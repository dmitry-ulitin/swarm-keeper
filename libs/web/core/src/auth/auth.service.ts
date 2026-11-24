import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AppearanceService, type Lang } from '../appearance.service';
import {
  AUTH_CLIENT,
  type AuthResult,
  type InvitationRow,
  type MemberView,
  type PasskeyView,
} from './auth-client';

/** `GET /api/v1/me`. */
export interface MeResponse {
  user: {
    id: string;
    name: string;
    email: string;
    locale: string;
    uiSize: string;
    twoFactorEnabled: boolean | null;
    /** Has a password: only then can 2FA be turned on. */
    hasPassword: boolean;
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
  private readonly failed = signal(false);
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
  /** The last /me load failed for a reason other than being signed out (server, network). */
  readonly loadError = this.failed.asReadonly();

  /**
   * Loads /me. Only a 401 means signed out; a server or network error keeps what was known
   * and sets `loadError`. Concurrent calls share one request.
   */
  refresh(): Promise<void> {
    this.pending ??= firstValueFrom(this.http.get<MeResponse>('/api/v1/me'))
      .then((me) => {
        this.state.set(me);
        this.appearance.setLang((me.user.locale === 'ru' ? 'ru' : 'en') satisfies Lang);
        this.appearance.setUiSize(me.user.uiSize === 'large' ? 'large' : 'compact');
        this.failed.set(false);
      })
      .catch((error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 401) {
          this.state.set(null);
          this.failed.set(false);
        } else {
          this.failed.set(true);
        }
      })
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

  /** Registers a passkey for the signed-in user (the browser asks for it). */
  async addPasskey(name?: string): Promise<void> {
    await this.call(this.client.passkey.addPasskey(name ? { name } : undefined));
  }

  async listPasskeys(): Promise<PasskeyView[]> {
    return (await this.call(this.client.passkey.listUserPasskeys())) ?? [];
  }

  async renamePasskey(id: string, name: string): Promise<void> {
    await this.call(this.client.passkey.updatePasskey({ id, name }));
  }

  /** The server refuses the last sign-in method with LAST_SIGN_IN_METHOD. */
  async deletePasskey(id: string): Promise<void> {
    await this.call(this.client.passkey.deletePasskey({ id }));
  }

  /** Step 1 of turning 2FA on: the secret (as an otpauth URI) and the backup codes. */
  async startTwoFactor(password: string): Promise<{ totpURI: string; backupCodes: string[] }> {
    const data = await this.call(this.client.twoFactor.enable({ password }));
    return { totpURI: data?.totpURI ?? '', backupCodes: data?.backupCodes ?? [] };
  }

  /** Step 2: a code from the app turns 2FA on. */
  async confirmTwoFactor(code: string): Promise<void> {
    await this.verifyTotp(code);
  }

  async newBackupCodes(password: string): Promise<string[]> {
    const data = await this.call(this.client.twoFactor.generateBackupCodes({ password }));
    return data?.backupCodes ?? [];
  }

  async disableTwoFactor(password: string): Promise<void> {
    await this.call(this.client.twoFactor.disable({ password }));
    await this.refresh();
  }

  async listMembers(): Promise<MemberView[]> {
    const data = await this.call(
      this.client.organization.listMembers({ query: { organizationId: this.familyId() } }),
    );
    return data?.members ?? [];
  }

  /** Every invitation of the active family, in any status. */
  async listInvitations(): Promise<InvitationRow[]> {
    const data = await this.call(
      this.client.organization.listInvitations({ query: { organizationId: this.familyId() } }),
    );
    return data ?? [];
  }

  async invite(input: { email: string; role: string; locale: string }): Promise<void> {
    await this.call(
      this.client.organization.inviteMember({ ...input, organizationId: this.familyId() }),
    );
  }

  /**
   * Sends an invitation again. A valid one keeps its id (`resend: true` extends it). An
   * expired one is not pending for Better Auth, so `resend` would make a second invitation:
   * send a new one, then cancel the old. A failed cancel only leaves the expired row visible.
   */
  async resendInvitation(row: InvitationRow): Promise<void> {
    const input = {
      email: row.email,
      role: row.role,
      organizationId: this.familyId(),
      locale: row.locale ?? 'en',
    };
    if (new Date(row.expiresAt).getTime() > Date.now()) {
      await this.call(this.client.organization.inviteMember({ ...input, resend: true }));
      return;
    }
    await this.call(this.client.organization.inviteMember(input));
    await this.cancelInvitation(row.id).catch(() => undefined);
  }

  async cancelInvitation(invitationId: string): Promise<void> {
    await this.call(this.client.organization.cancelInvitation({ invitationId }));
  }

  private familyId(): string {
    return this.activeFamily()?.id ?? '';
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
