import { type Transporter, createTransport } from 'nodemailer';
import type { MailEnv } from './mail-env.js';

export interface OutgoingMail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/** Injection token for the MailTransport. */
export const MAIL_TRANSPORT = Symbol('MAIL_TRANSPORT');

export interface MailTransport {
  /** Resolves once the SMTP server accepted the message; rejects otherwise. */
  send(mail: OutgoingMail): Promise<void>;
}

export class SmtpTransport implements MailTransport {
  private readonly transporter: Transporter;

  constructor(private readonly env: MailEnv) {
    this.transporter = createTransport(env.smtpUrl);
  }

  async send(mail: OutgoingMail): Promise<void> {
    await this.transporter.sendMail({ from: this.env.from, ...mail });
  }
}
