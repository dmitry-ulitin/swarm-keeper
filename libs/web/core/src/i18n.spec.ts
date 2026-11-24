import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  TRANSLOCO_LOADER,
  type Translation,
  type TranslocoLoader,
  TranslocoPipe,
} from '@jsverse/transloco';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppearanceService } from './appearance.service';
import { HttpTranslocoLoader, provideI18n } from './i18n';

const translations: Record<string, Translation> = {
  en: { files: '{count, plural, one {# file uploaded} other {# files uploaded}}' },
  ru: {
    files:
      '{count, plural, one {Загружен # файл} few {Загружено # файла} many {Загружено # файлов} other {Загружено # файла}}',
  },
};

class InlineLoader implements TranslocoLoader {
  getTranslation(lang: string) {
    return of(translations[lang] ?? {});
  }
}

@Component({
  selector: 'sk-test-files',
  imports: [TranslocoPipe],
  template: `<p>{{ 'files' | transloco: { count: count() } }}</p>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class FilesComponent {
  readonly count = input(5);
}

describe('provideI18n', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideI18n(),
        { provide: TRANSLOCO_LOADER, useClass: InlineLoader },
      ],
    });
  });

  async function render(count: number) {
    const fixture = TestBed.createComponent(FilesComponent);
    fixture.componentRef.setInput('count', count);
    await fixture.whenStable();
    return fixture;
  }

  it('renders ICU plurals in English', async () => {
    const fixture = await render(5);
    expect(fixture.nativeElement.textContent.trim()).toBe('5 files uploaded');
  });

  it('switches language without re-creating the component', async () => {
    const fixture = await render(5);
    TestBed.inject(AppearanceService).setLang('ru');
    TestBed.tick();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent.trim()).toBe('Загружено 5 файлов');
  });

  it('uses the Russian "one" form', async () => {
    TestBed.inject(AppearanceService).setLang('ru');
    const fixture = await render(1);
    TestBed.tick();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent.trim()).toBe('Загружен 1 файл');
  });
});

describe('HttpTranslocoLoader', () => {
  it('loads a scope file from /i18n/<scope>/<lang>.json', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const loader = TestBed.inject(HttpTranslocoLoader);
    loader.getTranslation('dev/ru').subscribe();
    TestBed.inject(HttpTestingController).expectOne('/i18n/dev/ru.json').flush({});
  });
});
