import { HttpClient } from '@angular/common/http';
import {
  type EnvironmentProviders,
  Injectable,
  effect,
  inject,
  isDevMode,
  makeEnvironmentProviders,
  provideEnvironmentInitializer,
} from '@angular/core';
import {
  type Translation,
  type TranslocoLoader,
  TranslocoService,
  provideTransloco,
} from '@jsverse/transloco';
import { provideTranslocoMessageformat } from '@jsverse/transloco-messageformat';
import { AppearanceService } from './appearance.service';

/** Loads `/i18n/<lang>.json` and, for a scope, `/i18n/<scope>/<lang>.json`. */
@Injectable({ providedIn: 'root' })
export class HttpTranslocoLoader implements TranslocoLoader {
  private readonly http = inject(HttpClient);

  getTranslation(path: string) {
    return this.http.get<Translation>(`/i18n/${path}.json`);
  }
}

/** Transloco with ICU plurals; the active language follows `AppearanceService.lang`. */
export function provideI18n(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideTransloco({
      config: {
        availableLangs: ['en', 'ru'],
        defaultLang: 'en',
        fallbackLang: 'en',
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
        missingHandler: { logMissingKey: isDevMode() },
      },
      loader: HttpTranslocoLoader,
    }),
    provideTranslocoMessageformat(),
    provideEnvironmentInitializer(() => {
      const transloco = inject(TranslocoService);
      const appearance = inject(AppearanceService);
      effect(() => transloco.setActiveLang(appearance.lang()));
    }),
  ]);
}
