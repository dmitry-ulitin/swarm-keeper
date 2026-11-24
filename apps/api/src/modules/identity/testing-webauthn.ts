// Tests only: a software authenticator that answers WebAuthn registration with a "none"
// attestation, so the API tests can run Better Auth's real passkey ceremony.
import { createHash, generateKeyPairSync, randomBytes } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { authEnv } from './auth-env.js';
import { clientIp } from './testing.js';

type Cbor = number | string | Uint8Array | Map<Cbor, Cbor> | { [key: string]: Cbor };

function head(major: number, length: number): Buffer {
  if (length < 24) return Buffer.from([(major << 5) | length]);
  if (length < 256) return Buffer.from([(major << 5) | 24, length]);
  if (length < 65536) return Buffer.from([(major << 5) | 25, length >> 8, length & 0xff]);
  const b = Buffer.alloc(5);
  b[0] = (major << 5) | 26;
  b.writeUInt32BE(length, 1);
  return b;
}

/** Just enough CBOR for an attestation object and a COSE key. */
function cbor(value: Cbor): Buffer {
  if (typeof value === 'number') return value >= 0 ? head(0, value) : head(1, -1 - value);
  if (typeof value === 'string') {
    const bytes = Buffer.from(value, 'utf8');
    return Buffer.concat([head(3, bytes.length), bytes]);
  }
  if (value instanceof Uint8Array)
    return Buffer.concat([head(2, value.length), Buffer.from(value)]);
  const entries = value instanceof Map ? [...value.entries()] : Object.entries(value);
  return Buffer.concat([
    head(5, entries.length),
    ...entries.flatMap(([k, v]) => [cbor(k), cbor(v)]),
  ]);
}

const b64url = (data: Uint8Array) => Buffer.from(data).toString('base64url');

/** A RegistrationResponseJSON for the options Better Auth generated. */
export function createCredential(
  options: { challenge: string; rp: { id?: string } },
  origin: string,
) {
  const { publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const jwk = publicKey.export({ format: 'jwk' }) as { x: string; y: string };
  const coseKey = new Map<Cbor, Cbor>([
    [1, 2],
    [3, -7],
    [-1, 1],
    [-2, Buffer.from(jwk.x, 'base64url')],
    [-3, Buffer.from(jwk.y, 'base64url')],
  ]);
  const credentialId = randomBytes(16);
  const rpIdHash = createHash('sha256')
    .update(options.rp.id ?? 'localhost')
    .digest();
  const idLength = Buffer.alloc(2);
  idLength.writeUInt16BE(credentialId.length);
  const authData = Buffer.concat([
    rpIdHash,
    Buffer.from([0x01 | 0x04 | 0x40]), // user present, user verified, attested credential
    Buffer.alloc(4), // sign count
    Buffer.alloc(16), // AAGUID
    idLength,
    credentialId,
    cbor(coseKey),
  ]);
  const clientDataJSON = Buffer.from(
    JSON.stringify({
      type: 'webauthn.create',
      challenge: options.challenge,
      origin,
      crossOrigin: false,
    }),
  );
  return {
    id: b64url(credentialId),
    rawId: b64url(credentialId),
    type: 'public-key',
    authenticatorAttachment: 'platform',
    clientExtensionResults: {},
    response: {
      clientDataJSON: b64url(clientDataJSON),
      attestationObject: b64url(cbor({ fmt: 'none', attStmt: {}, authData })),
      transports: ['internal'],
    },
  };
}

/** The whole passkey sign-up ceremony; `bearer` authenticates as an existing user instead. */
export async function registerWithPasskey(
  app: INestApplication,
  context: unknown,
  options: { bearer?: string; createSession?: boolean; passkeyName?: string } = {},
) {
  const agent = request.agent(app.getHttpServer());
  const ip = clientIp();
  const query =
    context === undefined ? '' : `?context=${encodeURIComponent(JSON.stringify(context))}`;
  let generate = agent
    .get(`/api/auth/passkey/generate-register-options${query}`)
    .set('x-forwarded-for', ip);
  if (options.bearer) generate = generate.set('Authorization', options.bearer);
  const generated = await generate;
  if (generated.status !== 200) return { generated, verified: undefined, token: undefined };
  const response = createCredential(generated.body, new URL(authEnv().baseURL).origin);
  let verify = agent
    .post('/api/auth/passkey/verify-registration')
    .set('x-forwarded-for', ip)
    .set('origin', new URL(authEnv().baseURL).origin)
    .send({
      response,
      createSession: options.createSession ?? true,
      ...(options.passkeyName ? { name: options.passkeyName } : {}),
    });
  if (options.bearer) verify = verify.set('Authorization', options.bearer);
  const verified = await verify;
  const token = verified.headers['set-auth-token'] as string | undefined;
  return { generated, verified, token };
}
