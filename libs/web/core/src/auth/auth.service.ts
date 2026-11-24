import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AppearanceService, type Lang } from '../appearance.service';
import { AUTH_CLIENT, type AuthResult } from './auth-client';

/** `GET /api/v1/me`. */
export interface MeResponse {
  user: {
    id: string;
    name: string;
    email: string;
    locale: string;
    uiSize: string;
    twoFactorEnabled: boolean | null;
  };
  families: { id: string; name: string; role: string }[];
  activeFamilyId: string | null;
  role: string | null;
  permissions: string[];
  twoFactorRequired: boolean;
}

/** A failed auth call; `code` is Better Auth's or ours (`errors.auth.<code>`). */
export class AuthError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

const UNKNOWN = 'UNKNOWN';

/**
 * The signed-in member: who they are, their families and what they may do. The UI hides
 * actions with `permissions`; the server checks every action again.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly client = inject(AUTH_CLIENT);
  private readonly appearance = inject(AppearanceService);
  private readonly state = signal<MeResponse | null>(null);
  private readonly loaded = signal(false);
  private pending: Promise<void> | null = null;

  readonly me = this.state.asReadonly();
  /** True once /me has answered at least once. */
  readonly ready = this.loaded.asReadonly();
  readonly signedIn = computed(() => this.state() !== null);
  readonly user = computed(() => this.state()?.user ?? null);
  readonly families = computed(() => this.state()?.families ?? []);
  readonly activeFamily = computed(() => {
    const me = this.state();
    return me?.families.find((f) => f.id === me.activeFamilyId) ?? null;
  });
  readonly role = computed(() => this.state()?.role ?? null);
  readonly permissions = computed(() => this.state()?.permissions ?? []);
  readonly twoFactorRequired = computed(() => this.state()?.twoFactorRequired ?? false);

  /** Loads /me; a 401 means signed out. Concurrent calls share one request. */
  refresh(): Promise<void> {
    this.pending ??= firstValueFrom(this.http.get<MeResponse>('/api/v1/me'))
      .then((me) => {
        this.state.set(me);
        this.appearance.setLang((me.user.locale === 'ru' ? 'ru' : 'en') satisfies Lang);
        this.appearance.setUiSize(me.user.uiSize === 'large' ? 'large' : 'compact');
      })
      .catch(() => this.state.set(null))
      .finally(() => {
        this.loaded.set(true);
        this.pending = null;
      });
    return this.pending;
  }

  /** Loads /me once if it never has. */
  async ensureLoaded(): Promise<void> {
    if (!this.loaded()) await this.refresh();
  }

  async signInPasskey(): Promise<void> {
    await this.call(this.client.signIn.passkey());
    await this.refresh();
  }

  async signInPassword(email: string, password: string): Promise<'ok' | 'two-factor'> {
    const data = await this.call(this.client.signIn.email({ email, password }));
    if (data?.twoFactorRedirect) return 'two-factor';
    await this.refresh();
    return 'ok';
  }

  async verifyTotp(code: string): Promise<void> {
    await this.call(this.client.twoFactor.verifyTotp({ code }));
    await this.refresh();
  }

  async verifyBackupCode(code: string): Promise<void> {
    await this.call(this.client.twoFactor.verifyBackupCode({ code }));
    await this.refresh();
  }

  /** Passkey-first sign-up from an invitation; the server signs the new member in. */
  async signUpPasskey(input: { invitationId: string; name: string; locale: Lang }): Promise<void> {
    const context = JSON.stringify({
      invitation: input.invitationId,
      name: input.name,
      locale: input.locale,
    });
    await this.call(this.client.passkey.addPasskey({ context, createSession: true }));
    await this.refresh();
  }

  /** Password sign-up from an invitation, then sign-in (sign-up starts no session). */
  async signUpPassword(input: {
    invitationId: string;
    email: string;
    name: string;
    password: string;
    locale: Lang;
  }): Promise<void> {
    await this.call(
      this.client.signUp.email({
        email: input.email,
        password: input.password,
        name: input.name,
        inviteToken: input.invitationId,
        locale: input.locale,
      }),
    );
    await this.signInPassword(input.email, input.password);
  }

  /** An existing member accepts another family's invitation and switches to it. */
  async acceptInvitation(invitationId: string): Promise<void> {
    const data = await this.call(this.client.organization.acceptInvitation({ invitationId }));
    const familyId = (data as { invitation?: { organizationId?: string } } | null)?.invitation
      ?.organizationId;
    if (familyId) await this.call(this.client.organization.setActive({ organizationId: familyId }));
    await this.refresh();
  }

  async addPasskey(): Promise<void> {
    await this.call(this.client.passkey.addPasskey());
  }

  async requestPasswordReset(email: string): Promise<void> {
    await this.call(this.client.requestPasswordReset({ email, redirectTo: '/reset-password' }));
  }

  async resetPassword(token: string, password: string): Promise<void> {
    await this.call(this.client.resetPassword({ newPassword: password, token }));
  }

  async signOut(): Promise<void> {
    await this.call(this.client.signOut());
    this.state.set(null);
  }

  private async call<T>(result: Promise<AuthResult<T>>): Promise<T | null> {
    const { data, error } = await result.catch(() => ({ data: null, error: { code: UNKNOWN } }));
    if (error) throw new AuthError(error.code || UNKNOWN);
    return data;
  }
}
