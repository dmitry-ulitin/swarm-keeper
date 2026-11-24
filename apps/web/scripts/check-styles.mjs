// Checks the built global CSS: every Material color role comes from a token, fonts and icons
// are bundled, there are no third-party URLs and no colors outside the generated tokens.
// Run after `pnpm --filter @swarm-keeper/web build`: node apps/web/scripts/check-styles.mjs
import { readFileSync, readdirSync } from 'node:fs';

const web = new URL('..', import.meta.url);
const dist = new URL('dist/web/browser/', web);
const file = readdirSync(dist).find((f) => /^styles-.*\.css$/.test(f));
if (!file) {
  console.error('FAIL: no built styles; run the web build first');
  process.exit(1);
}
const css = readFileSync(new URL(file, dist), 'utf8');
const flat = css.replace(/\s+/g, '');
const tokens = readFileSync(new URL('../../libs/shared/design-tokens/src/tokens.css', web), 'utf8');
const roleSource = readFileSync(
  new URL('node_modules/@angular/material/core/tokens/m3/_md-sys-color.scss', web),
  'utf8',
);
const lightValues = roleSource.slice(roleSource.indexOf('@function md-sys-color-values-light'));
const roles = new Set(
  [...lightValues.slice(0, lightValues.indexOf('\n}')).matchAll(/^\s+([a-z-]+):/gm)].map(
    (m) => m[1],
  ),
);

let failed = false;
const check = (label, ok) => {
  console.log(`${ok ? 'ok' : 'FAIL'}: ${label}`);
  failed ||= !ok;
};

const last = new Map();
for (const m of css.matchAll(/--mat-sys-([a-z0-9-]+):([^;}]*)/g)) last.set(m[1], m[2].trim());
const notFromTokens = [...roles].filter((r) => !last.get(r)?.startsWith('var(--'));
check(
  `all ${roles.size} color roles end on a token (${notFromTokens.join(', ') || 'none left'})`,
  notFromTokens.length === 0,
);
check('primary from --brand', last.get('primary') === 'var(--brand)');
check(
  'tonal buttons from --brand-container',
  last.get('secondary-container') === 'var(--brand-container)',
);
check('small corner from --radius-sm', last.get('corner-small') === 'var(--radius-sm)');
check('large size mode', /\[data-size=(large|"large"|'large')\]/.test(flat));
// Compact density (-3) applies only outside large mode, so large mode keeps Material's default
// (0) heights: a density-0 theme emits no height tokens and could not undo a base -3.
const compactBlock =
  flat.match(/html:not\(\[data-size=(?:large|"large"|'large')\]\)\{([^}]*)\}/)?.[1] ?? '';
check(
  'compact density only outside large mode',
  /--mat-button-filled-container-height:28px/.test(compactBlock),
);
check(
  'no compact heights in the base theme',
  !/html\{[^}]*--mat-button-filled-container-height:28px/.test(flat),
);
for (const [role, token] of [
  ['corner-extra-large', 'var(--radius-lg)'],
  ['corner-extra-large-top', 'var(--radius-lg) var(--radius-lg) 0 0'],
  ['corner-large-top', 'var(--radius-lg) var(--radius-lg) 0 0'],
  ['corner-large-start', 'var(--radius-lg) 0 0 var(--radius-lg)'],
  ['corner-large-end', '0 var(--radius-lg) var(--radius-lg) 0'],
  ['corner-extra-small-top', 'var(--radius-xs) var(--radius-xs) 0 0'],
  ['label-large-size', 'var(--fa-fs-label)'],
  ['label-large-line-height', 'var(--fa-lh-label)'],
  ['body-medium-size', 'var(--fa-fs-body)'],
  ['body-large-size', 'var(--fa-fs-body)'],
  ['title-medium-size', 'var(--fa-fs-title)'],
]) {
  check(`${role} from ${token}`, last.get(role) === token);
}
check('Cyrillic Inter', /font-family:"?Inter"?[^}]*unicode-range:U\+0?301/.test(flat));
check('Material Symbols Rounded', flat.includes('MaterialSymbolsRounded'));
check('no external URLs', !/https?:\/\//.test(css));

// Hex colors may appear only in tokens, in Material's raw tone variables, or in role
// declarations that a token override replaces (checked above).
const hex = /#[0-9a-f]{3,8}\b/gi;
const rest = css
  .replace(/--mat-sys-(primary|secondary|tertiary|neutral|neutral-variant|error)[0-9]+:[^;}]*/g, '')
  .replace(/--mat-sys-([a-z-]+):[^;}]*/g, (decl, name) => (roles.has(name) ? '' : decl));
const built = rest.match(hex)?.length ?? 0;
const source = tokens.match(hex)?.length ?? 0;
check(`hex colors only from tokens (${built} in CSS, ${source} in tokens.css)`, built === source);

process.exit(failed ? 1 : 0);
