import { DOCUMENT } from '@angular/common';
import { Injectable, effect, inject, signal } from '@angular/core';

export type Lang = 'en' | 'ru';
export type UiSize = 'compact' | 'large';

/** The browser's first preferred language: `ru` or `ru-*` → `ru`, anything else → `en`. */
export function browserLang(languages: readonly string[]): Lang {
  return languages[0]?.toLowerCase().split('-')[0] === 'ru' ? 'ru' : 'en';
}

/**
 * The member's interface language and size, reflected on `<html lang>` and `data-size`.
 * Until sign-in exists, the language comes from the browser and the size is compact;
 * step 6 sets both from `GET /me`.
 */
@Injectable({ providedIn: 'root' })
export class AppearanceService {
  private readonly document = inject(DOCUMENT);
  private readonly langState = signal<Lang>(
    browserLang(this.document.defaultView?.navigator.languages ?? []),
  );
  private readonly uiSizeState = signal<UiSize>('compact');

  readonly lang = this.langState.asReadonly();
  readonly uiSize = this.uiSizeState.asReadonly();

  constructor() {
    effect(() => {
      const html = this.document.documentElement;
      html.lang = this.lang();
      if (this.uiSize() === 'large') {
        html.setAttribute('data-size', 'large');
      } else {
        html.removeAttribute('data-size');
      }
    });
  }

  setLang(lang: Lang): void {
    this.langState.set(lang);
  }

  setUiSize(size: UiSize): void {
    this.uiSizeState.set(size);
  }
}
