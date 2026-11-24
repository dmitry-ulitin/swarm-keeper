// Development and tests only: reads what the API sent from Mailpit's HTTP API.

export interface ReceivedMail {
  subject: string;
  html: string;
  text: string;
  to: string[];
}

function mailpitUrl(): string {
  return process.env['MAILPIT_URL']?.trim() || 'http://127.0.0.1:8025';
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${mailpitUrl()}${path}`);
  if (!res.ok) {
    throw new Error(`Mailpit ${path}: HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

/** The newest message addressed to `address`; polls until it arrives or the timeout passes. */
export async function latestMailTo(address: string, timeoutMs = 5000): Promise<ReceivedMail> {
  const deadline = Date.now() + timeoutMs;
  const query = encodeURIComponent(`to:"${address}"`);
  for (;;) {
    const found = await getJson<{ messages: { ID: string }[] }>(`/api/v1/search?query=${query}`);
    const id = found.messages[0]?.ID;
    if (id) {
      const message = await getJson<{
        Subject: string;
        HTML: string;
        Text: string;
        To: { Address: string }[];
      }>(`/api/v1/message/${id}`);
      return {
        subject: message.Subject,
        html: message.HTML,
        text: message.Text,
        to: message.To.map((t) => t.Address),
      };
    }
    if (Date.now() >= deadline) {
      throw new Error(`No email to ${address} in Mailpit after ${timeoutMs} ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
