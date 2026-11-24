import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormField, email, form, maxLength, pattern, required } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppearanceService, AuthService, safeReturnUrl } from '@swarm-keeper/web-core';
import { authErrorKey, codeOf } from '../data-access';
import { AuthCard } from '../ui';

/** t(auth.login.title, auth.twoFactor.title, auth.twoFactor.backupTitle, auth.forgot.title) */
type Step = 'passkey' | 'password' | 'two-factor' | 'backup-code' | 'forgot' | 'forgot-sent';

/** `/login`: passkey first; a password (and 2FA) behind a link; password reset. */
@Component({
  selector: 'sk-login-page',
  imports: [
    AuthCard,
    FormField,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    TranslocoPipe,
  ],
  templateUrl: './login.page.html',
  styleUrl: './auth-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly appearance = inject(AppearanceService);

  /** Query parameters (router component input binding). */
  readonly returnUrl = input<string | undefined>();
  readonly reset = input<string | undefined>();

  protected readonly step = signal<Step>('passkey');
  protected readonly busy = signal(false);
  protected readonly errorKey = signal<string | null>(null);
  protected readonly titleKey = computed(() => {
    const step = this.step();
    if (step === 'two-factor') return 'auth.twoFactor.title';
    if (step === 'backup-code') return 'auth.twoFactor.backupTitle';
    if (step === 'forgot' || step === 'forgot-sent') return 'auth.forgot.title';
    return 'auth.login.title';
  });

  private readonly credentials = signal({ email: '', password: '' });
  protected readonly credentialsForm = form(this.credentials, (path) => {
    required(path.email);
    email(path.email);
    required(path.password);
  });
  private readonly codeModel = signal({ code: '' });
  protected readonly codeForm = form(this.codeModel, (path) => {
    required(path.code);
    maxLength(path.code, 6);
    pattern(path.code, /^\d{6}$/);
  });
  private readonly backupModel = signal({ code: '' });
  protected readonly backupForm = form(this.backupModel, (path) => required(path.code));
  private readonly forgotModel = signal({ email: '' });
  protected readonly forgotForm = form(this.forgotModel, (path) => {
    required(path.email);
    email(path.email);
  });

  protected go(step: Step): void {
    this.errorKey.set(null);
    this.step.set(step);
  }

  protected passkey(): Promise<void> {
    return this.run(async () => {
      await this.auth.signInPasskey();
      await this.done();
    });
  }

  protected password(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.credentialsForm().valid()) return Promise.resolve();
    const { email, password } = this.credentials();
    return this.run(async () => {
      if ((await this.auth.signInPassword(email, password)) === 'two-factor') this.go('two-factor');
      else await this.done();
    });
  }

  protected totp(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.codeForm().valid()) return Promise.resolve();
    return this.run(async () => {
      await this.auth.verifyTotp(this.codeModel().code);
      await this.done();
    });
  }

  protected backupCode(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.backupForm().valid()) return Promise.resolve();
    return this.run(async () => {
      await this.auth.verifyBackupCode(this.backupModel().code.trim());
      await this.done();
    });
  }

  /** Always ends on the same note, so the page never tells whether an account exists. */
  protected async forgot(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.forgotForm().valid()) return;
    this.busy.set(true);
    await this.auth.requestPasswordReset(this.forgotModel().email).catch(() => undefined);
    this.busy.set(false);
    this.go('forgot-sent');
  }

  private async done(): Promise<void> {
    await this.router.navigateByUrl(safeReturnUrl(this.returnUrl()));
  }

  private async run(action: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.errorKey.set(null);
    try {
      await action();
    } catch (error) {
      this.errorKey.set(authErrorKey(codeOf(error)));
    } finally {
      this.busy.set(false);
    }
  }
}
