# SizeModes

Interface size is each member's personal setting: "Compact" (default) or "Large".

**How it works.** The mode is stored in the user profile and returned by `GET /me` (`uiSize: "compact" | "large"`), so one choice applies on the web and in the native app. On the web, `AuthService` sets `data-size="large"` on `<html>`; without the attribute, compact mode applies.

**What changes** (the full table is in the design system README, "Size modes"):

- control height: `control-height` → `control-height-large`;
- list row height: `row-height` → `row-height-large`;
- icons: `icon-size` → `icon-size-large`;
- timeline tile row: `tile-size` → `tile-size-large`;
- text: `body`, `label`, `caption`… → `large-body`, `large-label`, `large-caption`…;
- component padding: one step larger (`space-3` → `space-5` horizontally).

**What doesn't change:** colors, radii, spacing between page blocks, the order and set of elements. Large mode is the same interface, not a simplified version.

**Invitations.** An admin can pick large mode in advance for the invitee (for grandma, say); the person can change it in "Settings → Appearance".

**Where to switch:** "Settings → Appearance", the `fa-seg` segmented toggle (`mat-button-toggle-group`). The selected segment is `brand-container` / `on-brand-container`.
