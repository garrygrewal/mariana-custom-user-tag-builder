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

Optional: custom field ids (`JIRA_FIELD_*`), `JIRA_TRANSITION_STATUS`,
`JIRA_TRANSITION_ID`, `JIRA_COMMENT_VISIBILITY_ROLE`, `FONT_TTF_PATH`.

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

- **Attachments:** `custom-tag_<slug>_<hex>.svg`, `.png`, and `.zip` (one set per
  option; complex requests may include `Option 1..N`). When a library match is
  low-confidence, a second `_ai` artifact set is also attached.
- **Comment:** a design-review comment that @mentions the configured reviewer(s)
  (`JIRA_REVIEW_ACCOUNT_ID` plus optional `JIRA_ADDITIONAL_REVIEW_MENTIONS`),
  embeds the generated tag SVG(s) inline at a
  reduced size (vector, so they stay crisp), and includes a downloadable ZIP
  bundle (SVG + PNG) per tag. Low-confidence simple matches label **Option A
  (library)** and **Option B (AI-generated)** in a single comment. The only
  leading text is: "DESIGN REVIEW NEEDED - Do not upload until approved by
  design. Please wait for a designer to comment and approve these user tags."
- **Status:** after posting the review comment, the ticket is assigned to the
  configured reviewer (`JIRA_REVIEW_ACCOUNT_ID`, or `JIRA_ASSIGNEE_ACCOUNT_ID`
  when set) and moved to **In Progress/Review** on the board (configurable via
  `JIRA_TRANSITION_STATUS`; set to empty to disable, or set `JIRA_TRANSITION_ID`
  to use a specific transition).
- **On failure:** a comment explaining the error so a designer can take over.

## 5. Field mapping notes

The UTR "Asset" request form writes to dedicated custom fields, mapped via env:

| Form field | Env var | Field id |
| --- | --- | --- |
| Tag Name | `JIRA_FIELD_TAG_NAME` | `customfield_10307` |
| Tag Color | `JIRA_FIELD_COLOR` | `customfield_10306` |
| Total # of Tags | `JIRA_FIELD_COUNT` | `customfield_10416` |
| Tag Icon (hint) | `JIRA_FIELD_ICON` | `customfield_10309` |

When **Total # of Tags** is greater than 1 and the Tag Icon / Tag Color fields
describe separate specs (e.g. "green for good and red for bad" with "smiling
emoji for the good tag, and sad emoji for the bad tag"), the generator produces
one distinct tag per spec — each with its own icon brief and background color —
instead of multiple design variations of the same tag.

`JIRA_FIELD_DESCRIPTION` is left unset, so the native description field supplies
the free-text brief. When a field id is unset, the generator falls back to
parsing the tag name from the summary and the color/count from the description
text. (Find ids via `/rest/api/3/field`, the issue-type create metadata, or the
automation rule's smart-value list.)

## 6. Local testing

```bash
vercel dev            # serves /api/jira-webhook locally
# then, with env vars set:
curl -X POST http://localhost:3000/api/jira-webhook \
  -H 'content-type: application/json' \
  -H 'x-webhook-secret: <secret>' \
  -d '{"issue":{"key":"UTR-123"}}'
```
