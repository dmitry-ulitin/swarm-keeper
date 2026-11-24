import { Module } from '@nestjs/common';
import { mailEnv } from './mail-env.js';
import { MAIL_TRANSPORT, SmtpTransport } from './mail-transport.js';

/** Outgoing email over SMTP (Mailpit in development). */
@Module({
  providers: [{ provide: MAIL_TRANSPORT, useFactory: () => new SmtpTransport(mailEnv()) }],
  exports: [MAIL_TRANSPORT],
})
export class MailModule {}
