# Context Handoff: Self-Serve Custom User Tags in Mariana Tek Admin

**Purpose of this document.** Everything a design agent needs to design the
experience of creating, purchasing, and receiving a **custom user tag** from
inside the Mariana Tek Admin product. It summarizes an existing working prototype
(the "Custom User Tag Builder"), the hard design constraints on the tag artwork
itself, the current support-mediated process being replaced, and the open
questions a designer must resolve.

Read this as background, not as a spec to implement. There is no UI to copy —
the target experience is net-new inside Admin.

---

## 1. What a custom user tag is

A **user tag** is a small circular badge displayed next to a customer's name in
Mariana Tek Admin and the Business app. Studios use them to flag context at a
glance: `VIP`, first responder, injured, 100-class milestone, corporate account,
banned, etc.

Concretely, one tag is:

- A **30 × 30** circle, filled edge-to-edge with a studio-chosen background color.
- A **single monochrome foreground** — either 1–3 characters of text, or one icon
  glyph — centered inside the circle.
- **Exactly two colors.** The foreground is auto-computed as pure black or pure
  white, whichever has higher WCAG contrast against the background. Studios do
  not choose the foreground color.
- Rendered at roughly **16–30px** in production UI, so it must read when tiny.

Deliverables today are an SVG plus a 30 × 30 PNG, bundled in a ZIP named
`custom-tag_<slug>_<bgHex>.zip`.

### Non-negotiable artwork rules

These come from `docs/user-tag-design-guidelines.md` and are enforced in code.
The purchase/creation UI must not offer choices that violate them.

| Rule | Detail |
| --- | --- |
| Canvas | `<svg width="30" height="30" viewBox="0 0 30 30">` |
| Shape | `<circle cx="15" cy="15" r="15">`, no padding outside the circle |
| Colors | one background hex + one auto-chosen foreground (`#000000` or `#FFFFFF`) |
| Foreground | flat fill only — no gradients, shadows, partial opacity, outer rings |
| Text tags | `A–Z`, `0–9`, `.` only, uppercased, **max 3 characters** |
| Text font | Proxima Nova ExtraBold (800), converted to vector outlines on export |
| Icon fit | ≤ 80% of width, ≤ 72% of height, optically centered, never touching the edge |
| Icon style | solid/filled silhouettes (Font Awesome "solid" feel), minimal internal detail |
| Banned background | pure white (`#FFFFFF`) is rejected and coerced to black |

