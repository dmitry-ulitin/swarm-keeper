export { LAYOUT_COLORS, type LayoutInput, escapeHtml, renderLayout } from './layout.js';
export { type MailEnv, mailEnv } from './mail-env.js';
export {
  MAIL_TRANSPORT,
  type MailTransport,
  type OutgoingMail,
  SmtpTransport,
} from './mail-transport.js';
export { MailModule } from './mail.module.js';
/** Development and tests only. */
export { type ReceivedMail, latestMailTo } from './mailpit.js';
