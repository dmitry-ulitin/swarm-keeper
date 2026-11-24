import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { TranslocoPipe } from '@jsverse/transloco';

export interface ConfirmDialogData {
  titleKey: string;
  textKey: string;
  confirmKey: string;
}

/** Yes or no: closes with `true` on confirm. */
@Component({
  selector: 'sk-confirm-dialog',
  imports: [MatButtonModule, MatDialogModule, TranslocoPipe],
  template: `
    <h2 mat-dialog-title>{{ data.titleKey | transloco }}</h2>
    <mat-dialog-content>
      <p class="hint">{{ data.textKey | transloco }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton="text" type="button" [mat-dialog-close]="false">
        {{ 'settings.cancel' | transloco }}
      </button>
      <button matButton="filled" type="button" data-test="confirm" [mat-dialog-close]="true">
        {{ data.confirmKey | transloco }}
      </button>
    </mat-dialog-actions>
  `,
  styleUrl: './settings.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialog {
  protected readonly data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);
}
