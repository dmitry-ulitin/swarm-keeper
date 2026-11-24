import { describe, expect, it } from 'vitest';
import type { MailTransport, OutgoingMail } from '../mail/index.js';
import { SmtpMailer } from './smtp-mailer.js';

const invitation = {
  email: 'a@example.test',
  url: 'https://archive.example/invite/1',
  locale: 'ru',
  inviterName: 'Анна',
  familyName: 'Ивановы',
  expiresAt: new Date('2026-12-01T12:00:00Z'),
};

describe('SmtpMailer', () => {
  it('sends the rendered invitation in the invitation language', async () => {
    const sent: OutgoingMail[] = [];
    const transport: MailTransport = { send: async (mail) => void sent.push(mail) };
    await new SmtpMailer(transport).invitation(invitation);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe('a@example.test');
    expect(sent[0]?.subject).toBe('Приглашение в семью «Ивановы»');
  });

  it('passes a transport failure on to the caller', async () => {
    const failure = new Error('SMTP down');
    const transport: MailTransport = { send: () => Promise.reject(failure) };
    await expect(new SmtpMailer(transport).invitation(invitation)).rejects.toBe(failure);
  });
});
