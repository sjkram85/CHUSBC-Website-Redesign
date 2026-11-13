# Refreshing `events.json` (upcoming events)

`events.json` (repo root) holds upcoming events copied from the **CHUSBC Google
account's** calendars ("CHUSBC Tournaments & Events" and "USBC Calendar"),
never a personal calendar. A refresh job reads the next ~12 months
(read-only), writes this file and commits it to `main`. Pages redeploys in about
a minute and the site picks it up on the next load (network-first in `sw.js`).

**The repo is public.** Only copy public-appropriate fields. Never write attendee
emails, organizer emails, Meet/Zoom links, private Drive links, calendar ids or
event ids.

## Shape

```json
{
  "source": "CHUSBC Google Calendar",
  "generated_at": "2026-11-13T12:30:00-05:00",
  "window": { "from": "2026-11-13", "to": "2027-11-13" },
  "events": [
    {
      "id": "example-singles",
      "title": "Example Singles Tournament (illustration only)",
      "start": "YYYY-MM-DD",
      "end": "YYYY-MM-DD",
      "location": "Center name, street, town, MD",
      "description": "Short public summary, max ~400 characters.",
      "deadline": "YYYY-MM-DD",
      "url": "https://chusbc.org/wp-content/uploads/.../entry-form.pdf"
    }
  ]
}
```

| Field | Rules |
|---|---|
| `title` | Required. |
| `start` | Required. All-day: `YYYY-MM-DD`. Timed: RFC 3339 with offset. |
| `end` | All-day: the **last day, inclusive** (Google's API returns an exclusive end date, so subtract one day). Timed: RFC 3339. |
| `id` | Optional. Use the `js/site-data.js` tournament id (`open-champ`, `womens-champ`, …) to attach to an existing card; otherwise the title is matched. Not the Google event id. |
| `location`, `description` | Optional, plain text, public only. |
| `deadline` | Optional `YYYY-MM-DD`. Only when the event states an entry deadline (e.g. "Entry deadline: Feb 27, 2027" in the description). Never guess. |
| `url` | Optional public `https://` link (entry form / event page). |

Multi-weekend events: one entry per weekend with the same `id`/`title`; the site
combines them into one card and one `.ics` with every weekend.

## How the site uses it

- Matching events update the dates, location and deadline on the existing
  "Featured Championship" card and the Tournaments page cards, and drive the
  "Deadline passed / X days left" line and the **Add to calendar** (.ics) and
  **Google** buttons. Unmatched calendar events only appear on the Tournaments
  page, never as a new home section.
- `"events": []`, a missing file or bad JSON means the site falls back to the
  `sessions` / `deadline` fields in `js/site-data.js`.
