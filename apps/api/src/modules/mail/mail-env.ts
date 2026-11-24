export interface MailEnv {
  /** SMTP server (SMTP_URL), e.g. smtp://user:pass@host:587 or smtps://…:465. */
  smtpUrl: string;
  /** The From header (MAIL_FROM), e.g. `Swarm Keeper <noreply@archive.example>`. */
  from: string;
}

/**
 * Mail settings from the environment. Fails closed like `authEnv`: the Mailpit defaults apply
 * only when NODE_ENV is explicitly `development` or `test`.
 */
export function mailEnv(env: NodeJS.ProcessEnv = process.env): MailEnv {
  const dev = env['NODE_ENV'] === 'development' || env['NODE_ENV'] === 'test';
  const setting = (name: string, devDefault: string): string => {
    const value = env[name]?.trim();
    if (value) {
      return value;
    }
    if (!dev) {
      throw new Error(`${name} is required unless NODE_ENV is development or test`);
    }
    return devDefault;
  };
  return {
    smtpUrl: setting('SMTP_URL', 'smtp://127.0.0.1:1025'),
    from: setting('MAIL_FROM', 'Swarm Keeper <noreply@swarm-keeper.test>'),
  };
}
