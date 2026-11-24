import { Directive, TemplateRef, ViewContainerRef, effect, inject, input } from '@angular/core';
import { AuthService } from './auth.service';

/**
 * `*skCan="['asset', 'delete']"`: renders its content only when the member may do it.
 * `skCanOwnerId` is accepted for "own item" rules, which arrive with the archive tables.
 */
@Directive({ selector: '[skCan]' })
export class CanDirective {
  private readonly auth = inject(AuthService);
  private readonly template = inject(TemplateRef);
  private readonly container = inject(ViewContainerRef);

  readonly skCan = input.required<readonly [string, string]>();
  readonly skCanOwnerId = input<string | null>(null);

  constructor() {
    effect(() => {
      const [resource, action] = this.skCan();
      const allowed = this.auth.permissions().includes(`${resource}:${action}`);
      if (allowed && this.container.length === 0) this.container.createEmbeddedView(this.template);
      if (!allowed && this.container.length > 0) this.container.clear();
    });
  }
}
