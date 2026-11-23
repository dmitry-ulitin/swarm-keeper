# PhotoTile

A photo or video tile in the timeline and albums: a preview with no caption, with state shown by badges on top.

**Layout.** Tiles form justified rows of equal height: `tile-size` (120px) in compact mode, `tile-size-large` (180px) in large mode. Width comes from the aspect ratio; the gap is `space-0`. Above each group — a date heading in `title` with a `caption` line (place, photo count).

**States:**

- **Preview loading** — `media-placeholder` background, no spinner.
- **Processing** — `media-placeholder` and a short `caption` in `ink-muted`: "Processing…".
- **Selected** — a 3px inner `selection` border, the image shrinks slightly, a check mark in the corner: a `selection` circle with an `on-brand` icon. In selection mode, unselected tiles show the check ring on hover.
- **Video** — a duration badge bottom right: `scrim` backing, `on-viewer` text, `caption` style.
- **Favorite** — an `accent` star with a `surface-000` outline, top right.

**Behavior.** A click opens the viewer (`/photos/:id`); a long press or a click on the circle enters selection mode; Shift+click selects a range. The tile is a button with an `aria-label` (what's in the photo or the file name, and the date); a selected tile has `aria-selected="true"`.

**The image** comes from the stable URL `/api/v1/assets/:id/thumb?size=256|512` (302 to a presigned URL), with `loading="lazy"` and a `srcset` for two densities.
