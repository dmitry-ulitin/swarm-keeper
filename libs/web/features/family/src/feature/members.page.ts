import { ChangeDetectionStrategy, Component, computed, inject, resource } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import {
  AppearanceService,
  AuthService,
  type InvitationRow,
  type MemberView,
} from '@swarm-keeper/web-core';
import { firstValueFrom } from 'rxjs';
import { canManage, codeOf, errorKey, isExpired } from '../data-access';
import { RoleBadge } from '../ui';
import { ConfirmDialog, type ConfirmDialogData } from './confirm.dialog';
import { InviteDialog } from './invite.dialog';

/**
 * Keys passed to dialogs and snack-bars, listed for transloco-keys-manager:
 * t(family.invitations.cancelTitle, family.invitations.cancelText, family.invitations.cancelConfirm, family.invitations.keep, family.invitations.resent, family.invitations.cancelled, family.dialog.sent, family.notImplemented, family.invitations.lang.en, family.invitations.lang.ru)
 */

/** `/family/members`: the active family's members and pending invitations (owners and admins). */
@Component({
  selector: 'sk-members-page',
  imports: [MatButtonModule, MatIconModule, MatMenuModule, RoleBadge, RouterLink, TranslocoPipe],
  templateUrl: './members.page.html',
  styleUrls: ['./family.scss', './members.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MembersPage {
  protected readonly auth = inject(AuthService);
  private readonly appearance = inject(AppearanceService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly transloco = inject(TranslocoService);

  protected readonly members = resource({ loader: () => this.auth.listMembers() });
  protected readonly allInvitations = resource({ loader: () => this.auth.listInvitations() });
  protected readonly invitations = computed(() =>
    // value() throws in the error state: read it only when there is one.
    (this.allInvitations.hasValue() ? this.allInvitations.value() : []).filter(
      (row) => row.status === 'pending',
    ),
  );

  /** Without the required 2FA the server refuses every change: hide them, show the way. */
  protected readonly blocked = computed(() => this.auth.twoFactorRequired());
  private readonly dateFormat = computed(
    () => new Intl.DateTimeFormat(this.appearance.lang(), { dateStyle: 'medium' }),
  );

  protected date(value: string): string {
    return this.dateFormat().format(new Date(value));
  }

  protected isSelf(member: MemberView): boolean {
    return member.userId === this.auth.user()?.id;
  }

  protected manageable(member: MemberView): boolean {
    const userId = this.auth.user()?.id ?? '';
    return canManage({ userId, role: this.auth.role() }, member);
  }

  protected expired(row: InvitationRow): boolean {
    return isExpired(row);
  }

  protected async invite(): Promise<void> {
    const sent = await firstValueFrom(
      this.dialog.open(InviteDialog, { autoFocus: 'first-tabbable' }).afterClosed(),
    );
    if (!sent) return;
    await this.say('family.dialog.sent');
    this.allInvitations.reload();
  }

  protected async resend(row: InvitationRow): Promise<void> {
    try {
      await this.auth.resendInvitation(row);
      await this.say('family.invitations.resent');
    } catch (error) {
      await this.say(errorKey(codeOf(error)));
    }
    this.allInvitations.reload();
  }

  protected async cancel(row: InvitationRow): Promise<void> {
    const data: ConfirmDialogData = {
      titleKey: 'family.invitations.cancelTitle',
      textKey: 'family.invitations.cancelText',
      confirmKey: 'family.invitations.cancelConfirm',
      cancelKey: 'family.invitations.keep',
    };
    const confirmed = await firstValueFrom(this.dialog.open(ConfirmDialog, { data }).afterClosed());
    if (!confirmed) return;
    try {
      await this.auth.cancelInvitation(row.id);
      await this.say('family.invitations.cancelled');
    } catch (error) {
      await this.say(errorKey(codeOf(error)));
    }
    this.allInvitations.reload();
  }

  /** "Change role" and "Remove" wait for the archive's retention rules and audit log. */
  protected notImplemented(): Promise<void> {
    return this.say('family.notImplemented');
  }

  private async say(key: string): Promise<void> {
    const text = await firstValueFrom(this.transloco.selectTranslate(key));
    this.snackBar.open(text, undefined, { duration: 6000 });
  }
}
