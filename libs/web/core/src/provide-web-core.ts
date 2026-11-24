import { provideHttpClient } from '@angular/common/http';
import { type EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { provideI18n } from './i18n';

/** App-wide core providers: HTTP and translations. Auth joins in step 6. */
export function provideWebCore(): EnvironmentProviders {
  return makeEnvironmentProviders([provideHttpClient(), provideI18n()]);
}
