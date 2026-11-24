import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormField, form, required } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { codeOf, errorKey } from '../data-access';

export interface PasswordDialogData<T = unknown> {
  titleKey: string;
  hintKey: string;
  confirmKey: string;
  /** A warning shown above the field (turning 2FA off as an owner or admin). */
  warningKey?: string;
  danger?: boolean;
  /** Runs with the password; its result closes the dialog. Errors stay in the dialog. */
  action: (password: string) => Promise<T>;
}

/** Asks for the account password, then runs one action with it. */
@Component({
  selector: 'sk-password-dialog',
  imports: [
    FormField,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    TranslocoPipe,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.titleKey | transloco }}</h2>
    <form novalidate (submit)="submit($event)">
      <mat-dialog-content>
        <p class="hint">{{ data.hintKey | transloco }}</p>
        @if (data.warningKey) {
          <p class="note warning" data-test="warning">{{ data.warningKey | transloco }}</p>
        }
        @if (errorKey(); as key) {
          <p class="note danger" role="alert" data-test="error">{{ key | transloco }}</p>
        }
        <mat-form-field>
          <mat-label>{{ 'settings.setup.password' | transloco }}</mat-label>
          <input
            matInput
            type="password"
            autocomplete="current-password"
            data-test="password"
            [formField]="passwordForm.password"
          />
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton="text" type="button" mat-dialog-close>
          {{ 'settings.cancel' | transloco }}
        </button>
        <button
          matButton="filled"
          type="submit"
          data-test="submit"
          [class.danger]="data.danger"
          [disabled]="busy()"
        >
          {{ data.confirmKey | transloco }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styleUrl: './settings.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PasswordDialog {
  protected readonly data = inject<PasswordDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<PasswordDialog>);
  protected readonly busy = signal(false);
  protected readonly errorKey = signal<string | null>(null);
  private readonly model = signal({ password: '' });
  protected readonly passwordForm = form(this.model, (path) => required(path.password));

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.passwordForm().valid()) return;
    this.busy.set(true);
    this.errorKey.set(null);
    try {
      const result = await this.data.action(this.model().password);
      this.model.set({ password: '' });
      this.ref.close({ result });
    } catch (error) {
      this.errorKey.set(errorKey(codeOf(error)));
    } finally {
      this.busy.set(false);
    }
  }
}
