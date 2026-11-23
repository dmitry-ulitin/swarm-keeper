import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './configure-app.js';

async function bootstrap(): Promise<void> {
  const app = configureApp(await NestFactory.create(AppModule, { bodyParser: false }));
  await app.listen(process.env['PORT'] ?? 3000);
}

await bootstrap();
