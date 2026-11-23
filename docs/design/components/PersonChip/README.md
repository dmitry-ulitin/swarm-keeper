# PersonChip

A person's (`person`) avatar and chip: who is in a photo, who a document belongs to, filtering the timeline by people.

**Avatar.** A face photo if one is chosen; otherwise initials (one or two letters) at `font-weight: 600` on one of three backgrounds: `brand-container` / `on-brand-container`, `accent-container` / `on-accent-container`, `surface-300` / `ink`. The background is picked deterministically from `person.id`, not at random. Size follows the current mode's control height; a `radius-full` circle.

**Chip** (`mat-chip-option` in filters, `mat-chip` in tags): avatar + short name, `control-height` tall, `border-strong` border, `surface-000` background. Selected — `brand-container` / `on-brand-container` with no border. The last chip, "Tag", adds a person.

**Names** are what the family calls people: "Grandma Valya", not "Valentina S.". The full name is on the person's card.

**Don't confuse:** a `person` is a family member in the archive (may have no account); a member (`member`) is someone who signs in to the app. Person chips don't show roles; roles are in RoleBadge.
