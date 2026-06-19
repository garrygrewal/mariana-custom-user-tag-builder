# Custom User Tag Creator

Tools for producing Mariana Tek **custom user tags** — small (30×30) circular
badges shown next to a customer's name. The repo has two parts that share the
same rendering core:

1. **Interactive builder** — a browser app for designing a tag with custom text
   or an icon, previewing it live, and exporting SVG + PNG as a ZIP.
2. **Automated Jira pipeline** — a Vercel serverless function that turns a UTR
   (User Tag Request) ticket into ready-to-review tag art automatically.

## Quick start

```bash
nvm use          # uses .nvmrc → Node 20.20.0
npm install
npm run dev      # interactive builder at http://localhost:5173
```

## Scripts

| Command                    | Description                                  |
| -------------------------- | -------------------------------------------- |
| `npm run dev`              | Start the Vite dev server (builder app)      |
| `npm run build`            | Type-check + production build to `dist/`     |
| `npm run preview`          | Serve the production build locally           |
| `npm run lint`             | Run ESLint                                   |
| `npm run format`           | Format with Prettier                         |
| `npm run typecheck:server` | Type-check the server/API generation code    |
| `npm run test`             | Run unit + integration tests (Vitest)        |
| `npm run test:e2e`         | Run Playwright E2E tests                     |
| `npm run test:all`         | Run unit tests then E2E tests                |

E2E tests need the Playwright browsers and a production build (the Playwright
config runs `npm run preview` as its web server):

```bash
npx playwright install chromium firefox webkit
```

## How a tag is generated

Both the builder and the automation produce the same kind of artwork. A request
is routed one of three ways (see `server/classify.ts`):

1. **Text mode** — content is letters/digits only (≤ 3 chars, e.g. `VIP`, a shoe
   size, a milestone number). Rendered by the builder; text is converted to
   vector outlines so it's font-independent.
2. **Icon mode** — the request matches a glyph in the `icons/` library by id,
   label, or a curated synonym (e.g. "vaccine" → `vaccinated`). Rendered
   deterministically by the builder: a background circle + the recolored glyph.
3. **Complex (AI) mode** — novel artwork with no library match. An LLM authors a
   compliant SVG via the Vercel AI Gateway, validated against the design rules.

Every tag is a background circle (`<circle r="15">`) plus a single monochrome
foreground glyph; the foreground color is chosen automatically for contrast.

## Icon library (`icons/`)

`icons/*.svg` are auto-discovered (Vite glob in the browser, `fs` on the server)
into the same registry. Library matches render instantly, for free, and exactly
on-brand, so the library is the preferred path over the AI.

To add an icon, drop a `.svg` into `icons/`:

- Include a `viewBox` (tight to the glyph for correct sizing).
- Use a **single** color (any color, or `white`) — it is recolored to the
  computed foreground at render time. Do **not** rely on background-colored
  sub-paths for negative space (use path holes / `fill-rule` instead).
- The id is derived from the filename (`my-icon.svg` → `my-icon`); add request
  synonyms in `server/classify.ts` (`ICON_SYNONYMS`).

### Reference corpus & extraction tool

`reference-tags/` holds the approved production tag SVGs (the design
source-of-truth). `scripts/extract-glyphs.mjs` pulls recolorable glyphs out of
them into the library: it strips the background circle, verifies the glyph is a
single recolorable color, and computes a tight integer `viewBox` by
rasterizing. A curated subset lives in `docs/tag-exemplars/` and is injected
into the AI prompt as house-style examples.

## Automated generation (Jira webhook)

`api/jira-webhook.ts` is a Vercel function triggered by a Jira Automation rule
when a UTR ticket is created. For each ticket it:

1. Reads the issue and parses the request — Tag Name, Tag Color, Total # of
   Tags, and a Tag Icon hint from the form's custom fields (configurable via
   `JIRA_FIELD_*`), falling back to the summary/description text.
2. Classifies and generates the tag(s) (builder or AI, per above) and
   rasterizes each SVG to PNG with `@resvg/resvg-js`.
3. Attaches the SVG, PNG, and a ZIP bundle (SVG + PNG) to the ticket and posts
   an internal **design-review comment** that @mentions the reviewer, embeds the
   tag preview inline, and includes the ZIP for download. It never contains the
   client-facing prefix, so nothing is sent to a client automatically — a
   designer reviews and forwards the approved tag. The ticket is then assigned
   to the configured reviewer and moved to **In Progress/Review** on the Jira board.

Notes:

- The chosen `TAG_AI_MODEL` must finish within the function timeout (**60s on
  the Vercel Hobby plan**). `anthropic/claude-sonnet-4.5` is the recommended
  model; heavy reasoning models (gpt-5.x, gemini-2.5-pro) are too slow.
- Complex requests produce **one** option per requested tag (cost-efficient);
  multi-tag requests get multiple distinct options.

Setup: see [`docs/jira-automation-setup.md`](docs/jira-automation-setup.md) for
the Automation rule (including `/regenerate-tag` for designer re-runs) and
[`.env.example`](.env.example) for configuration. The design rules shared by the
classifier and the AI prompt are in
[`docs/user-tag-design-guidelines.md`](docs/user-tag-design-guidelines.md).

## Project structure

```
src/                  Interactive builder (React)
  components/         UI (TagForm, IconPicker, HexColorInput, TagPreview, …)
  hooks/              useTagState — form reducer + derived contrast/warnings
  lib/                Pure logic — svgBuilder, textToPath, contrast, slugify, …
  constants.ts        Tag dimensions, font config, contrast thresholds
  types.ts            Shared TypeScript interfaces
server/               Generation core (framework-agnostic, Node)
  classify, tagGenerator, aiSvg, svgValidate, ticket, colors, jira,
  config, processTicket, *.node loaders (icons/fonts/rasterize), paths
api/jira-webhook.ts   Vercel function entry point
icons/                Library glyphs (auto-discovered)
reference-tags/       Approved tag corpus (source for the library)
scripts/              extract-glyphs.mjs — glyph extraction tool
docs/                 Design guidelines, Jira setup, AI tag exemplars
public/fonts/         Proxima Nova ExtraBold for in-app text rendering
tests/                Vitest unit + integration, Playwright e2e
```

## Builder export details

- **SVG**: 30×30 viewBox. Text is converted to vector paths for consistent
  rendering across tools (including Figma) without font embedding.
- **PNG**: 30×30 rasterized from the same SVG markup.
- **ZIP**: contains both files, named `custom-tag_<slug>_<bgHex>.zip`.

## Tech stack

React 19, TypeScript, Vite, CSS Modules, Vitest, Playwright. Server: Vercel
Functions, Vercel AI SDK (AI Gateway), `@resvg/resvg-js`.
