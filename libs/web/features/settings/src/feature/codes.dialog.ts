import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { TranslocoPipe } from '@jsverse/transloco';
import { BackupCodes } from '../ui';

/** New backup codes, shown once. */
@Component({
  selector: 'sk-codes-dialog',
  imports: [BackupCodes, MatButtonModule, MatDialogModule, TranslocoPipe],
  template: `
    <h2 mat-dialog-title>{{ 'settings.codes.title' | transloco }}</h2>
    <mat-dialog-content>
      <p class="hint">{{ 'settings.setup.codesHint' | transloco }}</p>
      <sk-backup-codes [codes]="data.codes" />
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton="filled" type="button" data-test="done" mat-dialog-close>
        {{ 'settings.setup.done' | transloco }}
      </button>
    </mat-dialog-actions>
  `,
  styleUrl: './settings.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CodesDialog {
  protected readonly data = inject<{ codes: string[] }>(MAT_DIALOG_DATA);
}