Advisory (warn, don't block): foreground-to-background contrast should be
≥ 4.5:1, and background-to-white-page contrast ≥ 2.0:1 so the tag is visible on
a white page.

A useful trick from the approved library: interior detail is carved with
sub-paths filled in the **background** color rather than adding a third color.
That keeps tags strictly two-color while allowing fairly rich shapes.

---

## 2. What exists today (the prototype)

A standalone React + TypeScript + Vite app, deployed on Vercel, not part of
Admin. Two halves share one rendering core.

### 2a. Interactive builder (the part being moved into Admin)

A two-pane layout: a form sidebar on the left, a large live preview on the right.
The complete set of inputs today is:

1. **Background Color** — a native color swatch plus a hex text field, defaulting
   to `#6923F4` (purple). White is silently coerced to black.
2. **Contrast warnings** — inline, non-blocking messages that appear directly
   under the color field when either contrast threshold is missed. Example:
   "Low text/icon contrast (3.2:1). Minimum recommended is 4.5:1 contrast ratio."
3. **Type toggle** — `Text` or `Icon`. Mutually exclusive.
4. If Text: a 3-character input (auto-uppercased, invalid characters stripped)
   with a live `n/3 chars` counter and an inline error for disallowed characters.
5. If Icon: a searchable combobox listing the library, filtering on icon id and
   label, each row showing a thumbnail plus a human label. Plus an
   **"OR UPLOAD ICON"** escape hatch accepting `.svg` or `.png`. Selecting a
   library icon clears an upload and vice versa — never both.
6. **Export** button, disabled until the hex is a valid 6-digit value and either
   text or an icon is present. It downloads the ZIP (SVG + PNG).

Notable behavioral details worth preserving in any redesign:

- The preview is **live and instant** on every keystroke; there is no "generate"
  step for text and library-icon tags.
- Text size is fit-to-width by character count (1 char ≈ 18.5px, 2 ≈ 16.5px,
  3 ≈ 12.5px, then shrunk further to avoid clipping).
- Icons are centered by measured content bounds, not by viewBox, so visually
  off-center source art still lands correctly. A per-icon optical nudge table
  exists for stubborn glyphs.
- Text is exported as vector outlines so the SVG renders identically in Figma or
  anywhere else without the font installed.
- Uploaded SVGs are sanitized (scripts, `on*` handlers, and `javascript:` hrefs
  stripped). This matters if uploads survive into a customer-facing product.

### 2b. Icon library

Two tiers:

- **61 curated production glyphs** (`icons/*.svg`) — the only set the browser
  builder shows today. Examples: `dumbbell`, `birthday`, `vaccinated`,
  `first-responder`, `milestone-100`, `milestone-1k`, `10-off` … `25-off`,
  `banned`, `instructor`, `wedding`, `shoe`, `corporate`, `lululemon`. These were
  extracted from approved production tags, so they are guaranteed on-brand.
- **~3,200 Nucleo glyphs**, licensed and bundled, reachable only by the
  server-side generator today. Organized into categories (accessibility,
  animals-nature, arrows, and so on) with fill and outline variants at multiple
  sizes; the loader prefers the filled 32px variant. This is a general-purpose
  icon vocabulary: crowns for VIP, faces and emoji, sports equipment, pets,
  weather, pregnancy, and much more.

Every glyph is single-color source art recolored to the computed foreground at
render time, so any glyph works on any background.

A separate corpus of **353 approved production tag SVGs** (`reference-tags/`)
is the design source of truth; a curated 14-tag subset is used as house-style
examples. Library glyphs were extracted from that corpus programmatically.

Design implication: **search and browse quality is the core UX problem**, not
the drawing tools. A flat searchable dropdown is adequate for 61 items and
collapses completely at 3,200. Categories, curated/popular sets, recently used,
and synonym-aware search are the difference between self-serve working and
studios giving up and filing a ticket anyway. There is also a real product
decision hiding here: exposing the full Nucleo set maximizes coverage but
weakens the on-brand guarantee the curated 61 provide.

There is already a hand-curated synonym map used for text matching
("gym", "weights", "workout" → `dumbbell`; "vip", "premium", "elite" →
`nucleo-crown`; "waiver", "consent", "covid" → `note`). It can power
natural-language icon search in the new UI.

### 2c. Automated Jira pipeline (context for the process being replaced)

A Vercel serverless function fires when a **UTR (User Tag Request)** Jira ticket
is created. It parses the request form (Tag Name, Tag Color, Total # of Tags,
Tag Icon hint), classifies it, generates artwork, and posts an internal
design-review comment with the SVG/PNG/ZIP attached, @mentioning a designer and
moving the ticket to In Progress/Review. A designer reviews and forwards the
approved tag; nothing reaches the client automatically. Designers can comment
`/regenerate-tag` with revisions to re-run it.

Classification routes each request one of three ways:

1. **Text mode** — letters/digits only, ≤ 3 chars → rendered deterministically.
2. **Icon mode** — the request matches a library glyph by id, label, or curated
   synonym → rendered deterministically, instantly, free, and exactly on-brand.
3. **Complex (AI) mode** — no library match → an LLM authors a compliant SVG
   (Claude Sonnet 4.5 via the Vercel AI Gateway, ~7s), validated against the
   design rules before use.

The classifier also emits a **confidence** signal. Low confidence (generic icon
matched, unmatched salient words in the request, two icons scoring closely)
triggers an additional AI option alongside the library match, so a human sees
choices. This concept transfers directly: when the system is unsure, show
options rather than a single answer.

---

## 3. The problem being solved

Today a studio cannot make its own tag. It files a request, and a support agent
plus a designer produce the artwork by hand — the Jira automation above is an
internal accelerator for that same human process. Consequences:

- Turnaround measured in days, not seconds.
- Design and support absorb a steady stream of low-complexity requests.
- The studio has no direct control, no iteration loop, and no preview.
- Requests arrive as prose and get misinterpreted ("letters PRO" vs. an icon).

**Goal:** studios create custom user tags themselves, on demand, without
support or design involvement.

---

## 4. The target experience to design

Custom user tags become a **self-serve, purchasable item inside Mariana Tek
Admin**. The intended flow, as scoped today:

1. Studio admin creates one or more custom tags in an in-Admin builder.
2. Tags are **added to a cart**.
3. The admin **checks out**.
4. The tags become available to apply to customers.

That is the full extent of what has been decided. Everything below is either an
inference or an open question — treat it as such.

### Screens and flows that likely need design

- An **entry point** in Admin. Custom tags plausibly live near existing user tag
  management, so the design should account for a screen that lists tags the
  studio already has, alongside a "create custom tag" affordance.
- The **builder** itself: color, text-or-icon, icon browse/search, live preview.
  The prototype's two-pane form-plus-preview layout is a reasonable starting
  point but was built as an internal tool, not a customer-facing surface.
- **Preview in context.** The prototype previews the tag large and alone. A
  studio buying a tag needs to see it at true size next to a customer name in a
  realistic list row, which is the only view that reveals whether a tag actually
  reads at 16px.
- **Naming/labeling** a tag. The tag's display name is a distinct concept from
  the 3 characters drawn inside it, and the prototype barely handles this (the
  label field exists in state but is unused in the UI). It is likely required for
  a real product: the tag needs a name in tag-management lists and tooltips.
- **Cart** — multiple tags in one order, editing or removing a tag from the
  cart, returning to edit a tag after adding it, and price presentation.
- **Checkout** — payment, confirmation, receipt.
- **Post-purchase** — where the tag appears, and how it gets applied to
  customers. There is a real question of whether purchase and assignment are one
  flow or two.
- **Empty, error, and edge states**: nothing in the cart, a low-contrast tag the
  admin wants anyway, an icon search with no results, an unsupported upload, a
  failed payment, and the case where the studio wants something the library
  cannot express.

### Design tensions worth resolving deliberately

- **Guardrails vs. freedom.** The two-color, single-glyph, 3-character system is
  what makes every tag legible and on-brand. Self-serve invites studios to push
  against it. The UI should make the constrained path feel like the good path
  rather than presenting the limits as denials.
- **Contrast warnings.** Advisory today. In a paid self-serve flow, letting a
  studio buy an illegible tag creates a support ticket — exactly what this
  project is eliminating. Consider whether some thresholds should block, or
  whether the design nudges toward a curated palette that cannot fail.
- **The "no library match" case.** Internally this falls through to AI
  generation. Whether studios get AI-generated custom artwork, get steered to
  the closest library glyph, or can still escalate to design is a product
  decision with a large UX footprint. Note the internal pipeline never ships AI
  output without a designer reviewing it.
- **Uploads.** The prototype accepts SVG and PNG uploads. In a customer-facing
  paid flow this is the main vector for off-brand, illegible, and
  trademark-infringing tags. If uploads ship, they probably need review — which
  reintroduces the human bottleneck for that path.
- **Charging for something instant.** A library-icon tag costs nothing to
  produce and renders in milliseconds. The cart-and-checkout model has to feel
  proportionate to that, and pricing structure (per tag, bundles, subscription
  entitlement) will shape the cart design.

### Open questions the designer should flag or decide

1. Pricing model — per tag, per pack, tiered, or included in a plan?
2. Who can create and buy? Which Admin roles/permissions?
3. Is there a limit on how many custom tags a studio can hold?
4. Do purchased tags need review before going live, or are they instant?
5. Are AI-generated custom icons in scope for self-serve, or library-only?
   And if library-only: the curated 61, or the full ~3,200 Nucleo set?
6. Are uploads in scope?
7. Can a purchased tag be edited later, and does editing cost anything?
8. Does purchase include assigning the tag to customers, or is that separate?
9. Multi-location studios: is a tag scoped to a brand or to a single location?
10. What happens to the existing UTR request path — retired, or kept as the
    escalation route for genuinely custom design work?

---

## 5. Glossary

| Term | Meaning |
| --- | --- |
| **User tag** | The 30 × 30 circular badge shown next to a customer's name |
| **Custom user tag** | A studio-specific tag, as opposed to a platform default |
| **Builder** | The interactive app that renders a tag deterministically |
| **Library / registry** | The set of pre-approved glyphs available for icon tags |
| **Text mode** | Tag whose foreground is 1–3 characters |
| **Icon mode** | Tag whose foreground is a single glyph |
| **Complex / AI mode** | Novel artwork authored by an LLM when nothing matches |
| **UTR** | "User Tag Request" — the Jira ticket type used today |
| **bgHex / fgHex** | Background hex (chosen) and foreground hex (auto-computed) |
| **Classification** | Deciding whether a request is text, library icon, or custom |
| **Confidence** | Whether the classifier trusts its match; low confidence adds options |

---

## 6. Reference values a designer may want

- Default background: `#6923F4`
- Named colors the system already understands include sage `#9CAF88`, red
  `#E1251B`, orange `#F26722`, yellow `#FFD200`, green `#3DAE2B`, blue
  `#2D6CDF`, navy `#001F5B`, purple `#6923F4`, pink `#EC4899`, charcoal
  `#36454F`, black `#000000`. These are a plausible starting palette for a
  curated swatch set that avoids contrast failures.
- Text font sizes by length: 1 char 18.5, 2 chars 16.5, 3 chars 12.5 (px in a
  30-unit canvas).
- Icon fit box: 80% width × 72% height of the 30 × 30 canvas.
- Contrast thresholds: 4.5:1 foreground-to-background, 2.0:1
  background-to-white-page.

---

## 7. Where the source material lives

Repository: `CustomUserTag-Project`.

- `docs/user-tag-design-guidelines.md` — full artwork rules (source of truth)
- `README.md` — architecture and how generation works
- `src/` — the interactive builder (React); `src/components/` holds `TagForm`,
  `IconPicker`, `HexColorInput`, `TagPreview`, `ContrastWarnings`, `ExportButton`
- `icons/` — the curated glyph library; `icons/nucleo_core_svg_v1.7.0/` — the
  ~3,200-glyph Nucleo set
- `reference-tags/` — 353 approved production tags
- `docs/tag-exemplars/` — 14-tag curated house-style sample
- `server/classify.ts` — the synonym map and routing/confidence logic
- `docs/jira-automation-setup.md` — the current support-mediated process
