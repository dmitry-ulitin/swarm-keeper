// transloco-keys-manager: finds keys used in templates and code but missing from the JSON.
// Run through `pnpm i18n:check` (part of `pnpm lint`).
const config = {
  rootTranslationsPath: 'src/i18n/',
  langs: ['en', 'ru'],
  keysManager: {
    // App code and feature libraries; specs of the core library use throwaway keys.
    input: ['src/app', '../../libs/web/features'],
    output: 'src/i18n',
    unflat: true,
  },
  scopePathMap: {
    dev: 'src/i18n/dev',
  },
};

export default config;
