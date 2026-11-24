import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

/** t(family.roles.owner, family.roles.admin, family.roles.member, family.roles.viewer) */

/** A member's role (docs/design/components/RoleBadge): fill weight falls with permissions. */
@Component({
  selector: 'sk-role-badge',
  imports: [TranslocoPipe],
  template: `<span class="badge" [class]="role()">{{
    'family.roles.' + role() | transloco
  }}</span>`,
  styles: `
    .badge {
      display: inline-block;
      padding: var(--space-0) var(--space-2);
      border: thin solid transparent;
      border-radius: var(--radius-xs);
      font-size: var(--fa-fs-caption);
      line-height: var(--fa-lh-caption);
      font-weight: var(--type-body-strong-weight);
      white-space: nowrap;
    }
    .owner {
      background: var(--brand);
      color: var(--on-brand);
    }
    .admin {
      background: var(--brand-container);
      color: var(--on-brand-container);
    }
    .member {
      background: var(--surface-200);
      color: var(--ink);
    }
    .viewer {
      border-color: var(--border-strong);
      color: var(--ink-muted);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoleBadge {
  readonly role = input.required<string>();
}
