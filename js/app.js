/* CHUSBC v2 preview — app logic (based on the Gemini layout).
   Data: js/site-data.js (static, from chusbc.org) + ./results-index.json (Prism-certified results) + ./events.json
   (upcoming events from the CHUSBC Google Calendar), both loaded at runtime and both optional. */
(function () {
  'use strict';
  const D = window.CHUSBC_DATA || { tournaments: [], results: [], hallOfFame: [], scholarships: [] };
  const EMAIL = { manager: 'cecilharford@gmail.com', web: 'chusbcwebmaster@gmail.com' };
  const ROUTES = {
    tournaments: { to: EMAIL.manager, label: 'Association Manager', subject: 'Tournament question' },
    youth:       { to: EMAIL.manager, label: 'Association Manager', subject: 'Youth bowling / scholarship question' },
    manager:     { to: EMAIL.manager, label: 'Association Manager', subject: 'Membership / averages question' },
    web:         { to: EMAIL.web,     label: 'Webmaster',           subject: 'Website / results question' },
    feedback:    { to: EMAIL.web,     label: 'Webmaster',           subject: 'Site feedback / enhancement idea' },
    records:     { to: EMAIL.manager, label: 'Association Manager', subject: 'Association record submission' }
  };
  const PRISM_INDEX_URL = './results-index.json';
  const EVENTS_URL = './events.json';
  const LIVE_URL = './live.json';
  const NEW_DAYS = 14;
  let prismResults = [];
  let calEvents = [];
  let currentTournamentFilter = 'all';

  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeUrl = (u) => (/^https:\/\//i.test(u || '') || /^\.?\/?[\w\-./]+\.pdf$/i.test(u || '')) ? u : '';
  // Live feeds: no-store + a per-minute query so the browser never reuses an old copy (GitHub Pages purges its CDN on each deploy).
  const feedUrl = (u) => u + '?v=' + Math.floor(Date.now() / 60000);
  const normTitle = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(certified|official|final|unofficial|results?|standings|the)\b/g, ' ').replace(/\s+/g, ' ').trim();
  const driveId = (u) => { const m = String(u || '').match(/\/d\/([\w-]{10,})|[?&]id=([\w-]{10,})/); return m ? (m[1] || m[2]) : ''; };
  const fmtDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const ext = (u) => { const m = (u || '').split('?')[0].match(/\.(pdf|xlsx?|docx?)$/i); return m ? m[1].toUpperCase() : 'PDF'; };

  /* ---------------- Navigation (+ hash routing so links like #honors/hof work) ---------------- */
  function switchView(viewName, subParam, opts) {
    opts = opts || {};
    if (!document.getElementById('view-' + viewName)) viewName = 'home';
    document.querySelectorAll('.view-section').forEach((sec) => sec.classList.add('hidden'));
    document.getElementById('view-' + viewName).classList.remove('hidden');
    document.querySelectorAll('.nav-btn').forEach((btn) => {
      const on = btn.dataset.nav === viewName;
      btn.classList.toggle('text-navy', on); btn.classList.toggle('bg-slate-100', on); btn.classList.toggle('font-bold', on);
      btn.classList.toggle('text-slate-600', !on); btn.classList.toggle('font-semibold', !on);
      if (on) btn.setAttribute('aria-current', 'page'); else btn.removeAttribute('aria-current');
    });
    document.querySelectorAll('[data-mobile-nav]').forEach((btn) => {
      const on = btn.dataset.mobileNav === viewName;
      btn.classList.toggle('bg-slate-100', on); btn.classList.toggle('font-bold', on); btn.classList.toggle('text-navy', on);
    });
    if (viewName === 'tournaments') setTournamentFilter(subParam || currentTournamentFilter || 'all');
    if (viewName === 'honors') setHonorsTab(subParam || 'hof');
    if (viewName === 'contact') { const sel = document.getElementById('contact-category'); if (sel && subParam && ROUTES[subParam]) { sel.value = subParam; updateContactRoute(); } }
    const hash = '#' + viewName + (subParam ? '/' + subParam : '');
    if (!opts.fromHash && location.hash !== hash) history.replaceState(null, '', viewName === 'home' && !subParam ? location.pathname : hash);
    if (!opts.keepScroll) window.scrollTo({ top: 0, behavior: opts.instant ? 'auto' : 'smooth' });
  }
  function routeFromHash(instant) {
    const h = (location.hash || '').replace(/^#/, '');
    if (!h) return;
    if (h === 'association-centers') { switchView('home', null, { fromHash: true, keepScroll: true }); document.getElementById('association-centers').scrollIntoView({ behavior: instant ? 'auto' : 'smooth' }); return; }
    const [v, sub] = h.split('/');
    switchView(v, sub || null, { fromHash: true, instant: instant });
  }

  function toggleMobileMenu() {
    const drawer = document.getElementById('mobile-drawer');
    const icon = document.getElementById('mobile-menu-icon');
    const open = drawer.classList.contains('hidden');
    drawer.classList.toggle('hidden', !open);
    icon.classList.toggle('fa-bars', !open); icon.classList.toggle('fa-xmark', open);
    document.getElementById('mobile-menu-btn').setAttribute('aria-expanded', String(open));
  }

  /* ---------------- Results (static archive + Prism-certified) ---------------- */
  function allResults() {
    // Prism entries first (newest published first); drop static archive rows that point at the same file or the same event + year.
    const urls = new Set(), ids = new Set(), keys = new Set();
    prismResults.forEach((r) => { if (r.url) urls.add(r.url); if (driveId(r.url)) ids.add(driveId(r.url)); keys.add(r.year + '|' + normTitle(r.title)); });
    return prismResults.concat(D.results.filter((r) => !(urls.has(r.url) || (driveId(r.url) && ids.has(driveId(r.url))) || keys.has(String(r.year) + '|' + normTitle(r.title)))));
  }
  function resultBadge(r) {
    if (!r.certified) return '<span class="px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-emerald-100 text-emerald-800">Posted</span>';
    return (r.isNew ? '<span class="px-2 py-0.5 rounded text-[11px] font-extrabold uppercase tracking-wider bg-gold text-navy ring-1 ring-navy/20">New</span>' : '') +
      '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-gold text-navy"><i class="fa-solid fa-circle-check"></i> Certified &middot; Published by Prism</span>';
  }
  function publishedLine(r) {
    return r.certified && r.publishedLabel ? `<span class="text-xs font-semibold text-gold-dark">Published ${esc(r.publishedLabel)}</span>` : '';
  }
  function resultLinks(r, compact) {
    const btn = compact
      ? 'inline-flex items-center gap-2 bg-slatebg hover:bg-navy hover:text-white text-navy font-bold text-xs px-4 py-2.5 rounded-xl border border-slate-200 transition'
      : 'inline-flex items-center gap-2 bg-gold-light hover:bg-gold text-navy font-bold text-xs px-4 py-2 rounded-xl border border-gold/40 transition';
    const kind = ext(r.url);
    let h = r.url
      ? `<a href="${esc(r.url)}" target="_blank" rel="noopener" class="${btn}"><i class="fa-solid ${kind === 'PDF' ? 'fa-file-pdf' : 'fa-file-excel'}"></i><span>View Results (${kind})</span></a>`
      : `<span class="inline-flex items-center gap-2 bg-slate-100 text-slate-400 font-bold text-xs px-4 py-2 rounded-xl">PDF coming soon</span>`;
    if (r.payouts) h += `<a href="${esc(r.payouts)}" target="_blank" rel="noopener" class="${btn}"><i class="fa-solid fa-sack-dollar"></i><span>Payouts</span></a>`;
    return `<div class="flex flex-wrap gap-2 self-start sm:self-center shrink-0">${h}</div>`;
  }
  function renderHomeLatestResults() {
    const top = allResults().slice(0, 5);
    document.getElementById('home-latest-results').innerHTML = top.map((r) => `
      <div class="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition">
        <div class="flex items-start sm:items-center gap-3.5">
          <div class="w-10 h-10 rounded-xl ${r.certified ? 'bg-gold text-navy' : 'bg-gold-light text-gold-dark'} flex items-center justify-center shrink-0"><i class="fa-solid ${r.certified ? 'fa-certificate' : 'fa-file-pdf'} text-lg"></i></div>
          <div>
            <div class="flex flex-wrap items-center gap-2">${resultBadge(r)}<span class="text-xs font-semibold text-slate-500">${esc(r.year)} Season</span>${publishedLine(r)}</div>
            <h3 class="font-bold text-navy text-sm sm:text-base mt-0.5">${esc(r.title)}</h3>
            ${r.meta ? `<div class="text-xs text-slate-500">${esc(r.meta)}</div>` : ''}
          </div>
        </div>
        ${resultLinks(r, true)}
      </div>`).join('');
  }
  function fillYearFilter() {
    const sel = document.getElementById('archive-year-filter');
    const cur = sel.value || 'all';
    const years = Array.from(new Set(allResults().map((r) => String(r.year)))).sort().reverse();
    sel.innerHTML = '<option value="all">All Years</option>' + years.map((y) => `<option value="${esc(y)}">${esc(y)} Season</option>`).join('');
    sel.value = years.includes(cur) ? cur : 'all';
  }
  function parsePrismIndex(idx) {
    const now = Date.now();
    const evs = idx && typeof idx === 'object' && Array.isArray(idx.events) ? idx.events : [];
    const byKey = new Map();
    evs.forEach((e) => {
      if (!e || typeof e !== 'object' || typeof e.event_name !== 'string' || !e.event_name.trim()) return; // skip malformed rows
      const fileId = /^[\w-]{10,}$/.test(e.pdf_file_id || '') ? e.pdf_file_id : '';
      const url = safeUrl(e.pdf_url) || (fileId ? 'https://drive.google.com/file/d/' + encodeURIComponent(fileId) + '/view' : '');
      const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(e.event_date || '');
      const year = /^\d{4}$/.test(String(e.year || '')) ? String(e.year) : (dateOk ? e.event_date.slice(0, 4) : '');
      const pub = e.published_at ? new Date(e.published_at) : null;
      const pubMs = pub && !isNaN(pub) ? pub.getTime() : 0;
      const r = {
        certified: true, year: year, title: e.event_name.trim(), url: url, file: '',
        meta: [dateOk ? fmtDate(new Date(e.event_date + 'T12:00:00')) : '', typeof e.host_center === 'string' ? e.host_center : ''].filter(Boolean).join(' · '),
        published_at: pubMs, publishedLabel: pubMs ? fmtDate(new Date(pubMs)) : '',
        isNew: pubMs > 0 && now - pubMs <= NEW_DAYS * 86400000 && pubMs <= now + 86400000,
        tournament_id: e.tournament_id || ''
      };
      // One row per tournament: a re-publish replaces the older entry.
      const key = r.tournament_id ? 'id:' + r.tournament_id : (fileId ? 'f:' + fileId : (url ? 'u:' + url : 't:' + year + '|' + normTitle(r.title)));
      const prev = byKey.get(key);
      if (!prev || r.published_at >= prev.published_at) byKey.set(key, r);
    });
    return Array.from(byKey.values()).sort((a, b) => b.published_at - a.published_at);
  }
  async function loadPrismResults() {
    try {
      const res = await fetch(feedUrl(PRISM_INDEX_URL), { cache: 'no-store' });
      if (res.ok) prismResults = parsePrismIndex(await res.json());
    } catch (err) { /* index missing, malformed or offline: static archive only */ prismResults = []; }
    fillYearFilter(); renderHomeLatestResults(); renderTournaments();
  }

  /* ---------------- Upcoming events: deadlines + Add to calendar ---------------- */
  const DAY = 86400000;
  const parseDay = (v) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
  const isTimed = (v) => /T\d{2}:\d{2}/.test(v || '');
  const today0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  function upcomingEvents() {
    const list = D.tournaments.filter((t) => t.status === 'upcoming' && Array.isArray(t.sessions) && t.sessions.length).map((t) => ({
      id: t.id, title: t.title, sessions: t.sessions.map((x) => ({ start: x.start, end: x.end || x.start })),
      location: t.location || t.center || '', description: t.summary || '', deadline: t.deadline || '', url: t.entryUrl || t.pageUrl || '', fromCalendar: false }));
    // events.json (CHUSBC Google Calendar) wins when it has the same event; extra calendar events are added.
    const claimed = new Set();
    calEvents.forEach((c) => {
      const hit = list.find((t) => (c.id && c.id === t.id) || normTitle(c.title) === normTitle(t.title));
      const sess = { start: c.start, end: c.end || c.start };
      if (hit) {
        if (!claimed.has(hit.id)) { hit.sessions = []; claimed.add(hit.id); }
        hit.sessions.push(sess); hit.fromCalendar = true;
        if (c.deadline) hit.deadline = c.deadline;
        if (c.location) hit.location = c.location;
      } else {
        const id = c.id || 'cal-' + normTitle(c.title).replace(/ /g, '-');
        const same = list.find((t) => t.id === id);
        if (same) same.sessions.push(sess);
        else list.push({ id: id, title: c.title, sessions: [sess], location: c.location || '', description: c.description || '', deadline: c.deadline || '', url: c.url || '', fromCalendar: true });
      }
    });
    list.forEach((t) => t.sessions.sort((a, b) => String(a.start).localeCompare(String(b.start))));
    return list;
  }
  const findEvent = (id) => upcomingEvents().find((t) => t.id === id);
  const lastDay = (ev) => parseDay(ev.sessions[ev.sessions.length - 1].end);
  const isOver = (ev) => { const d = lastDay(ev); return !d || d < today0(); };
  function deadlineInfo(ev) {
    const d = parseDay(ev.deadline);
    if (!d) return null;
    const days = Math.round((d - today0()) / DAY);
    if (days < 0) return { passed: true, text: 'Deadline passed', sub: 'Entry deadline was ' + fmtDate(d) };
    if (days === 0) return { passed: false, text: 'Deadline today', sub: 'Entry deadline ' + fmtDate(d) };
    return { passed: false, text: days + (days === 1 ? ' day left' : ' days left'), sub: 'Entry deadline ' + fmtDate(d) };
  }
  function deadlineBadge(ev) {
    const i = deadlineInfo(ev);
    if (!i) return '';
    const cls = i.passed ? 'bg-red-50 text-red-700 border-red-200' : 'bg-gold-light text-gold-dark border-gold/40';
    return `<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-bold uppercase tracking-wide ${cls}"><i class="fa-solid ${i.passed ? 'fa-hourglass-end' : 'fa-hourglass-half'}"></i>${esc(i.text)}</span> <span class="text-slate-500 text-xs">${esc(i.sub)}</span>`;
  }
  const ymd = (d) => d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  const utcStamp = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  function sessionRange(x) {
    if (isTimed(x.start)) { const a = new Date(x.start), b = new Date(isTimed(x.end) ? x.end : a.getTime() + 4 * 3600000); return { timed: true, s: utcStamp(a), e: utcStamp(b) }; }
    const a = parseDay(x.start), b = parseDay(x.end) || a;
    return { timed: false, s: ymd(a), e: ymd(new Date(b.getFullYear(), b.getMonth(), b.getDate() + 1)) }; // iCal/Google all-day end is exclusive
  }
  function eventDetails(ev) {
    const lines = [];
    if (ev.sessions.length > 1) lines.push('Dates: ' + ev.sessions.map((x) => { const a = parseDay(x.start), b = parseDay(x.end); return a ? fmtDate(a) + (b && +b !== +a ? ' – ' + fmtDate(b) : '') : ''; }).join(' and '));
    const d = parseDay(ev.deadline); if (d) lines.push('Entry deadline: ' + fmtDate(d));
    if (ev.description) lines.push(ev.description);
    if (ev.url) lines.push('Entry form / info: ' + ev.url);
    lines.push('Cecil Harford USBC · chusbc.org');
    return lines.join('\n');
  }
  function icsText(ev) {
    const escT = (v) => String(v || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
    const fold = (line) => { const out = []; while (line.length > 74) { out.push(line.slice(0, 74)); line = ' ' + line.slice(74); } out.push(line); return out.join('\r\n'); };
    const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Cecil Harford USBC//chusbc.org//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
    const stamp = utcStamp(new Date());
    ev.sessions.forEach((x, i) => {
      const r = sessionRange(x);
      L.push('BEGIN:VEVENT', 'UID:' + ev.id + '-' + (i + 1) + '-' + r.s + '@chusbc.org', 'DTSTAMP:' + stamp,
        r.timed ? 'DTSTART:' + r.s : 'DTSTART;VALUE=DATE:' + r.s, r.timed ? 'DTEND:' + r.e : 'DTEND;VALUE=DATE:' + r.e,
        'SUMMARY:' + escT(ev.title + (ev.sessions.length > 1 ? ' (weekend ' + (i + 1) + ' of ' + ev.sessions.length + ')' : '')),
        'LOCATION:' + escT(ev.location), 'DESCRIPTION:' + escT(eventDetails(ev)));
      if (/^https:\/\//.test(ev.url)) L.push('URL:' + ev.url);
      L.push('END:VEVENT');
    });
    L.push('END:VCALENDAR');
    return L.map(fold).join('\r\n') + '\r\n';
  }
  function downloadIcs(id) {
    const ev = findEvent(id); if (!ev) return;
    const blob = new Blob([icsText(ev)], { type: 'text/calendar;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = (normTitle(ev.title).replace(/ /g, '-') || 'chusbc-event') + '.ics';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    triggerToast('Calendar file downloaded. Open it to add “' + ev.title + '” to your calendar.');
  }
  function googleCalUrl(ev) {
    const x = ev.sessions.find((s) => { const e = parseDay(s.end); return e && e >= today0(); }) || ev.sessions[0];
    const r = sessionRange(x);
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(ev.title) + '&dates=' + r.s + '/' + r.e +
      '&location=' + encodeURIComponent(ev.location) + '&details=' + encodeURIComponent(eventDetails(ev));
  }
  function calButtons(ev, size) {
    if (isOver(ev)) return '';
    const sm = size === 'sm';
    const base = sm ? 'text-[11px] px-2.5 py-1.5' : 'text-xs px-3 py-2';
    const ics = `<button type="button" onclick="downloadIcs('${esc(ev.id)}')" class="inline-flex items-center gap-1.5 ${base} rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-navy font-bold transition" title="Download an .ics file for Apple, Outlook or Google Calendar"><i class="fa-regular fa-calendar-plus text-gold-dark"></i> Add to calendar</button>`;
    const g = `<a href="${esc(googleCalUrl(ev))}" target="_blank" rel="noopener" class="inline-flex items-center gap-1.5 ${base} rounded-lg text-slate-600 hover:text-navy font-semibold transition" title="${ev.sessions.length > 1 ? 'Adds the next weekend; all dates are listed in the event details' : 'Open in Google Calendar'}"><i class="fa-brands fa-google text-gold-dark"></i> Google</a>`;
    return ics + g;
  }
  function renderCalendarBits() {
    document.querySelectorAll('[data-cal-deadline]').forEach((el) => { const ev = findEvent(el.dataset.calDeadline); const h = ev && deadlineBadge(ev); if (h) el.innerHTML = h; });
    document.querySelectorAll('[data-cal-buttons]').forEach((el) => { const ev = findEvent(el.dataset.calButtons); const h = ev ? calButtons(ev) : ''; el.innerHTML = h; el.classList.toggle('hidden', !h); });
    document.querySelectorAll('[data-cal-inline]').forEach((el) => {
      const ev = findEvent(el.dataset.calInline);
      el.innerHTML = ev && !isOver(ev) ? ` &middot; <button type="button" onclick="downloadIcs('${esc(ev.id)}')" class="underline font-semibold text-amber-200 hover:text-white"><i class="fa-regular fa-calendar-plus mr-0.5"></i>Add to calendar</button>` : '';
    });
  }
  function parseEventsFile(j) {
    const evs = j && typeof j === 'object' && Array.isArray(j.events) ? j.events : [];
    const okDate = (v) => typeof v === 'string' && (/^\d{4}-\d{2}-\d{2}$/.test(v) || (isTimed(v) && !isNaN(new Date(v))));
    return evs.filter((e) => e && typeof e === 'object' && typeof e.title === 'string' && e.title.trim() && okDate(e.start)).map((e) => ({
      id: typeof e.id === 'string' ? e.id : '', title: e.title.trim(), start: e.start, end: okDate(e.end) ? e.end : e.start,
      location: typeof e.location === 'string' ? e.location : '', description: typeof e.description === 'string' ? e.description.slice(0, 400) : '',
      deadline: /^\d{4}-\d{2}-\d{2}$/.test(e.deadline || '') ? e.deadline : '', url: safeUrl(e.url) }));
  }
  async function loadEvents() {
    try {
      const res = await fetch(feedUrl(EVENTS_URL), { cache: 'no-store' });
      if (res.ok) calEvents = parseEventsFile(await res.json());
    } catch (err) { calEvents = []; /* fall back to js/site-data.js */ }
    renderCalendarBits(); renderTournaments();
  }

  /* ---------------- Tournaments hub ---------------- */
  function setTournamentFilter(filter) {
    currentTournamentFilter = filter;
    document.querySelectorAll('.tfilter-btn').forEach((btn) => {
      const on = btn.dataset.tfilter === filter;
      btn.classList.toggle('bg-gold', on); btn.classList.toggle('text-navy', on); btn.classList.toggle('font-bold', on);
      btn.classList.toggle('bg-white/10', !on); btn.classList.toggle('text-slate-200', !on); btn.classList.toggle('font-semibold', !on);
      btn.setAttribute('aria-selected', String(on));
    });
    renderTournaments();
  }
  function renderTournaments() {
    const q = (document.getElementById('tournament-search')?.value || '').toLowerCase().trim();
    const yearFilter = document.getElementById('archive-year-filter')?.value || 'all';
    const wrap = document.getElementById('tournament-events-wrapper');
    const grid = document.getElementById('tournament-grid');
    const titles = { all: 'Association Tournaments', upcoming: 'Upcoming Events', adult: 'Adult Championships', youth: 'Youth Events' };
    document.getElementById('tournament-section-title').textContent = titles[currentTournamentFilter] || titles.all;

    // Calendar-only events (from events.json, no matching site-data card) show here, never on the home page.
    const calOnly = upcomingEvents().filter((u) => u.fromCalendar && !isOver(u) && !D.tournaments.some((t) => t.id === u.id)).map((u) => {
      const a = parseDay(u.sessions[0].start), b = parseDay(u.sessions[u.sessions.length - 1].end);
      return { id: u.id, title: u.title, category: /youth/i.test(u.title) ? 'youth' : 'adult', status: 'upcoming', statusLabel: 'Upcoming · ' + a.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        dates: fmtDate(a) + (b && +b !== +a ? ' – ' + fmtDate(b) : ''), center: u.location || 'Location TBA', summary: u.description || 'From the CHUSBC calendar.',
        pageUrl: u.url || D.calendarUrl || '' };
    });
    const evs = D.tournaments.concat(calOnly).filter((ev) => {
      const hit = !q || [ev.title, ev.center, ev.dates].join(' ').toLowerCase().includes(q);
      if (!hit) return false;
      if (currentTournamentFilter === 'upcoming') return ev.status === 'upcoming';
      if (currentTournamentFilter === 'adult') return ev.category === 'adult';
      if (currentTournamentFilter === 'youth') return ev.category === 'youth';
      return true;
    });
    if (currentTournamentFilter === 'results') { wrap.classList.add('hidden'); wrap.hidden = true; }
    else {
      wrap.classList.remove('hidden'); wrap.hidden = false;
      document.getElementById('tournament-count-badge').textContent = evs.length + ' Event' + (evs.length === 1 ? '' : 's');
      const upEvents = upcomingEvents();
      grid.innerHTML = evs.length ? evs.map((ev) => {
        const youth = ev.category === 'youth';
        const up = ev.status === 'upcoming' ? upEvents.find((u) => u.id === ev.id) : null;
        const badge = ev.status === 'upcoming' ? 'bg-gold text-navy' : (youth ? 'bg-gold-light text-gold-dark' : 'bg-navy/10 text-navy');
        const primary = ev.entryUrl
          ? `<a href="${esc(ev.entryUrl)}" target="_blank" rel="noopener" class="flex-1 bg-navy hover:bg-navy-light text-white font-bold py-2.5 px-3 rounded-xl text-xs transition flex items-center justify-center gap-1.5"><i class="fa-solid fa-file-pdf text-gold"></i> Entry Form &amp; Rules</a>`
          : `<a href="${esc(ev.pageUrl)}" target="_blank" rel="noopener" class="flex-1 bg-slatebg hover:bg-slate-200 text-navy font-bold py-2.5 px-3 rounded-xl text-xs transition flex items-center justify-center gap-1.5 border border-slate-200"><i class="fa-solid fa-circle-info text-gold-dark"></i> Event Page</a>`;
        const secondary = ev.status === 'upcoming'
          ? `<button onclick="openSquadModal('${esc(ev.title).replace(/&#39;/g, "\\'")}')" class="flex-1 bg-gold hover:bg-gold-hover text-navy font-bold py-2.5 px-3 rounded-xl text-xs transition flex items-center justify-center gap-1.5"><i class="fa-solid fa-envelope"></i> Squad Inquiry</button>`
          : `<a href="${esc(ev.resultsUrl)}" target="_blank" rel="noopener" class="flex-1 bg-navy hover:bg-navy-light text-white font-bold py-2.5 px-3 rounded-xl text-xs transition flex items-center justify-center gap-1.5"><i class="fa-solid fa-ranking-star text-gold"></i> ${esc(ev.resultsLabel || 'Latest Results')}</a>`;
        return `
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between hover:shadow-md transition">
          <div>
            <div class="flex items-center justify-between gap-2 mb-3">
              <span class="px-2.5 py-1 rounded-lg text-[11px] font-extrabold uppercase tracking-wider ${badge}">${esc(ev.statusLabel)}</span>
              <span class="text-xs font-bold text-slate-500 uppercase">${youth ? 'Youth' : 'Adult'}</span>
            </div>
            <h3 class="font-display text-xl font-bold text-navy uppercase leading-snug">${esc(ev.title)}</h3>
            <div class="mt-3 space-y-1.5 text-xs text-slate-600">
              <div class="flex items-start gap-2"><i class="fa-solid fa-calendar text-gold-dark w-4 mt-0.5"></i><span class="font-semibold text-slate-800">${esc(ev.dates)}</span></div>
              <div class="flex items-start gap-2"><i class="fa-solid fa-location-dot text-gold-dark w-4 mt-0.5"></i><span>${esc(ev.center)}</span></div>
            </div>
            ${up ? `<div class="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1">${deadlineBadge(up)}</div>` : ''}
            <p class="text-xs text-slate-500 mt-3 leading-relaxed">${esc(ev.summary)}</p>
            ${up && calButtons(up, 'sm') ? `<div class="mt-3 flex flex-wrap items-center gap-1">${calButtons(up, 'sm')}</div>` : ''}
          </div>
          <div class="mt-5 pt-4 border-t border-slate-100 space-y-2">
            ${entryButton(ev, up)}
            <div class="flex items-center gap-2">${primary}${secondary}</div>
          </div>
        </div>`;
      }).join('') : `<div class="col-span-full bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-500 text-sm">No matching tournaments found for &ldquo;${esc(q)}&rdquo;.</div>`;
      if (D.calendarUrl && !q) {
        grid.insertAdjacentHTML('beforeend', `<a href="${esc(D.calendarUrl)}" target="_blank" rel="noopener" class="col-span-full text-center text-sm font-bold text-navy hover:text-gold-dark py-2"><i class="fa-solid fa-calendar-days mr-1.5 text-gold-dark"></i>2026–27 dates TBA unless shown. Past dates/centers are from the 2025–2026 CHUSBC Calendar of Events (PDF) <i class="fa-solid fa-arrow-up-right-from-square text-xs"></i></a>`);
      }
    }
    const list = allResults().filter((r) => (yearFilter === 'all' || String(r.year) === yearFilter) &&
      (!q || (r.title + ' ' + r.year + ' ' + (r.meta || '')).toLowerCase().includes(q)));
    document.getElementById('archive-list').innerHTML = list.length ? list.map((r) => `
      <div class="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition ${r.certified ? 'bg-gold-light/40' : ''}">
        <div class="flex items-center gap-3.5">
          <span class="px-2.5 py-1 rounded-lg bg-navy text-white font-display font-bold text-xs">${esc(r.year)}</span>
          <div>
            <div class="font-bold text-navy text-sm sm:text-base">${esc(r.title)}</div>
            <div class="flex flex-wrap items-center gap-2 mt-0.5">${r.certified ? resultBadge(r) + publishedLine(r) : ''}<span class="text-xs text-slate-500 font-mono break-all">${esc(r.meta || r.file || '')}</span></div>
          </div>
        </div>
        ${resultLinks(r, false)}
      </div>`).join('') : '<div class="p-8 text-center text-slate-500 text-sm">No results match your filter.</div>';
  }

  /* ---------------- LIVE from the Lanes (Facebook Live embed, hidden unless live.json says so) ---------------- */
  function fbVideoUrl(u) {
    try {
      const x = new URL(String(u || '').trim());
      if (x.protocol !== 'https:') return '';
      if (!/^(?:www\.|m\.|web\.)?facebook\.com$|^fb\.watch$/i.test(x.hostname)) return '';
      if (x.hostname !== 'fb.watch' && !/\/videos\/|\/watch\/?|\/live\/|\/reel\//i.test(x.pathname + '/')) return '';
      return x.href;
    } catch (e) { return ''; }
  }
  // Preview-only demo: ?livedemo=1 turns it on, ?livedemo=0 turns it off. Stored in THIS browser only; live.json is never changed.
  const LIVE_DEMO_KEY = 'chusbc-livedemo';
  const LIVE_DEMO = { live: true, title: 'Demo — LIVE from the Lanes', event: 'Preview demo (sample public Facebook video)',
    facebook_video_url: 'https://www.facebook.com/facebook/videos/10153231379946729/', demo: true };
  const liveDemoOn = () => { try { return localStorage.getItem(LIVE_DEMO_KEY) === '1'; } catch (e) { return false; } };
  (function readLiveDemoParam() {
    const m = /[?&]livedemo=([01])\b/.exec(location.search);
    if (!m) return;
    try { if (m[1] === '1') localStorage.setItem(LIVE_DEMO_KEY, '1'); else localStorage.removeItem(LIVE_DEMO_KEY); } catch (e) { /* storage blocked */ }
    const qs = location.search.replace(/([?&])livedemo=[01]\b&?/, '$1').replace(/[?&]$/, '');
    history.replaceState(null, '', location.pathname + qs + location.hash);
  })();
  function liveDemoOff() {
    try { localStorage.removeItem(LIVE_DEMO_KEY); } catch (e) { /* ignore */ }
    loadLive();
    triggerToast('Live player demo turned off in this browser.');
  }
  function renderLive(cfg) {
    const realUrl = cfg && cfg.live === true ? fbVideoUrl(cfg.facebook_video_url) : '';
    if (!realUrl && liveDemoOn()) cfg = LIVE_DEMO;   // a real stream always wins over the demo
    const url = cfg && cfg.live === true ? fbVideoUrl(cfg.facebook_video_url) : '';
    document.querySelectorAll('.live-slot').forEach((el) => {
      if (!url) { el.innerHTML = ''; el.classList.add('hidden'); return; }
      const title = typeof cfg.title === 'string' && cfg.title.trim() ? cfg.title.trim().slice(0, 120) : 'Live from the lanes';
      const ev = typeof cfg.event === 'string' ? cfg.event.trim().slice(0, 120) : '';
      const src = 'https://www.facebook.com/plugins/video.php?href=' + encodeURIComponent(url) + '&show_text=false&width=1280';
      const home = el.dataset.liveVariant === 'home';
      el.innerHTML = `
      <div class="${home ? 'bg-navy-dark border-b-4 border-gold' : 'bg-navy-dark rounded-2xl overflow-hidden shadow-sm border-b-4 border-gold'}">
        <div class="${home ? 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5' : 'p-4 sm:p-5'} grid grid-cols-1 md:grid-cols-[1fr_minmax(0,560px)] gap-4 md:gap-6 items-center">
          <div class="text-white">
            <div class="inline-flex items-center gap-2 bg-red-600 text-white text-[11px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-md">
              <span class="relative flex w-2 h-2"><span class="absolute inline-flex w-full h-full rounded-full bg-white opacity-75 animate-ping"></span><span class="relative inline-flex w-2 h-2 rounded-full bg-white"></span></span> Live
            </div>
            <h2 class="font-display text-2xl sm:text-3xl font-bold uppercase mt-2 leading-tight">Live from the Lanes</h2>
            <p class="text-slate-200 text-sm sm:text-base font-semibold mt-1">${esc(title)}</p>
            ${ev ? `<p class="text-gold text-xs font-bold uppercase tracking-wide mt-1">${esc(ev)}</p>` : ''}
            <a href="${esc(url)}" target="_blank" rel="noopener" class="mt-3 inline-flex items-center gap-2 bg-gold hover:bg-gold-hover text-navy font-bold text-xs px-4 py-2 rounded-xl transition"><i class="fa-brands fa-facebook"></i> Watch on Facebook</a>
            ${cfg.demo ? `<div class="mt-3 text-[11px] text-slate-400"><i class="fa-solid fa-flask text-gold mr-1"></i>Demo mode &middot; <button type="button" onclick="liveDemoOff()" class="underline font-bold text-gold hover:text-white">Turn off</button></div>` : ''}
          </div>
          <div class="relative w-full rounded-xl overflow-hidden bg-black ring-1 ring-white/10" style="aspect-ratio:16/9">
            <iframe src="${esc(src)}" title="${esc(title)} (Facebook Live)" class="absolute inset-0 w-full h-full" style="border:none;overflow:hidden" scrolling="no" frameborder="0" allowfullscreen="true" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share" loading="lazy"></iframe>
          </div>
        </div>
      </div>`;
      el.classList.remove('hidden');
    });
  }
  async function loadLive() {
    let cfg = null;
    try {
      const res = await fetch(feedUrl(LIVE_URL), { cache: 'no-store' });
      if (res.ok) cfg = await res.json();
    } catch (err) { cfg = null; /* missing, offline or bad JSON: show nothing */ }
    renderLive(cfg);
  }

  /* ---------------- Online entry (mailto prefill, no payment) ---------------- */
  function entryButton(ev, up) {
    if (ev.status !== 'upcoming' || !ev.entry) return '';
    const closed = up && deadlineInfo(up) && deadlineInfo(up).passed;
    if (closed || (up && isOver(up))) return `<div class="w-full text-center text-[11px] font-bold uppercase tracking-wide text-slate-400 bg-slate-50 border border-slate-200 rounded-xl py-2"><i class="fa-solid fa-lock mr-1"></i> Online entry closed &middot; deadline passed</div>`;
    return `<button type="button" onclick="openEntryModal('${esc(ev.id)}')" class="w-full bg-gold hover:bg-gold-hover text-navy font-bold py-2.5 px-3 rounded-xl text-xs transition flex items-center justify-center gap-1.5"><i class="fa-solid fa-pen-to-square"></i> Enter Online</button>`;
  }
  const inputCls = 'w-full px-3 py-2 rounded-lg bg-slatebg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-gold';
  function openEntryModal(id) {
    const t = D.tournaments.find((x) => x.id === id);
    if (!t || !t.entry) return;
    const cfg = t.entry;
    document.getElementById('entry-form').reset();
    document.getElementById('entry-tid').value = t.id;
    document.getElementById('entry-event-name').value = t.title + ' · ' + t.dates;
    document.getElementById('entry-events').innerHTML = cfg.events.map((e, i) => `
      <label class="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-navy cursor-pointer has-[:checked]:bg-gold-light has-[:checked]:border-gold">
        <input type="checkbox" name="entry-event" value="${esc(e)}" class="accent-[#0F1E36]"> ${esc(e)}</label>`).join('');
    document.getElementById('entry-bowlers').innerHTML = Array.from({ length: cfg.maxBowlers || 1 }, (_, i) => `
      <div class="grid grid-cols-12 gap-2 items-center">
        <span class="col-span-1 text-xs font-bold text-slate-500 text-center">${i + 1}</span>
        <input aria-label="Bowler ${i + 1} name" placeholder="Bowler name${i === 0 ? ' *' : ''}" ${i === 0 ? 'required' : ''} class="col-span-11 sm:col-span-5 ${inputCls} entry-b-name">
        <input aria-label="Bowler ${i + 1} USBC member ID" placeholder="USBC ID" class="col-span-6 col-start-2 sm:col-start-auto sm:col-span-4 ${inputCls} entry-b-id">
        <input aria-label="Bowler ${i + 1} average" placeholder="Avg" inputmode="numeric" class="col-span-5 sm:col-span-2 ${inputCls} entry-b-avg">
      </div>`).join('');
    const sq = document.getElementById('entry-squad');
    sq.innerHTML = '<option value="">' + (cfg.squads.length ? 'Select a squad' : 'To be confirmed') + '</option>' + cfg.squads.map((x) => `<option>${esc(x)}</option>`).join('');
    document.getElementById('entry-squad-note').textContent = cfg.note || '';
    const pdf = document.getElementById('entry-pdf');
    pdf.href = t.entryUrl || t.pageUrl || '#'; pdf.classList.toggle('hidden', !(t.entryUrl || t.pageUrl));
    openModal('entry-modal');
  }
  function handleEntrySubmit(e) {
    e.preventDefault();
    const t = D.tournaments.find((x) => x.id === document.getElementById('entry-tid').value);
    if (!t) return;
    const events = Array.from(document.querySelectorAll('input[name="entry-event"]:checked')).map((x) => x.value);
    if (!events.length) { triggerToast('Pick at least one event.'); return; }
    const v = (id) => document.getElementById(id).value.trim();
    const rows = Array.from(document.querySelectorAll('#entry-bowlers > div')).map((r, i) => {
      const n = r.querySelector('.entry-b-name').value.trim(); if (!n) return '';
      const id = r.querySelector('.entry-b-id').value.trim(), avg = r.querySelector('.entry-b-avg').value.trim();
      return (i + 1) + '. ' + n + ' | USBC ID: ' + (id || '—') + ' | Avg: ' + (avg || '—');
    }).filter(Boolean);
    const lead = rows.length ? rows[0].replace(/^1\. /, '').split(' | ')[0] : '';
    const href = mailto(ROUTES.tournaments.to, 'Online entry – ' + t.title + ' – ' + (v('entry-team') || lead), [
      'Tournament: ' + t.title + ' (' + t.dates + ')', 'Events: ' + events.join(', '), '', 'Bowlers:', ...rows, '',
      v('entry-team') && 'Team name: ' + v('entry-team'), v('entry-center') && 'Home center / league: ' + v('entry-center'),
      'Captain email: ' + v('entry-email'), 'Captain phone: ' + v('entry-phone'), 'Squad choice: ' + (v('entry-squad') || 'To be confirmed'),
      v('entry-notes') && 'Notes: ' + v('entry-notes'), '', 'Payment: per the entry form instructions (no payment taken online).',
      '(Sent from the chusbc.org online entry form)']);
    closeModal('entry-modal');
    window.location.href = href;
    triggerToast('Opening your email app with your entry to ' + ROUTES.tournaments.to + '. Press Send there to submit it.');
  }

  /* ---------------- Board of Directors ---------------- */
  const avatar = '<div class="w-12 h-12 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0" title="Photo pending committee approval"><i class="fa-solid fa-user text-slate-300 text-xl"></i></div>';
  function renderBoard() {
    const B = D.board; const o = document.getElementById('board-officers');
    if (!B || !o) return;
    const termTag = (y) => y ? `<span class="inline-block mt-1 text-[11px] font-bold uppercase tracking-wide text-gold-dark">Term ends ${esc(y)}</span>` : '';
    const card = (p, appointed) => `
      <div class="bg-white rounded-2xl p-5 border ${appointed ? 'border-gold/60' : 'border-slate-200'} shadow-sm relative overflow-hidden flex flex-col">
        <div class="absolute top-0 inset-x-0 h-1 ${appointed ? 'bg-navy' : 'bg-gold'}"></div>
        <div class="flex items-center gap-3">${avatar}<div class="min-w-0">
          <div class="text-[11px] font-extrabold uppercase tracking-widest text-gold-dark">${esc(p.role)}</div>
          <div class="font-display text-lg font-bold text-navy uppercase leading-tight">${esc(p.name || 'To be announced')}</div>
          ${appointed ? '<span class="inline-block mt-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">Appointed by the board</span>' : termTag(p.term)}
        </div></div>
        <p class="text-xs text-slate-500 mt-3 leading-relaxed">${esc(p.duty || '')}</p>
      </div>`;
    o.innerHTML = B.officers.map((p) => card(p, false)).join('') + (B.manager ? card(B.manager, true) : '');
    document.getElementById('board-season').textContent = B.season ? B.season + ' board' : '';
    document.getElementById('board-directors').innerHTML = B.directors.map((d) => `
      <div class="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-3">
        ${avatar.replace('w-12 h-12', 'w-10 h-10').replace('text-xl', 'text-base')}
        <div class="min-w-0">
          <div class="text-[11px] font-bold uppercase tracking-wide text-slate-500">Director #${esc(d.seat)}</div>
          <div class="font-bold text-sm ${d.name ? 'text-navy' : 'text-slate-400 italic'}">${esc(d.name || 'Vacant')}</div>
          ${termTag(d.term)}
        </div>
      </div>`).join('');
  }

  /* ---------------- Honors ---------------- */
  function setHonorsTab(tab) {
    ['hof', 'scholarship', 'records', 'yearbook'].forEach((t) => {
      const on = t === tab;
      document.getElementById('htab-content-' + t).classList.toggle('hidden', !on);
      const btn = document.querySelector('[data-htab="' + t + '"]');
      btn.classList.toggle('bg-gold', on); btn.classList.toggle('text-navy', on); btn.classList.toggle('font-bold', on);
      btn.classList.toggle('bg-white/10', !on); btn.classList.toggle('text-slate-200', !on); btn.classList.toggle('font-semibold', !on);
    });
  }
  function nameLink(n, url) {
    return url ? `<a href="${esc(url)}" target="_blank" rel="noopener" class="font-semibold text-navy hover:text-gold-dark hover:underline">${esc(n)}</a>` : `<span class="font-semibold text-navy">${esc(n)}</span>`;
  }
  function renderHonors() {
    const cats = ['Superior Performance & Meritorious Service', 'Superior Performance', 'Meritorious Service'];
    document.getElementById('hof-grid').innerHTML = cats.map((c) => {
      const rows = D.hallOfFame.filter((h) => h.category === c).sort((a, b) => a.year - b.year || 0);
      return `
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
        <div class="absolute top-0 inset-x-0 h-1 bg-gold"></div>
        <div class="px-6 pt-6 pb-3 flex items-baseline justify-between gap-2">
          <h3 class="font-display text-xl font-bold text-navy uppercase">${esc(c)}</h3>
          <span class="text-xs font-bold text-gold-dark whitespace-nowrap">${rows.length} inductees</span>
        </div>
        <ul class="px-6 pb-6 text-sm divide-y divide-slate-100 ${rows.length > 12 ? 'max-h-[520px] overflow-y-auto' : ''}">
          ${rows.map((h) => `<li class="py-2 flex items-baseline gap-3"><span class="font-display font-bold text-gold-dark w-10 shrink-0">${esc(h.year)}</span>${nameLink(h.name, h.bio)}</li>`).join('')}
        </ul>
      </div>`;
    }).join('');
    const sch = D.scholarships.slice().sort((a, b) => b.year - a.year);
    document.getElementById('scholarship-list').innerHTML = sch.map((s) => `
      <div class="px-6 py-3 flex items-center gap-3"><span class="px-2.5 py-1 rounded-lg bg-gold-light text-gold-dark font-bold text-xs">${esc(s.year)}</span>${nameLink(s.name, s.bio)}</div>`).join('');
  }

  /* ---------------- Modals, email forms, toast ---------------- */
  function openModal(id) { const m = document.getElementById(id); m.classList.remove('hidden'); m.classList.add('flex'); const f = m.querySelector('input:not([readonly]),select,textarea'); if (f) f.focus(); }
  function closeModal(id) { const m = document.getElementById(id); m.classList.add('hidden'); m.classList.remove('flex'); }
  function openSquadModal(eventName) { document.getElementById('squad-event-name').value = eventName; openModal('squad-modal'); }
  function mailto(to, subject, lines) {
    return 'mailto:' + to + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(lines.filter(Boolean).join('\n'));
  }
  function handleSquadSubmit(e) {
    e.preventDefault();
    const v = (id) => document.getElementById(id).value.trim();
    const href = mailto(EMAIL.manager, 'Squad inquiry – ' + v('squad-event-name') + ' – ' + v('squad-name'), [
      'Tournament: ' + v('squad-event-name'), 'Captain / bowler: ' + v('squad-name'), 'Phone or email: ' + v('squad-contact'),
      'Events: ' + v('squad-events'), v('squad-pref') && 'Preferred date / squad: ' + v('squad-pref'), v('squad-notes') && ('Notes: ' + v('squad-notes')),
      '', '(Sent from the chusbc.org squad inquiry form)']);
    closeModal('squad-modal'); e.target.reset();
    window.location.href = href;
    triggerToast('Opening your email app with a message to ' + EMAIL.manager + '. Press Send there to deliver it.');
  }
  function openFeedback() { switchView('contact', 'feedback'); setTimeout(() => { const m = document.getElementById('contact-message'); if (m) m.focus({ preventScroll: true }); }, 300); }
  function updateContactRoute() {
    const r = ROUTES[document.getElementById('contact-category').value] || ROUTES.manager;
    document.getElementById('contact-route-note').innerHTML = 'Goes to: <strong>' + esc(r.to) + '</strong> (' + esc(r.label) + ')';
  }
  function handleContactSubmit(e) {
    e.preventDefault();
    const v = (id) => document.getElementById(id).value.trim();
    const r = ROUTES[v('contact-category')] || ROUTES.manager;
    const href = mailto(r.to, '[CHUSBC website] ' + r.subject + ' – ' + v('contact-name'), [
      v('contact-message'), '', '—', 'Name: ' + v('contact-name'), 'Reply to: ' + v('contact-email'),
      v('contact-usbc') && 'USBC ID: ' + v('contact-usbc'), '(Sent from the chusbc.org contact form)']);
    window.location.href = href;
    triggerToast('Opening your email app with a message to ' + r.to + '. Press Send there to deliver it.');
  }
  let toastTimer;
  function triggerToast(message) {
    const t = document.getElementById('toast-banner');
    document.getElementById('toast-message').textContent = message;
    t.classList.remove('hidden'); t.classList.add('flex');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.classList.add('hidden'); t.classList.remove('flex'); }, 6000);
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeModal('squad-modal'); closeModal('entry-modal'); } });

  Object.assign(window, { switchView, toggleMobileMenu, setTournamentFilter, renderTournaments, setHonorsTab,
    openSquadModal, closeModal, handleSquadSubmit, handleContactSubmit, updateContactRoute, triggerToast, openFeedback, downloadIcs, openEntryModal, handleEntrySubmit, liveDemoOff });

  document.addEventListener('DOMContentLoaded', () => {
    fillYearFilter(); renderHomeLatestResults(); renderTournaments(); renderHonors(); renderBoard();
    routeFromHash(true);
    window.addEventListener('hashchange', () => routeFromHash(false));
    renderCalendarBits();
    loadPrismResults();
    loadEvents();
    loadLive();
    // Re-check every 2 minutes while the page is visible, so the player appears/disappears without a reload.
    setInterval(() => { if (document.visibilityState === 'visible') loadLive(); }, 120000);
  });
})();
