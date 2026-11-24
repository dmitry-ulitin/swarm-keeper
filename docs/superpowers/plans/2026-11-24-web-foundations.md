# Web foundations (step 5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The web app speaks en/ru through Transloco, is styled only by tokens generated from `docs/design/tokens.json`, themes Angular Material through `--mat-sys-*`, switches compact/large and light/dark, and shows all of it on a dev-only page `/dev/foundations`.

**Architecture:**
- **`libs/shared/design-tokens`:** a Style Dictionary generator under `build/` writes the committed `src/tokens.css`.
- **`apps/web`:** `styles.scss` holds the Material theme and the overrides; fonts and icons are bundled through `angular.json` `styles`.
- **`libs/web/core`:** `AppearanceService` (`lang`, `uiSize`) plus `provideI18n()`, which sets up Transloco.
- **`libs/web/ui`:** the `--fa-*` size variables and the `fileSize` pipe.
- **Showcase:** lives in `apps/web/src/app/dev/`, behind `isDevMode()`.

**Tech Stack:**
- Angular 22.3, Angular Material and CDK 22.3.0.
- Transloco: `@jsverse/transloco` 8.4.0, `@jsverse/transloco-messageformat` 8.4.0, `@jsverse/transloco-keys-manager` 8.1.1.
- `style-dictionary` 5.8.0.
- Fonts and icons: `@fontsource/inter` 5.3.0, `@fontsource/jetbrains-mono` 5.3.0, `material-symbols` 0.49.0.
- Vitest 5 (through `ng test` for Angular code; plain Vitest for the token generator).

**Spec:** `docs/superpowers/specs/2026-11-24-web-foundations-design.md`

## Global Constraints

- **Versions:** pinned exactly; shared Angular packages (`@angular/material`, `@angular/cdk`) go in the `catalog:` of `pnpm-workspace.yaml`.
- **Styling:** no raw colors or px outside `libs/shared/design-tokens/src/tokens.css`. The theme, `--fa-*` and the showcase use `var(--…)` only.
- **No third-party requests:** fonts and icons are bundled, and no `https://` URL appears in built CSS.
- **Languages:** `en`, `ru`; fallback and default `en`; a browser language starting with `ru` → `ru`.
- **Sizes:** `compact` (default), `large` → `html[data-size="large"]`; compact sets no attribute.
- **Material density:** −3 in compact, 0 in large. Typography `plain-family` / `brand-family` is `Inter`.
- **Templates contain no literal text.** Keys per feature; translations in `i18n/<scope>/{en,ru}.json`, served at `/i18n/<scope>/<lang>.json`.
- Standalone components, OnPush, zoneless (already the app default), signals for state.
- Conventional Commits with the Claude co-author line. Sheriff: `web:core` may use only `web:api-client` and shared libraries; `web:ui` only shared libraries.

## Review Focus

1. **Browser language:** `['ru-RU']`, `['uk', 'ru']`, `['de']`, `[]` must resolve to `ru`, `en`, `en`, `en`. Only the first preferred language counts; the user switches explicitly. Test in Task 3.
2. **Switching language mid-session:** already-rendered text and `<html lang>` change without a reload. Test in Task 3.
3. **A token referencing a missing token** (`{nope}`): the build must fail loudly rather than emit `var(--nope)`. Test in Task 1.
4. **No token silently dropped:** every name in `tokens.json` (colors, spacing, radius, size, shadow, type styles, families) appears in `tokens.css`. Test in Task 1.
5. **Production build:** must not register `/dev/foundations`. Test in Task 4, on the route function with `dev = false`.

---

### Task 1: Generated design tokens

**Files:**
- Create: `libs/shared/design-tokens/build/tokens-css.ts`, `build/tokens-css.spec.ts`, `build/generate.ts`, `vitest.config.ts`, `src/tokens.css` (generated)
- Modify: `libs/shared/design-tokens/package.json` (`style-dictionary` 5.8.0 devDependency, `vitest` catalog; scripts `build`, `test`), `tsconfig.json` (include `build/**/*.ts`), `README.md`, root `package.json` (script `tokens:build`), `CLAUDE.md` (commands block: `pnpm tokens:build` after editing `tokens.json`)

**Interfaces:**
- Produces:
  - `buildTokensCss(tokens: unknown): Promise<string>`, exported from `build/tokens-css.ts`. It returns the full CSS text.
  - `build/generate.ts` reads `docs/design/tokens.json` and writes `src/tokens.css`. Run with `node build/generate.ts`.
  - Package script `build` runs it; root `pnpm tokens:build` → `pnpm --filter @swarm-keeper/design-tokens build`.
