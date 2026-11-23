import 'reflect-metadata';
import {
  Controller,
  ForbiddenException,
  Get,
  type INestApplication,
  NotFoundException,
} from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ErrorFilter } from './error.filter.js';

@Controller('throw')
class ThrowingController {
  @Get('crash')
  crash(): never {
    throw new Error('secret detail from the database');
  }

  @Get('missing')
  missing(): never {
    throw new NotFoundException();
  }

  @Get('coded')
  coded(): never {
    throw new ForbiddenException({ code: 'X_CODE', params: { a: 1 } });
  }

  @Get('teapot')
  teapot(): never {
    throw new ForbiddenException('human readable text');
  }
}

describe('ErrorFilter', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ThrowingController],
      providers: [{ provide: APP_FILTER, useClass: ErrorFilter }],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.init();
  });

  afterAll(() => app.close());

  it('hides unexpected errors behind INTERNAL', async () => {
    const res = await request(app.getHttpServer()).get('/throw/crash').expect(500);
    expect(res.body).toEqual({ code: 'INTERNAL', params: {} });
    expect(JSON.stringify(res.body)).not.toContain('secret detail');
  });

  it('maps a plain 404 to NOT_FOUND', async () => {
    await request(app.getHttpServer())
      .get('/throw/missing')
      .expect(404, { code: 'NOT_FOUND', params: {} });
  });

  it('keeps our own code and params', async () => {
    await request(app.getHttpServer())
      .get('/throw/coded')
      .expect(403, { code: 'X_CODE', params: { a: 1 } });
  });

  it('drops human-readable messages', async () => {
    await request(app.getHttpServer())
      .get('/throw/teapot')
      .expect(403, { code: 'FORBIDDEN', params: {} });
  });

  it('answers unknown routes with NOT_FOUND', async () => {
    await request(app.getHttpServer())
      .get('/nowhere')
      .expect(404, { code: 'NOT_FOUND', params: {} });
  });
});
