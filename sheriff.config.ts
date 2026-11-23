import { sameTag, type SheriffConfig } from '@sheriff-arch/sheriff-core';

/**
 * Module boundaries for the whole monorepo.
 * A dependency is allowed only if every tag of the importing module permits
 * at least one tag of the imported module. Modules are folders with an index.ts;
 * everything else inside a module is private to it.
 */
export const config: SheriffConfig = {
  entryPoints: {
    api: 'apps/api/src/main.ts',
    worker: 'apps/worker/src/main.ts',
    web: 'apps/web/src/main.ts',
  },
  modules: {
    'apps/api/src': ['scope:api', 'app:api'],
    'apps/api/src/modules/<module>': ['scope:api', 'api:module:<module>'],
    'apps/api/src/database': ['scope:api', 'api:infra:database'],
    'apps/worker/src': ['scope:api', 'app:worker'],
    'apps/web/src': ['scope:web', 'app:web'],
    'libs/shared/<lib>/src': ['scope:shared', 'shared:<lib>'],
    'libs/web/core/src': ['scope:web', 'web:core'],
    'libs/web/ui/src': ['scope:web', 'web:ui'],
    'libs/web/api-client/src': ['scope:web', 'web:api-client'],
    'libs/web/features/<feature>/src': ['scope:web', 'feature:<feature>', 'layer:public'],
    'libs/web/features/<feature>/src/<layer>': ['scope:web', 'feature:<feature>', 'layer:<layer>'],
  },
  depRules: {
    // Config files and anything outside a tagged module.
    root: ['scope:*'],
    // Every barrel module must be tagged above.
    noTag: [],

    // Backend and web never depend on each other; both may use shared libraries.
    'scope:api': ['scope:api', 'scope:shared'],
    'scope:web': ['scope:web', 'scope:shared'],
    'scope:shared': 'scope:shared',
    'shared:*': 'scope:shared',

    // API: modules talk to each other only through their index.ts.
    // Infrastructure (the database) is reachable from every API module and depends on none.
    'app:api': ['api:module:*', 'api:infra:database', 'scope:shared'],
    'api:module:*': ['api:module:*', 'api:infra:database', 'scope:shared'],
    'api:infra:database': ['scope:shared'],
    'app:worker': ['app:api', 'api:module:*', 'api:infra:database', 'scope:shared'],

    // Web libraries.
    'app:web': ['web:core', 'web:ui', 'layer:public', 'scope:shared'],
    'web:core': ['web:api-client', 'scope:shared'],
    'web:ui': ['scope:shared'],
    'web:api-client': [],

    // Features never import each other; inside a feature, layers point downward.
    'feature:*': [sameTag, 'web:core', 'web:ui', 'web:api-client', 'scope:shared'],
    'layer:public': ['layer:feature'],
    'layer:feature': ['layer:data-access', 'layer:ui', 'web:core', 'web:ui', 'scope:shared'],
    'layer:data-access': ['web:api-client', 'web:core', 'scope:shared'],
    'layer:ui': ['web:ui', 'scope:shared'],
  },
};
