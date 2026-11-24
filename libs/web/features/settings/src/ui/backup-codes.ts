import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';

/** Backup codes shown once, with Copy and Download. Never stored anywhere else. */
@Component({
  selector: 'sk-backup-codes',
  imports: [MatButtonModule, MatIconModule, TranslocoPipe],
  template: `
    <ul class="codes">
      @for (code of codes(); track code) {
        <li data-test="backup-code">{{ code }}</li>
      }
    </ul>
    <div class="actions">
      <button matButton="outlined" type="button" data-test="copy" (click)="copy()">
        <mat-icon svgIcon="content_copy" />{{
          (copied() ? 'settings.setup.copied' : 'settings.setup.copy') | transloco
        }}
      </button>
      <button matButton="outlined" type="button" data-test="download" (click)="download()">
        <mat-icon svgIcon="download" />{{ 'settings.setup.download' | transloco }}
      </button>
    </div>
  `,
  styles: `
    .codes {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(8rem, 1fr));
      gap: var(--space-1) var(--space-3);
      margin: 0 0 var(--space-3);
      padding: var(--space-3);
      list-style: none;
      background: var(--surface-100);
      border-radius: var(--radius-md);
      font-family: var(--font-mono);
      font-size: var(--type-code-size);
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BackupCodes {
  readonly codes = input.required<readonly string[]>();
  protected readonly copied = signal(false);

  protected async copy(): Promise<void> {
    await navigator.clipboard?.writeText(this.codes().join('\n'));
    this.copied.set(true);
  }

  protected download(): void {
    const blob = new Blob([this.codes().join('\n') + '\n'], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'swarm-keeper-backup-codes.txt';
    link.click();
    URL.revokeObjectURL(url);
  }
}
