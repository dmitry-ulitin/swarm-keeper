/** Light-theme values of `docs/design/tokens.json`; layout.spec.ts keeps them in sync. */
export const LAYOUT_COLORS = {
  'surface-100': '#f7f4ef',
  'surface-000': '#ffffff',
  ink: '#1f1b16',
  'ink-muted': '#5c544a',
  brand: '#2f5d8c',
  'on-brand': '#ffffff',
  border: '#d6cec2',
} as const;

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
}

/** Plain text only: renderLayout escapes every field itself. */
export interface LayoutInput {
  lang: string;
  heading: string;
  paragraphs: string[];
  action: { label: string; url: string };
  notes: string[];
  footer: string;
}

const c = LAYOUT_COLORS;
// Spacing and radius from tokens.json: space-4 16px, space-6 24px, radius-sm 6px.
const FONT = 'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;';

/** A simple, table-based email that renders in every mail client; styles are inline. */
export function renderLayout(input: LayoutInput): string {
  const e = escapeHtml;
  const paragraphs = input.paragraphs
    .map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:22px;">${e(p)}</p>`)
    .join('');
  const notes = input.notes
    .map(
      (n) =>
        `<p style="margin:0 0 8px;font-size:13px;line-height:18px;color:${c['ink-muted']};">${e(n)}</p>`,
    )
    .join('');
  return `<!doctype html>
<html lang="${e(input.lang)}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(input.heading)}</title></head>
<body style="margin:0;padding:0;background:${c['surface-100']};color:${c.ink};${FONT}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${c['surface-100']};">
<tr><td align="center" style="padding:24px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${c['surface-000']};border:1px solid ${c.border};border-radius:6px;">
<tr><td style="padding:24px;">
<p style="margin:0 0 16px;font-size:13px;font-weight:600;color:${c['ink-muted']};">Swarm Keeper</p>
<h1 style="margin:0 0 16px;font-size:18px;line-height:24px;font-weight:600;">${e(input.heading)}</h1>
${paragraphs}
<p style="margin:24px 0;"><a href="${e(input.action.url)}" style="display:inline-block;padding:12px 20px;background:${c.brand};color:${c['on-brand']};border-radius:6px;font-size:15px;font-weight:600;text-decoration:none;">${e(input.action.label)}</a></p>
${notes}
</td></tr>
</table>
<p style="margin:16px 0 0;font-size:12px;color:${c['ink-muted']};">${e(input.footer)}</p>
</td></tr>
</table>
</body>
</html>
`;
}
