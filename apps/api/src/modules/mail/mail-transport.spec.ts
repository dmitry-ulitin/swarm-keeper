import { describe, expect, it } from 'vitest';
import { mailEnv } from './mail-env.js';
import { SmtpTransport } from './mail-transport.js';
import { latestMailTo } from './mailpit.js';

describe('SmtpTransport (Mailpit must be up)', () => {
  it('delivers an email that Mailpit receives', async () => {
    const to = `mail-${Date.now()}@example.test`;
    await new SmtpTransport(mailEnv()).send({
      to,
      subject: 'Проверка — check',
      html: '<p>Привет</p>',
      text: 'Привет',
    });
    const mail = await latestMailTo(to);
    expect(mail.subject).toBe('Проверка — check');
    expect(mail.to).toContain(to);
    expect(mail.text.trim()).toBe('Привет');
  });

  it('rejects when the SMTP server is unreachable', async () => {
    const transport = new SmtpTransport({ ...mailEnv(), smtpUrl: 'smtp://127.0.0.1:1' });
    await expect(
      transport.send({ to: 'x@example.test', subject: 's', html: '<p>h</p>', text: 't' }),
    ).rejects.toThrow();
  });
});
