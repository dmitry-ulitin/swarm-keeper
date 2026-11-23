# FamilySwitcher

A button with the active family's name in the left corner of the header; it opens the family menu.

**Button:** the family sign (first letter, `brand` / `on-brand`, `radius-xs`) + the name in `body` 600 + a chevron. Hover and the open menu use a `surface-200` background. With only one family there is no chevron, and the button leads to the family page.

**Menu** (`mat-menu`): `surface-000`, `border`, `radius-md`, `shadow-md`. Each item has the sign, the name, a `caption` line (role and member count) and a `brand` check mark on the active family. Below a divider — "Members and invitations" (owners and admins only).

**Switching families** calls `organization.setActive`, refetches `GET /me` and resets feature stores; the timeline reopens from the top. Families differ by the sign's background (`brand` or `accent-container`), not by name alone.

**Header** (`fa-bar`): `surface-000`, a bottom `border`, height `control-height` + 16px. On the right — upload queue progress (`caption`), the "Upload" button and the user's avatar.
