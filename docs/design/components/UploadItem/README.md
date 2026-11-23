# UploadItem

An upload queue row: what the file is, which step it's at and what you can do with it.

**Structure:** a thumbnail or type icon (`row-height` minus 8px, `media-placeholder` background) · file name in `body` 500 + a `caption` line (`ink-muted`) · on the right, a status or one action. Progress — a 4px bar: `surface-300` track, `brand` fill.

| Step | Right side | Caption |
| --- | --- | --- |
| Checking (computing SHA-256) | "Checking" status `surface-200` / `ink-muted` + progress | file size |
| Uploading | "Pause" button + progress | "1.8 of 4.2 GB · 6 min left" |
| Duplicate | "Duplicate" status `warning-container` / `on-warning-container` | "already in the archive · date" |
| Error | "Retry" text button | the cause in plain words: "no connection to the server" |
| Done | "Done" status `success-container` / `on-success-container` | file size |

**Rules:**

- A duplicate is not an error: the file simply isn't uploaded again, with no red.
- Errors are explained in plain words ("no connection to the server", "the file is damaged"), without codes.
- Statuses differ not only by color: each has a word.
- Above the list — a summary ("120 of 214 uploaded · 3 duplicates") and bulk actions "Pause all" / "Retry failed". Finished rows collapse into one.
- The queue lives at the app level; its progress shows in the header on any page.