- CSS variable names (consumed by Tasks 2–4):
  - `--<color name>`, e.g. `--brand`, `--surface-100`.
  - `--<spacing|radius|size|shadow name>`, e.g. `--space-4`, `--radius-sm`, `--control-height-large`, `--shadow-md`.
  - `--font-sans`, `--font-mono`.
  - `--type-<style>-size`, `--type-<style>-line-height`, `--type-<style>-weight`, `--type-<style>-letter-spacing` (only when set), for every style in every `type.groups` entry (e.g. `--type-body-size`, `--type-large-body-size`, `--type-code-size`).
- File shape:
  - A header comment saying it is generated from `docs/design/tokens.json` and must not be edited.
  - Then one `:root { color-scheme: light dark; … }` block.
  - `{ light, dark }` values become `light-dark(<light>, <dark>)`.
  - A value `{name}` (whole or as a side of light/dark) becomes `var(--name)`.

- [ ] **Step 1: Failing tests** `tokens-css.spec.ts` (reads the real `docs/design/tokens.json`):
  - The output contains `--brand: light-dark(#2f5d8c, #8db8e8);`, `--selection: var(--brand);`, `--space-4: 16px;`, `--radius-full: 9999px;`, `--type-body-size: 13px;`, `--type-large-body-size: 17px;`, `--type-display-letter-spacing: -0.01em;`, a line starting `--font-sans: Inter,`, and `color-scheme: light dark`.
  - **Shadows:** CSS `light-dark()` accepts only colors, so shadows can't use it.
    - The `:root` block has `--shadow-md: 0 4px 12px rgba(31, 27, 22, 0.12), 0 1px 3px rgba(31, 27, 22, 0.08);`.
    - The block `@media (prefers-color-scheme: dark) { :root:not([data-theme='light']) { … } }` and the block `:root[data-theme='dark'] { … }` both have `--shadow-md: 0 4px 12px rgba(0, 0, 0, 0.55), 0 1px 3px rgba(0, 0, 0, 0.4);`.
  - **Every token is present:** for every `name` under `color`, `spacing`, `radius`, `size` and `shadow`, the CSS contains `--<name>:`. For every type style, it contains `--type-<style>-size:`.
  - **Missing reference:** `buildTokensCss` on a copy whose `selection` is `{ light: '{nope}', dark: '{nope}' }` rejects with `/nope/`.
  - **Freshness:** `readFileSync('src/tokens.css')` equals `await buildTokensCss(real tokens)`.
- [ ] **Step 2:** Run `pnpm --filter @swarm-keeper/design-tokens test`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement `buildTokensCss`.**
  - Convert our groups to a Style Dictionary token tree. Run it through the Style Dictionary 5 API (`new StyleDictionary({ tokens, platforms: { css: … } })`, `formatPlatform`) with a custom format that emits the blocks above, without writing to disk.
  - Theme-dependent non-color values (the shadows) go into the two dark blocks. The showcase theme switch (Task 4) sets `data-theme` and `style.colorScheme` together.
  - `generate.ts` writes the file. Run `pnpm tokens:build`.
- [ ] **Step 4:** Run the tests. Expected: PASS. Then `pnpm lint && pnpm typecheck`. Expected: exit 0.
- [ ] **Step 5: Commit** `feat(design-tokens): generate CSS variables from tokens.json`.

### Task 2: Material theme, fonts, icons and size variables

**Files:**
- Create: `libs/web/ui/src/styles/size-modes.css`
- Modify:
  - `pnpm-workspace.yaml` (catalog `@angular/material`, `@angular/cdk` 22.3.0)
  - `apps/web/package.json` (`@angular/material`, `@angular/cdk`, `@fontsource/inter` 5.3.0, `@fontsource/jetbrains-mono` 5.3.0, `material-symbols` 0.49.0)
  - `apps/web/angular.json` (`styles`, in this order):
    1. `../../libs/shared/design-tokens/src/tokens.css`
    2. the font CSS for `@fontsource/inter`: `latin-400.css`, `latin-500.css`, `latin-600.css`, `cyrillic-400.css`, `cyrillic-500.css`, `cyrillic-600.css`
    3. `@fontsource/jetbrains-mono/latin-400.css`
    4. `material-symbols/rounded.css`
    5. `../../libs/web/ui/src/styles/size-modes.css`
    6. `src/styles.scss`
  - `apps/web/src/styles.scss`
  - `docs/design/README.md` ("Typography": self-hosted through `@fontsource`, not Google Fonts; "Icons": `material-symbols` package)

