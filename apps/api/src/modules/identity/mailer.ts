import { Injectable, Logger } from '@nestjs/common';

/** Injection token for the Mailer. */
export const MAILER = Symbol('MAILER');

export interface InvitationMail {
  email: string;
  url: string;
  /** The invitation's language, picked by the inviter. */
  locale: string;
  inviterName: string;
  familyName: string;
  expiresAt: Date;
}

export interface LinkMail {
  email: string;
  url: string;
  /** The user's language (`user.locale`). */
  locale: string;
}

/** Outgoing auth emails. `SmtpMailer` sends them; `LoggingMailer` only logs the links. */
export interface Mailer {
  invitation(input: InvitationMail): Promise<void>;
  verifyEmail(input: LinkMail): Promise<void>;
  resetPassword(input: LinkMail): Promise<void>;
}

/** For the seed script: writes the link to the log instead of sending an email. */
@Injectable()
export class LoggingMailer implements Mailer {
  private readonly logger = new Logger('Mailer');

  async invitation({ email, url, locale }: InvitationMail) {
    this.logger.log(`Invitation for ${email} (${locale}): ${url}`);
  }

  async verifyEmail({ email, url }: LinkMail) {
    this.logger.log(`Email verification for ${email}: ${url}`);
  }

  async resetPassword({ email, url }: LinkMail) {
    this.logger.log(`Password reset for ${email}: ${url}`);
  }
}
