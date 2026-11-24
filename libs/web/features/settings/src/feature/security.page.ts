import { ChangeDetectionStrategy, Component, computed, inject, resource } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AppearanceService, AuthService, type PasskeyView } from '@swarm-keeper/web-core';
import { firstValueFrom } from 'rxjs';
import {
  CANCELLED,
  SessionsApi,
  type SessionView,
  codeOf,
  deviceLabel,
  errorKey,
  sessionsResource,
} from '../data-access';
import { CodesDialog } from './codes.dialog';
import { ConfirmDialog, type ConfirmDialogData } from './confirm.dialog';
import { PasskeyNameDialog } from './passkey-name.dialog';
import { PasswordDialog, type PasswordDialogData } from './password.dialog';
import { TwoFactorDialog } from './two-factor.dialog';

/**
 * Keys passed to dialogs, listed for transloco-keys-manager:
 * t(settings.codes.title, settings.codes.passwordHint, settings.setup.next, settings.disable.title, settings.disable.hint, settings.disable.warning, settings.disable.confirm, settings.deletePasskey.title, settings.deletePasskey.text, settings.deletePasskey.confirm, settings.fresh.title, settings.fresh.text, settings.fresh.confirm, settings.sessions.endOthersTitle, settings.sessions.endOthersText, settings.sessions.endOthersConfirm, settings.sessions.ended)
 */
const RETURN_HERE = '/login?returnUrl=%2Fsettings%2Fsecurity';

/** `/settings/security`: the signed-in person's passkeys, 2FA and sessions. */
@Component({
  selector: 'sk-security-page',
  imports: [MatButtonModule, MatIconModule, TranslocoPipe],
  templateUrl: './security.page.html',
  styleUrls: ['./settings.scss', './security.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SecurityPage {
  protected readonly auth = inject(AuthService);
  private readonly appearance = inject(AppearanceService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly sessionsApi = inject(SessionsApi);

  protected readonly passkeys = resource({ loader: () => this.auth.listPasskeys() });
  protected readonly sessions = sessionsResource();
  protected readonly user = this.auth.user;
  protected readonly isAdmin = computed(() => ['owner', 'admin'].includes(this.auth.role() ?? ''));

  private readonly dateFormat = computed(
    () => new Intl.DateTimeFormat(this.appearance.lang(), { dateStyle: 'medium' }),
  );
  private readonly timeFormat = computed(
    () => new Intl.DateTimeFormat(this.appearance.lang(), { timeStyle: 'short' }),
  );

  protected date(value: string): string {
    return this.dateFormat().format(new Date(value));
  }

  /** Today → the time; otherwise the date. */
  protected lastActive(session: SessionView): { today: boolean; text: string } {
    const at = new Date(session.updatedAt);
    const today = at.toDateString() === new Date().toDateString();
    return { today, text: today ? this.timeFormat().format(at) : this.dateFormat().format(at) };
  }

  protected device(session: SessionView): string | null {
    return deviceLabel(session.userAgent);
  }

  protected async addPasskey(): Promise<void> {
    try {
      await this.auth.addPasskey(deviceLabel(globalThis.navigator?.userAgent) ?? undefined);
      this.passkeys.reload();
    } catch (error) {
      const code = codeOf(error);
      if (CANCELLED.has(code)) return;
      if (code === 'SESSION_NOT_FRESH') return this.signInAgain();
      await this.fail(code);
    }
  }

  protected async rename(passkey: PasskeyView): Promise<void> {
    const name = await this.open<string>(PasskeyNameDialog, { name: passkey.name ?? '' });
    if (!name) return;
    await this.attempt(() => this.auth.renamePasskey(passkey.id, name));
    this.passkeys.reload();
  }

  protected async deletePasskey(passkey: PasskeyView): Promise<void> {
    const confirmed = await this.confirm({
      titleKey: 'settings.deletePasskey.title',
      textKey: 'settings.deletePasskey.text',
      confirmKey: 'settings.deletePasskey.confirm',
    });
    if (!confirmed) return;
    await this.attempt(() => this.auth.deletePasskey(passkey.id));
    this.passkeys.reload();
  }

  protected async enableTwoFactor(): Promise<void> {
    await this.open(TwoFactorDialog, undefined);
    await this.auth.refresh();
  }

  protected async newBackupCodes(): Promise<void> {
    const closed = await this.open<{ result: string[] }>(PasswordDialog, {
      titleKey: 'settings.codes.title',
      hintKey: 'settings.codes.passwordHint',
      confirmKey: 'settings.setup.next',
      action: (password) => this.auth.newBackupCodes(password),
    } satisfies PasswordDialogData<string[]>);
    if (closed?.result) await this.open(CodesDialog, { codes: closed.result });
  }

  protected async disableTwoFactor(): Promise<void> {
    await this.open(PasswordDialog, {
      titleKey: 'settings.disable.title',
      hintKey: 'settings.disable.hint',
      confirmKey: 'settings.disable.confirm',
      warningKey: this.isAdmin() ? 'settings.disable.warning' : undefined,
      danger: true,
      action: (password) => this.auth.disableTwoFactor(password),
    } satisfies PasswordDialogData);
  }

  protected async endSession(session: SessionView): Promise<void> {
    await this.attempt(async () => {
      await this.sessionsApi.end(session.id);
      await this.say('settings.sessions.ended');
    });
    this.sessions.reload();
  }

  protected async endOtherSessions(): Promise<void> {
    const confirmed = await this.confirm({
      titleKey: 'settings.sessions.endOthersTitle',
      textKey: 'settings.sessions.endOthersText',
      confirmKey: 'settings.sessions.endOthersConfirm',
    });
    if (!confirmed) return;
    await this.attempt(() => this.sessionsApi.endOthers());
    this.sessions.reload();
  }

  private async signInAgain(): Promise<void> {
    const confirmed = await this.confirm({
      titleKey: 'settings.fresh.title',
      textKey: 'settings.fresh.text',
      confirmKey: 'settings.fresh.confirm',
    });
    if (!confirmed) return;
    await this.auth.signOut();
    await this.router.navigateByUrl(RETURN_HERE);
  }

  private confirm(data: ConfirmDialogData): Promise<boolean | undefined> {
    return this.open<boolean>(ConfirmDialog, data);
  }

  private open<R>(component: unknown, data: unknown): Promise<R | undefined> {
    const ref = this.dialog.open(component as never, { data, autoFocus: 'first-tabbable' });
    return firstValueFrom(ref.afterClosed()) as Promise<R | undefined>;
  }

  private async attempt(action: () => Promise<unknown>): Promise<void> {
    try {
      await action();
    } catch (error) {
      await this.fail(codeOf(error));
    }
  }

  private fail(code: string): Promise<void> {
    return this.say(errorKey(code));
  }

  private async say(key: string): Promise<void> {
    const text = await firstValueFrom(this.transloco.selectTranslate(key));
    this.snackBar.open(text, undefined, { duration: 6000 });
  }
}
