import type { INestApplicationContext } from '@nestjs/common';

const SIGNALS = ['SIGTERM', 'SIGINT'] as const;

/**
 * Keeps the worker process alive until SIGTERM or SIGINT, then closes the Nest context.
 * The timer is the only thing holding the event loop until the job queue does.
 */
export function runUntilSignal(ctx: INestApplicationContext): Promise<void> {
  return new Promise((resolve, reject) => {
    const keepAlive = setInterval(() => undefined, 1 << 30);
    const stop = (): void => {
      for (const signal of SIGNALS) process.off(signal, stop);
      clearInterval(keepAlive);
      ctx.close().then(resolve, reject);
    };
    for (const signal of SIGNALS) process.once(signal, stop);
  });
}
