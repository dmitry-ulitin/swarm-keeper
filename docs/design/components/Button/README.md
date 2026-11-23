# Button

Buttons are Angular Material `mat-button` with our tokens; no more than one `primary` button per screen.

| Variant | Material | When |
| --- | --- | --- |
| primary | `matButton="filled"` | The screen's main action: "Upload", "Invite", "Save". |
| tonal | `matButton="tonal"` | Second in importance: "Create album", "Add people". |
| outline | `matButton="outlined"` | "Cancel", neutral actions next to primary. |
| text | `matButton` | Link-like actions in rows and toasts: "Show all", "Undo". |
| danger | `filled` + `fa-danger` class | Irreversible only: "Delete forever" in the trash. Regular deletion goes to the trash, without danger. |
| icon | `matIconButton` | Actions on tiles, rows, the header. `aria-label` is required. |

**Text.** Start with a verb, keep it short, capitalize only the first word: "Upload photos", not "Photo Upload".

**Size** is set by the mode, not the button: compact — `control-height` (28px), large — `control-height-large` (44px). Never pick a height by hand. On touch screens the hit area grows to `hit-target-touch` in any mode.

**Colors:** primary — `brand` / `on-brand`, hover `brand-hover`; tonal — `brand-container` / `on-brand-container`; outline — `border-strong` border on `surface-000`; danger — `danger` / `on-danger`; disabled — `surface-200` / `ink-subtle`. Focus — `focus-ring`, `focus-ring-width` thick, 2px offset.
