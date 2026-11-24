# Web foundations (step 5) design

November 24, 2026. Status: approved. Step 5 of `docs/superpowers/roadmaps/2026-11-23-better-auth-roadmap.md`. The rules come from `docs/architecture/frontend.md` ("Interface languages", "UI kit") and `docs/design/README.md` ("Size modes", "Mapping to Angular Material").

## Intent

The auth screens of step 6 need a web app that already speaks two languages, uses the design tokens and the Material theme, and switches between compact and large. Today `apps/web` is a bare scaffold and `libs/shared/design-tokens` is empty.

## Scope

**Goals:**
- Transloco with per-feature JSON, ICU plurals, `html[lang]`, and a missing-key check in `pnpm lint`.
- Style Dictionary generating CSS variables from `tokens.json`.
- Angular Material M3 themed through `--mat-sys-*` overrides.
- Compact and large modes through `html[data-size]`.
- Self-hosted fonts and icons.
- A dev-only showcase page where everything above can be checked by eye.

**Non-goals:**
- `GET /me`, `AuthService` and the real source of `locale` / `uiSize` (step 6).
- The PWA service worker.
- Real screens.
- Our own `libs/web/ui` components beyond what the showcase needs.
- A user setting for the theme.

**Anti-goals:**
- A raw color or pixel value outside the generated tokens.
- Material colors that drift from `tokens.json`.
- Any request to a third-party host (Google Fonts or a CDN).

## Approaches

| | Approach | Trade-off |
| --- | --- | --- |
| **A (chosen by the owner)** | Style Dictionary writes `tokens.css` with `light-dark()` colors. `mat.theme-overrides` points every `--mat-sys-*` at our variables, as in the README mapping table. The generated file is committed and checked by `pnpm lint` | Exact token values; dark theme for free; one more generated file |
| B | Generate SCSS palettes from `brand` and `accent` and let `mat.theme` derive the tones | Less code, but tones and contrasts drift from `tokens.json` |

## Decided by the owner

- What is visible at the end is a dev-only showcase page.
- Approach A.

## Design (builder's calls, open to correction)

### Tokens (`libs/shared/design-tokens`)

- A `build` script runs Style Dictionary 5 with a custom parser for our `tokens.json` shape (`{ tokens: [{ name, value }] }` groups, where a value may be `{ light, dark }`). Output is `src/tokens.css`, committed. A test fails if regenerating changes it.
- Colors and shadows become `--<name>: light-dark(<light>, <dark>)`. References such as `{brand}` resolve to `var(--brand)`.
- Spacing, radius and size tokens become plain variables, and so do the font families (`--font-sans`, `--font-mono`).
- Type styles become `--type-<name>-size`, `-line-height`, `-weight` and `-letter-spacing`.
- `color-scheme: light dark` sits on `:root`.

### Theme (`apps/web/src/styles.scss`)

- `mat.theme` with `theme-type: light dark`, Inter, density −3. `html[data-size='large']` sets density 0.
- `mat.theme-overrides` follows the README mapping table, values `var(--…)`.
- The `--fa-*` size variables from `docs/design/components/bundle.css` move into `libs/web/ui` styles. The `fa-` component classes do not.

### Fonts and icons

- `@fontsource/inter` (400/500/600, latin and cyrillic), `@fontsource/jetbrains-mono` (400) and `material-symbols` (Rounded), all bundled.
- `docs/design/README.md` stops pointing at Google Fonts.

### Language and size (`libs/web/core`)

- `AppearanceService` (root) holds `lang` and `uiSize` signals and reflects them onto `<html lang>` and `data-size`.
- Initial values: language from `navigator.languages` (`ru*` → `ru`, otherwise `en`), size `compact`. Step 6 will set both from `/me`.
- Transloco uses the `http` loader with lazy per-feature scopes from `i18n/<feature>/{en,ru}.json`, fallback `en`, and the messageformat transpiler. The active language follows `AppearanceService.lang`.
- Transloco's `missingHandler` logs in dev. `pnpm lint` runs `transloco-keys-manager find` and fails on a key missing from `en` or `ru`.

### Showcase

- Route `/dev/foundations`, registered only in dev builds.
- It holds a language switch, a compact/large switch, a light/dark/system switch (forces `color-scheme`, for checking only), and Material buttons (filled, tonal, outlined, text, danger), a form field, a checkbox and a menu.
- It also shows the type scale, color swatches, an ICU plural in both languages, and a date and a file size through `Intl`.
- Its texts live in `i18n/dev/{en,ru}.json`.

### Pins

- `@angular/material` and `@angular/cdk` 22.3.0 in the catalog.
- `@jsverse/transloco` 8.4.0, `@jsverse/transloco-messageformat` 8.4.0, `@jsverse/transloco-keys-manager` 8.1.1.
- `style-dictionary` 5.8.0, `@fontsource/inter` 5.3.0, `@fontsource/jetbrains-mono` 5.3.0, `material-symbols` 0.49.0.

## Tests

- **Tokens:** generated CSS matches a fresh build; `brand` is `light-dark(#2f5d8c, #8db8e8)`; `selection` is `var(--brand)`.
- **AppearanceService:** language from `navigator.languages`; `html[lang]` and `data-size` follow the signals.
- **Transloco:** a plural renders "Загружено 5 файлов" / "5 files uploaded".
- **Showcase:** renders without literal text in templates.
- **Missing keys:** the check in `pnpm lint` fails on a key added only to `en`.

## Left to the builder

- The exact Style Dictionary transforms.
- The showcase layout, within the token rules.
- Where `fileSize` lands (`libs/web/ui`, per `frontend.md`).
