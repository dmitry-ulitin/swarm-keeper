import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { bootstrapWorker } from './bootstrap.js';
import { WorkerModule } from './worker.module.js';

describe('bootstrapWorker', () => {
  it('creates a Nest context without an HTTP server and closes it cleanly', async () => {
    const ctx = await bootstrapWorker();
    expect(ctx.get(WorkerModule)).toBeDefined();
    expect('getHttpServer' in ctx).toBe(false);
    await expect(ctx.close()).resolves.toBeUndefined();
  });
});
