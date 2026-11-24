import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { AuthService, provideWebCore } from '@swarm-keeper/web-core';
import { describe, expect, it } from 'vitest';
import { ME, fakeAuth, fileLoader, literalText } from './testing';
import { HomePlaceholderPage } from './home-placeholder.page';

describe('HomePlaceholderPage', () => {
  it('names the family', async () => {
    const auth = fakeAuth(ME);
    TestBed.configureTestingModule({
      providers: [
        provideWebCore(),
        provideRouter([]),
        fileLoader,
        provideTranslocoScope('auth'),
        { provide: AuthService, useValue: auth },
      ],
    });
    const fixture = TestBed.createComponent(HomePlaceholderPage);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-test="family"]')?.textContent).toContain('Ивановы');
  });

  it('has no literal text in its template', () => {
    expect(literalText('../../libs/web/features/auth/src/feature/home-placeholder.page.html')).toBe(
      '',
    );
  });
});
