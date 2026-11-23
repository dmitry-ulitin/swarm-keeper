import 'reflect-metadata';
import { bootstrapWorker } from './bootstrap.js';
import { runUntilSignal } from './run-until-signal.js';

await runUntilSignal(await bootstrapWorker());
