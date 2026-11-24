import { describe, expect, it } from 'vitest';
import { UsageError, parseFamilyCommand } from './family-command.js';

const env = { OPERATOR_EMAIL: 'op@x.y' };

describe('parseFamilyCommand', () => {
  it('parses create', () => {
    expect(
      parseFamilyCommand(
        ['create', '--name', 'Ивановы', '--owner-email', 'a@b.c', '--locale', 'ru'],
        env,
      ),
    ).toEqual({
      kind: 'create',
      name: 'Ивановы',
      ownerEmail: 'a@b.c',
      locale: 'ru',
      operatorEmail: 'op@x.y',
    });
  });

  it('defaults the locale to en', () => {
    expect(
      parseFamilyCommand(['create', '--name', 'X', '--owner-email', 'a@b.c'], env),
    ).toMatchObject({ locale: 'en' });
  });

  it('lets --inviter override OPERATOR_EMAIL', () => {
    expect(
      parseFamilyCommand(
        ['create', '--name', 'X', '--owner-email', 'a@b.c', '--inviter', 'me@x.y'],
        env,
      ),
    ).toMatchObject({ operatorEmail: 'me@x.y' });
  });

  it('parses invite-owner with and without --owner-email', () => {
    expect(parseFamilyCommand(['invite-owner', '--family', 'the-ivanovs'], env)).toEqual({
      kind: 'invite-owner',
      familySlug: 'the-ivanovs',
      operatorEmail: 'op@x.y',
    });
    expect(
      parseFamilyCommand(
        ['invite-owner', '--family', 'the-ivanovs', '--owner-email', 'a@b.c'],
        env,
      ),
    ).toEqual({
      kind: 'invite-owner',
      familySlug: 'the-ivanovs',
      ownerEmail: 'a@b.c',
      operatorEmail: 'op@x.y',
    });
  });

  it('parses list without needing an operator', () => {
    expect(parseFamilyCommand(['list'], {})).toEqual({ kind: 'list' });
  });

  it.each([
    ['a missing --name', ['create', '--owner-email', 'a@b.c'], env],
    ['a missing --owner-email', ['create', '--name', 'X'], env],
    ['a missing operator', ['create', '--name', 'X', '--owner-email', 'a@b.c'], {}],
    ['a missing --family', ['invite-owner'], env],
    ['an unknown subcommand', ['delete'], env],
    ['no subcommand', [], env],
    ['an unknown flag', ['list', '--force'], env],
    ['a flag without a value', ['create', '--name'], env],
  ])('throws UsageError for %s', (_label, argv, environment) => {
    expect(() => parseFamilyCommand(argv, environment)).toThrow(UsageError);
  });
});
