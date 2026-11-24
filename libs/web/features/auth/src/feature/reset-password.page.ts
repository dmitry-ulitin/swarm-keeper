import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormField, form, minLength, required, validate } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppearanceService, AuthService } from '@swarm-keeper/web-core';
import { authErrorKey, codeOf } from '../data-access';
import { AuthCard } from '../ui';

/** `/reset-password?token=…`: the link from the reset email. */
@Component({
  selector: 'sk-reset-password-page',
  imports: [
    AuthCard,
    FormField,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    TranslocoPipe,
  ],
  templateUrl: './reset-password.page.html',
  styleUrl: './auth-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPasswordPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly appearance = inject(AppearanceService);

  readonly token = input<string | undefined>();

  protected readonly busy = signal(false);
  protected readonly errorKey = signal<string | null>(null);
  private readonly model = signal({ password: '', repeat: '' });
  protected readonly passwords = form(this.model, (path) => {
    required(path.password);
    minLength(path.password, 12);
    required(path.repeat);
    validate(path.repeat, ({ value, valueOf }) =>
      value() === valueOf(path.password) ? null : { kind: 'mismatch' },
    );
  });

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    const token = this.token();
    if (!token || !this.passwords().valid()) return;
    this.busy.set(true);
    this.errorKey.set(null);
    try {
      await this.auth.resetPassword(token, this.model().password);
      await this.router.navigateByUrl('/login?reset=1');
    } catch (error) {
      this.errorKey.set(authErrorKey(codeOf(error)));
    } finally {
      this.busy.set(false);
    }
  }
}
