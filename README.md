# Cecil Harford USBC — Website Redesign (v2 preview)

**Status: preview for committee review. Not live.** chusbc.org (WordPress) is unchanged until the committee approves the redesign.

Base: Gemini's single-page layout (sticky header + mobile drawer, live ribbon, Women's reschedule callout, featured Open card, quick tiles, tournament hub with filters/search + results archive, Honors sub-tabs, department contact form, Facebook card), restyled **navy + gold**.

## Files

| Path | What |
|---|---|
| `index.html` | The site (views: `#home`, `#tournaments/{all,upcoming,adult,youth,results}`, `#honors/{hof,scholarship,records,yearbook}`, `#about`, `#contact`) |
| `directors.html` | Director Portal (Google sign-in links only, no passwords stored) |
| `js/site-data.js` | Tournaments, results archive, Hall of Fame and Jerry Farro scholarship data (sourced from chusbc.org) |
| `js/app.js` | View switching, filters, results merge, email (mailto) forms |
| `js/ask-chusbc.js`, `css/ask-chusbc.css` | "John" chat widget |
| `results-index.json` | Prism → website certified-results contract (see below) |
| `assets/` | Center photos, USBC/bowl.com art, Legacy Computing Services logo |

Preview locally: `python3 -m http.server 8080` in this folder, then open http://localhost:8080/ (the results index is loaded with `fetch`, so open it over http, not `file://`).

## Rules for this repo (it is PUBLIC)

- **No API keys, ever.** `gemini-local.js` is git-ignored and only requested when the page runs on `localhost`.
- John runs in **demo mode** (canned answers) unless a local-only `gemini-local.js` sets `window.ASK_CHUSBC_GEMINI_API_KEY`. The "Powered by Gemini" label stays for now. **Plan:** move John to **Grok (xAI) behind a server-side proxy** (for example a Firebase Function). The browser never holds a key.
- Contact and squad forms do **not** send anything themselves. They open the visitor's email app with a pre-filled message to the right address (Association Manager `cecilharford@gmail.com` or Webmaster `chusbcwebmaster@gmail.com`).

## Production checklist (after committee approval)

1. **Compile Tailwind**: replace the Play CDN (`cdn.tailwindcss.com`) with a compiled, purged CSS build (Tailwind CLI) and move the inline `tailwind.config` into `tailwind.config.js`. The CDN is for previews only.
2. **Firebase Hosting**: deploy this folder as static hosting. Serve `results-index.json` with `Cache-Control: no-cache`.
3. **No keys in the browser**: add a server-side proxy (Firebase Function) for John → Grok/xAI. Keep secrets in Functions config or Secret Manager.
4. **Committee approval before cutover**: approve the design, then do the DNS/hosting cutover from WordPress. Keep the WordPress `wp-content/uploads` PDF links working, or mirror them, because the archive links point there.
5. Fill in the "coming soon" items: board names, bylaws, association records, HOF nomination form, scholarship application, history timeline.

## Prism → website results contract

When a tournament is **certified completed** in Prism, Prism publishes the certified PDF and updates `results-index.json`. Phase 1 uses the Drive folder `CHUSBC Results/YYYY/` plus the index (Drive file id `115HUsQeeQtBcU8YaY3SJ2XUCZbKZcB6Y`). On hosting, the same JSON is deployed at `/results-index.json`. The site fetches `./results-index.json` on load and lists those events **at the top** of Latest Results and the Results Archive, badged **"Certified · Published by Prism"**. Nobody retypes results.

```json
{
  "events": [
    {
      "event_name": "69th Annual CHUSBC Open Championship – Certified Results",
      "event_date": "2026-11-22",
      "host_center": "Forest Hill Lanes",
      "pdf_file_id": "<Drive file id>",
      "pdf_url": "https://… (https only; optional if pdf_file_id is set)",
      "published_at": "2026-11-23T20:15:00-05:00",
      "year": 2026,
      "tournament_id": "<optional Prism id>"
    }
  ]
}
```

- `pdf_url` wins if present (must be `https://`). Otherwise the link is `https://drive.google.com/file/d/<pdf_file_id>/view`, so the Drive file must be shared "anyone with the link".
- Sorted by `published_at` (newest first). If a URL matches a static archive entry, the static entry is dropped.
- Missing or empty index means the site shows the static archive only.
- Future (phase 2): a Firebase Function endpoint Prism can POST to, which writes this same JSON. The schema stays stable for the desk.

## Instagram feed (placeholder)
The home page has a "From the Lanes" Instagram section and a footer badge, both marked coming soon. Once CHUSBC has an Instagram Business/Creator account, connect a feed through a server-side Instagram Graph API call (token kept off the browser) or a hosted embed widget, and swap the placeholder tiles for live posts.
