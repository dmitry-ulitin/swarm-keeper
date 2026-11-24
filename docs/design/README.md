# Swarm Keeper — design system

The design system for **Swarm Keeper**, a family archive for photos and documents: an Angular + Angular Material web app and a separate native app. It defines tokens on top of the Material M3 theme and describes the components Material doesn't have: photo tiles, the upload queue, document cards, people and roles. The interface is compact by default; each member can switch on large mode for themselves.

Source of truth for the visual version: [Swarm Keeper design system artifact](https://claude.ai/artifact/UaiwvaKVutVoB6yqNNbWp5). This folder is the copy the code works from.

## How to use it

- **Tokens** — [`tokens.json`](tokens.json) (light and dark colors, typography, spacing, radii, sizes, shadows). It is the only source of values: code refers to tokens, never to raw colors or pixels.
- **Component styles** — [`components/bundle.css`](components/bundle.css), classes prefixed `fa-`. It is the reference for the previews and a model for the Angular components in `libs/web/ui`; Material components are styled through theme tokens, not `::ng-deep`. The `preview.html` files are reference markup and expect the CSS variables generated from `tokens.json`.
- **Size mode** — the `data-size="large"` attribute on `<html>`; without it, compact mode applies (see "Size modes").
- **The product name is Swarm Keeper** — always two words, both capitalized, never translated. In Russian UI text the descriptive "семейный архив" is fine. **Logo** — the "Swarm family" mark with the name next to it (see "Logo").

## Principles

1. **Photos come first.** The interface is calm and warm, on a `surface-100` background, so photos don't compete with buttons. `brand` is only for actions and selection.
2. **Dense but readable.** Compact mode by default: more photos per screen, less scrolling. Large mode is the same interface at a larger scale, not a simplified version.
3. **Nothing gets lost.** Deleting goes to the trash with an undo; irreversible actions look different (`danger`) and require confirmation.
4. **Clear to every age.** Plain words, statuses with words rather than color alone, visible focus, AA contrast in both themes.

## Interface language

The interface ships in two languages — **English and Russian**; each member picks theirs. Every string is written in both languages at once; keys and the fallback language are English. The tone is the same in both: short, plain words, no technical terms, no exclamation marks. In Russian, system messages use the formal «вы»; in English, sentence case ("Upload photos", not "Upload Photos").

**String length.** Russian text is usually 20–30% longer than English. Buttons, tabs, badges and columns have no fixed widths; mockups and previews are checked in both languages. If a Russian label doesn't fit, shorten the wording in both languages rather than the font.

| Do | Don't |
| --- | --- |
| Upload photos | Execute media file upload |
| 3 photos moved to trash · Undo | Operation completed successfully! |
| Already in the archive | Error: hash duplicate |
| No connection to the server. Retry | Error 503 |
| Grandma Valya | Valentina S. (person #42) |

**Glossary.** The same words on every screen, in emails and in the native app — in both languages.

| English | Russian | Meaning |
| --- | --- | --- |
| Family | Семья | A Better Auth organization: a shared archive and its members. |
| Member | Участник | A person with an account in the family. |
| Owner · Admin · Member · Viewer | Владелец · Админ · Участник · Просмотр | Member roles. |
| Person | Человек | `person` — a family member in the archive; may have no account. |
| Timeline | Лента | All of the family's photos and videos by date. |
| Album | Альбом | A hand-picked collection of photos. |
| Document | Документ | A scan or file with metadata: type, people, expiry date. |
| Trash | Корзина | Deleted items; kept for 30 days, then deleted forever. |
| Favorites | Избранное | A member's personal picks: each member has their own. |
| Invitation | Приглашение | An email with a link to join the family. |
| Interface size: Compact · Large | Размер интерфейса: компактный · крупный | The size mode in settings. |

Dates, numbers and sizes are formatted by the user's language through `Intl`, never by hand: "July 12, 2025", "1,284 photos", "3.4 MB" — «12 июля 2025», «1 284 фото», «3,4 МБ». Plurals use ICU plural rules (Russian has three forms: «1 фото», «3 дубликата», «5 дубликатов»).

## Color

The palette is warm and "papery": background `surface-100`, cards `surface-000`, text `ink` and `ink-muted`. One brand color — a calm navy `brand` — and a warm amber `accent` for favorites and memories: navy handles actions and selection, amber adds warmth. The dark theme uses the same roles with the same names; the first (light) theme is the fallback.

- **Actions and selection** — `brand` with `on-brand` text; tonal elements — `brand-container` / `on-brand-container`. Links and text buttons — `brand` on `surface-000` and `surface-100`.
- **Statuses** always come as a "container + text" pair: `success-container` / `on-success-container`, `warning-container` / `on-warning-container`, `danger-container` / `on-danger-container`. The `danger` / `on-danger` fill is only for the button of an irreversible action.
- **`accent`** fills icons (the "favorite" star), never small text: on white its contrast is about 3.6:1.
- **The photo viewer** is always dark: `viewer-bg` and `on-viewer` in both themes.
- **Borders:** dividers and cards — `border`; controls — `border-strong` (3:1 against the background in both themes).
- Colors that must be told apart also differ in saturation or by a word: roles by decreasing fill weight, statuses by a label.

## Typography

One typeface — **Inter** (weights 400/500/600, with Cyrillic) for the whole interface; **JetBrains Mono** only for hashes and recovery codes (the `code` style). Compact-mode scale: `display` 24, `title-lg` 18, `title` 15, `body` 13, `body-strong` 13/600, `label` 12/500, `caption` 11. In large mode these map to the `large-` styles (32, 24, 19, 17, 17, 16, 15).

Fonts are bundled with the app (`@fontsource/inter`, `@fontsource/jetbrains-mono`), never loaded from Google Fonts or another CDN: a family archive makes no requests to third parties.

- `caption` is only for metadata (date, size, duration) and only in `ink-muted` or darker.
- Headings use sentence case: "Family documents", not "Family Documents".
- Numbers in tables and counters use `font-variant-numeric: tabular-nums`.

## Size modes

Interface size is a personal member setting ("Settings → Appearance"). It is stored in the profile, returned by `GET /me` as `uiSize`, and applies both on the web and in the native app. Compact is the default; an admin can pick large when inviting someone.

| | Compact (default) | Large |
| --- | --- | --- |
| Controls | `control-height` 28px | `control-height-large` 44px |
| List row | `row-height` 32px | `row-height-large` 52px |
| Icons | `icon-size` 18px | `icon-size-large` 24px |
| Timeline tile row | `tile-size` 120px | `tile-size-large` 180px |
| Body text | `body` 13/18 | `large-body` 17/24 |
| Buttons, menus | `label` 12/16 | `large-label` 16/22 |
| Metadata | `caption` 11/14 | `large-caption` 15/20 |
| Horizontal padding of buttons and rows | `space-3` | `space-5` |
| Material density | -3 | 0 |

**What doesn't change:** colors, radii, spacing between page blocks, the set of screens.

**In any mode:** on touch screens (`pointer: coarse`) the hit area is at least `hit-target-touch` (40px) — the compact look stays and the invisible touch area grows. Browser zoom and the system font size work on top of the mode; layouts hold up to 200% zoom.

**In Angular** the mode is two Material themes on the same `<html>`:

```scss
@use '@angular/material' as mat;

html {
  @include mat.theme((
    color: (theme-type: color-scheme),
    typography: (plain-family: 'Inter', brand-family: 'Inter'),
    density: -3,
  ));
}

html[data-size='large'] {
  @include mat.theme((density: 0));
  @include mat.theme-overrides($overrides); // mat.theme re-emits the shape tokens
  font-size: 17px;
}
```

Our own components read the same CSS variables as `bundle.css` (`--fa-control-h`, `--fa-row-h`, `--fa-fs-body`…), so they switch together with Material.

**In the native app** `uiSize` selects one of two size scales from the same tokens; the system font size (Dynamic Type, Font scale) applies on top.

## Spacing, radii, shadows

- **Spacing** — a 4px scale: `space-1` 4 … `space-12` 48; `space-0` (2px) is only the gap between photo tiles. Pages and panels use `space-4`, sections `space-6`.
- **Radii:** tiles and badges `radius-xs`, buttons and inputs `radius-sm`, cards and menus `radius-md`, dialogs `radius-lg`, avatars and chips `radius-full`. Corners are small: the interface is closer to a photo album than to a toy.
- **Shadows** only for what floats above the page: menus `shadow-md`, toasts and dialogs `shadow-lg`. Cards on the page get a `border` and no shadow.

## Logo

The "Swarm family" mark: six dots of different sizes around an amber center. The dots are family members, the center is the shared archive they keep together; the varied sizes make the swarm feel alive rather than geometric. Files are in [`logo/`](logo/).

| File | Where |
| --- | --- |
| `swarm-keeper-mark.svg` | Main mark on light backgrounds (`surface-000`, `surface-100`): `brand` dots, `accent` center. |
| `swarm-keeper-mark-dark.svg` | On dark backgrounds: dark-theme `brand` dots and `accent` center. |
| `swarm-keeper-mark-small.svg` | 16–24 px: favicon, browser tab, tight spots. Equal, larger dots so they don't merge. |
| `swarm-keeper-mark-mono.svg` | Single-color print and embossing; `ink` color. |
| `swarm-keeper-app-icon.svg` | App icon (iOS, Android, PWA): the mark on a `brand` fill, `surface-100` dots, dark-theme `accent` center. |

**Lockup:** mark on the left, the name "Swarm Keeper" on the right, Inter 600, `ink` color; the mark is 1.6× the cap height, the gap is 0.3× the mark height. In the app header — a 24 px mark and the name in the `title` style.

**Don't:** swap the dot and center colors, equalize the dot sizes in the main mark (only the small version does that), add outlines, place it on photos without a backing, or use the mark smaller than 16 px.

## Icons

Material Symbols Rounded (outline, weight 400, no fill) via `mat-icon` with `fontSet`, bundled from the `material-symbols` package (no CDN). Size — `icon-size` or `icon-size-large` depending on the mode; color inherits from text. Icon buttons always have an `aria-label`. Fill is allowed only for "favorite" (the `accent` star) and the selection check mark. The previews draw icons as simplified strokes in the same style.

## Accessibility

- Text is at least 4.5:1 against its background in both themes; large text, icons and control borders at least 3:1. Each text token's note says which backgrounds it is readable on.
- Keyboard focus is always visible: `focus-ring`, `focus-ring-width` thick, 2px offset.
- State is never conveyed by color alone: statuses have a word, selection has a check mark, roles have a label.
- Animations are short (up to 200 ms) and turn off with `prefers-reduced-motion`.
- The gallery is fully keyboard-operable: arrows move between tiles, Enter opens, Space selects.

## Mapping to Angular Material

The tokens are fed into the M3 system variables (`--mat-sys-*`) via `mat.theme-overrides` (`apps/web/src/styles.scss`). Every M3 color role is overridden, not only the rows below: the `secondary` family maps to `brand` / `brand-container` (M3 tonal buttons use `secondary-container`), the `*-fixed` roles to the matching containers, and the remaining surfaces to the nearest `surface-*`. `apps/web/scripts/check-styles.mjs` fails the build check if a role is left on Material's palette:

| Material | Token |
| --- | --- |
| `primary` / `on-primary` | `brand` / `on-brand` |
| `primary-container` / `on-primary-container` | `brand-container` / `on-brand-container` |
| `tertiary` / `tertiary-container` | `accent` / `accent-container` |
| `surface` | `surface-100` |
| `surface-container-lowest` · `surface-container` · `surface-container-highest` | `surface-000` · `surface-200` · `surface-300` |
| `on-surface` / `on-surface-variant` | `ink` / `ink-muted` |
| `outline` / `outline-variant` | `border-strong` / `border` |
| `error` / `on-error` · `error-container` / `on-error-container` | `danger` / `on-danger` · `danger-container` / `on-danger-container` |
| `inverse-surface` / `inverse-on-surface` / `inverse-primary` | `ink` / `surface-100` / `brand-inverse` |
| `corner-extra-small` · `small` · `medium` · `large` · `full` | `radius-xs` · `radius-sm` · `radius-md` · `radius-lg` · `radius-full` |

## Tokens for the native app

`tokens.json` is exported to `libs/shared/design-tokens`, and Style Dictionary generates CSS variables for Angular and a theme for the native app (Swift/Kotlin or Flutter, depending on the chosen stack). Token names are the same on every platform; changes are made only here.

## Components

| Component | What it is |
| --- | --- |
| [Button](components/Button/README.md) | Material button variants with our tokens and rules. |
| [SizeModes](components/SizeModes/README.md) | The Compact / Large switch and what it changes. |
| [PhotoTile](components/PhotoTile/README.md) | A photo or video tile in the timeline: selection, video, favorite, processing. |
| [UploadItem](components/UploadItem/README.md) | An upload queue row with statuses. |
| [DocumentCard](components/DocumentCard/README.md) | A document card with its expiry status. |
| [PersonChip](components/PersonChip/README.md) | A person's avatar and chip. |
| [RoleBadge](components/RoleBadge/README.md) | A member's role in the family list. |
| [FamilySwitcher](components/FamilySwitcher/README.md) | The family switcher in the header. |
| [Toast](components/Toast/README.md) | A message with Undo and an error message. |
| [EmptyState](components/EmptyState/README.md) | An empty screen with an action. |

Not yet described: the photo viewer, the search and filter bar, the invitation dialog, the sign-in page (passkey, password, 2FA), the timeline year scrubber.
