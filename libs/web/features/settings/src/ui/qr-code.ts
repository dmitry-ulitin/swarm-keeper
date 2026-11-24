import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';

/** A QR code of `value`, drawn as SVG. The QR library loads only when one is shown. */
@Component({
  selector: 'sk-qr-code',
  template: `<div class="qr" role="img" [attr.aria-label]="label()" [innerHTML]="svg()"></div>`,
  styles: `
    .qr {
      inline-size: calc(var(--tile-size) * 1.5);
      aspect-ratio: 1;
      margin-inline: auto;
      padding: var(--space-2);
      background: var(--surface-000);
      border: thin solid var(--border);
      border-radius: var(--radius-md);
    }
    .qr ::ng-deep svg {
      display: block;
      inline-size: 100%;
      block-size: 100%;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QrCode {
  private readonly sanitizer = inject(DomSanitizer);
  readonly value = input.required<string>();
  readonly label = input<string>('');
  protected readonly svg = signal<SafeHtml | null>(null);

  constructor() {
    effect(() => {
      const value = this.value();
      if (!value) return this.svg.set(null);
      void import('uqr').then(({ renderSVG }) => {
        // Trusted: the markup is generated locally by the library from our own string.
        if (this.value() === value) {
          this.svg.set(this.sanitizer.bypassSecurityTrustHtml(renderSVG(value, { border: 0 })));
        }
      });
    });
  }
}
