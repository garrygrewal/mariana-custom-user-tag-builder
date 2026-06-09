# User Tag Design Guidelines

These are the rules the automated generator follows when producing a Mariana Tek
custom user tag. They are the single source of truth for both:

1. **Classification** — deciding whether a request is _simple_ (built deterministically
   by the existing builder) or _complex_ (authored as SVG by the LLM).
2. **Complex SVG authoring** — the exact constraints the LLM must satisfy.

A user tag is a small **circular badge** shown next to a customer's name in Mariana
Tek Admin and the Business app. It must read clearly at ~16-30px.

## Canvas & geometry

- Artboard is **30 x 30** units. The SVG root MUST be
  `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30">`.
- The tag is a **filled circle**: `<circle cx="15" cy="15" r="15" fill="{bgHex}" />`.
  The circle fills the artboard edge-to-edge (no padding outside the circle).
- All foreground content (text or icon) sits **inside** the circle, optically centered.

## Color

- **Background** (`bgHex`) is the color requested on the ticket. Always a 6-digit hex.
- **Foreground** (`fgHex`) is chosen automatically for legibility: pure black
  (`#000000`) or pure white (`#FFFFFF`), whichever has the higher WCAG contrast
  against the background. Do not introduce additional colors.
- Foreground content is **monochrome** — a single flat fill of `fgHex`. No gradients,
  shadows, multiple hues, or partial opacity.
- Contrast targets (advisory, surfaced as warnings — they do not block generation):
  - Foreground vs background: **>= 4.5:1**.
  - Background vs a white page: **>= 2.0:1** (so the tag is visible on white).

## Text tags

- Use when the tag content is **letters and/or digits only**, up to **3 characters**.
- Allowed characters: `A-Z`, `0-9`, and `.` — uppercased.
- Font is **Proxima Nova ExtraBold** (weight 800). Text is converted to vector
  outlines on export so it renders identically without the font installed.
- Sizing is fit-to-width by character count (1 char largest, 3 chars smallest);
  the builder handles this automatically.
- Text tags are always **simple** (built by the builder, never LLM-authored).

## Icon tags

- A single, simple, recognizable glyph centered in the circle.
- The icon must be **monochrome** and recolored to `fgHex`. Source artwork that is a
  single solid color (white/black) is recolored automatically; keep `fill="none"`
  strokes intact (they inherit the foreground).
- Fit the icon within **80% of the width** and **72% of the height** of the circle so
  it never touches the edge. Optically center it (visual weight, not just bounding box).
- Style: prefer **solid (filled)** glyphs consistent with the existing library. Keep
  detail minimal — it must read at 16px. Avoid thin hairlines, fine text, or busy detail.

### Icon sourcing order (for a human or the LLM)

1. **Existing library** — reuse a glyph already in `icons/` if one fits.
2. **SF Symbols** style.
3. **Material Design** icons.
4. **Font Awesome**.
5. **Noun Project**.

## Classification: simple vs complex

**Simple** (route to the builder, no LLM artwork):

- Content is letters/digits only (<= 3 chars) -> **text mode**.
- The requested concept maps to an icon already in the library (`icons/*.svg`)
  by id, label, or an obvious synonym -> **icon mode**.

**Complex** (route to LLM SVG authoring):

- A novel/custom icon is needed that is not in the library and is more than a few
  letters. Produce 1-3 distinct options when the brief is open-ended.

## Complex SVG authoring rules (LLM output contract)

When authoring SVG for a complex tag, the output MUST:

- Be a **single complete `<svg>`** element, nothing else (no markdown fences, no prose).
- Use exactly `width="30" height="30" viewBox="0 0 30 30"`.
- Begin the visible content with the background circle
  `<circle cx="15" cy="15" r="15" fill="{bgHex}" />`.
- Render the glyph using `<path>` / basic shapes with `fill="{fgHex}"` (or `fill="none"`
  + `stroke="{fgHex}"` for line glyphs), centered and fit within the 80% x 72% box.
- Contain **no** `<script>`, no event handlers (`on*=`), no external/`href`/`xlink:href`
  references, no `<image>`, no raster data, no `<text>` (letters are handled as text tags).
- Be deterministic and self-contained so it rasterizes identically to PNG.

## Do / Don't

- **Do** keep it bold, simple, and legible at small sizes.
- **Do** keep the circle edge-to-edge and the glyph centered with breathing room.
- **Don't** add drop shadows, gradients, outer rings, or text labels around the tag.
- **Don't** use more than the two colors (one background + one foreground).
