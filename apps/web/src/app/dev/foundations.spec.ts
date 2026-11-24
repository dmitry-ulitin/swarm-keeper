import { DOCUMENT } from '@angular/common';
import { readFileSync } from 'node:fs';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TRANSLOCO_LOADER, type Translation, type TranslocoLoader } from '@jsverse/transloco';
import { AppearanceService, provideWebCore } from '@swarm-keeper/web-core';
import { of } from 'rxjs';
import { appRoutes } from '../app.routes';
import { Foundations } from './foundations';

const read = (path: string) => readFileSync(path, 'utf8');
const dev: Record<string, Translation> = {
  en: JSON.parse(read('src/i18n/dev/en.json')),
  ru: JSON.parse(read('src/i18n/dev/ru.json')),
};

class FileLoader implements TranslocoLoader {
  getTranslation(path: string) {
    const [scope, lang] = path.includes('/') ? path.split('/') : ['', path];
    return of(scope === 'dev' ? (dev[lang] ?? {}) : {});
  }
}

describe('appRoutes', () => {
  it('registers the showcase only in dev builds', () => {
    expect(appRoutes(false).some((r) => r.path === 'dev/foundations')).toBe(false);
    expect(appRoutes(true).some((r) => r.path === 'dev/foundations')).toBe(true);
  });
});

describe('Foundations', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideWebCore(),
        provideRouter([]),
        { provide: TRANSLOCO_LOADER, useClass: FileLoader },
        ...(appRoutes(true).find((r) => r.path === 'dev/foundations')?.providers ?? []),
      ],
    });
  });

  afterEach(() => {
    const html = TestBed.inject(DOCUMENT).documentElement;
    html.removeAttribute('data-size');
    html.removeAttribute('data-theme');
    html.style.colorScheme = '';
  });

  async function render() {
    const fixture = TestBed.createComponent(Foundations);
    await fixture.whenStable();
    return fixture;
  }

  const title = (el: HTMLElement) => el.querySelector('h1')?.textContent?.trim();

  it('renders the title in English and switches to Russian', async () => {
    const fixture = await render();
    expect(title(fixture.nativeElement)).toBe(dev['en']['title']);
    TestBed.inject(AppearanceService).setLang('ru');
    TestBed.tick();
    await fixture.whenStable();
    expect(title(fixture.nativeElement)).toBe(dev['ru']['title']);
  });

  it('switches to large mode', async () => {
    const fixture = await render();
    const button = fixture.nativeElement.querySelector('[data-test="size-large"]') as HTMLElement;
    button.click();
    TestBed.tick();
    expect(TestBed.inject(DOCUMENT).documentElement.getAttribute('data-size')).toBe('large');
  });

  it('forces the dark theme for checking', async () => {
    const fixture = await render();
    (fixture.nativeElement.querySelector('[data-test="theme-dark"]') as HTMLElement).click();
    TestBed.tick();
    const html = TestBed.inject(DOCUMENT).documentElement;
    expect(html.getAttribute('data-theme')).toBe('dark');
    expect(html.style.colorScheme).toBe('dark');
  });

  it('has no literal text in its template', () => {
    const text = read('src/app/dev/foundations.html')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\{\{[\s\S]*?\}\}/g, '')
      .replace(/<[^>]*>/g, '')
      .replace(/@[a-z]+\s*(\([^)]*\))?\s*\{/gi, '')
      .replace(/[{}]/g, '')
      .trim();
    expect(text).toBe('');
  });
});
