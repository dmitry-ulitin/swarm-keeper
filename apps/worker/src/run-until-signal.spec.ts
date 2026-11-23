import 'reflect-metadata';
import { afterEach, describe, expect, it } from 'vitest';
import { bootstrapWorker } from './bootstrap.js';
import { runUntilSignal } from './run-until-signal.js';

describe('runUntilSignal', () => {
  afterEach(() => {
    process.removeAllListeners('SIGTERM');
    process.removeAllListeners('SIGINT');
  });

  it('stays pending until SIGTERM, then closes the context', async () => {
    const ctx = await bootstrapWorker();
    let closed = false;
    const originalClose = ctx.close.bind(ctx);
    ctx.close = async () => {
      closed = true;
      await originalClose();
    };

    let settled = false;
    const running = runUntilSignal(ctx).then(() => (settled = true));
    await new Promise((r) => setTimeout(r, 50));
    expect(settled).toBe(false);

    process.emit('SIGTERM');
    await running;
    expect(closed).toBe(true);
  });

  it('also stops on SIGINT', async () => {
    const ctx = await bootstrapWorker();
    const running = runUntilSignal(ctx);
    process.emit('SIGINT');
    await expect(running).resolves.toBeUndefined();
  });
});
