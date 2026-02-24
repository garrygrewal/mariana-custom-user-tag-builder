# Custom User Tag Creator

A standalone browser-based tool for creating small circular user tags with
custom text or icons, previewing them live, and exporting as SVG + PNG in a
single ZIP download.

## Quick Start

```bash
nvm use          # uses .nvmrc → Node 20.20.0
npm install
npm run dev      # http://localhost:5173
```

## Scripts

| Command             | Description                            |
|---------------------|----------------------------------------|
| `npm run dev`       | Start Vite dev server                  |
| `npm run build`     | Type-check + production build to dist/ |
| `npm run preview`   | Serve production build locally         |
| `npm run lint`      | Run ESLint                             |
| `npm run format`    | Format with Prettier                   |
| `npm run test`      | Run unit + integration tests (Vitest)  |
| `npm run test:e2e`  | Run Playwright E2E tests               |
| `npm run test:all`  | Run unit tests then E2E tests          |

For E2E tests, install all configured Playwright browsers first:

```bash
npx playwright install chromium firefox webkit
```

E2E tests require a production build (`npm run build`) — the Playwright
config automatically runs `npm run preview` as its web server and executes the
suite against Chromium, Firefox, and WebKit.

## Project Structure

```
src/
  components/     UI components (TagForm, IconPicker, HexColorInput, etc.)
  hooks/          useTagState — form reducer + derived contrast/warnings
  lib/            Pure logic — contrast, slugify, svgBuilder, rasterize, export
  constants.ts    Tag dimensions, font config, contrast thresholds
  types.ts        Shared TypeScript interfaces
icons/            Source SVGs (auto-discovered at build time)
public/fonts/     Proxima Nova ExtraBold font assets for in-app rendering
tests/
  unit/           Vitest unit tests
  integration/    Vitest component integration tests
  e2e/            Playwright browser tests
```

## Export Details

- **SVG**: 30×30 viewBox. Text exports are converted to vector paths for
  consistent rendering across tools (including Figma) without font embedding.
- **PNG**: 30×30 rasterized via Canvas from the same SVG markup.
- **ZIP**: Contains both files. Filename format:
  `custom-tag_<slug>_<text|icon>_<bgHex>.zip`

`<slug>` is derived from:
- text mode: the entered tag text (e.g. `AB` -> `ab`)
- icon mode: the selected icon id (e.g. `dumbbell`)

## Adding Icons

Drop any `.svg` file into the `icons/` directory. It will be auto-discovered
at build time via Vite glob import. Requirements:

- Must have a `viewBox` attribute (single or double quotes).
- Monochrome fills (`white`, `#fff`, `#ffffff`) are replaced with the
  computed foreground color at render time.
- Icon ID is derived from the filename (e.g. `my-icon.svg` → id `my-icon`).



## Tech Stack

React 19, TypeScript, Vite, CSS Modules, Vitest, Playwright.
