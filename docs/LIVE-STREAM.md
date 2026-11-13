# LIVE from the Lanes: streaming to the site

The site can show a Facebook Live stream from the CHUSBC Facebook page
(facebook.com/chusbca). It is **hidden by default**. A compact "LIVE from the
Lanes" player shows only while `live.json` says `"live": true`: at the top of
the home page and at the top of the Tournaments page. Otherwise nothing
renders.

## 1. Go live on the CHUSBC Facebook page

Use an account that is an admin/editor of the CHUSBC page, and post **as the page**.

- **Phone:** Facebook app → switch to the CHUSBC page → *Live* → title it → *Go Live*.
- **Camera/laptop with OBS (or similar):** facebook.com/live/producer → choose the
  CHUSBC page → *Streaming software* → copy the stream key into OBS → *Start Streaming*,
  then *Go Live* in Live Producer. Never commit or share the stream key.
- Set the audience to **Public**. Facebook only embeds public videos; anything
  else shows a blank or "content unavailable" box.

## 2. Copy the live video URL

Once live, open the video on the page and copy its link, for example
`https://www.facebook.com/chusbca/videos/1234567890123456/`.
(Links that contain `/videos/`, `/watch`, `/live/` or `/reel/` on facebook.com, or fb.watch links, are accepted.)

## 3. Turn the player on

Edit `live.json` in the repo root and commit it to `main`, or ask the Grok Bot to do it:

```json
{
  "live": true,
  "title": "Open Championship – Team event, Saturday 4:00 pm",
  "event": "69th Annual CHUSBC Open Championship",
  "facebook_video_url": "https://www.facebook.com/chusbca/videos/1234567890123456/"
}
```

GitHub Pages redeploys in about a minute. Open pages pick up the change within
about 2 minutes (they re-check `live.json`); a reload shows it immediately.
Allow **a few minutes** in the worst case for the Pages CDN.

## 4. Turn it off afterwards

Set `"live": false` (you can clear the URL too) and commit. The player disappears
on the next check. Leaving it on after the stream ends just shows the recorded
video, so switch it off.

## Rules

- `live.json` is public (the repo is public). Put only the public video URL,
  title and event name in it. No stream keys, tokens or private links.
- If `live.json` is missing, invalid JSON, `live` isn't exactly `true`, or the URL
  isn't a facebook.com/fb.watch https link, the site shows nothing.
- The app's service worker fetches `live.json` network-first, so installed-app
  users see changes too.

## Automatic mode (after hosting)

Goal: the player turns on by itself when the CHUSBC Facebook page goes live, and
off when the stream ends. The site keeps working exactly the same way: it only
ever reads `live.json`. Only *who writes* `live.json` changes.

Not built yet. It needs the site on its permanent host (e.g. Firebase Hosting)
and a Meta app + Page access token that Scott sets up.

How it would work:

1. **Meta setup (Scott):** create a Meta (Facebook) developer app, connect it to
   the CHUSBC page, and generate a long-lived **Page access token** with
   permission to read the page's live videos (e.g. `pages_read_engagement`,
   plus whatever Meta's app review requires at the time).
2. **Server job:** a small scheduled function (e.g. a Firebase scheduled Cloud
   Function) runs every 1–2 minutes and calls the Graph API:
   `GET /{page-id}/live_videos?broadcast_status=["LIVE_NOW"]&fields=title,permalink_url,status`
3. **If a LIVE_NOW video is found:** it writes `live.json` with
   `"live": true`, the video title, and the public permalink
   (`https://www.facebook.com` + `permalink_url`) as `facebook_video_url`.
4. **When nothing is LIVE_NOW anymore:** it writes `"live": false` (clearing the URL).
   It only rewrites the file when the state actually changes.
5. **Where it writes:** on Firebase, the function serves or updates `live.json`
   directly (served with `Cache-Control: no-cache`). While still on GitHub Pages,
   it would have to commit `live.json` to `main` with a bot token instead,
   which is slower (Pages rebuild ~1 min + CDN), so automatic mode is meant for after the move.

Security rules:

- The Page access token (and any GitHub/Firebase credentials) live **only on the
  server** in Functions config / Secret Manager. Never in this public repo,
  never in `live.json`, never in browser JavaScript.
- `live.json` only ever contains public fields: `live`, `title`, `event`,
  `facebook_video_url`.
- Manual mode (section 3 above) keeps working as a fallback and an override.
