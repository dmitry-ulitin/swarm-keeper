import StyleDictionary from 'style-dictionary';

/** Our tokens.json: groups of `{ name, value }`; a value may be `{ light, dark }`. */
interface Token {
  name: string;
  value: string | { light: string; dark: string };
}
interface TypeStyle {
  name: string;
  fontSize: string;
  lineHeight: string;
  fontWeight: number;
  letterSpacing?: string;
}
interface TokensFile {
  color: { tokens: Token[] };
  spacing: { tokens: Token[] };
  radius: { tokens: Token[] };
  size: { tokens: Token[] };
  shadow: { tokens: Token[] };
  type: { families: Record<string, string>; groups: { styles: TypeStyle[] }[] };
}

const HEADER = `/* Generated from docs/design/tokens.json by \`pnpm tokens:build\`. Do not edit. */\n`;

type Tree = Record<string, { $value: string }>;

function isThemed(value: Token['value']): value is { light: string; dark: string } {
  return typeof value === 'object' && value !== null;
}

/** A `light-dark()` pair, or the single value when both themes agree. */
function colorValue(value: Token['value']): string {
  if (!isThemed(value)) return value;
  return value.light === value.dark ? value.light : `light-dark(${value.light}, ${value.dark})`;
}

function tree(file: TokensFile): Tree {
  const out: Tree = {};
  const put = (name: string, value: string | number) => {
    out[name] = { $value: String(value) };
  };
  for (const t of file.color.tokens) put(t.name, colorValue(t.value));
  for (const group of [file.spacing, file.radius, file.size]) {
    for (const t of group.tokens) put(t.name, String(t.value));
  }
  // light-dark() takes colors only, so shadows get their light value here and dark blocks below.
  for (const t of file.shadow.tokens) put(t.name, isThemed(t.value) ? t.value.light : t.value);
  for (const [name, value] of Object.entries(file.type.families)) put(`font-${name}`, value);
  for (const style of file.type.groups.flatMap((g) => g.styles)) {
    put(`type-${style.name}-size`, style.fontSize);
    put(`type-${style.name}-line-height`, style.lineHeight);
    put(`type-${style.name}-weight`, style.fontWeight);
    if (style.letterSpacing) put(`type-${style.name}-letter-spacing`, style.letterSpacing);
  }
  return out;
}

function darkBlock(selector: string, file: TokensFile, indent: string): string {
  const lines = file.shadow.tokens
    .filter((t) => isThemed(t.value))
    .map((t) => `${indent}  --${t.name}: ${(t.value as { dark: string }).dark};`);
  return `${indent}${selector} {\n${lines.join('\n')}\n${indent}}\n`;
}

/** The CSS variables for every token; `{name}` references become `var(--name)`. */
export async function buildTokensCss(tokens: unknown): Promise<string> {
  const file = tokens as TokensFile;
  const sd = new StyleDictionary({
    tokens: tree(file),
    log: { verbosity: 'verbose', warnings: 'disabled', errors: { brokenReferences: 'throw' } },
    hooks: {
      transforms: {
        'name/as-is': { type: 'name', transform: (token) => token.path.join('-') },
      },
    },
    platforms: {
      css: {
        transforms: ['name/as-is'],
        files: [
          {
            destination: 'tokens.css',
            format: 'css/variables',
            options: { outputReferences: true, showFileHeader: false },
          },
        ],
      },
    },
  });
  const [result] = await sd.formatPlatform('css');
  const root = String(result?.output ?? '').replace(
    ':root {\n',
    ':root {\n  color-scheme: light dark;\n',
  );
  return (
    HEADER +
    root.trimEnd() +
    '\n\n' +
    '@media (prefers-color-scheme: dark) {\n' +
    darkBlock(":root:not([data-theme='light'])", file, '  ') +
    '}\n\n' +
    darkBlock(":root[data-theme='dark']", file, '')
  );
}
