import { type EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';

/** Registers app-wide core providers (auth, HTTP, config). Empty until those land. */
export function provideWebCore(): EnvironmentProviders {
  return makeEnvironmentProviders([]);
}
