import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { TranslocoPipe } from '@jsverse/transloco';

/** t(auth.lang.en, auth.lang.ru) */

/** The card every sign-in screen sits in: name, title, content, language switch. */
@Component({
  selector: 'sk-auth-card',
  imports: [MatButtonModule, TranslocoPipe],
  template: `
    <main class="page">
      <section class="card">
        <p class="brand">
          <span class="mark" aria-hidden="true"></span>{{ 'auth.appName' | transloco }}
        </p>
        <h1 class="title" data-test="title">{{ heading() }}</h1>
        @if (subtitle()) {
          <p class="subtitle">{{ subtitle() }}</p>
        }
        <ng-content />
        <nav class="langs">
          @for (item of langs; track item) {
            <button
              matButton="text"
              type="button"
              [class.current]="lang() === item"
              [attr.aria-pressed]="lang() === item"
              [attr.data-test]="'lang-' + item"
              (click)="langChange.emit(item)"
            >
              {{ 'auth.lang.' + item | transloco }}
            </button>
          }
        </nav>
      </section>
    </main>
  `,
  styles: `
    .page {
      display: flex;
      justify-content: center;
      min-height: 100dvh;
      box-sizing: border-box;
      padding: var(--space-12) var(--space-4);
      background: var(--surface-100);
    }
    .card {
      width: 100%;
      max-width: 26rem;
      align-self: flex-start;
      box-sizing: border-box;
      padding: var(--space-6);
      background: var(--surface-000);
      border: thin solid var(--border);
      border-radius: var(--radius-lg);
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      margin: 0;
      color: var(--ink-muted);
      font-size: var(--fa-fs-label);
      font-weight: var(--type-label-weight);
    }
    .mark {
      width: var(--fa-icon);
      height: var(--fa-icon);
      border-radius: var(--radius-full);
      background: radial-gradient(circle, var(--accent) 30%, var(--brand) 32%);
    }
    .title {
      margin: 0;
      font-size: var(--type-title-lg-size);
      line-height: var(--type-title-lg-line-height);
      font-weight: var(--type-title-lg-weight);
    }
    .subtitle {
      margin: 0;
      color: var(--ink-muted);
    }
    .langs {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: var(--space-1);
    }
    .current {
      font-weight: var(--type-body-strong-weight);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthCard {
  readonly heading = input.required<string>();
  readonly subtitle = input<string>('');
  readonly lang = input.required<string>();
  readonly langChange = output<'en' | 'ru'>();
  protected readonly langs = ['en', 'ru'] as const;
}
