import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormField, form, pattern, required } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '@swarm-keeper/web-core';
import { codeOf, errorKey } from '../data-access';
import { BackupCodes, QrCode } from '../ui';

type Step = 'password' | 'scan' | 'codes';

/** The key of an otpauth URI, grouped by four: `JBSW Y3DP EHPK 3PXP`. */
export function groupedSecret(totpURI: string): string {
  try {
    const secret = new URL(totpURI).searchParams.get('secret') ?? '';
    return secret.match(/.{1,4}/g)?.join(' ') ?? '';
  } catch {
    return '';
  }
}

/**
 * Turning 2FA on: password → QR code and a code from the app → backup codes, shown once.
 * Closing before the last step leaves 2FA off. The secret and the codes live only here and
 * are dropped when the dialog closes.
 */
@Component({
  selector: 'sk-two-factor-dialog',
  imports: [
    BackupCodes,
    FormField,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    QrCode,
    TranslocoPipe,
  ],
  templateUrl: './two-factor.dialog.html',
  styleUrl: './settings.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TwoFactorDialog {
  private readonly auth = inject(AuthService);
  private readonly ref = inject(MatDialogRef<TwoFactorDialog, boolean>);

  protected readonly step = signal<Step>('password');
  protected readonly busy = signal(false);
  protected readonly errorKey = signal<string | null>(null);
  protected readonly totpURI = signal('');
  protected readonly codes = signal<string[]>([]);
  protected readonly secret = computed(() => groupedSecret(this.totpURI()));

  private readonly passwordModel = signal({ password: '' });
  protected readonly passwordForm = form(this.passwordModel, (path) => required(path.password));
  private readonly codeModel = signal({ code: '' });
  protected readonly codeForm = form(this.codeModel, (path) => {
    required(path.code);
    pattern(path.code, /^\d{6}$/);
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.forget());
  }

  protected start(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.passwordForm().valid()) return Promise.resolve();
    return this.run(async () => {
      const { totpURI, backupCodes } = await this.auth.startTwoFactor(
        this.passwordModel().password,
      );
      this.passwordModel.set({ password: '' });
      this.totpURI.set(totpURI);
      this.codes.set(backupCodes);
      this.step.set('scan');
    });
  }

  protected confirm(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.codeForm().valid()) return Promise.resolve();
    return this.run(async () => {
      await this.auth.confirmTwoFactor(this.codeModel().code);
      this.totpURI.set('');
      this.step.set('codes');
    });
  }

  protected cancel(): void {
    this.forget();
    this.ref.close(false);
  }

  protected done(): void {
    this.forget();
    this.ref.close(true);
  }

  private forget(): void {
    this.totpURI.set('');
    this.codes.set([]);
    this.passwordModel.set({ password: '' });
  }

  private async run(action: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.errorKey.set(null);
    try {
      await action();
    } catch (error) {
      this.errorKey.set(errorKey(codeOf(error)));
    } finally {
      this.busy.set(false);
    }
  }
}