**Interfaces:**
- Consumes: the variables from Task 1.
- Produces:
  - `--fa-control-h`, `--fa-row-h`, `--fa-icon`, `--fa-tile`, `--fa-pad-x`, `--fa-gap`.
  - `--fa-fs-title|body|label|caption` and `--fa-lh-*`, with values `var(--type-…)`.
  - `--fa-avatar`. Its 24px and 36px aren't tokens, so it is omitted until a component needs it. Record that as a ruling.
  - All of these sit on `:root` and `[data-size="large"]`, with the same names as `docs/design/components/bundle.css`.

- [ ] **Step 1: Write the expected checks as a script** `apps/web/scripts/check-styles.sh`. It runs against `dist/web/browser/styles-*.css` after `pnpm --filter @swarm-keeper/web build` and fails unless every check holds:
  - the CSS contains `--mat-sys-primary:var(--brand)` (spaces stripped);
  - `--mat-sys-surface:var(--surface-100)`;
  - `--mat-sys-corner-small:var(--radius-sm)`;
  - `[data-size=large]` (any quoting);
  - `unicode-range` with `U+0400` (Cyrillic Inter);
  - `Material Symbols Rounded`;
  - no `https://` and no `http://`;
  - no `#rrggbb` outside the tokens block. Check it this way: count the hex colors in the built CSS and compare with the count in `tokens.css`, which must be equal.
- [ ] **Step 2:** Run it. Expected: FAIL (no theme yet).
- [ ] **Step 3: Implement.**
  - `styles.scss`: `html { @include mat.theme((color: (theme-type: light dark), typography: (plain-family: Inter, brand-family: Inter), density: -3)); @include mat.theme-overrides((…)); }`. The overrides follow every row of the README table "Mapping to Angular Material", with values `var(--…)`. Then `html[data-size='large'] { @include mat.theme((density: 0)); }`.
  - Also in `styles.scss`: `body` gets `margin: 0`, `background: var(--surface-100)`, `color: var(--ink)`, `font: var(--fa-fs-body)/var(--fa-lh-body) var(--font-sans)`.
  - `size-modes.css` gets the `--fa-*` variables.
  - Check the exact `theme-overrides` key names against the installed `@angular/material` 22.3.0 (`_m3-system` / `theme-overrides` docs).
- [ ] **Step 4:** Run `pnpm --filter @swarm-keeper/web build && sh apps/web/scripts/check-styles.sh`. Expected: PASS. Then `pnpm lint && pnpm typecheck && pnpm test`. Expected: exit 0. If the initial budget warns, raise it only for styles and record a ruling.
- [ ] **Step 5: Commit** `feat(web): theme Material from design tokens with self-hosted fonts`.

### Task 3: Language and size: `AppearanceService` and Transloco

**Files:**
- Create:
  - `libs/web/core/src/appearance.service.ts` and `appearance.service.spec.ts`
  - `libs/web/core/src/i18n.ts` (`provideI18n`, `HttpTranslocoLoader`) and `i18n.spec.ts`
  - `apps/web/src/i18n/en.json`, `ru.json` (root, `{}`)
- Modify:
  - `libs/web/core/package.json` (peer and dev `@angular/common`, `@jsverse/transloco`, `@jsverse/transloco-messageformat`)
  - `libs/web/core/src/provide-web-core.ts`, `index.ts`
  - `apps/web/package.json` (Transloco deps)
  - `apps/web/angular.json`:
    - assets `{ "glob": "**/*.json", "input": "src/i18n", "output": "i18n" }`;
    - test `options.include: ["src/**/*.spec.ts", "../../libs/web/**/src/**/*.spec.ts"]`, so `ng test` runs the libraries' specs. If the builder rejects paths outside the project, rule on it and move the specs under `apps/web/src`.

**Interfaces:**
- `type Lang = 'en' | 'ru'`; `type UiSize = 'compact' | 'large'`.
- `browserLang(languages: readonly string[]): Lang` (exported, pure): the first entry only; `ru` or `ru-*` → `ru`, otherwise `en`.
- `@Injectable({ providedIn: 'root' }) class AppearanceService`:
  - `readonly lang: Signal<Lang>`, starting at `browserLang(navigator.languages ?? [])`;
  - `readonly uiSize: Signal<UiSize>`, starting at `'compact'`;
  - `setLang(lang: Lang): void`, `setUiSize(size: UiSize): void`;
  - an `effect` that sets `document.documentElement.lang` and sets or removes `data-size="large"`, using `inject(DOCUMENT)`.
