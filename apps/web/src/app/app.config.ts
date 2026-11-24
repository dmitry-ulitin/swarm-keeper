import {
  type ApplicationConfig,
  inject,
  provideBrowserGlobalErrorListeners,
  provideEnvironmentInitializer,
} from '@angular/core';
import { MatIconRegistry } from '@angular/material/icon';
import { provideRouter } from '@angular/router';
import { provideWebCore } from '@swarm-keeper/web-core';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideWebCore(),
    // Material Symbols Rounded, bundled from the material-symbols package: <mat-icon fontIcon="…">.
    provideEnvironmentInitializer(() =>
      inject(MatIconRegistry).setDefaultFontSetClass(
        'material-symbols-rounded',
        'mat-ligature-font',
      ),
    ),
  ],
};
