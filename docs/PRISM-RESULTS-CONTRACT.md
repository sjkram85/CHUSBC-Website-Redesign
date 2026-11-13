# Prism → website: certified results contract

The site lists certified tournament results that Prism publishes. This file is the whole contract.

## How Prism publishes

1. Prism commits an updated `results-index.json` to the **`main` branch** of
   `github.com/sjkram85/CHUSBC-Website-Redesign` (repo root).
2. GitHub Pages redeploys automatically, usually in **about 1 minute**.
3. On the next page load the site fetches `./results-index.json` (network-first,
   with a per-minute cache-busting query, so neither the Pages CDN nor the app's
   service worker serves an old copy while the visitor is online).

No other step is needed. Nobody retypes results.

**This repository is PUBLIC.** Everything in `results-index.json` (and its git
history) is visible to anyone.

## Schema

```json
{
  "events": [
    {
      "event_name":    "69th Annual CHUSBC Open Championship – Certified Results",
      "event_date":    "2026-11-22",
      "host_center":   "Forest Hill Lanes",
      "pdf_file_id":   "<Drive FILE id of the PDF>",
      "pdf_url":       "https://drive.google.com/file/d/<file id>/view",
      "published_at":  "2026-11-23T20:15:00-05:00",
      "year":          2026,
      "tournament_id": "open-2026"
    }
  ]
}
```

| Field | Required | Rules |
|---|---|---|
| `event_name` | yes | Non-empty string. Rows without it are skipped. |
| `event_date` | recommended | `YYYY-MM-DD` (last day of the event). |
| `host_center` | optional | Plain text. |
| `pdf_url` | yes* | `https://` only, and **publicly viewable** (Drive file shared "Anyone with the link – Viewer", or a public web URL). |
| `pdf_file_id` | yes* | Drive **file** id. Used only if `pdf_url` is missing: the link becomes `https://drive.google.com/file/d/<id>/view`, so the file must be public too. |
| `published_at` | yes | ISO 8601 with offset. Drives sort order (newest first), the "Published" date and the gold **NEW** badge (shown for 14 days). |
| `year` | optional | Season year; defaults to the year of `event_date`. |
| `tournament_id` | optional | Stable Prism id. Re-publishing the same id replaces the earlier row. |

\* One of `pdf_url` / `pdf_file_id`. With neither, the row shows "PDF coming soon".

Other top-level keys (for example `_note`) are ignored.

## Site behaviour

- Prism rows appear at the top of **Latest Tournament Results** (home, top 5) and
  the **Results Archive**, badged "Certified · Published by Prism", with the
  published date and a **NEW** badge for 14 days.
- Duplicates: within the file, one row per `tournament_id` (else file id / URL /
  name + year), newest `published_at` wins. A static archive row is hidden when it
  has the same URL, the same Drive file, or the same event name and year.
- If the file is missing, empty, unreachable or not valid JSON, the site quietly
  shows the static archive only. Malformed rows are skipped individually.

## Never include

- Secrets of any kind: API keys, tokens, passwords, service-account JSON.
- Private Drive **folder** ids or links to private folders.
- Links that need a sign-in to view, personal email addresses, phone numbers.

Only the public PDF link (or public file id) and the display fields above.

## Prism checklist before committing

1. PDF opens in a private/incognito window without signing in.
2. `results-index.json` is valid JSON (`python3 -m json.tool results-index.json`).
3. `published_at` is now, with timezone offset.
4. Diff contains no keys, tokens or folder ids.