- `provideI18n(): EnvironmentProviders`:
  - `provideTransloco({ config: { availableLangs: ['en', 'ru'], defaultLang: 'en', fallbackLang: 'en', reRenderOnLangChange: true, prodMode: !isDevMode(), missingHandler: { logMissingKey: isDevMode() } }, loader: HttpTranslocoLoader })`;
  - `provideTranslocoMessageformat()`;
  - an environment initializer whose `effect` calls `TranslocoService.setActiveLang(appearance.lang())`.
- `HttpTranslocoLoader.getTranslation(path: string)` → `HttpClient.get('/i18n/' + path + '.json')`. A scope path arrives as `dev/en`.
- `provideWebCore()` now returns `provideHttpClient()` plus `provideI18n()`.

- [ ] **Step 1: Failing tests** `appearance.service.spec.ts`:
  - `browserLang` table: `['ru-RU']`→ru, `['ru']`→ru, `['RU']`→ru, `['uk','ru']`→en, `['de']`→en, `[]`→en.
  - `setLang('ru')` then `TestBed.tick()` → `document.documentElement.lang === 'ru'`.
  - `setUiSize('large')` → `data-size` attribute is `large`; `setUiSize('compact')` → no `data-size` attribute.
- [ ] **Step 2: Failing tests** `i18n.spec.ts`:
  - TestBed with `provideI18n()` and Transloco's testing loader in place of HTTP (`TranslocoTestingModule`, or override the loader with inline `{ en: { files: '{count, plural, one {# file uploaded} other {# files uploaded}}' }, ru: { files: '{count, plural, one {Загружен # файл} few {Загружено # файла} many {Загружено # файлов} other {Загружено # файла}}' } }`).
  - A test component renders `{{ 'files' | transloco: { count: 5 } }}`. Expect `5 files uploaded`.
  - After `AppearanceService.setLang('ru')` and a tick, the same element reads `Загружено 5 файлов` without re-creating the component.
  - With count 1 in ru, it reads `Загружен 1 файл`.
  - `HttpTranslocoLoader` requests `/i18n/dev/ru.json` for path `dev/ru` (`HttpTestingController`).
- [ ] **Step 3:** Run `pnpm --filter @swarm-keeper/web test`. Expected: the new specs FAIL (missing modules). If they don't run at all, fix `include` first.
- [ ] **Step 4:** Implement and install the deps (exact versions). Check the peer dependencies of Transloco 8.4 against Angular 22.3 when installing.
- [ ] **Step 5:** Run the web tests. Expected: PASS. Then `pnpm lint && pnpm typecheck && pnpm test`. Expected: exit 0, and the existing `App` spec still passes.
- [ ] **Step 6: Commit** `feat(web-core): add AppearanceService and Transloco with ICU plurals`.

### Task 4: `fileSize` pipe, the showcase and the missing-key check

**Files:**
- Create:
  - `libs/web/ui/src/file-size.pipe.ts` and `file-size.pipe.spec.ts`
  - `apps/web/src/app/dev/foundations.ts`, `foundations.html`, `foundations.scss`, `foundations.spec.ts`
  - `apps/web/src/i18n/dev/en.json`, `ru.json`
  - `apps/web/transloco.config.ts` (for keys-manager)
  - `tools/i18n-check/check.ts` and `check.spec.ts` (in the `tools/boundaries`-style package, or `tools/i18n-check` with its own `package.json` and vitest)
- Modify:
  - `libs/web/ui/src/index.ts`
  - `apps/web/src/app/app.routes.ts`
  - `apps/web/src/app/app.config.ts` (if the routes become a function)
  - root `package.json`: `lint` becomes `eslint . && pnpm i18n:check`; `i18n:check` runs the parity script and then `transloco-keys-manager find` with the config
  - `docs/architecture/frontend.md` (where translation files live, `/dev/foundations`, how the check runs)
  - roadmap (step 5 done)
  - `CLAUDE.md` (Commands: `pnpm i18n:check` runs inside `pnpm lint`)

**Interfaces:**
- **`formatFileSize`:** `formatFileSize(bytes: number, locale: string): string`. Decimal units (1000): byte, kilobyte, megabyte, gigabyte, terabyte, through `Intl.NumberFormat(locale, { style: 'unit', unit, unitDisplay: 'short', maximumFractionDigits: 1 })`.
- **`FileSizePipe`:** `@Pipe({ name: 'fileSize' }) class FileSizePipe` with `transform(bytes: number, locale: string): string`. It is pure; the locale is passed explicitly.
- **`appRoutes`:** `appRoutes(dev: boolean): Routes` in `app.routes.ts`. With `dev` it includes `{ path: 'dev/foundations', loadComponent: () => import('./dev/foundations').then(m => m.Foundations), providers: [provideTranslocoScope('dev')] }`. `routes = appRoutes(isDevMode())`.
- **`Foundations` component**, selector `sk-dev-foundations`, OnPush. All its text comes from the `dev.*` keys. It holds:
  - toggles for the language (`AppearanceService.setLang`), the size (`setUiSize`) and the theme (`system | light | dark`; it sets `documentElement.style.colorScheme` and `data-theme`, both cleared for `system`);
  - Material filled, tonal, outlined and text buttons, plus a danger filled button;
  - a form field, a checkbox and a menu;
  - type-scale samples using `--type-*` vars;
  - swatches for `brand`, `accent`, `success`, `warning` and `danger`;
  - the `dev.files` plural for 1, 3 and 5;
  - a date with `Intl.DateTimeFormat(lang, { dateStyle: 'long' })` for 2025-07-12;
  - `3400000 | fileSize: lang()`.
- **`checkI18nParity`:** `checkI18nParity(root: string): string[]` (`tools/i18n-check`). For every folder under `root` that holds `en.json`, it compares the flattened key sets of `en.json` and `ru.json` and returns messages like `dev: "title" missing in ru`. The CLI exits 1 on any message. Roots: `apps/web/src/i18n`, plus `libs/web/features/*/src/i18n` once they exist.

- [ ] **Step 1: Failing tests** `file-size.pipe.spec.ts`. Expected values are computed with the same `Intl.NumberFormat` options, so the tests don't depend on ICU data quirks:
  - `formatFileSize(3_400_000, 'en') === '3.4 MB'`;
  - `formatFileSize(3_400_000, 'ru')` equals `Intl` for (`ru`, `megabyte`, 3.4), which reads «3,4 МБ»;
  - `formatFileSize(512, 'en')` equals `Intl` for (`en`, `byte`, 512);
  - `formatFileSize(0, 'en')` equals `Intl` for (`en`, `byte`, 0);
  - `formatFileSize(999_999, 'en') === '1 MB'`: the value goes up a unit when the rounded value reaches 1000.
- [ ] **Step 2: Failing tests** `foundations.spec.ts`:
  - `appRoutes(false)` has no path `dev/foundations`; `appRoutes(true)` has it.
  - With a testing loader holding the real `apps/web/src/i18n/dev/{en,ru}.json`, the component renders the en title. After `setLang('ru')` it renders the ru title.
  - The template source (`foundations.html`, read as text) has no text nodes outside `{{ }}`. Check this by stripping tags, interpolations and whitespace, then expect an empty string.
  - Clicking the large toggle sets `data-size="large"` on `<html>`.
- [ ] **Step 3: Failing tests** `check.spec.ts` against temporary folders:
  - equal keys → `[]`;
  - a nested key only in `en` → one message naming the folder and the key in `ru`;
  - a key only in `ru` → a message for `en`;
  - a folder without `ru.json` → a message.
- [ ] **Step 4:** Run `pnpm --filter @swarm-keeper/web test` and the i18n-check tests. Expected: FAIL.
- [ ] **Step 5: Implement** the pipe, the routes, the showcase, the translations (en and ru, glossary tone, no exclamation marks), the parity script, and the keys-manager config (`rootTranslationsPath: 'src/i18n/'`, `langs: ['en','ru']`, `scopePathMap: { dev: 'src/i18n/dev' }`).
- [ ] **Step 6:** Run the tests. Expected: PASS.
- [ ] **Step 7: Prove the check bites.** Add `"probe": "x"` to `apps/web/src/i18n/dev/en.json` only, run `pnpm i18n:check`, and expect exit 1 with `probe`. Then use a `t('dev.unknown')` key in the template without adding it to the JSON, run `pnpm i18n:check`, and expect exit 1. If keys-manager `find` exits 0 on missing keys, add `--emit-error-on-extra-keys` or parse its output and fail, and record a ruling. Revert both probes.
- [ ] **Step 8:** Run `pnpm lint && pnpm typecheck && pnpm test && pnpm --filter @swarm-keeper/web build && sh apps/web/scripts/check-styles.sh`. Expected: exit 0.
- [ ] **Step 9: Look at it by eye.** Run `pnpm --filter @swarm-keeper/web start` and open http://localhost:4200/dev/foundations. Check en/ru, compact/large and light/dark. Then update the docs.
- [ ] **Step 10: Commit** `feat(web): add the foundations showcase and the missing-key check` (code), then `docs: describe web foundations` (docs).
