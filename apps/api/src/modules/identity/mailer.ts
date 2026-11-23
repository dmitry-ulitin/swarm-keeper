import { Injectable, Logger } from '@nestjs/common';

/** Injection token for the Mailer. */
export const MAILER = Symbol('MAILER');

/** Outgoing auth emails. Step 4 adds the SMTP implementation with en/ru templates. */
export interface Mailer {
  invitation(input: { email: string; url: string; locale: string }): Promise<void>;
  verifyEmail(input: { email: string; url: string }): Promise<void>;
  resetPassword(input: { email: string; url: string }): Promise<void>;
}

/** Development: writes the link to the log instead of sending an email. */
@Injectable()
export class LoggingMailer implements Mailer {
  private readonly logger = new Logger('Mailer');

  async invitation({ email, url, locale }: { email: string; url: string; locale: string }) {
    this.logger.log(`Invitation for ${email} (${locale}): ${url}`);
  }

  async verifyEmail({ email, url }: { email: string; url: string }) {
    this.logger.log(`Email verification for ${email}: ${url}`);
  }

  async resetPassword({ email, url }: { email: string; url: string }) {
    this.logger.log(`Password reset for ${email}: ${url}`);
  }
}
