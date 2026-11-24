// transloco-keys-manager: finds keys used in templates and code but missing from the JSON.
// Run through `pnpm i18n:check` (part of `pnpm lint`).
const config = {
  rootTranslationsPath: 'src/i18n/',
  langs: ['en', 'ru'],
  keysManager: {
    // App code and feature libraries; specs of the core library use throwaway keys.
    // Each feature's src (not the feature root: its node_modules hold other packages' code).
    input: ['src/app', '../../libs/web/core/src/auth', '../../libs/web/features/auth/src'],
    output: 'src/i18n',
    unflat: true,
  },
  scopePathMap: {
    dev: 'src/i18n/dev',
    auth: 'src/i18n/auth',
  },
};

export default config;
