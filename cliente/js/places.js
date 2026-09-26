/* All Cabo Services · app del huésped · Lugares (v3)
   «Find food» (restaurantes), «Things to do» (actividades con filtro por tipo) y la ficha de cada lugar.
   Reemplaza a «Explore» de la app anterior (mapa con fotos + tarjetas, «Ride there», «Add to my stay», «Plan a stay»).
   Todo sale de A.db.sugerencias (la lista curada que el dueño edita desde la central): aquí no se escribe
   ningún nombre de lugar. La lista de restaurantes es provisional hasta que el dueño mande la suya. */
(function () {
  'use strict';
  const APP = window.APP; const A = APP.A; const esc = APP.esc; const $ = APP.$; const $$ = APP.$$; const ICO = APP.ICO;

  // estado de estas pantallas mientras la pestaña esté abierta: lugar elegido por lista y filtro de actividades
  const st = { sel: { food: null, todo: null }, sub: '' };

  const CAT = {
    restaurant: { label: 'Restaurant', ico: 'fork', back: 'food', hora: '18:30' },
    activity: { label: 'Things to do', ico: 'compass', back: 'todo', hora: '09:00' },
    hotel: { label: 'Hotel', ico: 'hotel', back: 'travel', hora: null },
  };
  const TXT = {
    food: { h: 'Find food', p: 'Restaurants we love, with a ride to the door and back.', uno: 'restaurant', varios: 'restaurants', vacio: 'No restaurants are listed right now.' },
    todo: { h: 'Things to do', p: 'Beaches, boats, golf and old towns. You enjoy, we drive.', uno: 'place', varios: 'places', vacio: 'Nothing is listed in this category right now.' },
  };
  const NOTA = 'Photos are illustrative. Recommendations are curated by All Cabo Services and updated from the operations center; reservations at the venue are arranged by your host driver on request.';

  // ───────── ayudantes ─────────
  const lugarDe = (s) => A.lugar(s.lugarId);
  const catDe = (s) => CAT[s.cat] || CAT.activity;
  const kmTxt = (l) => { const t = APP.kmTxt(l.pos); return t === 'here' ? 'where you are' : t + ' from you'; };
  const meta = (s) => { const l = lugarDe(s); return l ? `${l.area} · ${kmTxt(l)}` : ''; };
  const estancia = () => A.itinerariosDe(APP.userId()).filter(it => it.salida.fecha >= APP.hoy)[0] || null;
  const origenDe = (s) => s.cat === 'hotel' ? 'sjd' : APP.hotelDe(APP.user());
  const sinAnio = (iso) => A.fechaLarga(iso, true).replace(/, \d{4}$/, '');
  const rango = (a, b) => {
    const [, ma, da] = a.split('-').map(Number); const [, mb, dbb] = b.split('-').map(Number);
    return ma === mb ? `${A.MESES_EN[ma - 1]} ${da}–${dbb}` : `${A.MESES_EN[ma - 1]} ${da} – ${A.MESES_EN[mb - 1]} ${dbb}`;
  };
  const mapsURL = (l) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(`${l.nombre.replace(/ · /g, ', ')}, Los Cabos, Baja California Sur`);
  // fecha propuesta para ir: hoy si todavía da tiempo (una hora de margen), si no, mañana; el huésped la cambia en la reserva
  const fechaPara = (hora) => A.minutosDe(A.ahoraHM()) + 60 <= A.minutosDe(hora) ? APP.hoy : A.sumaDias(APP.hoy, 1);

  // ───────── acciones (las mismas de Explore) ─────────
  function irEnViaje(s) {
    const l = lugarDe(s); if (!l) return;
    const c = catDe(s);
    const pre = s.cat === 'hotel'
      ? { servicio: 'ride', origenId: 'sjd', destinoId: l.id, cuando: 'schedule' }
      : { servicio: 'ride', origenId: APP.hotelDe(APP.user()), destinoId: l.id, cuando: 'schedule', hora: c.hora, fecha: fechaPara(c.hora) };
    if (APP.ride) APP.ride.start(pre); else APP.go('ride');
  }
  function planearCon(s) { if (APP.stay) APP.stay.add(s.id); else APP.go('stay'); }
  function planearHotel(s) { if (APP.stay) APP.stay.start({ hotelId: s.lugarId }); else APP.go('stay'); }
  const abrir = (id) => APP.go('place', { id });

  // ───────── lista (food / todo) ─────────
  const lista = (vista) => APP.sugs(vista === 'food' ? 'restaurant' : 'activity', vista === 'todo' ? st.sub : '');

  function tarjeta(s, on) {
    return `<div class="pl-card ${on ? 'on' : ''}" data-card="${esc(s.id)}">
      <div class="pl-ph">${APP.fotoSug(s)}<span class="badge pl-tag">${esc(s.tagline)}</span>
        <button class="pl-pin press" data-pin="${esc(s.id)}" aria-label="Show ${esc(s.nombre)} on the map">${ICO.pin}</button></div>
      <div class="pl-bd">
        <button class="pl-open" data-open="${esc(s.id)}">${esc(s.nombre)}</button>
        <span class="pl-meta">${esc(meta(s))}</span>
        <p class="pl-desc">${esc(s.desc)}</p>
        <div class="pl-foot">${s.cuando ? `<span class="pl-when">${ICO.clock}<span>${esc(s.cuando)}</span></span>` : '<span></span>'}<button class="btn sm pl-ride" data-ride="${esc(s.id)}">Ride there</button></div>
      </div>
    </div>`;
  }

  // tarjetita flotante sobre el mapa con el lugar elegido (teléfono: dentro del mapa; escritorio: #sideOver)
  const peek = (s) => `<div class="pl-peek">
      <button class="pl-peek-main" data-open="${esc(s.id)}"><span class="pl-thumb">${APP.fotoSug(s)}</span><span class="tx"><b>${esc(s.nombre)}</b><span>${esc(meta(s))}</span></span></button>
      <button class="pl-go press" data-ride="${esc(s.id)}" aria-label="Ride to ${esc(s.nombre)}">${ICO.ride}</button>
    </div>`;

  function filtro() {
    if (st.sub && !APP.sugs('activity', st.sub).length) st.sub = '';
    const subs = Object.keys(APP.SUBS).filter(k => APP.sugs('activity', k).length);
    const chip = (k, label, ico) => `<button class="chip press ${st.sub === k ? 'on' : ''}" data-sub="${k}" aria-pressed="${st.sub === k}">${ICO[ico] || ''}${esc(label)}</button>`;
    return `<div class="hscroll pl-filter" role="group" aria-label="Filter by type">${chip('', 'All', 'compass')}${subs.map(k => chip(k, APP.SUBS[k][0], APP.SUBS[k][1])).join('')}</div>`;
  }

  function ligar(root, vista) {
    if (!root) return;
    $$('[data-open]', root).forEach(b => { b.onclick = () => abrir(b.dataset.open); });
    $$('[data-ride]', root).forEach(b => { b.onclick = () => { const s = A.sugerencia(b.dataset.ride); if (s) irEnViaje(s); }; });
    $$('[data-pin]', root).forEach(b => { b.onclick = () => elegir(vista, b.dataset.pin, 'lista'); });
  }

  // elegir un lugar: resalta la tarjeta y el marcador, y enseña la tarjetita sobre el mapa
  function elegir(vista, id, desde) {
    st.sel[vista] = id || null;
    const cards = $$('#plList [data-card]');
    cards.forEach(c => c.classList.toggle('on', c.dataset.card === id));
    APP.mapa.marcar(id || null);
    const s = id ? A.sugerencia(id) : null;
    const slot = APP.desktop() ? $('#sideOver') : $('#plPeek');
    if (slot) { slot.innerHTML = s ? peek(s) : ''; ligar(slot, vista); }
    if (!id) return;
    if (desde === 'mapa' && APP.desktop()) { const c = cards.find(x => x.dataset.card === id); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
    if (desde === 'lista' && !APP.desktop()) { const w = $('#root .pl-map'); if (w) w.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  }

  // mapa de la lista: en el teléfono va dentro de la pantalla; en escritorio es el mapa lateral (def.side)
  function mapaLista(el, vista) {
    const ls = lista(vista);
    if (!el || !ls.length) { if (el && el.id === 'sideMap') APP.mapa.contexto(el); return; }
    const m = APP.mapa.lugares(el, ls, st.sel[vista], (id) => elegir(vista, id, 'mapa'));
    if (!m) return;
    m.on('click', () => { if (st.sel[vista]) elegir(vista, null); });
    const s = st.sel[vista] ? A.sugerencia(st.sel[vista]) : null;
    const slot = el.id === 'sideMap' ? $('#sideOver') : $('#plPeek');
    if (slot && s) { slot.innerHTML = peek(s); ligar(slot, vista); }
  }

  // pinta la lista y el mapa sin rehacer la pantalla (así el filtro no brinca al cambiar)
  function pintar(vista) {
    const ls = lista(vista); const t = TXT[vista];
    if (st.sel[vista] && !ls.some(s => s.id === st.sel[vista])) st.sel[vista] = null;
    $('#plN').textContent = `${ls.length} ${ls.length === 1 ? t.uno : t.varios}`;
    $('#plList').innerHTML = ls.length ? ls.map(s => tarjeta(s, s.id === st.sel[vista])).join('') : `<div class="empty card">${t.vacio}</div>`;
    ligar($('#plList'), vista);
    if (APP.desktop()) {
      $$('#plList [data-card]').forEach(c => {
        c.onmouseenter = () => $$('.mk-photo').forEach(x => x.classList.toggle('pl-hot', x.dataset.mk === c.dataset.card));
        c.onmouseleave = () => $$('.mk-photo.pl-hot').forEach(x => x.classList.remove('pl-hot'));
      });
      APP.sideUpdate();
      return;
    }
    const wrap = $('#root .pl-map'); if (!wrap) return;
    wrap.classList.toggle('hide', !ls.length);
    $$('.mapstyle', wrap).forEach(b => b.remove()); // el mapa nuevo pone su propio botón de estilo
    $('#plPeek').innerHTML = '';
    mapaLista($('#plMap'), vista);
  }

  function renderLista(vista) {
    const t = TXT[vista];
    const body = `
      <div class="title"><h1>${t.h}</h1><p>${t.p}</p></div>
      ${vista === 'todo' ? filtro() : ''}
      <div class="pl-geo">${APP.geoChip()}</div>
      ${APP.desktop() ? '' : '<div class="mapwrap pl-map"><div class="map" id="plMap"></div><div id="plPeek"></div></div>'}
      <div class="sec-h"><h2 id="plN"></h2><span class="tiny faint">Tap the pin to see it on the map</span></div>
      <div class="pl-list" id="plList"></div>
      <p class="demo-note">${NOTA}</p>`;
    APP.screen({ back: true, title: '', body });
    $$('#root [data-sub]').forEach(b => {
      b.onclick = () => {
        st.sub = b.dataset.sub;
        $$('#root [data-sub]').forEach(x => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on)); });
        pintar(vista);
      };
    });
    pintar(vista);
  }

  // ───────── ficha del lugar ─────────
  const dato = (ico, label, valor) => `<div class="pl-fact"><i>${ICO[ico]}</i><div><small>${esc(label)}</small><b>${esc(valor)}</b></div></div>`;
  const accion = (o) => {
    const inner = `<span class="pl-act-ic">${ICO[o.ico]}</span><span class="pl-act-tx"><b>${esc(o.t)}${o.href ? ICO.ext : ''}</b><small>${esc(o.sub)}</small></span>`;
    return o.href
      ? `<a class="pl-act press ${o.wide ? 'wide' : ''}" href="${esc(o.href)}" target="_blank" rel="noopener">${inner}</a>`
      : `<button class="pl-act press ${o.wide ? 'wide' : ''}" data-act="${o.id}">${inner}</button>`;
  };

  function renderPlace(p) {
    const s = p.id ? A.sugerencia(p.id) : null; const l = s ? lugarDe(s) : null;
    if (!s || !l) {
      APP.screen({ back: true, title: 'Place', body: '<div class="empty card" style="margin-top:14px;">This place is no longer listed.</div>' });
      return;
    }
    const c = catDe(s); const it = s.cat === 'hotel' ? null : estancia();
    const o = origenDe(s); const d = o !== l.id ? A.distanciaViaje(o, l.id) : null;
    const tipo = s.cat === 'activity' && APP.SUBS[s.sub] ? { label: APP.SUBS[s.sub][0], ico: APP.SUBS[s.sub][1] } : c;
    const acts = [];
    if (s.cat === 'restaurant') acts.push({ id: 'table', ico: 'fork', t: 'Request a table', sub: 'Your host driver asks for you' });
    if (s.cat === 'hotel') acts.push({ id: 'plan', ico: 'stay', t: 'Plan my stay here', sub: 'Arrival, dinners, departure' });
    else if (it) acts.push({ id: 'add', ico: 'cal', t: 'Add to my stay', sub: `Your stay · ${rango(it.llegada.fecha, it.salida.fecha)}` });
    else acts.push({ id: 'stayadd', ico: 'stay', t: 'Plan a stay with this', sub: 'Arrival, this, departure · one payment' });
    acts.push({ ico: 'pin', t: 'Open in Google Maps', sub: l.area, href: mapsURL(l) });
    if (acts.length % 2) acts[acts.length - 1].wide = true;
    const body = `
      <div class="pl-hero">${APP.fotoSug(s)}
        <button class="iconbtn press pl-back" data-back aria-label="Back">${ICO.back}</button>
        <span class="badge pl-tag">${esc(s.tagline)}</span>
      </div>
      <div class="pl-head">
        <h1>${esc(s.nombre)}</h1>
        <p class="pl-sub"><span class="pl-cat">${ICO[tipo.ico]}${esc(tipo.label)}</span><span>${esc(l.area)}</span><span>${esc(kmTxt(l))}</span></p>
      </div>
      <p class="pl-text">${esc(s.desc)}</p>
      ${s.cuando || s.duracion ? `<div class="pl-facts">${s.cuando ? dato('clock', 'Best time', s.cuando) : ''}${s.duracion ? dato('cal', 'Typical visit', s.duracion + ' h') : ''}</div>` : ''}
      <button class="btn xl full pl-cta" id="plRide">${ICO.ride}${s.cat === 'hotel' ? 'Ride from the airport' : 'Ride there'}</button>
      ${d ? `<p class="pl-route">From ${esc(APP.lugarN(o))} · ${d.km} km · about ${d.min} min</p>` : ''}
      <div class="pl-acts">${acts.map(accion).join('')}</div>
      ${!APP.desktop() && d ? `<div class="sec-h"><h2>Getting there</h2><span class="tiny faint">from ${esc(s.cat === 'hotel' ? 'the airport' : 'your hotel')}</span></div><div class="mapwrap pl-routemap"><div class="map" id="plRoute"></div></div>` : ''}
      <p class="demo-note">${NOTA}</p>`;
    APP.screen({ top: '', body });
    $('#plRide').onclick = () => irEnViaje(s);
    $$('#root [data-act]').forEach(b => {
      b.onclick = () => {
        const a = b.dataset.act;
        if (a === 'table') pedirMesa(s);
        if (a === 'plan') planearHotel(s);
        if (a === 'stayadd') planearCon(s);
        if (a === 'add') { const cur = estancia(); if (cur) agregarAEstancia(s, cur); else planearCon(s); }
      };
    });
    const mr = $('#plRoute'); if (mr && d) APP.mapa.preview(mr, o, l.id);
  }

  function sidePlace(el, p) {
    const s = p.id ? A.sugerencia(p.id) : null; const l = s ? lugarDe(s) : null;
    const o = s ? origenDe(s) : null;
    if (!l || o === l.id) { APP.mapa.contexto(el); return; }
    APP.mapa.preview(el, o, l.id);
    const d = A.distanciaViaje(o, l.id);
    $('#sideOver').innerHTML = `<div class="etacard pl-eta"><div style="min-width:0;"><b>${esc(APP.lugarN(o))} → ${esc(APP.lugarN(l.id))}</b><span>${d.km} km · about ${d.min} min by road</span></div></div>`;
  }

  // ───────── hojas ─────────
  const cabeza = (s) => `<div class="pl-sh"><span class="pl-thumb">${APP.fotoSug(s)}</span><div class="tx"><b>${esc(s.nombre)}</b><span>${esc(s.tagline)}</span></div></div>`;

  // «Add to my stay»: el mismo traslado que creaba Explore (espera N horas, o deja y regresa)
  function agregarAEstancia(s, it) {
    const dias = Array.from({ length: it.noches }, (_, i) => A.sumaDias(it.llegada.fecha, i + 1));
    const dur = s.duracion || 3; let esperar = true;
    APP.sheet(`${APP.sheetH('Add to your stay')}${cabeza(s)}
      <div class="grid2">
        <div><label class="lbl" for="adDia">Day</label><select class="txt" id="adDia">${dias.map(f => `<option value="${f}">${esc(sinAnio(f))}</option>`).join('')}</select></div>
        <div><label class="lbl" for="adHora">Time</label><input class="txt" type="time" id="adHora" value="${s.cat === 'restaurant' ? '18:30' : '09:00'}"></div>
      </div>
      <label class="lbl">Your driver</label>
      <div class="seg pl-seg"><button class="on" data-esp="1">Waits for you · ${dur} h</button><button data-esp="0">Drops off &amp; comes back</button></div>
      <div class="pl-quote" id="adQ"></div>
      <button class="btn xl full" id="adGo">Add ride</button>`);
    const datos = () => {
      const fecha = $('#adDia').value, hora = $('#adHora').value || '18:30';
      const vuelta = A.hmDe(A.minutosDe(hora) + dur * 60);
      return { fecha, hora, vuelta, pedido: { clienteId: APP.userId(), fecha, hora, origenId: it.hotelId, destinoId: s.lugarId, modo: esperar ? 'horas' : 'redondo', horas: dur, regresoHora: esperar ? null : vuelta, vehiculo: it.vehiculo, pasajeros: it.pax, maletas: 0, extras: [], notas: esperar ? `Driver waits · ${dur} h` : 'Pickup back at ' + A.hora12(vuelta), canal: 'app', itinerarioId: it.id, pago: { ...it.pago, ref: '' } } };
    };
    const metodo = () => (A.METODOS[it.pago.metodo] || { en: 'card' }).en;
    const cotiza = () => {
      const { pedido, vuelta } = datos(); const q = A.cotizar(pedido);
      const que = esperar ? `Driver waits · ${q.horas} h${q.horas > dur ? ' minimum' : ''}` : `Round trip · pickup back at ${A.hora12(vuelta)}`;
      $('#adQ').innerHTML = `<div class="sum"><span>${esc(que)}</span><b class="num">${A.usd(q.total)}</b></div><p class="tiny muted">Charged to your ${esc(metodo())}, like the rest of your stay.</p>`;
      $('#adGo').textContent = 'Add ride · ' + A.usd(q.total);
    };
    $$('#overlay [data-esp]').forEach(x => { x.onclick = () => { esperar = x.dataset.esp === '1'; $$('#overlay [data-esp]').forEach(y => y.classList.toggle('on', y === x)); cotiza(); }; });
    $('#adDia').onchange = cotiza; $('#adHora').onchange = cotiza;
    cotiza();
    $('#adGo').onclick = () => {
      const cur = A.itinerario(it.id) || it; // por si otra pestaña recargó los datos mientras la hoja estaba abierta
      const { fecha, hora, pedido } = datos();
      const v = A.solicitarViaje(pedido);
      v.etiqueta = s.nombre; cur.viajeIds.push(v.id); cur.total += v.precio.total;
      cur.actividades.push({ sugerenciaId: s.id, fecha, hora, esperar, horas: dur });
      A.save(); APP.closeSheet();
      APP.toast(`${s.nombre} added · ${A.usd(v.precio.total)} charged to your ${metodo()}`);
      APP.go('trips');
    };
  }

  // «Request a table»: solo simula la solicitud; no hay reservación ni se promete lugar
  function pedirMesa(s) {
    const it = estancia(); let pax = it ? it.pax : 2;
    APP.sheet(`${APP.sheetH('Request a table')}${cabeza(s)}
      <div class="grid2">
        <div><label class="lbl" for="rqDia">Date</label><input class="txt" type="date" id="rqDia" min="${APP.hoy}" value="${APP.hoy}"></div>
        <div><label class="lbl" for="rqHora">Time</label><input class="txt" type="time" id="rqHora" value="19:00"></div>
      </div>
      <div class="row pl-pax"><span><b>Party size</b><small>Guests at the table</small></span>
        <span class="step"><button data-pax="-1" aria-label="Fewer guests">−</button><b id="rqPax" class="num">${pax}</b><button data-pax="1" aria-label="More guests">+</button></span></div>
      <label class="lbl" for="rqNota">Notes for the restaurant</label>
      <textarea class="txt" id="rqNota" placeholder="Birthday, allergies, a table with a view…"></textarea>
      <button class="btn xl full" id="rqGo" style="margin-top:16px;">Send request</button>
      <p class="legal pl-legal">This is a request, not a reservation. Your host driver asks ${esc(s.nombre)} and confirms with you by message. Demo: nothing is sent.</p>`);
    $$('#overlay [data-pax]').forEach(b => { b.onclick = () => { pax = Math.max(1, Math.min(20, pax + Number(b.dataset.pax))); $('#rqPax').textContent = pax; }; });
    $('#rqGo').onclick = () => {
      const f = $('#rqDia').value, h = $('#rqHora').value;
      if (!f || !h || f < APP.hoy) { APP.toast('Pick a date from today on and a time'); return; }
      APP.closeSheet();
      APP.toast(`Demo · request for ${pax} on ${sinAnio(f)}, ${A.hora12(h)} noted. Your host confirms with ${s.nombre}.`);
    };
  }

  // ───────── registro ─────────
  APP.places = { open: abrir };
  APP.register('food', { render: () => renderLista('food'), side: (el) => mapaLista(el, 'food'), tab: 'home', back: 'home', noAutoRender: true });
  APP.register('todo', { render: () => renderLista('todo'), side: (el) => mapaLista(el, 'todo'), tab: 'home', back: 'home', noAutoRender: true });
  APP.register('place', {
    render: renderPlace, side: sidePlace, tab: 'home', noAutoRender: true,
    back: (p) => { const s = p && p.id ? A.sugerencia(p.id) : null; return s ? catDe(s).back : 'home'; },
  });
})();
