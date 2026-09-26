/* All Cabo Services · app del huésped · base compartida (v3, 26-sep-2026)
   Expone window.APP: ayudantes, enrutador por hash, pantallas, mapas, selector de lugar, pagos y eventos.
   Cada pantalla vive en su propio archivo (js/*.js) y se registra con APP.register(nombre, def).
   Todo el texto visible está en inglés (la app es para el huésped); los comentarios, en español. */
(function () {
  'use strict';
  const A = window.ACS;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hoy = A.hoy();
  const qs = new URLSearchParams(location.search);
  if (qs.get('user')) sessionStorage.setItem('acs_user', qs.get('user'));

  const APP = window.APP = { A, $, $$, esc, usd: A.usd, hoy, qs, views: {}, view: 'home', params: {} };
  let userId = sessionStorage.getItem('acs_user') || 'c1';

  // ───────── huésped y datos derivados ─────────
  APP.userId = () => userId;
  APP.user = () => A.cliente(userId) || A.db.clientes[0];
  APP.setUser = (id) => { userId = id; sessionStorage.setItem('acs_user', id); };
  APP.desktop = () => document.documentElement.dataset.device === 'desktop';
  APP.ini = (n) => String(n || '?').split(' ').map(x => x[0]).slice(0, 2).join('').toUpperCase();
  APP.first = (n) => String(n || '').split(' ')[0];
  APP.lugarN = (id) => { const l = A.lugar(id); return l ? (l.corto || l.nombre) : '—'; };
  APP.done = (v) => ['completado', 'cancelado', 'no_show'].includes(v.estado);
  APP.amigos = () => (APP.user().amigos || []).map(id => A.cliente(id)).filter(Boolean);
  APP.hotelDe = (u) => { const it = A.itinerariosDe(u.id)[0]; if (it) return it.hotelId; const v = A.db.viajes.filter(x => x.clienteId === u.id && x.destinoId !== 'sjd').slice(-1)[0]; return v ? v.destinoId : 'oo'; };
  APP.misViajes = () => { const u = APP.user(); return A.db.viajes.filter(v => v.clienteId === u.id || (v.cuentaId && v.cuentaId === u.cuentaId)); };
  APP.sugs = (cat, sub) => A.db.sugerencias.filter(s => s.activa && (!cat || s.cat === cat) && (!sub || s.sub === sub));
  APP.proximoViaje = () => { const vs = APP.misViajes().filter(v => !APP.done(v) && v.fecha >= hoy).sort((a, b) => (a.fecha + a.hora) < (b.fecha + b.hora) ? -1 : 1); return vs.find(v => A.EN_RUTA.includes(v.estado)) || vs.find(v => v.fecha === hoy) || null; };
  // ubicación actual del huésped: en el demo es el aeropuerto SJD (con GPS real se cambia solo esta línea)
  APP.MI_LUGAR = 'sjd';
  APP.miPos = () => A.lugar('sjd').pos;
  APP.kmDe = (pos) => A.haversine(APP.miPos(), pos);
  APP.kmTxt = (pos) => { const k = APP.kmDe(pos); return k < 0.15 ? 'here' : (k < 10 ? k.toFixed(1) : String(Math.round(k))) + ' km'; };
  APP.geoChip = () => `<span class="geo"><i></i>Your location: SJD Airport <span class="faint" style="font-weight:500;">· demo</span></span>`;
  // minutos del chofer libre más cercano a un punto (datos del demo)
  APP.minCerca = (pos) => { const cs = A.db.choferes.filter(c => c.enLinea && !A.viajeActivo(c.id)).map(c => A.haversine(c.pos, pos || APP.miPos())).sort((a, b) => a - b); return cs.length ? Math.max(3, Math.round(cs[0] / 50 * 60)) : null; };

  // ───────── fotos ─────────
  const VEH_FOTO = { suburban: 'suburban_drive', escalade: 'escalade_jet', hiace: 'hiace_casa', sprinter: 'sprinter_casa' };
  APP.fotoVeh = (tipo) => `../shared/img/site/${VEH_FOTO[tipo] || 'suburban_drive'}.webp`;
  APP.fotoSitio = (n) => `../shared/img/site/${n}.webp`;
  // foto de una sugerencia con respaldo de color + emoji si el servicio de fotos no responde
  // (el color y el emoji quedan debajo; la foto encima; si la foto falla, se quita y se ve el respaldo)
  APP.fotoSug = (s) => `<span class="ph-fallback" style="background:${esc(s.color || '#E6EAF1')};">${s.icono || ''}</span>${s.foto ? `<img class="ph-img" src="${esc(s.foto)}" alt="" loading="lazy" onerror="this.remove()">` : ''}`;

  // ───────── íconos (trazo 1.8, heredan color) ─────────
  const sv = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  APP.ICO = {
    home: sv('<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>'),
    trips: sv('<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M8 2v4M16 2v4M3 10h18"/><path d="M8 14h3M8 17h6"/>'),
    ride: sv('<path d="M5 11.5 6.6 7a1.5 1.5 0 0 1 1.4-1h8a1.5 1.5 0 0 1 1.4 1L19 11.5"/><rect x="3" y="11.5" width="18" height="6" rx="2"/><circle cx="7.5" cy="17.5" r="1.6"/><circle cx="16.5" cy="17.5" r="1.6"/>'),
    friends: sv('<circle cx="9" cy="8" r="3.5"/><circle cx="17" cy="9" r="2.8"/><path d="M2.5 20c.5-4 3.5-6 6.5-6s6 2 6.5 6M15 14.5c2.8 0 5.5 1.6 6 5.5"/>'),
    account: sv('<circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4 4-6 8-6s7.2 2 8 6"/>'),
    back: sv('<path d="M15 5l-7 7 7 7"/>'),
    close: sv('<path d="M6 6l12 12M18 6L6 18"/>'),
    chev: sv('<path d="M9 6l6 6-6 6"/>'),
    down: sv('<path d="M6 9l6 6 6-6"/>'),
    plane: sv('<path d="M2 16l20-8-4 8 4 4-6-2-3 3-2-6z"/>'),
    planeUp: sv('<path d="M3 21h18M4 14l7-2 6-8 3 1-4 8 5 2v2L4 15z"/>'),
    pin: sv('<path d="M12 21s-6-5.3-6-11a6 6 0 0 1 12 0c0 5.7-6 11-6 11z"/><circle cx="12" cy="10" r="2"/>'),
    dot: sv('<circle cx="12" cy="12" r="4" fill="currentColor"/>'),
    clock: sv('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    cal: sv('<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/>'),
    stay: sv('<path d="M3 20V9l9-5 9 5v11"/><path d="M9 20v-6h6v6"/>'),
    hotel: sv('<path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"/><path d="M16 9h2a2 2 0 0 1 2 2v10M3 21h18M8 7h4M8 11h4M8 15h4"/>'),
    swap: sv('<path d="M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3"/>'),
    plus: sv('<path d="M12 5v14M5 12h14"/>'),
    minus: sv('<path d="M5 12h14"/>'),
    bolt: sv('<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>'),
    fork: sv('<path d="M7 3v8a3 3 0 0 0 6 0V3M10 3v18M17 3c-2 2-2 6-2 8h4V3zM17 11v10"/>'),
    compass: sv('<circle cx="12" cy="12" r="9"/><path d="M15 9l-2 6-4 2 2-6z"/>'),
    wave: sv('<path d="M2 15c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"/><path d="M2 19c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"/><path d="M9 11V4l6 3-6 2"/>'),
    sun: sv('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
    flag: sv('<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>'),
    leaf: sv('<path d="M5 19c0-8 6-14 15-14 0 9-6 15-14 15"/><path d="M5 19c3-4 6-6 10-8"/>'),
    columns: sv('<path d="M3 21h18M5 21V10M10 21V10M14 21V10M19 21V10M2 10l10-6 10 6"/>'),
    search: sv('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'),
    mic: sv('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>'),
    share: sv('<path d="M12 3v12M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>'),
    split: sv('<path d="M4 4h6v6H4zM14 14h6v6h-6z"/><path d="M14 4l6 6M20 4l-6 6"/>'),
    phone: sv('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>'),
    chat: sv('<path d="M4 5h16v11H9l-5 4z"/>'),
    star: sv('<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>'),
    card: sv('<rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20M6 15h4"/>'),
    check: sv('<path d="M5 12l5 5 9-10"/>'),
    ext: sv('<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'),
    bag: sv('<rect x="5" y="7" width="14" height="14" rx="2"/><path d="M9 7V5a3 3 0 0 1 6 0v2"/>'),
    user: sv('<circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4 4-6 8-6s7.2 2 8 6"/>'),
    gift: sv('<rect x="3" y="8" width="18" height="13" rx="2"/><path d="M3 12h18M12 8v13M12 8c-2-4-6-4-6-1s4 1 6 1c2 0 6 2 6-1s-4-3-6 1"/>'),
    wine: sv('<path d="M8 3h8l-1 7a3 3 0 0 1-6 0zM12 13v8M8 21h8"/>'),
  };
  APP.ico = (n) => APP.ICO[n] || '';
  APP.SUBS = { water: ['On the water', 'wave'], beach: ['Beaches', 'sun'], golf: ['Golf', 'flag'], culture: ['Towns & culture', 'columns'], nature: ['Nature', 'leaf'] };

  // ───────── avisos y hojas ─────────
  let toastT = null;
  APP.toast = (m) => { const t = $('#toast'); t.innerHTML = `<div class="toast">${esc(m)}</div>`; clearTimeout(toastT); toastT = setTimeout(() => { t.innerHTML = ''; }, 2800); };
  APP.sheetH = (titulo) => `<div class="sheet-h"><h3>${esc(titulo)}</h3><button class="sheet-x press" data-close aria-label="Close">${APP.ICO.close}</button></div>`;
  let onCloseSheet = null;
  APP.sheet = (html, opts) => {
    opts = opts || {}; onCloseSheet = opts.onClose || null;
    $('#overlay').innerHTML = `<div class="sheet-bg" id="sheetBg"><div class="sheet" role="dialog" aria-modal="true">${html}</div></div>`;
    $('#sheetBg').addEventListener('click', e => { if (e.target.id === 'sheetBg') APP.closeSheet(); });
    $$('#overlay [data-close]').forEach(b => { b.onclick = APP.closeSheet; });
    return $('#overlay .sheet');
  };
  APP.closeSheet = () => { $('#overlay').innerHTML = ''; APP.chatViaje = null; const f = onCloseSheet; onCloseSheet = null; if (f) f(); };
  APP.sheetOpen = () => !!$('#sheetBg');

  // ───────── enrutador ─────────
  // def = { render(params), side?(el, params), tab?: 'home'|'trips'|'ride'|'friends'|'account', back?: 'vista' }
  APP.register = (name, def) => { APP.views[name] = def; };
  const parseHash = () => { const h = location.hash.replace(/^#/, ''); const [v, id] = h.split('/'); return { v: v || 'home', id: id ? decodeURIComponent(id) : null }; };
  APP.go = (name, params) => {
    params = params || {}; APP.view = name; APP.params = params;
    const h = '#' + name + (params.id ? '/' + encodeURIComponent(params.id) : '');
    if (location.hash !== h) { APP._skipHash = true; location.hash = h; }
    APP.render(); const p = $('#panel'); if (p) p.scrollTo(0, 0); window.scrollTo(0, 0);
  };
  APP.back = () => { const d = APP.views[APP.view] || {}; const to = typeof d.back === 'function' ? d.back(APP.params) : d.back; if (to) APP.go(to); else if (history.length > 1) history.back(); else APP.go('home'); };
  window.addEventListener('hashchange', () => { if (APP._skipHash) { APP._skipHash = false; return; } const { v, id } = parseHash(); if (APP.views[v]) { APP.view = v; APP.params = id ? { id } : {}; APP.render(); } });

  // ───────── pantallas ─────────
  // APP.screen({ body, title, back, right, map, nonav, top }) pinta #root. Con map:true en el teléfono devuelve el
  // elemento del mapa de arriba (#map); en escritorio devuelve null y el mapa se pinta en def.side(el) (panel lateral).
  APP.topbarMain = () => `<div class="topbar"><div class="row start" style="gap:10px;min-width:0;"><button class="avatar press" id="btnUser" title="Switch guest (demo)">${esc(APP.ini(APP.user().nombre))}</button><span class="brand"><img src="../shared/img/logo.png" alt="All Cabo Services"></span></div><span id="wxSlot"></span></div>`;
  APP.topbarBack = (title, right) => `<div class="topbar"><button class="iconbtn press" data-back aria-label="Back">${APP.ICO.back}</button><div class="t">${esc(title || '')}</div>${right || '<span style="width:44px;flex:none;"></span>'}</div>`;
  APP.screen = (o) => {
    o = o || {};
    const top = o.top != null ? o.top : (o.back ? APP.topbarBack(o.title, o.right) : APP.topbarMain());
    if (o.map && !APP.desktop()) {
      $('#root').innerHTML = `<div class="ms"><div class="ms-map"><div id="map" class="map"></div></div><div class="ms-top">${o.back ? `<button class="iconbtn press" data-back aria-label="Back">${APP.ICO.back}</button>` : `<button class="avatar press" id="btnUser" title="Switch guest (demo)">${esc(APP.ini(APP.user().nombre))}</button>`}${o.right || ''}</div><div class="ms-panel">${o.title && o.back ? `<div class="ph-h">${esc(o.title)}</div>` : ''}${o.body || ''}</div></div>`;
    } else {
      $('#root').innerHTML = `<div class="scr ${o.nonav ? 'nonav' : ''}">${top}${o.body || ''}</div>`;
    }
    $$('#root [data-back]').forEach(b => { b.onclick = APP.back; });
    const bu = $('#btnUser'); if (bu) bu.onclick = APP.demoSwitch;
    if ($('#wxSlot')) APP.clima((w) => { const s = $('#wxSlot'); if (s && w) s.innerHTML = `<span class="wx" title="Live weather · Cabo San Lucas"><i></i><b>${w.temp}°</b><span>${esc(w.txt)}</span></span>`; });
    return o.map && !APP.desktop() ? $('#map') : null; // en escritorio el mapa lo pinta def.side(el) en el panel lateral
  };

  // ───────── barra inferior ─────────
  const NAV = [['home', 'Home', 'home'], ['trips', 'Trips', 'trips'], ['ride', 'Ride', 'ride'], ['friends', 'Friends', 'friends'], ['account', 'Account', 'account']];
  APP.pendientesAmigos = () => A.db.invitaciones.filter(i => i.para === userId && i.estado === 'pendiente').length + A.viajesCompartidosCon(userId).filter(v => v.partes && v.partes[userId] && v.partes[userId].estado !== 'pagado' && !APP.done(v)).length;
  APP.renderNav = () => {
    const d = APP.views[APP.view] || {}; const nav = $('#nav');
    if (d.nonav) { nav.innerHTML = ''; return; }
    const cur = d.tab || APP.view; const n = APP.pendientesAmigos();
    nav.innerHTML = NAV.map(([id, l, ic]) => `<button class="nav-b ${id === 'ride' ? 'center' : ''} ${cur === id ? 'on' : ''}" data-nav="${id}" aria-label="${l}">${id === 'ride' ? `<i class="ring">${APP.ICO.ride}</i>` : APP.ICO[ic]}<span>${l}</span>${id === 'friends' && n ? `<i class="n">${n}</i>` : ''}</button>`).join('');
    $$('#nav [data-nav]').forEach(b => { b.onclick = () => { const v = b.dataset.nav; if (v === 'ride' && APP.ride) APP.ride.start({}); else APP.go(v); }; });
  };

  // ───────── cambio de huésped (demo) ─────────
  APP.demoSwitch = () => {
    APP.sheet(`${APP.sheetH('Demo · switch guest')}<p class="small muted">Each browser tab can be a different guest. Open two tabs to see friends split a ride.</p><div class="list" style="margin-top:12px;">${A.db.clientes.slice(0, 8).map(c => `<button class="lrow" data-u="${c.id}"><span class="avatar sm">${esc(APP.ini(c.nombre))}</span><div class="tx"><b>${esc(c.nombre)}</b><span>${esc(c.ciudad)} · ${c.visitas} trips</span></div>${c.id === userId ? '<span class="pill dark">You</span>' : ''}</button>`).join('')}</div><div class="grid2" style="margin-top:14px;"><button class="btn sec" id="swDev">${APP.desktop() ? 'Phone layout' : 'Desktop layout'}</button><button class="btn ghost" id="swReset">Reset demo</button></div>`);
    $$('[data-u]').forEach(x => { x.onclick = () => { APP.setUser(x.dataset.u); APP.closeSheet(); APP.go('home'); }; });
    $('#swReset').onclick = () => { if (confirm('Reset all demo data in this browser?')) { A.reset(); APP.closeSheet(); APP.go('home'); } };
    $('#swDev').onclick = () => { A.fijarDispositivo(APP.desktop() ? 'mobile' : 'desktop'); APP.closeSheet(); APP.render(); };
  };

  // ───────── clima real de Cabo San Lucas (Open-Meteo, sin llave; si falla no se muestra) ─────────
  APP.clima = (cb) => {
    try { const c = JSON.parse(sessionStorage.getItem('acs_wx') || 'null'); if (c && Date.now() - c.t < 30 * 60000) { cb(c); return; } } catch (e) { }
    if (APP._wxPend) { APP._wxPend.push(cb); return; } APP._wxPend = [cb];
    const txt = (k) => k === 0 ? 'Clear sky' : (k <= 3 ? 'Partly cloudy' : (k <= 48 ? 'Hazy' : (k <= 67 ? 'Rain' : (k <= 82 ? 'Showers' : 'Storms'))));
    fetch('https://api.open-meteo.com/v1/forecast?latitude=22.89&longitude=-109.91&current=temperature_2m,weather_code&timezone=America%2FMazatlan')
      .then(r => r.json()).then(j => { const w = { temp: Math.round(j.current.temperature_2m), txt: txt(j.current.weather_code), t: Date.now() }; sessionStorage.setItem('acs_wx', JSON.stringify(w)); APP._wxPend.forEach(f => f(w)); })
      .catch(() => { APP._wxPend.forEach(f => f(null)); }).finally(() => { APP._wxPend = null; });
  };

  // ───────── mapas ─────────
  const M = APP.mapa = { main: null, side: null, capas: {} };
  M.nuevo = (el) => {
    if (!el) return null;
    if (el.id === 'sideMap') { if (M.side) { M.side.remove(); M.side = null; } M.side = A.mapa(el, { idioma: 'en' }); return M.side; }
    if (M.main) { M.main.remove(); M.main = null; } M.main = A.mapa(el, { idioma: 'en' }); return M.main;
  };
  M.pin = (tipo, label) => L.divIcon({ className: 'mk', html: `<div style="position:relative;"><div class="mk-pin ${tipo || ''}"></div>${label ? `<div class="mk-lbl">${esc(label)}</div>` : ''}</div>`, iconSize: [18, 18], iconAnchor: [9, 9] });
  M.car = (busy) => L.divIcon({ className: 'mk', html: `<div class="mk-car ${busy ? 'busy' : ''}">${APP.ICO.ride}</div>`, iconSize: [36, 36], iconAnchor: [18, 18] });
  M.me = () => L.divIcon({ className: 'mk', html: '<div class="mk-me" title="You are here"></div>', iconSize: [18, 18], iconAnchor: [9, 9] });
  M.linea = (m, pts, opts) => { opts = opts || {}; L.polyline(pts, { color: '#FFFFFF', weight: (opts.weight || 5) + 5, opacity: .9 }).addTo(m); return L.polyline(pts, { color: opts.color || '#111318', weight: opts.weight || 5, opacity: 1, dashArray: opts.dash || null }).addTo(m); };
  M.fit = (m, bounds, pad) => { if (!m) return; const p = pad || 44; m.fitBounds(bounds, { padding: [p, p], maxZoom: 15 }); };
  // vista previa de una ruta antes de reservar: origen → paradas → destino
  M.preview = (el, origenId, destinoId, paradas) => {
    const m = M.nuevo(el); if (!m) return null; const lo = A.lugar(origenId), ld = A.lugar(destinoId);
    const r = A.rutaLugares(lo.pos, lo.nodo, ld); M.linea(m, r.pts);
    L.marker(APP.miPos(), { icon: M.me(), zIndexOffset: 900 }).addTo(m);
    L.marker(lo.pos, { icon: M.pin('', lo.corto || lo.nombre) }).addTo(m); L.marker(ld.pos, { icon: M.pin('dest', ld.corto || ld.nombre) }).addTo(m);
    const extra = (paradas || []).map(p => p.lugarId ? A.lugar(p.lugarId) : null).filter(Boolean).map(l => { L.marker(l.pos, { icon: M.pin('stop', 'Stop · ' + (l.corto || l.nombre)) }).addTo(m); return l.pos; });
    M.fit(m, L.latLngBounds([lo.pos, ld.pos].concat(extra)), 48); M.capas = { m }; return m;
  };
  // viaje en vivo: tramo a recoger (punteado, acento) y tramo al destino (tinta), camioneta encima
  M.viaje = (v, el) => {
    const m = M.nuevo(el); if (!m) return null; const o = A.lugar(v.origenId), d = A.lugar(v.destinoId); const r = A.rutaViaje(v);
    M.capas = { m, viajeId: v.id };
    M.capas.dest = M.linea(m, r.destino);
    if (r.recoger) M.capas.rec = L.polyline(r.recoger, { color: '#E8612C', weight: 4, dashArray: '6 8', opacity: .95 }).addTo(m);
    L.marker(o.pos, { icon: M.pin('', o.corto || o.nombre) }).addTo(m); L.marker(d.pos, { icon: M.pin('dest', d.corto || d.nombre) }).addTo(m);
    (v.paradas || []).forEach(p => { const l = p.lugarId ? A.lugar(p.lugarId) : null; if (l) L.marker(l.pos, { icon: M.pin('stop', 'Stop · ' + (l.corto || l.nombre)) }).addTo(m); });
    const c = v.choferId ? A.chofer(v.choferId) : null; if (c && !APP.done(v)) M.capas.car = L.marker(c.pos, { icon: M.car(A.EN_RUTA.includes(v.estado)), zIndexOffset: 1000 }).addTo(m);
    M.fit(m, L.latLngBounds([o.pos, d.pos].concat(c ? [c.pos] : [])), 50); return m;
  };
  M.actualizar = () => {
    const k = M.capas; if (!k.viajeId) return; const v = A.viaje(k.viajeId); if (!v) return; const c = v.choferId ? A.chofer(v.choferId) : null;
    if (c && k.car) k.car.setLatLng(c.pos);
    if (APP.etaLineas) { const [t1, t2] = APP.etaLineas(v); $$('.etacard b').forEach(e => { e.textContent = t1; }); $$('.etacard .eta2').forEach(e => { e.textContent = t2; }); }
    if (v.sim && c) { const idx = v.sim.cum.findIndex(x => x >= v.sim.avance); const resto = [c.pos].concat(v.sim.pts.slice(Math.max(1, idx))); if (v.sim.fase === 'a_recoger' && k.rec) k.rec.setLatLngs(resto); if (v.sim.fase === 'a_destino' && k.dest) k.dest.setLatLngs(resto); }
  };
  // lugares con foto en el mapa; onSel(id) al tocar uno
  M.lugares = (el, lista, selId, onSel) => {
    const m = M.nuevo(el); if (!m) return null; const pts = []; M.capas = { m, marcas: {} };
    lista.forEach(s => { const l = A.lugar(s.lugarId); if (!l) return; pts.push(l.pos);
      const mk = L.marker(l.pos, { icon: L.divIcon({ className: 'mk', html: `<div class="mk-photo ${selId === s.id ? 'on' : ''}" data-mk="${s.id}" style="background:${esc(s.color || '#E6EAF1')}"><span>${s.icono || ''}</span>${s.foto ? `<img src="${esc(s.foto)}" alt="" onerror="this.remove()">` : ''}</div><div class="mk-lbl">${esc(s.nombre)}</div>`, iconSize: [46, 46], iconAnchor: [23, 23] }), zIndexOffset: selId === s.id ? 500 : 0 }).addTo(m);
      M.capas.marcas[s.id] = mk; mk.on('click', () => { if (onSel) onSel(s.id); });
    });
    if (pts.length) M.fit(m, L.latLngBounds(pts), 56); return m;
  };
  M.marcar = (id) => { $$('.mk-photo').forEach(x => x.classList.toggle('on', x.dataset.mk === id)); const mk = M.capas.marcas && M.capas.marcas[id]; if (mk) { mk.setZIndexOffset(600); const m = M.capas.m; if (m) m.panTo(mk.getLatLng(), { animate: true }); } };
  // mapa lateral por defecto (escritorio): hotel del huésped, aeropuerto y camionetas en línea
  M.contexto = (el) => {
    const m = M.nuevo(el); if (!m) return null; const h = A.lugar(APP.hotelDe(APP.user())); const s = A.lugar('sjd');
    L.marker(h.pos, { icon: M.pin('dest', h.corto || h.nombre) }).addTo(m); L.marker(s.pos, { icon: M.pin('', 'SJD Airport') }).addTo(m);
    A.db.choferes.filter(c => c.enLinea).forEach(c => { L.marker(c.pos, { icon: M.car(!!A.viajeActivo(c.id)) }).addTo(m); });
    M.fit(m, L.latLngBounds([h.pos, s.pos]), 90); return m;
  };
  APP.sideUpdate = () => {
    if (!APP.desktop()) { if (M.side) { M.side.remove(); M.side = null; } return; }
    const el = $('#sideMap'); $('#sideOver').innerHTML = ''; const d = APP.views[APP.view] || {};
    if (d.side) d.side(el, APP.params || {}); else M.contexto(el);
  };

  // ───────── selector de lugar (hoja con buscador y distancia desde tu ubicación) ─────────
  const lugares = A.LUGARES.filter(l => l.tipo !== 'aeropuerto');
  APP.GRUPOS = [['Corridor', l => l.tipo === 'hotel' && l.area === 'Corridor'], ['San José del Cabo', l => l.tipo === 'hotel' && l.area === 'San José'], ['Cabo San Lucas', l => l.tipo === 'hotel' && l.area === 'Cabo San Lucas'], ['Pacific', l => l.tipo === 'hotel' && l.area === 'Pacific'], ['Private villas', l => l.tipo === 'villa'], ['Restaurants', l => l.tipo === 'restaurante'], ['Things to do', l => l.tipo === 'actividad']];
  // opts: { aero: bool (incluir aeropuerto), yo: bool (opción «ubicación actual»), libre: bool (dirección libre) }; cb({ lugarId } | { texto })
  APP.pickerLugar = (titulo, actual, cb, opts) => {
    opts = opts || {};
    const icoDe = (l) => l.tipo === 'aeropuerto' ? APP.ICO.plane : l.tipo === 'restaurante' ? APP.ICO.fork : l.tipo === 'actividad' ? APP.ICO.compass : l.tipo === 'hotel' ? APP.ICO.hotel : APP.ICO.pin;
    const fila = (l) => `<button class="pk ${l.id === actual ? 'on' : ''}" data-pk="${l.id}"><span class="pk-ic">${icoDe(l)}</span><div class="tx"><b>${esc(l.nombre)}</b><span>${esc(l.area || '')}${l.tipo === 'villa' ? ' · private villa' : ''}${l.tipo === 'restaurante' ? ' · restaurant' : ''}${l.tipo === 'actividad' ? ' · things to do' : ''}</span></div><span class="pk-km">${APP.kmTxt(l.pos)}</span></button>`;
    const porKm = (ls) => ls.slice().sort((a, b) => APP.kmDe(a.pos) - APP.kmDe(b.pos));
    const lista = (q) => {
      q = (q || '').toLowerCase(); const secs = []; if (opts.aero !== false) secs.push(['Airport', [A.lugar('sjd')]]); APP.GRUPOS.forEach(([g, f]) => secs.push([g, porKm(lugares.filter(f))]));
      const cerca = !q ? porKm(lugares.filter(l => l.id !== actual && l.tipo !== 'villa')).slice(0, 4) : [];
      const yo = !q && opts.yo ? `<div class="pk-g">You</div><button class="pk" data-pk="${APP.MI_LUGAR}"><span class="pk-ic">${APP.ICO.dot}</span><div class="tx"><b>Current location</b><span>SJD Airport · demo location</span></div><span class="pk-km">here</span></button>` : '';
      const html = (cerca.length ? '<div class="pk-g">Nearby</div>' + cerca.map(fila).join('') : '') + secs.map(([g, ls]) => { const fl = ls.filter(l => !q || l.nombre.toLowerCase().includes(q) || (l.area || '').toLowerCase().includes(q) || g.toLowerCase().includes(q)); return fl.length ? `<div class="pk-g">${esc(g)}</div>` + fl.map(fila).join('') : ''; }).join('');
      return yo + (html || '<div class="empty">No matches. Try a hotel name or an area.</div>') + (opts.libre ? `<div class="pk-g">Other</div><button class="pk" data-pk="_free"><span class="pk-ic">${APP.ICO.pin}</span><div class="tx"><b>Another address</b><span>Pharmacy, shop, a friend's villa…</span></div></button>` : '');
    };
    APP.sheet(`${APP.sheetH(titulo)}<label class="search"><span>${APP.ICO.search}</span><input id="pkQ" placeholder="Search hotels, restaurants, places…" autocomplete="off"></label><div class="row" style="margin-top:10px;">${APP.geoChip()}<span class="tiny faint">distances from you</span></div><div class="pk-list" id="pkList">${lista('')}</div>`);
    const bind = () => $$('#pkList [data-pk]').forEach(b => { b.onclick = () => {
      if (b.dataset.pk === '_free') {
        APP.sheet(`${APP.sheetH('Another address')}<label class="lbl">Where should we stop?</label><input class="txt" id="pkFree" placeholder="e.g. Walmart San José, a pharmacy…"><button class="btn xl full" id="pkFreeGo" style="margin-top:14px;">Add stop</button>`);
        $('#pkFreeGo').onclick = () => { const t = $('#pkFree').value.trim(); if (!t) return; APP.closeSheet(); cb({ texto: t }); }; setTimeout(() => { const f = $('#pkFree'); if (f) f.focus(); }, 60); return;
      }
      APP.closeSheet(); cb({ lugarId: b.dataset.pk }); }; });
    bind(); $('#pkQ').oninput = () => { $('#pkList').innerHTML = lista($('#pkQ').value); bind(); };
    if (APP.desktop()) setTimeout(() => { const q = $('#pkQ'); if (q) q.focus(); }, 60);
  };

  // ───────── pagos simulados ─────────
  // APP.pagar({ metodo, monto (USD), concepto, onDone(extra) }) — muestra la hoja del método y llama onDone al confirmar
  APP.pagar = (o) => {
    const total = A.usd(o.monto); const concepto = o.concepto || 'All Cabo Services';
    if (o.metodo === 'applepay') {
      APP.sheet(`<div style="text-align:center;padding:6px 0 4px;"><div style="display:inline-flex;align-items:center;gap:4px;background:#000;color:#fff;border-radius:10px;padding:6px 14px;font-weight:700;font-size:17px;"> Pay</div><div class="faceid">👤</div><div class="muted small" id="apMsg">Confirm with Face ID…</div><div class="row" style="margin-top:16px;"><span class="muted">${esc(concepto)}</span><b>${total}</b></div></div>`);
      setTimeout(() => { const m = $('#apMsg'); if (m) m.innerHTML = `<span class="ok-t" style="font-weight:700;">✓ Done</span>`; }, 1100);
      setTimeout(() => { APP.closeSheet(); o.onDone({ ultimos4: '4242' }); }, 1700); return;
    }
    if (o.metodo === 'zelle') {
      APP.sheet(`${APP.sheetH('Pay with Zelle')}<p class="small muted">Send <b style="color:var(--ink)">${total}</b> from your bank app to <b style="color:var(--ink)">pay@allcaboservices.com</b> · All Cabo Services. Your booking is held now; our office confirms the payment, usually within minutes.</p><div class="card" style="margin:12px 0;"><div class="kv"><span>Reference</span><b>ACS-${String(10000 + Math.floor(Math.random() * 90000))}</b></div><div class="kv"><span>Amount</span><b>${total}</b></div><div class="kv"><span>Fees</span><b>None</b></div></div><button class="btn xl full" id="zGo">I sent the Zelle</button><p class="legal" style="margin-top:10px;text-align:center;">Demo: nothing is sent; in production the reference matches your Zelle memo.</p>`);
      $('#zGo').onclick = () => { APP.closeSheet(); o.onDone({}); }; return;
    }
    if (o.metodo === 'tarjeta') {
      APP.sheet(`${APP.sheetH('Card payment')}<label class="lbl">Card number</label><input class="txt" id="cNum" value="4242 4242 4242 4242" inputmode="numeric"><div class="grid2"><div><label class="lbl">Expiry</label><input class="txt" value="09/28"></div><div><label class="lbl">CVC</label><input class="txt" value="123" inputmode="numeric"></div></div><label class="lbl">Name on card</label><input class="txt" value="${esc(APP.user().nombre)}"><button class="btn xl full" id="cGo" style="margin-top:16px;">Pay ${total}</button><p class="legal" style="margin-top:10px;text-align:center;">Simulated · in production this runs on Stripe and nothing is stored on our side.</p>`);
      $('#cGo').onclick = () => { $('#cGo').textContent = 'Authorizing…'; setTimeout(() => { const n = ($('#cNum') || {}).value || ''; APP.closeSheet(); o.onDone({ ultimos4: n.slice(-4) }); }, 900); }; return;
    }
    if (o.metodo === 'transferencia') {
      APP.sheet(`${APP.sheetH('Bank transfer (SPEI)')}<div class="card" style="margin:10px 0;"><div class="kv"><span>Beneficiary</span><b>All Cabo Services S.A. de C.V.</b></div><div class="kv"><span>CLABE</span><b>012 180 0012345678 9</b></div><div class="kv"><span>Amount</span><b>${total} · ${A.mxn(o.monto * A.db.config.tipoCambio)}</b></div></div><p class="legal">Simulated account. Confirmed automatically when the transfer lands.</p><button class="btn xl full" id="tGo" style="margin-top:12px;">I made the transfer</button>`);
      $('#tGo').onclick = () => { APP.closeSheet(); o.onDone({}); }; return;
    }
    APP.sheet(`${APP.sheetH('Cash on arrival')}<p class="small muted">Pay <b style="color:var(--ink)">${total}</b> in USD or MXN to your driver. Your reservation is confirmed now; we only ask you to cancel 24 h ahead.</p><button class="btn xl full" id="eGo" style="margin-top:14px;">Confirm reservation</button>`);
    $('#eGo').onclick = () => { APP.closeSheet(); o.onDone({}); };
  };
  // hoja «otras formas de pago»; cb(metodo)
  APP.otrosPagos = (cb) => {
    APP.sheet(`${APP.sheetH('Other ways to pay')}<div class="list" style="margin-top:6px;"><button class="lrow" data-pago="tarjeta"><span class="ic" style="background:#1A1F71;color:#fff;font-weight:800;font-size:11px;">VISA</span><div class="tx"><b>Credit or debit card</b><span>Visa, Mastercard, Amex · 3D Secure</span></div></button><button class="lrow" data-pago="transferencia"><span class="ic" style="font-weight:800;font-size:11px;">SPEI</span><div class="tx"><b>Bank transfer (Mexico)</b><span>SPEI with reference</span></div></button><button class="lrow" data-pago="efectivo"><span class="ic" style="background:var(--ok-soft);color:var(--ok);font-weight:800;">$</span><div class="tx"><b>Cash on arrival</b><span>USD or MXN · driver carries change</span></div></button></div>`);
    $$('[data-pago]').forEach(b => { b.onclick = () => { APP.closeSheet(); cb(b.dataset.pago); }; });
  };

  // ───────── render y eventos ─────────
  APP.render = () => {
    if (M.main) { M.main.remove(); M.main = null; } M.capas = {};
    const track = qs.get('track');
    if (track && A.viaje(track) && APP.views.track) { APP.view = 'track'; APP.views.track.render({ id: track }); $('#nav').innerHTML = ''; return; }
    const d = APP.views[APP.view] || APP.views.home; if (!APP.views[APP.view]) APP.view = 'home';
    d.render(APP.params || {}); APP.renderNav(); APP.sideUpdate();
  };
  window.addEventListener('resize', () => { const dv = document.documentElement.dataset.device; if (M.main) M.main.invalidateSize(); if (M.side) M.side.invalidateSize(); clearTimeout(APP._rz); APP._rz = setTimeout(() => { if (document.documentElement.dataset.device !== dv) APP.render(); }, 150); });
  A.on((motivo) => {
    if (motivo === 'sim') { M.actualizar(); return; }
    if (APP.sheetOpen()) { if (APP.chatViaje && APP.chatRefresh) APP.chatRefresh(); return; }
    const a = document.activeElement; if (a && ['INPUT', 'TEXTAREA', 'SELECT'].includes(a.tagName)) return;
    if (APP.views[APP.view] && APP.views[APP.view].noAutoRender) return;
    APP.render();
  });
  A.onEvento((ev) => {
    const v = ev.viajeId ? A.viaje(ev.viajeId) : null; if (!v) return;
    if (ev.tipo === 'compartido' && ev.para === userId) { APP.toast(`${APP.first(v.nombre)} shared a ride with you`); return; }
    if (v.clienteId !== userId && !(v.compartidoCon || []).includes(userId)) return;
    if (ev.tipo === 'viaje_asignado') APP.toast(`${A.chofer(ev.choferId).nombre} is your driver`);
    if (ev.tipo === 'estado') { const t = { en_camino: 'Your driver is on the way', llegue: 'Your driver has arrived' + (v.origenId === 'sjd' ? ' · Door 3' : ''), a_bordo: 'Enjoy the ride!', completado: 'Trip completed · receipt sent', cancelado: 'Trip cancelled' }[ev.estado]; if (t) APP.toast(t); }
    if (ev.tipo === 'mensaje' && ev.de === 'chofer') APP.toast('New message from your driver');
    if (ev.tipo === 'llegada' && ev.fase === 'a_recoger') APP.toast('Your driver is arriving now');
  });

  // arranque: lo llama index.html cuando ya se cargaron todas las pantallas
  APP.start = () => {
    // ?demo=now: un viaje inmediato para enseñar el mapa en vivo sin llenar el formulario
    if (qs.get('demo') === 'now' && !A.db.viajes.some(v => v.clienteId === userId && A.EN_RUTA.includes(v.estado))) {
      const v0 = A.solicitarViaje({ clienteId: userId, fecha: hoy, hora: A.ahoraHM(), asap: true, origenId: 'sjd', destinoId: 'oo', vehiculo: 'escalade', pasajeros: 4, maletas: 4, extras: ['super', 'cervezas'], canal: 'app', pago: { metodo: 'applepay', estado: 'aprobado' } });
      APP.view = 'trip'; APP.params = { id: v0.id }; history.replaceState(null, '', location.pathname + location.search + '#trip/' + v0.id);
    } else {
      const { v, id } = parseHash(); const alias = { book: 'ride', explore: 'todo', stay: 'stay' };
      const vv = alias[v] || v; APP.view = APP.views[vv] ? vv : 'home'; APP.params = id ? { id } : {};
    }
    APP.render();
  };
})();
