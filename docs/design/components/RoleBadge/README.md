# RoleBadge

A member's role badge in the family; shown only in the member list and in the family switcher menu.

| Role (`member.role`) | Label | Tokens |
| --- | --- | --- |
| owner | Owner | `brand` fill / `on-brand` |
| admin | Admin | `brand-container` / `on-brand-container` |
| member | Member | `surface-200` / `ink` |
| viewer | Viewer | `border-strong` border, `ink-muted` text |

Saturation decreases with permissions, so roles differ not only in hue but in fill weight. Style — `caption` 600, `radius-xs`.

**Member row:** avatar · name in `body-strong` and a `caption` line (email, "You", "Invitation sent Nov 18") · badge · a "⋮" menu (change role, remove from family) — owners and admins only. Someone invited who hasn't signed in yet is shown with an invitation note.

**Role labels** are the same everywhere — in the list, in the invitation dialog, in the email.
