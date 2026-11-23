// @ts-check
import eslint from '@eslint/js';
import sheriff from '@sheriff-arch/eslint-plugin-sheriff';
import angular from 'angular-eslint';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  {
    ignores: [
      '**/node_modules/',
      '**/dist/',
      '**/coverage/',
      '**/.angular/',
      '.superpowers/',
      'docs/',
    ],
  },
  {
    files: ['**/*.ts'],
    extends: [eslint.configs.recommended, tseslint.configs.recommended],
  },
  {
    files: ['apps/web/**/*.ts', 'libs/web/**/*.ts'],
    extends: [angular.configs.tsRecommended],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'sk', style: 'kebab-case' },
      ],
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'sk', style: 'camelCase' },
      ],
    },
  },
  {
    files: ['apps/web/**/*.html', 'libs/web/**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
  },
  {
    files: ['apps/**/*.ts', 'libs/**/*.ts'],
    extends: [sheriff.configs.all],
  },
);
