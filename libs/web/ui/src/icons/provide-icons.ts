import { type EnvironmentProviders, inject, provideEnvironmentInitializer } from '@angular/core';
import { MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';
import { ICONS } from './icons';

/** Registers the app's SVG icons with Material: `<mat-icon svgIcon="upload" />`. */
export function provideIcons(): EnvironmentProviders {
  return provideEnvironmentInitializer(() => {
    const registry = inject(MatIconRegistry);
    const sanitizer = inject(DomSanitizer);
    for (const [name, svg] of Object.entries(ICONS)) {
      // Trusted: the sources are this package's own files, bundled at build time.
      registry.addSvgIconLiteral(name, sanitizer.bypassSecurityTrustHtml(svg));
    }
  });
}
