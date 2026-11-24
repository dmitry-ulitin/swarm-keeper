import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormField, form, maxLength, required } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';

/** The longest passkey name (the same limit as a person's name). */
export const PASSKEY_NAME_MAX = 64;

/** Renames a passkey; closes with the trimmed name. */
@Component({
  selector: 'sk-passkey-name-dialog',
  imports: [
    FormField,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    TranslocoPipe,
  ],
  template: `
    <h2 mat-dialog-title>{{ 'settings.rename.title' | transloco }}</h2>
    <form novalidate (submit)="submit($event)">
      <mat-dialog-content>
        <mat-form-field>
          <mat-label>{{ 'settings.rename.name' | transloco }}</mat-label>
          <input matInput data-test="name" [formField]="nameForm.name" />
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton="text" type="button" mat-dialog-close>
          {{ 'settings.cancel' | transloco }}
        </button>
        <button matButton="filled" type="submit" data-test="save" [disabled]="!nameForm().valid()">
          {{ 'settings.rename.save' | transloco }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styleUrl: './settings.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PasskeyNameDialog {
  private readonly ref = inject(MatDialogRef<PasskeyNameDialog, string>);
  private readonly model = signal({ name: inject<{ name: string }>(MAT_DIALOG_DATA).name });
  protected readonly nameForm = form(this.model, (path) => {
    required(path.name);
    maxLength(path.name, PASSKEY_NAME_MAX);
  });

  protected submit(event: Event): void {
    event.preventDefault();
    const name = this.model().name.trim();
    if (this.nameForm().valid() && name) this.ref.close(name);
  }
}
