import { describe, expect, it } from 'vitest';
import { mailEnv } from './mail-env.js';

describe('mailEnv', () => {
  it.each(['development', 'test'])('has dev defaults when NODE_ENV=%s', (NODE_ENV) => {
    expect(mailEnv({ NODE_ENV })).toEqual({
      smtpUrl: 'smtp://127.0.0.1:1025',
      from: 'Swarm Keeper <noreply@swarm-keeper.test>',
    });
  });

  it('takes trimmed values from the environment', () => {
    expect(
      mailEnv({
        SMTP_URL: ' smtps://u:p@mail.example:465 ',
        MAIL_FROM: ' Archive <a@example.org> ',
      }),
    ).toEqual({ smtpUrl: 'smtps://u:p@mail.example:465', from: 'Archive <a@example.org>' });
  });

  it.each([{ NODE_ENV: 'production' }, {}])('requires SMTP_URL outside dev (%o)', (env) => {
    expect(() => mailEnv({ ...env, MAIL_FROM: 'a@example.org' })).toThrow(/SMTP_URL is required/);
  });

  it.each([{ NODE_ENV: 'production' }, {}])('requires MAIL_FROM outside dev (%o)', (env) => {
    expect(() => mailEnv({ ...env, SMTP_URL: 'smtp://mail.example' })).toThrow(
      /MAIL_FROM is required/,
    );
  });
});
