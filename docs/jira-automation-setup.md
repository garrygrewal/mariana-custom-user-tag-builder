# Jira Automation -> Webhook Setup

This wires a UTR (User Tag Request) ticket to the automated generator. When
support creates a ticket, Jira calls the Vercel webhook, which generates the
tag(s), attaches the SVG/PNG, and posts an internal draft comment for a
designer to review.

```
UTR ticket created
   -> Jira Automation rule (Send web request)
   -> POST https://<your-app>.vercel.app/api/jira-webhook
   -> generate (builder | AI) -> rasterize -> attach SVG+PNG -> draft comment
   -> designer reviews, then forwards the approved tag to the client
```

## 1. Deploy

Deploy this repo to Vercel. The SPA continues to serve at `/`, and the function
is exposed at `/api/jira-webhook`.

## 2. Environment variables (Vercel project settings)

See [`.env.example`](../.env.example) for the full list and notes. Required:

- `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`
- `WEBHOOK_SECRET` (recommended)
- `TAG_AI_MODEL` + AI Gateway auth (`AI_GATEWAY_API_KEY`) for complex tags

Optional: custom field ids (`JIRA_FIELD_*`), `JIRA_TRANSITION_ID`,
`JIRA_COMMENT_VISIBILITY_ROLE`, `FONT_TTF_PATH`.

The function reads the icon library (`icons/`), font (`public/fonts/`), and
guidelines (`docs/`) at runtime; these are bundled via `vercel.json`
`includeFiles`.

## 3. Create the Automation rule

In the UTR project: **Project settings -> Automation -> Create rule**.

1. **Trigger:** `Issue created`.
2. **Condition (recommended):** restrict to the design-request issue type /
   form so unrelated issues don't trigger generation.
3. **Action:** `Send web request`:
   - **Web request URL:** `https://<your-app>.vercel.app/api/jira-webhook`
   - **HTTP method:** `POST`
   - **Headers:**
     - `Content-Type: application/json`
     - `x-webhook-secret: <your WEBHOOK_SECRET>`
   - **Web request body:** `Custom data`:
     ```json
     { "issue": { "key": "{{issue.key}}" } }
     ```
   - Leave "Wait for response" off (generation can take longer than the
     automation timeout; the function works asynchronously from Jira's view and
     posts results back to the ticket).

## 4. What gets posted

- **Attachments:** `custom-tag_<slug>_<hex>.svg` and `.png` (one pair per
  option; complex requests may include `Option 1..N`).
- **Comment:** an internal draft summary (routing decision, colors, file names,
  any contrast warnings). It deliberately omits the client-facing comment prefix
  so nothing is sent to the client automatically — a designer reviews and
  forwards the approved tag.
- **On failure:** a comment explaining the error so a designer can take over.

## 5. Field mapping notes

If the design-request form writes to dedicated custom fields, set
`JIRA_FIELD_TAG_NAME` / `JIRA_FIELD_COLOR` / `JIRA_FIELD_COUNT` /
`JIRA_FIELD_DESCRIPTION` to their ids (find them via
`/rest/api/3/field` or the automation rule's smart-value list). Otherwise the
generator parses the tag name from the summary and the color/count from the
description text.

## 6. Local testing

```bash
vercel dev            # serves /api/jira-webhook locally
# then, with env vars set:
curl -X POST http://localhost:3000/api/jira-webhook \
  -H 'content-type: application/json' \
  -H 'x-webhook-secret: <secret>' \
  -d '{"issue":{"key":"UTR-123"}}'
```
