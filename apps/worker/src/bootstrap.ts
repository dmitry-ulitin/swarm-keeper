import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module.js';

export function bootstrapWorker(): Promise<INestApplicationContext> {
  return NestFactory.createApplicationContext(WorkerModule);
}
