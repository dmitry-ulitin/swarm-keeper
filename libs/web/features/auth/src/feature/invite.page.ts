import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormField, form, minLength, required } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppearanceService, AuthService } from '@swarm-keeper/web-core';
import { authErrorKey, codeOf, invitationResource } from '../data-access';
import { AuthCard } from '../ui';

type State =
  | 'loading'
  | 'invalid'
  | 'sign-up'
  | 'sign-up-password'
  | 'add-passkey'
  | 'sign-in-to-accept'
  | 'accept'
  | 'other-account';

/** Errors that mean the invitation itself stopped working while the page was open. */
const GONE = new Set(['INVITE_REQUIRED', 'INVITATION_NOT_FOUND']);

/** t(auth.invite.role.owner, auth.invite.role.admin, auth.invite.role.member, auth.invite.role.viewer) */
const ROLES = new Set(['owner', 'admin', 'member', 'viewer']);

/** `/invite/:token`: join a family from an invitation, or accept it with an existing account. */
@Component({
  selector: 'sk-invite-page',
  imports: [
    AuthCard,
    FormField,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    TranslocoPipe,
  ],
  templateUrl: './invite.page.html',
  styleUrl: './auth-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvitePage {
  protected readonly auth = inject(AuthService);
  protected readonly appearance = inject(AppearanceService);
  private readonly router = inject(Router);

  /** The route parameter `:token` (router component input binding). */
  readonly token = input.required<string>();

  protected readonly invitation = invitationResource(this.token);
  /** The invitation, or undefined while loading or after an error (value() throws then). */
  protected readonly view = computed(() => (this.invitation.hasValue() ? this.invitation.value() : undefined));
  protected readonly busy = signal(false);
  protected readonly errorKey = signal<string | null>(null);
  private readonly withPassword = signal(false);
  private readonly created = signal(false);

  private readonly model = signal({ name: '', password: '' });
  protected readonly fields = form(this.model, (path) => {
    required(path.name);
    required(path.password);
    minLength(path.password, 12);
  });

  protected readonly roleKey = computed(() => {
    const role = this.view()?.role ?? '';
    return ROLES.has(role) ? `auth.invite.role.${role}` : null;
  });

  protected readonly state = computed<State>(() => {
    if (this.invitation.error()) return 'invalid';
    const invitation = this.view();
    if (!invitation) return 'loading';
    if (this.created()) return 'add-passkey';
    const user = this.auth.user();
    if (user) {
      return user.email.toLowerCase() === invitation.email.toLowerCase()
        ? 'accept'
        : 'other-account';
    }
    if (invitation.hasAccount) return 'sign-in-to-accept';
    return this.withPassword() ? 'sign-up-password' : 'sign-up';
  });

  constructor() {
    void this.auth.ensureLoaded();
    // Open in the invitation's language once; the visitor's own switch wins after that.
    let languageSet = false;
    effect(() => {
      const invitation = this.view();
      if (invitation && !languageSet) {
        languageSet = true;
        this.appearance.setLang(invitation.locale);
      }
    });
  }

  protected usePassword(value: boolean): void {
    this.errorKey.set(null);
    this.withPassword.set(value);
  }

  protected signUpPasskey(): Promise<void> {
    if (this.fields.name().invalid()) {
      this.fields.name().markAsTouched();
      return Promise.resolve();
    }
    return this.run(async () => {
      await this.auth.signUpPasskey({
        invitationId: this.token(),
        name: this.model().name.trim(),
        locale: this.appearance.lang(),
      });
      await this.router.navigateByUrl('/');
    });
  }

  protected signUpPassword(event: Event): Promise<void> {
    event.preventDefault();
    const invitation = this.view();
    if (!invitation || !this.fields().valid()) return Promise.resolve();
    return this.run(async () => {
      await this.auth.signUpPassword({
        invitationId: this.token(),
        email: invitation.email,
        name: this.model().name.trim(),
        password: this.model().password,
        locale: this.appearance.lang(),
      });
      this.created.set(true);
    });
  }

  protected addPasskey(): Promise<void> {
    return this.run(async () => {
      await this.auth.addPasskey();
      await this.router.navigateByUrl('/');
    });
  }

  protected accept(): Promise<void> {
    return this.run(async () => {
      await this.auth.acceptInvitation(this.token());
      await this.router.navigateByUrl('/');
    });
  }

  protected signOut(): Promise<void> {
    return this.run(() => this.auth.signOut());
  }

  protected go(url: string): void {
    void this.router.navigateByUrl(url);
  }

  protected signInUrl(): string {
    return `/login?returnUrl=${encodeURIComponent(`/invite/${this.token()}`)}`;
  }

  private async run(action: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.errorKey.set(null);
    try {
      await action();
    } catch (error) {
      const code = codeOf(error);
      if (GONE.has(code)) {
        // Check again: if the invitation is gone, the page shows the expired state.
        this.invitation.reload();
      } else {
        this.errorKey.set(authErrorKey(code));
      }
    } finally {
      this.busy.set(false);
    }
  }
}
