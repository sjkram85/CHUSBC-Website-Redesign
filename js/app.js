/* CHUSBC v2 preview — app logic (based on the Gemini layout).
   Data: js/site-data.js (static, from chusbc.org) + ./results-index.json (Prism-certified results, loaded at runtime). */
(function () {
  'use strict';
  const D = window.CHUSBC_DATA || { tournaments: [], results: [], hallOfFame: [], scholarships: [] };
  const EMAIL = { manager: 'cecilharford@gmail.com', web: 'chusbcwebmaster@gmail.com' };
  const ROUTES = {
    tournaments: { to: EMAIL.manager, label: 'Association Manager', subject: 'Tournament question' },
    youth:       { to: EMAIL.manager, label: 'Association Manager', subject: 'Youth bowling / scholarship question' },
    manager:     { to: EMAIL.manager, label: 'Association Manager', subject: 'Membership / averages question' },
    web:         { to: EMAIL.web,     label: 'Webmaster',           subject: 'Website / results question' },
    feedback:    { to: EMAIL.web,     label: 'Webmaster',           subject: 'Site feedback / enhancement idea' }
  };
  const PRISM_INDEX_URL = './results-index.json';
  let prismResults = [];
  let currentTournamentFilter = 'all';

  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeUrl = (u) => (/^https:\/\//i.test(u || '') || /^\.?\/?[\w\-./]+\.pdf$/i.test(u || '')) ? u : '';
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
    const seen = new Set(prismResults.map((r) => r.url));
    return prismResults.concat(D.results.filter((r) => !seen.has(r.url)));
  }
  function resultBadge(r) {
    return r.certified
      ? '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-gold text-navy"><i class="fa-solid fa-circle-check"></i> Certified &middot; Published by Prism</span>'
      : '<span class="px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-emerald-100 text-emerald-800">Posted</span>';
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
            <div class="flex flex-wrap items-center gap-2">${resultBadge(r)}<span class="text-xs font-semibold text-slate-500">${esc(r.year)} Season</span></div>
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
  async function loadPrismResults() {
    try {
      const res = await fetch(PRISM_INDEX_URL, { cache: 'no-store' });
      if (!res.ok) return;
      const idx = await res.json();
      const evs = Array.isArray(idx.events) ? idx.events : [];
      prismResults = evs.map((e) => {
        const url = safeUrl(e.pdf_url) || (e.pdf_file_id ? 'https://drive.google.com/file/d/' + encodeURIComponent(e.pdf_file_id) + '/view' : '');
        const year = e.year || (e.event_date ? String(e.event_date).slice(0, 4) : '');
        const when = e.event_date ? new Date(e.event_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
        return { certified: true, year: String(year), title: e.event_name || 'Certified results', url: url, file: '',
                 meta: [when, e.host_center].filter(Boolean).join(' · '), published_at: e.published_at || '', tournament_id: e.tournament_id || '' };
      }).sort((a, b) => String(b.published_at).localeCompare(String(a.published_at)));
    } catch (err) { /* index missing or offline: static archive only */ }
    fillYearFilter(); renderHomeLatestResults(); renderTournaments();
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

    const evs = D.tournaments.filter((ev) => {
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
      grid.innerHTML = evs.length ? evs.map((ev) => {
        const youth = ev.category === 'youth';
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
            <p class="text-xs text-slate-500 mt-3 leading-relaxed">${esc(ev.summary)}</p>
          </div>
          <div class="mt-5 pt-4 border-t border-slate-100 flex items-center gap-2">${primary}${secondary}</div>
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
            <div class="flex flex-wrap items-center gap-2 mt-0.5">${r.certified ? resultBadge(r) : ''}<span class="text-xs text-slate-500 font-mono break-all">${esc(r.meta || r.file || '')}</span></div>
          </div>
        </div>
        ${resultLinks(r, false)}
      </div>`).join('') : '<div class="p-8 text-center text-slate-500 text-sm">No results match your filter.</div>';
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
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal('squad-modal'); });

  Object.assign(window, { switchView, toggleMobileMenu, setTournamentFilter, renderTournaments, setHonorsTab,
    openSquadModal, closeModal, handleSquadSubmit, handleContactSubmit, updateContactRoute, triggerToast, openFeedback });

  document.addEventListener('DOMContentLoaded', () => {
    fillYearFilter(); renderHomeLatestResults(); renderTournaments(); renderHonors();
    routeFromHash(true);
    window.addEventListener('hashchange', () => routeFromHash(false));
    loadPrismResults();
  });
})();
