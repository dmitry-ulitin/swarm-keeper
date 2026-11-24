import { Module } from '@nestjs/common';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { DATABASE, type Database } from '../../database/index.js';
import { authEnv } from './auth-env.js';
import { createAuth } from './create-auth.js';
import { MailModule } from '../mail/index.js';
import { MAILER, type Mailer } from './mailer.js';
import { InvitationsController } from './invitations.controller.js';
import { MeController } from './me.controller.js';
import { SessionsController } from './sessions.controller.js';
import { SmtpMailer } from './smtp-mailer.js';

/** Auth emails over SMTP (Mailpit in development). */
@Module({
  imports: [MailModule],
  providers: [{ provide: MAILER, useClass: SmtpMailer }],
  exports: [MAILER],
})
class MailerModule {}

/**
 * Better Auth inside the API: /api/auth/* and a global guard.
 * Every route needs a session unless it is marked @AllowAnonymous().
 */
@Module({
  imports: [
    AuthModule.forRootAsync({
      imports: [MailerModule],
      inject: [DATABASE, MAILER],
      useFactory: (db: Database, mailer: Mailer) => ({ auth: createAuth(db, authEnv(), mailer) }),
    }),
  ],
  controllers: [MeController, InvitationsController, SessionsController],
})
export class IdentityModule {}
