import 'reflect-metadata';
import { Controller, Get, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from './app.module.js';
import { configureApp } from './configure-app.js';

/** Stands in for any route that has no @AllowAnonymous(). */
@Controller('protected-check')
class ProtectedCheckController {
  @Get()
  check(): { ok: true } {
    return { ok: true };
  }
}

describe('app authentication', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ProtectedCheckController],
    }).compile();
    app = configureApp(moduleRef.createNestApplication({ bodyParser: false, logger: false }));
    await app.init();
  });

  afterAll(() => app.close());

  it('keeps /health public', async () => {
    await request(app.getHttpServer()).get('/api/v1/health').expect(200, { status: 'ok' });
  });

  it('mounts Better Auth at /api/auth', async () => {
    const res = await request(app.getHttpServer()).get('/api/auth/get-session').expect(200);
    expect(res.body).toBeNull();
  });

  it('closes every other route without a session', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/protected-check')
      .expect(401, { code: 'UNAUTHENTICATED', params: {} });
  });

  it('serves GET /me under /api/v1', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/me')
      .expect(401, { code: 'UNAUTHENTICATED', params: {} });
  });
});
