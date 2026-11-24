import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormField, email, form, required } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '@swarm-keeper/web-core';
import { codeOf, errorKey, inviteRoles } from '../data-access';

/**
 * t(family.roleHints.owner, family.roleHints.admin, family.roleHints.member, family.roleHints.viewer, family.languages.en, family.languages.ru)
 */

const LANGS = ['en', 'ru'] as const;

/** Invites a person by email with one role; the email goes out in the chosen language. */
@Component({
  selector: 'sk-invite-dialog',
  imports: [
    FormField,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    TranslocoPipe,
  ],
  templateUrl: './invite.dialog.html',
  styleUrl: './family.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InviteDialog {
  private readonly auth = inject(AuthService);
  private readonly ref = inject(MatDialogRef<InviteDialog, boolean>);

  protected readonly langs = LANGS;
  protected readonly roles = computed(() => inviteRoles(this.auth.role()));
  protected readonly busy = signal(false);
  protected readonly errorKey = signal<string | null>(null);

  protected readonly model = signal({
    email: '',
    role: 'member',
    locale: this.auth.user()?.locale === 'ru' ? 'ru' : 'en',
  });
  protected readonly inviteForm = form(this.model, (path) => {
    required(path.email);
    email(path.email);
    required(path.role);
    required(path.locale);
  });

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.inviteForm().valid()) return;
    const { email: address, role, locale } = this.model();
    this.busy.set(true);
    this.errorKey.set(null);
    try {
      await this.auth.invite({ email: address.trim(), role, locale });
      this.ref.close(true);
    } catch (error) {
      this.errorKey.set(errorKey(codeOf(error)));
    } finally {
      this.busy.set(false);
    }
  }
}
