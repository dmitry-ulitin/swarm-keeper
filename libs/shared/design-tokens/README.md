# @swarm-keeper/design-tokens

CSS variables generated from `docs/design/tokens.json` with Style Dictionary (`build/tokens-css.ts`).

- `src/tokens.css` is generated and committed. Never edit it by hand: change `tokens.json` and run `pnpm tokens:build`. A test fails if the committed file is out of date.
- Colors are `light-dark(<light>, <dark>)` and follow `color-scheme`. Shadows are not colors, so their dark values sit in a `prefers-color-scheme: dark` block and a `:root[data-theme='dark']` block. `data-theme='light'` forces the light ones.
- A `{name}` reference becomes `var(--name)`; a reference to a missing token fails the build.
