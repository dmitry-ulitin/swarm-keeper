# DocumentCard

A document card in lists and on a person's page: title, type, who it belongs to and the expiry status.

**Structure:** a format icon (`brand-container` / `on-brand-container`, `radius-xs`), or a first-page thumbnail once the preview is ready · title in `body-strong` · a `caption` line: document type and people · expiry status. The card is `surface-000`, `border`, `radius-md`, `space-3` padding (`space-4` in large mode), no shadow.

**Expiry status** is computed from `document_meta.expires_at`:

| State | When | Tokens |
| --- | --- | --- |
| Valid | more than 60 days left | `success-container` / `on-success-container` |
| Expiring | 60 days or fewer left | `warning-container` / `on-warning-container` |
| Expired | the date has passed | `danger-container` / `on-danger-container` |
| No expiry | no date set | no status shown |

**Status text** is specific: "Expires in 24 days", "Expired Oct 12, 2026", not "Attention!".

**Behavior.** A click opens the document (`/documents/:id`) with its preview and metadata. The document number is never shown on the card — only on the document page, and it stays hidden until "Show" is pressed.
