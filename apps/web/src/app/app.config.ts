import { type ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideWebCore } from '@swarm-keeper/web-core';
import { provideIcons } from '@swarm-keeper/web-ui';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideWebCore(),
    provideIcons(),
  ],
};
