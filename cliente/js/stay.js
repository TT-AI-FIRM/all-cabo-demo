/* All Cabo Services · app del huésped · Planear la estancia (v3)
   Tres pasos: 1) hotel, llegada, salida, grupo, camioneta y extras · 2) cenas y actividades · 3) revisión por día y un solo pago.
   El total (planCot) usa la misma lógica que el núcleo en crearItinerario: llegada con extras, cada actividad
   (el chofer espera = por horas; te deja y regresa = redondo) y salida 3 h antes del vuelo.
   API: APP.stay.start(prefill {hotelId, paso}) y APP.stay.add(sugId). */
(function () {
  'use strict';
  const APP = window.APP; const A = APP.A; const esc = APP.esc; const usd = APP.usd; const $ = APP.$; const $$ = APP.$$;
  const I = APP.ICO;

  // ───────── estado de la estancia en curso (vive en la pestaña; se reinicia si cambia el huésped) ─────────
  const esAloj = (id) => { const l = A.lugar(id); return !!l && (l.tipo === 'hotel' || l.tipo === 'villa'); };
  const hotelInicial = () => { const h = APP.hotelDe(APP.user()); return esAloj(h) ? h : 'oo'; };
  const nuevo = () => ({
    user: APP.userId(), paso: 1, hotelId: hotelInicial(),
    llegadaFecha: A.sumaDias(APP.hoy, 10), llegadaHora: '13:20', llegadaVuelo: 'UA 1234',
    salidaFecha: A.sumaDias(APP.hoy, 15), salidaHora: '14:05', salidaVuelo: 'UA 1235',
    pax: 2, maletas: 3, vehiculo: 'suburban', extras: [], actividades: [], notas: '',
  });
  let S = nuevo();
  let cat = 'restaurant';
  const fresco = () => { if (S.user !== APP.userId()) S = nuevo(); };

  const noches = () => Math.max(1, Math.round((new Date(S.salidaFecha) - new Date(S.llegadaFecha)) / 86400000));
  const dias = () => Array.from({ length: noches() + 1 }, (_, i) => A.sumaDias(S.llegadaFecha, i));
  const diaCorto = (d) => A.fechaLarga(d, true).replace(/, \d{4}$/, '');
  // la salida siempre después de la llegada; las actividades, dentro de la estancia
  const ajustar = () => {
    if (S.llegadaFecha < APP.hoy) S.llegadaFecha = APP.hoy;
    if (S.salidaFecha <= S.llegadaFecha) S.salidaFecha = A.sumaDias(S.llegadaFecha, 1);
    S.actividades.forEach(a => { if (a.fecha < S.llegadaFecha) a.fecha = S.llegadaFecha; if (a.fecha > S.salidaFecha) a.fecha = S.salidaFecha; });
  };
  const nuevaActividad = (s, fecha) => ({ sugerenciaId: s.id, fecha, hora: s.cat === 'restaurant' ? '18:30' : '09:00', esperar: s.cat === 'restaurant', horas: s.duracion || 3 });

  // ───────── precios (misma lógica que el núcleo, para mostrar el total antes de pagar) ─────────
  function planCot() {
    const cfg = A.db.config; let total = 0; const filas = [];
    const add = (fecha, hora, o, d, modo, horas, etiqueta, tipo, sug) => {
      const q = A.cotizar({ origenId: o, destinoId: d, modo, horas, vehiculo: S.vehiculo, extras: tipo === 'arr' ? S.extras : [] });
      total += q.total;
      filas.push({ fecha, hora, etiqueta, tipo, sug, o, d, modo, horas: q.horas || horas, total: q.total, regreso: modo === 'redondo' ? A.hmDe(A.minutosDe(hora) + horas * 60) : null });
    };
    add(S.llegadaFecha, A.hmDe(A.minutosDe(S.llegadaHora) + cfg.esperaAeropuerto), 'sjd', S.hotelId, 'sencillo', null, 'Arrival', 'arr');
    S.actividades.forEach(a => { const s = A.sugerencia(a.sugerenciaId); if (!s) return; add(a.fecha, a.hora, S.hotelId, s.lugarId, a.esperar ? 'horas' : 'redondo', a.horas || s.duracion || 3, s.nombre, 'act', s); });
    add(S.salidaFecha, A.hmDe(A.minutosDe(S.salidaHora) - 180), S.hotelId, 'sjd', 'sencillo', null, 'Departure', 'dep');
    filas.sort((a, b) => (a.fecha + a.hora) < (b.fecha + b.hora) ? -1 : 1);
    return { total, filas };
  }
  const precioEspera = (a, s) => A.cotizar({ origenId: S.hotelId, destinoId: s.lugarId, modo: 'horas', horas: a.horas || s.duracion || 3, vehiculo: S.vehiculo });
  const precioVuelta = (s) => A.cotizar({ origenId: S.hotelId, destinoId: s.lugarId, modo: 'redondo', vehiculo: S.vehiculo });

  // ───────── paso 1 · tu viaje ─────────
  const vueloInfo = () => { const f = A.vueloDe(S.llegadaVuelo); return f ? `${esc(f.aerolinea)} · from ${esc(f.origen)} · simulated flight data` : ''; };
  const selectHotel = () => {
    const aloj = A.LUGARES.filter(l => l.tipo === 'hotel' || l.tipo === 'villa');
    return `<select class="txt" id="sHotel" aria-label="Hotel or private villa">${APP.GRUPOS.map(([g, f]) => { const ls = aloj.filter(f); return ls.length ? `<optgroup label="${esc(g)}">${ls.map(l => `<option value="${l.id}" ${S.hotelId === l.id ? 'selected' : ''}>${esc(l.nombre)}</option>`).join('')}</optgroup>` : ''; }).join('')}</select>`;
  };
  const cabeza = (ic, tono, titulo, sub) => `<div class="st-h"><span class="ic ${tono}">${ic}</span><div><b>${titulo}</b><span>${sub}</span></div></div>`;
  const pasoso = (k, v) => `<div class="step"><button class="press" data-sst="${k},-1" aria-label="Fewer">−</button><b class="num">${v}</b><button class="press" data-sst="${k},1" aria-label="More">+</button></div>`;
  const textoSiguiente = () => `Add dinners & activities · ${noches()} nights`;

  function paso1() {
    const u = APP.user(); const cfg = A.db.config; const its = A.itinerariosDe(u.id);
    const it = its.find(x => x.salida.fecha >= APP.hoy) || its[0];
    const h = A.lugar(S.hotelId); const hc = esc(APP.lugarN(S.hotelId)); const dist = A.distanciaViaje('sjd', S.hotelId);
    const vehs = Object.values(A.TIPOS_VEHICULO).map(v => {
      const chico = v.pax < S.pax;
      return `<button class="opt press ${S.vehiculo === v.id ? 'on' : ''}" data-sveh="${v.id}" ${chico ? 'disabled' : ''}><span class="vimg"><img src="${APP.fotoVeh(v.id)}" alt="" loading="lazy"></span><div class="tx"><b>${esc(v.corto)}</b><span>${chico ? `Seats ${v.pax} · too small for ${S.pax}` : `${v.pax} seats · ${v.maletas} bags`}</span></div><div class="pr num">${usd(cfg.horaVehiculo[v.id])}<small>per hour waiting</small></div></button>`;
    }).join('');
    const extras = cfg.extras.map(e => { const on = S.extras.includes(e.id); return `<button class="chip press ${on ? 'on' : ''}" data-sex="${e.id}" aria-pressed="${on}">${on ? I.check : I.plus}${esc(e.en.split(' · ')[0])}${e.precio ? ` · +${usd(e.precio)}` : (e.nota ? ` · ${esc(e.nota)}` : '')}</button>`; }).join('');
    return `
      <div class="title"><h1>Plan your whole stay</h1><p>Arrival, dinners, boat day, golf, departure: one plan, one payment, and your driver knows your week before you land.</p></div>
      ${it ? `<div class="lrow card tint st-ya"><span class="ic accent">${I.stay}</span><div class="tx"><b>Already planned</b><span>${esc(APP.lugarN(it.hotelId))} · ${it.noches} nights · ${it.viajeIds.length} rides. You can plan another one below.</span></div><button class="btn sm sec" id="sVer">View</button></div>` : ''}
      <div class="card st-card">
        ${cabeza(I.hotel, '', 'Where are you staying?', 'Hotel or private villa')}
        ${selectHotel()}
        <p class="st-hint">${I.pin}<span>${esc(h.area || '')} · ${dist.km} km from SJD Airport · about ${dist.min} min</span></p>
      </div>
      <div class="card st-card">
        ${cabeza(I.plane, 'dark', 'Arrival', `SJD Airport → ${hc}`)}
        <label class="lbl" for="sLF">Arrival date</label><input class="txt" id="sLF" type="date" value="${S.llegadaFecha}" min="${APP.hoy}">
        <div class="grid2"><div><label class="lbl" for="sLH">Lands at</label><input class="txt" id="sLH" type="time" value="${S.llegadaHora}"></div><div><label class="lbl" for="sLV">Flight</label><input class="txt" id="sLV" value="${esc(S.llegadaVuelo)}" autocomplete="off" autocapitalize="characters" placeholder="UA 1234"></div></div>
        <p class="st-hint" id="sVueloInfo">${vueloInfo()}</p>
        <p class="st-hint">${I.clock}<span>Pickup about ${cfg.esperaAeropuerto} min after landing</span></p>
      </div>
      <div class="card st-card">
        ${cabeza(I.planeUp, 'accent', 'Departure', `${hc} → SJD Airport`)}
        <label class="lbl" for="sSF">Departure date</label><input class="txt" id="sSF" type="date" value="${S.salidaFecha}" min="${A.sumaDias(S.llegadaFecha, 1)}">
        <div class="grid2"><div><label class="lbl" for="sSH">Flight departs</label><input class="txt" id="sSH" type="time" value="${S.salidaHora}"></div><div><label class="lbl" for="sSV">Flight</label><input class="txt" id="sSV" value="${esc(S.salidaVuelo)}" autocomplete="off" autocapitalize="characters" placeholder="UA 1235"></div></div>
        <p class="st-hint">${I.clock}<span>Pickup 3 hours before your flight</span></p>
      </div>
      <div class="card st-card"><div class="grid2">
        <div><label class="lbl st-l0">Passengers</label>${pasoso('pax', S.pax)}</div>
        <div><label class="lbl st-l0">Bags</label>${pasoso('maletas', S.maletas)}</div>
      </div></div>
      <div class="sec-h"><h2>Vehicle for the week</h2></div>
      <div>${vehs}</div>
      <p class="st-hint st-note">Airport rides and drop-offs are priced by zone for any vehicle that fits; the hourly rate applies when your driver waits.</p>
      <div class="sec-h"><h2>Welcome extras</h2><span class="small muted">on arrival</span></div>
      <div class="chips">${extras}</div>
      <button class="btn xl full st-next" id="sNext">${textoSiguiente()}</button>`;
  }

  // ───────── paso 2 · cenas y actividades ─────────
  const catN = (s) => s.cat === 'restaurant' ? 'Restaurant' : (s.cat === 'hotel' ? 'Hotel' : (APP.SUBS[s.sub] ? APP.SUBS[s.sub][0] : 'Things to do'));
  const pista = (a, s) => {
    if (a.esperar) { const q = precioEspera(a, s); const dur = a.horas || s.duracion || 3; return `Your driver waits with you · ${q.horas} h${q.horas > dur ? ` (${A.db.config.horasMin} h minimum)` : ''}`; }
    return `Drop-off at ${A.hora12(a.hora)} · pickup back at ${A.hora12(A.hmDe(A.minutosDe(a.hora) + (a.horas || s.duracion || 3) * 60))}`;
  };
  const actividad = (a, i, ds) => {
    const s = A.sugerencia(a.sugerenciaId); if (!s) return '';
    const l = A.lugar(s.lugarId); const qe = precioEspera(a, s); const qr = precioVuelta(s);
    return `<div class="st-act" data-i="${i}">
      <div class="lrow"><span class="thumb">${APP.fotoSug(s)}</span><div class="tx"><b>${esc(s.nombre)}</b><span>${esc(catN(s))}${l ? ' · ' + esc(l.area) : ''}</span></div><button class="st-x press" data-adel="${i}" aria-label="Remove ${esc(s.nombre)}">${I.close}</button></div>
      <div class="grid2">
        <div><label class="lbl" for="sAd${i}">Day</label><select class="txt" id="sAd${i}" data-afecha="${i}">${ds.map(d => `<option value="${d}" ${a.fecha === d ? 'selected' : ''}>${diaCorto(d)}</option>`).join('')}</select></div>
        <div><label class="lbl" for="sAh${i}">Time</label><input class="txt" type="time" id="sAh${i}" data-ahora="${i}" value="${a.hora}"></div>
      </div>
      <div class="seg st-mode" role="group" aria-label="Ride for ${esc(s.nombre)}">
        <button class="${a.esperar ? 'on' : ''}" data-aesp="${i}" data-v="1" aria-pressed="${!!a.esperar}"><b>Driver waits</b><small class="num">${qe.horas} h · ${usd(qe.total)}</small></button>
        <button class="${a.esperar ? '' : 'on'}" data-aesp="${i}" data-v="0" aria-pressed="${!a.esperar}"><b>Drop-off & pickup</b><small class="num">${usd(qr.total)} round trip</small></button>
      </div>
      <p class="st-hint st-pista">${esc(pista(a, s))}</p>
    </div>`;
  };
  const tarjeta = (s) => {
    const l = A.lugar(s.lugarId); const hotel = s.cat === 'hotel'; const mio = hotel && S.hotelId === s.lugarId;
    const n = S.actividades.filter(a => a.sugerenciaId === s.id).length;
    const d = l ? A.distanciaViaje(hotel ? 'sjd' : S.hotelId, s.lugarId) : null;
    const donde = l ? `${l.area} · ${d.km} km ${hotel ? 'from SJD Airport' : 'from your hotel'}` : '';
    const accion = hotel
      ? (mio ? `<span class="pill ok st-mine">${I.check} Your hotel</span>` : `<button class="btn sm sec press" data-shotel="${s.lugarId}" data-sug="${s.id}">${I.hotel} Stay here</button>`)
      : `<button class="btn sm press" data-sadd="${s.id}">${I.plus} ${n ? 'Add again' : 'Add to my stay'}</button>`;
    return `<div class="pcard wide st-sug" id="sug-${s.id}">
      <div class="ph">${APP.fotoSug(s)}<span class="tagl badge">${esc(s.tagline)}</span>${n ? `<span class="pill ok st-in">${I.check} In your plan${n > 1 ? ' ×' + n : ''}</span>` : ''}</div>
      <div class="bd"><b>${esc(s.nombre)}</b><span>${esc(donde)}</span><p class="st-desc">${esc(s.desc)}</p>${s.cuando ? `<p class="st-when">${I.clock}${esc(s.cuando)}</p>` : ''}
        <div class="st-acts">${accion}<a class="btn sm ghost" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.nombre + ' Los Cabos')}">${I.ext} Map</a></div>
      </div>
    </div>`;
  };

  function paso2() {
    const ds = dias(); const n = S.actividades.length;
    const plan = n
      ? `<div class="sec-h st-ph"><h2>Your plan</h2><span class="pill dark">${n} added</span></div><div class="list st-plan">${S.actividades.map((a, i) => actividad(a, i, ds)).join('')}</div>`
      : `<div class="card st-empty"><span class="ic">${I.cal}</span><p>Nothing added yet. Pick dinners and activities below; each one becomes a scheduled ride from ${esc(APP.lugarN(S.hotelId))}.</p></div>`;
    const cats = [['restaurant', 'Restaurants'], ['activity', 'Things to do'], ['hotel', 'Hotels']];
    return `
      <div class="title"><h1>What would you like to do?</h1><p>Curated by All Cabo Services. Add it and we schedule the ride; your driver can wait or come back for you.</p></div>
      ${plan}
      <div class="seg st-cats" role="tablist">${cats.map(([id, l]) => `<button role="tab" aria-selected="${cat === id}" class="${cat === id ? 'on' : ''}" data-cat="${id}">${l}</button>`).join('')}</div>
      <div class="pgrid">${APP.sugs(cat).map(tarjeta).join('')}</div>
      <div class="cta-bar st-cta"><button class="iconbtn press" id="sBack" aria-label="Back to your trip">${I.back}</button><button class="btn xl" id="sNext">Review · ${usd(planCot().total)}</button></div>`;
  }

  // ───────── paso 3 · revisión y pago ─────────
  const evento = (f) => {
    const cfg = A.db.config;
    const ic = f.tipo === 'arr' ? `<span class="ic dark">${I.plane}</span>` : (f.tipo === 'dep' ? `<span class="ic accent">${I.planeUp}</span>` : `<span class="thumb">${APP.fotoSug(f.sug)}</span>`);
    let det;
    if (f.tipo === 'arr') {
      const ex = S.extras.map(id => cfg.extras.find(e => e.id === id)).filter(Boolean).map(e => e.en.split(' · ')[0]);
      det = `${S.llegadaVuelo ? 'Flight ' + esc(S.llegadaVuelo) + ' lands' : 'Lands'} ${A.hora12(S.llegadaHora)}${ex.length ? ' · with ' + esc(ex.join(', ')) : ''}`;
    } else if (f.tipo === 'dep') det = `${S.salidaVuelo ? 'Flight ' + esc(S.salidaVuelo) + ' departs' : 'Flight departs'} ${A.hora12(S.salidaHora)} · pickup 3 h before`;
    else det = f.modo === 'horas' ? `Driver waits ${f.horas} h` : `Pickup back at ${A.hora12(f.regreso)}`;
    return `<div class="lrow">${ic}<div class="tx"><b>${esc(f.etiqueta)}</b><span>${A.hora12(f.hora)} · ${esc(APP.lugarN(f.o))} → ${esc(APP.lugarN(f.d))}</span><span>${det}</span></div><div class="end num">${usd(f.total)}</div></div>`;
  };
  function paso3() {
    const pc = planCot(); const ds = dias(); const veh = A.TIPOS_VEHICULO[S.vehiculo];
    const porDia = {}; pc.filas.forEach(f => { (porDia[f.fecha] = porDia[f.fecha] || []).push(f); });
    const semana = Object.keys(porDia).sort().map(d => {
      const k = ds.indexOf(d); const tag = d === S.llegadaFecha ? 'Arrival day' : (d === S.salidaFecha ? 'Departure day' : 'Day ' + (k + 1));
      return `<div class="st-dayh"><b>${diaCorto(d)}</b><span>${tag}</span></div>${porDia[d].map(evento).join('')}`;
    }).join('');
    return `
      <div class="title"><h1>Your week, ready to go</h1><p>${esc(APP.lugarN(S.hotelId))} · ${noches()} nights · ${pc.filas.length} rides · ${esc(veh.nombre)}</p></div>
      ${APP.desktop() ? '' : '<div class="mapwrap st-map"><div id="stMap" class="map"></div></div>'}
      <div class="list st-week">${semana}<div class="st-tot"><span>Total for the stay</span><b class="num">${usd(pc.total)} USD</b></div></div>
      <div class="opt on st-vrow"><span class="vimg"><img src="${APP.fotoVeh(S.vehiculo)}" alt="" loading="lazy"></span><div class="tx"><b>${esc(veh.corto)} for the week</b><span>${S.pax} ${S.pax === 1 ? 'guest' : 'guests'} · ${S.maletas} ${S.maletas === 1 ? 'bag' : 'bags'}</span></div><button class="linkbtn" id="sEdit">Change</button></div>
      <label class="lbl" for="sNotas">Notes for your driver</label><textarea class="txt" id="sNotas" rows="2" placeholder="Anniversary, kids, allergies, favorite music…">${esc(S.notas)}</textarea>
      <label class="lbl">Pay ${usd(pc.total)} once</label>
      <button class="applebtn press" id="sApple" aria-label="Pay with Apple Pay"> Pay</button>
      <button class="zellebtn press st-zelle" id="sZelle">Zelle <span>· send directly, no card fees</span></button>
      <div class="cta-bar"><button class="btn sec xl" id="sBack">${I.back} Back</button></div>
      <p class="legal st-legal">Every ride can still be changed or cancelled from Trips up to 24 h before. Demo: payments are simulated.</p>`;
  }

  // ───────── mapa: hotel, aeropuerto y cada actividad con su ruta ─────────
  function dibujar(el) {
    const M = APP.mapa; const m = M.nuevo(el); if (!m) return;
    const h = A.lugar(S.hotelId); const sjd = A.lugar('sjd'); const pts = [h.pos, sjd.pos];
    const acento = getComputedStyle(document.documentElement).getPropertyValue('--accent2').trim();
    M.linea(m, A.rutaLugares(sjd.pos, sjd.nodo, h).pts);
    const porLugar = {};
    S.actividades.forEach(a => { const s = A.sugerencia(a.sugerenciaId); if (s && A.lugar(s.lugarId)) (porLugar[s.lugarId] = porLugar[s.lugarId] || new Set()).add(s.nombre); });
    Object.keys(porLugar).forEach(id => {
      const l = A.lugar(id); const ns = Array.from(porLugar[id]); pts.push(l.pos);
      M.linea(m, A.rutaLugares(h.pos, h.nodo, l).pts, { color: acento, weight: 4 });
      L.marker(l.pos, { icon: M.pin('', ns[0] + (ns.length > 1 ? ` +${ns.length - 1}` : '')) }).addTo(m);
    });
    L.marker(sjd.pos, { icon: M.pin('stop', 'SJD Airport') }).addTo(m);
    L.marker(h.pos, { icon: M.pin('dest', h.corto || h.nombre), zIndexOffset: 800 }).addTo(m);
    M.fit(m, L.latLngBounds(pts), 56);
  }
  // tarjeta sobre el mapa lateral (escritorio)
  const resumenSide = () => {
    const o = $('#sideOver'); if (!APP.desktop() || !o) return; const pc = planCot();
    o.innerHTML = `<div class="etacard st-over"><div style="min-width:0;"><b>Your stay · ${esc(APP.lugarN(S.hotelId))}</b><span>${noches()} nights · ${pc.filas.length} rides · ${usd(pc.total)} USD</span></div></div>`;
  };

  // ───────── pintar y eventos ─────────
  const pintar = () => { render(); resumenSide(); };               // solo el panel (el mapa no cambia)
  const scroller = () => APP.desktop() ? $('#panel') : window;
  // vuelve a pintar sin que el elemento de referencia brinque de lugar en la pantalla
  const anclado = (sel, fn) => {
    const a = $(sel); const y0 = a ? a.getBoundingClientRect().top : null; fn();
    const b = $(sel); if (y0 != null && b) scroller().scrollBy(0, b.getBoundingClientRect().top - y0);
  };
  const irPaso = (n) => { S.paso = Math.max(1, Math.min(3, n)); APP.go('stay'); };

  function enlazar1() {
    const leer = () => {
      [['sLF', 'llegadaFecha'], ['sLH', 'llegadaHora'], ['sSF', 'salidaFecha'], ['sSH', 'salidaHora']].forEach(([id, k]) => { const e = $('#' + id); if (e && e.value) S[k] = e.value; });
      S.llegadaVuelo = $('#sLV').value.trim(); S.salidaVuelo = $('#sSV').value.trim();
    };
    const fechas = (cambio) => {
      leer();
      if (cambio === 'llegada' && S.salidaFecha <= S.llegadaFecha) S.salidaFecha = A.sumaDias(S.llegadaFecha, 4);
      ajustar();
      $('#sLF').value = S.llegadaFecha; const sf = $('#sSF'); sf.min = A.sumaDias(S.llegadaFecha, 1); sf.value = S.salidaFecha;
      $('#sNext').textContent = textoSiguiente(); resumenSide();
    };
    $('#sLF').onchange = () => fechas('llegada');
    $('#sSF').onchange = () => fechas('salida');
    ['sLH', 'sSH'].forEach(id => { $('#' + id).onchange = () => { leer(); resumenSide(); }; });
    $('#sLV').oninput = () => { S.llegadaVuelo = $('#sLV').value.trim(); $('#sVueloInfo').innerHTML = vueloInfo(); };
    $('#sSV').oninput = () => { S.salidaVuelo = $('#sSV').value.trim(); };
    $('#sHotel').onchange = () => { leer(); S.hotelId = $('#sHotel').value; APP.render(); };
    const ver = $('#sVer'); if (ver) ver.onclick = () => APP.go('trips');
    $$('#root [data-sst]').forEach(b => { b.onclick = () => {
      leer(); const [k, d] = b.dataset.sst.split(',');
      S[k] = Math.max(k === 'pax' ? 1 : 0, Math.min(14, S[k] + Number(d)));
      if (S.pax > A.TIPOS_VEHICULO[S.vehiculo].pax) S.vehiculo = S.pax > 12 ? 'sprinter' : (S.pax > 7 ? 'hiace' : 'suburban');
      pintar();
    }; });
    $$('#root [data-sveh]').forEach(b => { b.onclick = () => { leer(); S.vehiculo = b.dataset.sveh; pintar(); }; });
    $$('#root [data-sex]').forEach(b => { b.onclick = () => { leer(); const id = b.dataset.sex; S.extras = S.extras.includes(id) ? S.extras.filter(x => x !== id) : S.extras.concat([id]); pintar(); }; });
    $('#sNext').onclick = () => { leer(); S.hotelId = $('#sHotel').value || S.hotelId; ajustar(); irPaso(2); };
  }

  function enlazar2() {
    $$('#root [data-cat]').forEach(b => { b.onclick = () => { cat = b.dataset.cat; anclado('.st-cats', pintar); }; });
    $$('#root [data-sadd]').forEach(b => { b.onclick = () => {
      const s = A.sugerencia(b.dataset.sadd); if (!s) return; const n = S.actividades.length;
      S.actividades.push(nuevaActividad(s, A.sumaDias(S.llegadaFecha, Math.min(noches() - 1, n + 1))));
      APP.toast(s.nombre + ' added to your stay'); anclado('#sug-' + s.id, APP.render);
    }; });
    $$('#root [data-shotel]').forEach(b => { b.onclick = () => { S.hotelId = b.dataset.shotel; APP.toast('Hotel updated · ' + APP.lugarN(S.hotelId)); anclado('#sug-' + b.dataset.sug, APP.render); }; });
    $$('#root [data-adel]').forEach(b => { b.onclick = () => { S.actividades.splice(Number(b.dataset.adel), 1); APP.render(); }; });
    $$('#root [data-aesp]').forEach(b => { b.onclick = () => { const i = b.dataset.aesp; S.actividades[Number(i)].esperar = b.dataset.v === '1'; anclado(`.st-act[data-i="${i}"]`, pintar); }; });
    $$('#root [data-afecha]').forEach(e => { e.onchange = () => { S.actividades[Number(e.dataset.afecha)].fecha = e.value; }; });
    $$('#root [data-ahora]').forEach(e => { e.onchange = () => {
      const a = S.actividades[Number(e.dataset.ahora)]; a.hora = e.value || '18:30';
      const p = e.closest('.st-act').querySelector('.st-pista'); const s = A.sugerencia(a.sugerenciaId); if (p && s) p.textContent = pista(a, s);
    }; });
    $('#sBack').onclick = () => irPaso(1);
    $('#sNext').onclick = () => irPaso(3);
  }

  function enlazar3() {
    $('#sNotas').oninput = () => { S.notas = $('#sNotas').value; };
    $('#sEdit').onclick = () => irPaso(1);
    $('#sBack').onclick = () => irPaso(2);
    const pagar = (metodo) => {
      const pc = planCot();
      APP.pagar({ metodo, monto: pc.total, concepto: 'All Cabo Services · your stay', onDone: () => {
        const it = A.crearItinerario({ clienteId: APP.userId(), hotelId: S.hotelId, llegada: { fecha: S.llegadaFecha, hora: S.llegadaHora, vuelo: S.llegadaVuelo }, salida: { fecha: S.salidaFecha, hora: S.salidaHora, vuelo: S.salidaVuelo }, pax: S.pax, maletas: S.maletas, vehiculo: S.vehiculo, extras: S.extras, actividades: S.actividades, notas: S.notas, pago: { metodo, estado: metodo === 'zelle' ? 'pendiente_confirmar' : 'aprobado' } });
        S.paso = 1; S.actividades = [];
        APP.toast(`Your stay is planned · ${it.viajeIds.length} rides confirmed`); APP.go('trips');
      } });
    };
    $('#sApple').onclick = () => pagar('applepay');
    $('#sZelle').onclick = () => pagar('zelle');
    const mapa = $('#stMap'); if (mapa) dibujar(mapa);
  }

  function render() {
    fresco(); ajustar();
    const pasos = ['Your trip', 'Plans', 'Review & pay'];
    const barra = `<div class="steps" aria-hidden="true">${pasos.map((_, i) => `<i class="${S.paso >= i + 1 ? 'on' : ''}"></i>`).join('')}</div><div class="st-stepl">${pasos.map((l, i) => `<span class="${S.paso === i + 1 ? 'on' : ''}">${l}</span>`).join('')}</div>`;
    const cuerpo = S.paso === 1 ? paso1() : (S.paso === 2 ? paso2() : paso3());
    APP.screen({ back: true, title: 'Plan my stay', body: `<div class="st">${barra}${cuerpo}</div>` });
    (S.paso === 1 ? enlazar1 : (S.paso === 2 ? enlazar2 : enlazar3))();
  }

  APP.register('stay', {
    render, tab: 'ride', noAutoRender: true,
    // la flecha de arriba regresa un paso; desde el primero vuelve a la reserva
    back: () => { if (S.paso > 1) { S.paso -= 1; return 'stay'; } return 'ride'; },
    side: (el) => { dibujar(el); resumenSide(); },
  });

  APP.stay = {
    start(prefill) {
      prefill = prefill || {}; fresco();
      if (prefill.hotelId && esAloj(prefill.hotelId)) S.hotelId = prefill.hotelId;
      if (prefill.paso) S.paso = Math.max(1, Math.min(3, Number(prefill.paso) || 1));
      APP.go('stay');
    },
    // agrega una sugerencia (desde lugares, inicio, etc.) y abre el paso 2; un hotel se vuelve el hotel de la estancia
    add(sugId) {
      fresco(); const s = A.sugerencia(sugId);
      if (s && s.cat === 'hotel') { if (esAloj(s.lugarId)) S.hotelId = s.lugarId; S.paso = 1; APP.toast('Hotel updated · ' + APP.lugarN(S.hotelId)); APP.go('stay'); return; }
      if (s) {
        if (S.actividades.some(a => a.sugerenciaId === s.id)) APP.toast(s.nombre + ' is already in your stay');
        else { S.actividades.push(nuevaActividad(s, A.sumaDias(S.llegadaFecha, 1))); APP.toast(s.nombre + ' added to your stay'); }
        cat = s.cat;
      }
      S.paso = 2; APP.go('stay');
    },
  };
})();
