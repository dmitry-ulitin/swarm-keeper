import { parseArgs } from 'node:util';

export const USAGE = `Usage:
  pnpm family:create --name <name> --owner-email <email> [--locale en|ru] [--inviter <email>]
  pnpm family:invite-owner --family <slug> [--owner-email <email>] [--inviter <email>]
  pnpm family:list

The inviter is the operator's own verified account: --inviter, or OPERATOR_EMAIL.`;

export type FamilyCommand =
  | { kind: 'create'; name: string; ownerEmail: string; locale: string; operatorEmail: string }
  | { kind: 'invite-owner'; familySlug: string; ownerEmail?: string; operatorEmail: string }
  | { kind: 'list' };

/** Bad command-line arguments; the message is the usage text. */
export class UsageError extends Error {
  constructor(readonly problem: string) {
    super(`${problem}\n\n${USAGE}`);
    this.name = 'UsageError';
  }
}

const OPTIONS = {
  create: {
    name: { type: 'string' },
    'owner-email': { type: 'string' },
    locale: { type: 'string' },
    inviter: { type: 'string' },
  },
  'invite-owner': {
    family: { type: 'string' },
    'owner-email': { type: 'string' },
    inviter: { type: 'string' },
  },
  list: {},
} as const;

function required(value: string | undefined, flag: string): string {
  if (!value?.trim()) {
    throw new UsageError(`${flag} is required`);
  }
  return value;
}

/** `family <create|invite-owner|list> [flags]` → the command to run. */
export function parseFamilyCommand(argv: string[], env: NodeJS.ProcessEnv): FamilyCommand {
  const [kind, ...rest] = argv;
  if (kind !== 'create' && kind !== 'invite-owner' && kind !== 'list') {
    throw new UsageError(kind ? `Unknown command "${kind}"` : 'A command is required');
  }

  let values: Record<string, string | undefined>;
  try {
    ({ values } = parseArgs({
      args: rest,
      options: OPTIONS[kind],
      strict: true,
      allowPositionals: false,
    }) as { values: Record<string, string | undefined> });
  } catch (error) {
    throw new UsageError(error instanceof Error ? error.message : String(error));
  }

  if (kind === 'list') {
    return { kind };
  }
  const operatorEmail = required(
    values['inviter'] ?? env['OPERATOR_EMAIL'],
    '--inviter or OPERATOR_EMAIL',
  );
  if (kind === 'create') {
    return {
      kind,
      name: required(values['name'], '--name'),
      ownerEmail: required(values['owner-email'], '--owner-email'),
      locale: values['locale'] ?? 'en',
      operatorEmail,
    };
  }
  const ownerEmail = values['owner-email'];
  return {
    kind,
    familySlug: required(values['family'], '--family'),
    ...(ownerEmail === undefined ? {} : { ownerEmail }),
    operatorEmail,
  };
}
