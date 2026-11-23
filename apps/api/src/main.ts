import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp, listenAddress } from './configure-app.js';

async function bootstrap(): Promise<void> {
  const app = configureApp(await NestFactory.create(AppModule, { bodyParser: false }));
  const { port, host } = listenAddress();
  await app.listen(port, host);
}

await bootstrap();
