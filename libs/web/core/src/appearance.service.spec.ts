import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { AppearanceService, browserLang } from './appearance.service';

describe('browserLang', () => {
  it.each([
    [['ru-RU'], 'ru'],
    [['ru'], 'ru'],
    [['RU'], 'ru'],
    [['uk', 'ru'], 'en'],
    [['de'], 'en'],
    [[], 'en'],
  ])('%o → %s', (languages, expected) => {
    expect(browserLang(languages)).toBe(expected);
  });
});

describe('AppearanceService', () => {
  afterEach(() => {
    const html = TestBed.inject(DOCUMENT).documentElement;
    html.removeAttribute('data-size');
    html.lang = 'en';
  });

  it('reflects the language on <html lang>', () => {
    const appearance = TestBed.inject(AppearanceService);
    appearance.setLang('ru');
    TestBed.tick();
    expect(TestBed.inject(DOCUMENT).documentElement.lang).toBe('ru');
  });

  it('sets data-size only in large mode', () => {
    const appearance = TestBed.inject(AppearanceService);
    const html = TestBed.inject(DOCUMENT).documentElement;
    appearance.setUiSize('large');
    TestBed.tick();
    expect(html.getAttribute('data-size')).toBe('large');
    appearance.setUiSize('compact');
    TestBed.tick();
    expect(html.hasAttribute('data-size')).toBe(false);
  });

  it('starts compact', () => {
    expect(TestBed.inject(AppearanceService).uiSize()).toBe('compact');
  });
});
