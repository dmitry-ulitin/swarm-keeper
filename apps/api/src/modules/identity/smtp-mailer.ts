import { Inject, Injectable } from '@nestjs/common';
import { MAIL_TRANSPORT, type MailTransport } from '../mail/index.js';
import { invitationEmail, resetPasswordEmail, verifyEmailEmail } from './auth-emails.js';
import type { InvitationMail, LinkMail, Mailer } from './mailer.js';

/** Auth emails in the recipient's language, over the mail module's SMTP transport. */
@Injectable()
export class SmtpMailer implements Mailer {
  constructor(@Inject(MAIL_TRANSPORT) private readonly transport: MailTransport) {}

  async invitation({ email, ...rest }: InvitationMail) {
    await this.transport.send(invitationEmail({ to: email, ...rest }));
  }

  async verifyEmail({ email, url, locale }: LinkMail) {
    await this.transport.send(verifyEmailEmail({ to: email, url, locale }));
  }

  async resetPassword({ email, url, locale }: LinkMail) {
    await this.transport.send(resetPasswordEmail({ to: email, url, locale }));
  }
}
