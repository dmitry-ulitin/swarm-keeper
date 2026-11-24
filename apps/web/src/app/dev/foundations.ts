import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { TranslocoDirective } from '@jsverse/transloco';
import { AppearanceService, type Lang, type UiSize } from '@swarm-keeper/web-core';
import { FileSizePipe } from '@swarm-keeper/web-ui';

type Theme = 'system' | 'light' | 'dark';

/** Development only: every foundation (tokens, theme, sizes, languages) on one page. */
@Component({
  selector: 'sk-dev-foundations',
  imports: [
    TranslocoDirective,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    FileSizePipe,
  ],
  templateUrl: './foundations.html',
  styleUrl: './foundations.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Foundations {
  private readonly document = inject(DOCUMENT);
  protected readonly appearance = inject(AppearanceService);

  protected readonly langs: readonly Lang[] = ['en', 'ru'];
  protected readonly sizes: readonly UiSize[] = ['compact', 'large'];
  protected readonly themes: readonly Theme[] = ['system', 'light', 'dark'];
  protected readonly theme = signal<Theme>('system');
  protected readonly counts = [1, 3, 5] as const;
  protected readonly swatches = ['brand', 'accent', 'success', 'warning', 'danger'] as const;
  protected readonly typeStyles = [
    'display',
    'title-lg',
    'title',
    'body',
    'label',
    'caption',
  ] as const;
  protected readonly fileBytes = 3_400_000;
  protected readonly date = computed(() =>
    new Intl.DateTimeFormat(this.appearance.lang(), { dateStyle: 'long' }).format(
      new Date(2025, 6, 12),
    ),
  );

  /** Forces a theme for checking: `light-dark()` follows color-scheme, shadows follow data-theme. */
  protected setTheme(theme: Theme): void {
    this.theme.set(theme);
    const html = this.document.documentElement;
    if (theme === 'system') {
      html.removeAttribute('data-theme');
      html.style.colorScheme = '';
    } else {
      html.setAttribute('data-theme', theme);
      html.style.colorScheme = theme;
    }
  }
}
