import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { type EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { authInterceptor } from './auth/auth.interceptor';
import { provideI18n } from './i18n';

/** App-wide core providers: HTTP with the auth interceptor, and translations. */
export function provideWebCore(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideHttpClient(withInterceptors([authInterceptor])),
    provideI18n(),
  ]);
}
