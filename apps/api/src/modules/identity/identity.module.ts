import { Module } from '@nestjs/common';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { DATABASE, type Database } from '../../database/index.js';
import { authEnv } from './auth-env.js';
import { createAuth } from './create-auth.js';
import { LoggingMailer, MAILER, type Mailer } from './mailer.js';
import { MeController } from './me.controller.js';

/** Mailer for auth emails; step 4 replaces the logging one with SMTP. */
@Module({
  providers: [{ provide: MAILER, useClass: LoggingMailer }],
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
  controllers: [MeController],
})
export class IdentityModule {}
