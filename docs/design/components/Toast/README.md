# Toast

A short message at the bottom of the screen about what just happened; reversible actions get an "Undo" button.

**Regular** (`MatSnackBar`): `ink` background, `surface-100` text, a text action button in `brand-inverse`. `radius-sm`, `shadow-lg`. Disappears after 6 seconds; hover and focus pause the timer.

**Error:** `danger-container` background, `on-danger-container` text and button, a warning icon. It doesn't disappear on its own until it is closed or "Retry" is pressed.

**Rules:**

- Deleting always goes to the trash with an "Undo" toast, no "Are you sure?" dialog. A confirmation dialog is only for the irreversible: emptying the trash, deleting the family.
- One message at a time; a new toast replaces the old one.
- The text says what happened, with a number: "3 photos moved to trash", not "Operation completed successfully".
- An error names the cause in plain words and offers an action.
- Role `status` for a regular toast, `alert` for an error.
