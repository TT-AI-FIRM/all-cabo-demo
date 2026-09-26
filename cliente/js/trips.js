/* All Cabo Services · app del huésped · Viajes (v3)
   Lista (viaje en vivo, estancia, compartidos, próximos, pasados), detalle con mapa en vivo arriba y panel abajo,
   chat con el chofer, compartir / dividir, pagar tu parte, calificar, cancelar y el enlace público (?track=ID).
   Expone APP.etaLineas(v), APP.chatRefresh() y APP.trips = { open(id), card(v, pillsExtra) }. */
(function () {
  'use strict';
  const APP = window.APP; const A = APP.A; const esc = APP.esc; const $ = APP.$; const $$ = APP.$$;
  const hoy = APP.hoy;

  // ───────── ayudantes ─────────
  const PASOS = ['asignado', 'en_camino', 'llegue', 'a_bordo', 'completado'];
  const PASOS_L = ['Assigned', 'En route', 'Arrived', 'On board'];
  // los colores de ESTADOS en core son del tema oscuro: aquí cada estado usa una píldora del sistema de diseño
  const TONO = { solicitado: 'warn', asignado: 'info', aceptado: 'info', en_camino: 'accent', llegue: 'accent', a_bordo: 'ok', cancelado: 'bad', no_show: 'bad' };
  const pillEstado = (v) => `<span class="pill ${TONO[v.estado] || ''}">${esc(A.ESTADOS[v.estado].en)}</span>`;
  const dinero = (n) => A.usd(n, Number(n) % 1 ? 2 : 0);
  const ruta = (v) => `${APP.lugarN(v.origenId)} → ${APP.lugarN(v.destinoId)}`;
  const nombreDe = (id) => { const l = A.lugar(id); return l ? l.nombre : '—'; };
  const sinAnio = (f) => A.fechaLarga(f, true).replace(/, \d{4}$/, '');
  const ordenAsc = (a, b) => (a.fecha + a.hora) < (b.fecha + b.hora) ? -1 : 1;
  const choferDe = (v) => v.choferId ? A.chofer(v.choferId) : null;
  const vehDe = (c) => c ? A.vehiculo(c.vehiculoId) : null;
  const vivo = (v) => A.EN_RUTA.includes(v.estado);
  const puedeVer = (v, u) => v.clienteId === u.id || (v.cuentaId && v.cuentaId === u.cuentaId) || (v.compartidoCon || []).includes(u.id);
  const telDe = (c) => '+52' + String(c.tel || '').replace(/\D/g, '');
  const fchip = (a, on, attr) => `<button class="fchip press ${on ? 'on' : ''}" ${attr}="${a.id}"><span class="avatar">${esc(APP.ini(a.nombre))}</span>${esc(APP.first(a.nombre))}</button>`;
  const irA = (id) => APP.go('trip', { id });
  const reservar = () => { if (APP.ride) APP.ride.start({}); else APP.go('ride'); };

  // ───────── texto del ETA (lo usa también base para refrescar .etacard en cada tic) ─────────
  APP.etaLineas = (v) => {
    if (v.estado === 'completado') return ['Trip completed', A.fechaLarga(v.fecha, true) + ' · ' + A.usd(v.precio.total)];
    if (v.estado === 'cancelado') return ['Trip cancelled', ''];
    if (v.estado === 'no_show') return [A.ESTADOS.no_show.en, ''];
    const c = choferDe(v); if (!c) return ['Finding your driver…', 'Matching the nearest available vehicle'];
    const veh = vehDe(c); const nom = APP.first(c.nombre); const car = veh ? `${A.TIPOS_VEHICULO[veh.tipo].corto} · ${veh.placa}` : ''; const e = A.eta(v);
    if (v.estado === 'asignado' || v.estado === 'aceptado') return [`${nom} picks you up at ${A.hora12(v.hora)}`, `${car} · ${A.haversine(c.pos, A.lugar(v.origenId).pos).toFixed(1)} km away right now`];
    if (v.estado === 'en_camino') return e && e.llegado ? [`${nom} is at the pickup point`, car] : [`${nom} arrives in ${e ? e.min : '—'} min`, `${e ? e.km.toFixed(1) : '—'} km away · ${car}`];
    if (v.estado === 'llegue') return [`${nom} is here`, `${v.origenId === 'sjd' ? 'Door 3 · ' : ''}${car}`];
    if (v.estado === 'a_bordo') return e && e.llegado ? ['You have arrived', APP.lugarN(v.destinoId)] : [`${e ? e.min : '—'} min to ${APP.lugarN(v.destinoId)}`, `${e ? e.km.toFixed(1) : '—'} km left · enjoy the ride`];
    return [A.ESTADOS[v.estado].en, ''];
  };

  // tarjeta oscura del ETA: un solo <b> (línea 1) y .eta2 (línea 2), que base actualiza en cada tic
  const etaCard = (v, cls, attrs) => {
    const c = choferDe(v); const [t1, t2] = APP.etaLineas(v); const tag = attrs ? 'button' : 'div';
    return `<${tag} class="etacard ${cls || ''}" ${attrs || ''}><div class="trp-eta-tx"><b>${esc(t1)}</b><span class="eta2">${esc(t2)}</span></div>${c && !APP.done(v) ? `<div class="avatar">${esc(APP.ini(c.nombre))}</div>` : ''}</${tag}>`;
  };

  // ───────── tarjeta de viaje (la usan otras pantallas: los llamadores enlazan [data-trip]) ─────────
  const tarjeta = (v, extra) => {
    const [, m, d] = v.fecha.split('-'); const c = choferDe(v);
    const det = [A.hora12(v.hora), A.TIPOS_VEHICULO[v.vehiculo].corto, v.pasajeros + ' pax'];
    if (c) det.push(APP.first(c.nombre)); if (v.modo === 'horas') det.push(v.horas + ' h');
    return `<button class="trip press" data-trip="${esc(v.id)}"><span class="dt"><b>${Number(d)}</b><span>${A.MESES_EN[Number(m) - 1]}</span></span>
      <span class="rt"><b>${v.etiqueta ? esc(v.etiqueta) + ' · ' : ''}${esc(ruta(v))}</b><span>${esc(det.join(' · '))}</span>
        <span class="pills">${pillEstado(v)}${v.itinerarioId ? '<span class="pill gold">Your stay</span>' : ''}${(v.compartidoCon || []).length ? '<span class="pill info">Shared</span>' : ''}${extra || ''}${v.estado === 'completado' && v.calificacion ? `<span class="stars">${'★'.repeat(v.calificacion)}</span>` : ''}</span></span>
      <span class="amt num">${A.usd(v.precio.total)}</span></button>`;
  };

  // ═════════════ LISTA ═════════════
  const vivaDe = (u) => APP.misViajes().concat(A.viajesCompartidosCon(u.id)).filter(v => !APP.done(v) && v.fecha >= hoy).sort(ordenAsc).find(vivo) || null;

  const tarjetaViva = (v) => {
    const c = choferDe(v); const [t1, t2] = APP.etaLineas(v);
    return `<button class="etacard trp-live press" data-trip="${esc(v.id)}" data-live="${esc(v.id)}">
      <div class="trp-eta-tx"><em class="trp-live-tag"><i class="trp-dot"></i>Live · ${esc(A.ESTADOS[v.estado].en)}</em><b>${esc(t1)}</b><span class="eta2">${esc(t2)}</span><em class="trp-live-rt">${esc(ruta(v))}</em></div>
      ${c ? `<div class="avatar">${esc(APP.ini(c.nombre))}</div>` : ''}</button>`;
  };

  const tarjetaEstancia = (it) => {
    const vsIt = it.viajeIds.map(A.viaje).filter(Boolean).sort(ordenAsc); const enCurso = it.llegada.fecha <= hoy;
    const dia = Math.round((new Date(hoy) - new Date(it.llegada.fecha)) / 86400000) + 1;
    const s = A.db.sugerencias.find(x => x.cat === 'hotel' && x.lugarId === it.hotelId);
    const fila = (v) => {
      const [wd] = A.fechaLarga(v.fecha, true).split(','); const extra = v.modo === 'horas' ? v.horas + ' h wait' : (v.regresoHora ? 'back ' + A.hora12(v.regresoHora) : '');
      return `<button class="trp-srow press" data-trip="${esc(v.id)}"><span class="d"><small>${esc(wd)}</small><b>${Number(v.fecha.slice(8))}</b></span><span class="tx"><b>${esc(v.etiqueta || APP.lugarN(v.destinoId))}</b><small>${A.hora12(v.hora)}${extra ? ' · ' + esc(extra) : ''}</small></span><span class="chev">${APP.ICO.chev}</span></button>`;
    };
    return `<div class="card trp-stay">
      <div class="trp-stay-h"><span class="trp-stay-ph">${s ? APP.fotoSug(s) : APP.ICO.hotel}</span>
        <span class="tx"><span class="eyebrow">${enCurso ? `Your stay · day ${dia} of ${it.noches + 1}` : 'Your upcoming stay'}</span><b>${esc(APP.lugarN(it.hotelId))}</b><small>${esc(sinAnio(it.llegada.fecha))} → ${esc(sinAnio(it.salida.fecha))}</small></span>
        <span class="pill gold">${it.noches} nights</span></div>
      <div class="trp-stay-rows">${vsIt.map(fila).join('')}</div>
      <p class="trp-stay-f">${vsIt.length} rides · ${A.usd(it.total)} paid with ${esc(A.METODOS[it.pago.metodo].en)}</p>
      ${it.notas ? `<p class="trp-stay-f">Notes for your driver: ${esc(it.notas)}</p>` : ''}</div>`;
  };

  const vacio = (titulo, sub, conReserva) => `<div class="card trp-empty">${conReserva ? `<div class="trp-empty-ph"><img src="${APP.fotoVeh('escalade')}" alt="" loading="lazy"></div>` : ''}<b>${titulo}</b><p class="small muted">${sub}</p>${conReserva ? '<button class="btn" data-book>Book a ride</button>' : ''}</div>`;

  function lista() {
    const u = APP.user(); const vs = APP.misViajes();
    const up = vs.filter(v => !APP.done(v) && v.fecha >= hoy).sort(ordenAsc);
    const past = vs.filter(v => APP.done(v) || v.fecha < hoy).sort((a, b) => ordenAsc(b, a));
    const shared = A.viajesCompartidosCon(u.id).filter(v => !APP.done(v) && !vs.includes(v)).sort(ordenAsc);
    const its = A.itinerariosDe(u.id).filter(it => it.salida.fecha >= hoy);
    const live = vivaDe(u); const upL = up.filter(v => v !== live);
    const partePill = (v) => { const p = v.partes && v.partes[u.id]; return p ? `<span class="pill ${p.estado === 'pagado' ? 'ok' : 'warn'}">Your share ${dinero(p.monto)} · ${p.estado === 'pagado' ? 'paid' : 'to pay'}</span>` : `<span class="pill info">by ${esc(APP.first(v.nombre))}</span>`; };
    const resumen = [live ? '1 ride in progress' : '', `${upL.length} upcoming`, shared.length ? `${shared.length} shared with you` : '', `${past.length} past`].filter(Boolean).join(' · ');
    const body = `
      <div class="title"><h1>Your trips</h1><p>${resumen}</p></div>
      ${live ? tarjetaViva(live) : ''}
      ${its.map(tarjetaEstancia).join('')}
      ${shared.length ? `<div class="sec-h"><h2>Shared with you</h2></div>${shared.map(v => tarjeta(v, partePill(v))).join('')}` : ''}
      <div class="sec-h"><h2>Upcoming</h2>${upL.length ? `<span class="pill">${upL.length}</span>` : ''}</div>
      ${upL.map(v => tarjeta(v)).join('') || vacio(live ? 'Nothing else booked' : 'No upcoming rides', 'Book one in seconds: airport, dinner, anywhere.', true)}
      <div class="sec-h"><h2>Past</h2>${past.length > 12 ? '<span class="pill">Last 12</span>' : ''}</div>
      ${past.slice(0, 12).map(v => tarjeta(v)).join('') || vacio('No past trips yet', 'Completed rides and receipts show up here.', false)}`;
    APP.screen({ body });
    $$('#root [data-trip]').forEach(b => { b.onclick = () => irA(b.dataset.trip); });
    $$('#root [data-book]').forEach(b => { b.onclick = reservar; });
  }
  // escritorio: el viaje en vivo en el mapa de la derecha; si no hay, el mapa de contexto
  function listaSide(el) {
    const live = vivaDe(APP.user()); if (!live) { APP.mapa.contexto(el); return; }
    APP.mapa.viaje(live, el); $('#sideOver').innerHTML = etaCard(live, 'trp-side press', `data-trip="${esc(live.id)}"`);
    const b = $('#sideOver [data-trip]'); if (b) b.onclick = () => irA(live.id);
  }

  // ═════════════ DETALLE ═════════════
  const linea = (idx) => `<div class="timeline">${PASOS_L.map((_, i) => `<i class="${idx >= i ? 'on' : ''}"></i>`).join('')}</div><div class="trp-tl">${PASOS_L.map((l, i) => `<span class="${idx === i ? 'on' : ''}">${l}</span>`).join('')}</div>`;

  const rutaCard = (v) => `<div class="card trp-route"><div class="route">
      <div class="rt-row"><span class="rt-dot">${APP.ICO.dot}</span><span class="tx"><small>Pickup · ${A.hora12(v.hora)}</small><b>${esc(nombreDe(v.origenId))}</b></span></div>
      ${(v.paradas || []).map(p => `<div class="rt-row stop"><span class="rt-dot">${APP.ICO.pin}</span><span class="tx"><small>Stop</small><b>${esc(p.texto || APP.lugarN(p.lugarId))}</b></span></div>`).join('')}
      <div class="rt-row to"><span class="rt-dot">${APP.ICO.flag}</span><span class="tx"><small>${v.modo === 'horas' ? 'Destination' : 'Drop-off'}</small><b>${esc(nombreDe(v.destinoId))}</b></span></div>
    </div>${v.origenId === 'sjd' && !APP.done(v) ? `<div class="trp-meet">${APP.ICO.pin}<span>Meeting point: Door 3 · look for the <b>All Cabo Services</b> sign</span></div>` : ''}</div>`;

  const cardChofer = (v, c, veh, conAcciones) => {
    if (!c || !veh) return `<div class="card trp-assign"><div class="row start"><i class="trp-dot"></i><b>Assigning your driver…</b></div><p class="small muted">Dispatch is matching the nearest available vehicle. You will get the name and plate here and by WhatsApp.</p></div>`;
    const prov = A.proveedor(v.proveedorId); const abierto = A.chatAbierto(v); const n = A.mensajesDe(v.id).length;
    const acciones = !conAcciones || APP.done(v) ? '' : `<div class="grid2 trp-2"><a class="btn sec" href="tel:${telDe(c)}">${APP.ICO.phone}Call</a>${abierto ? `<button class="btn" id="tChat">${APP.ICO.chat}Message${n ? ' (' + n + ')' : ''}</button>` : `<button class="btn sec" disabled>${APP.ICO.chat}Message</button>`}</div>${abierto ? '' : '<p class="tiny muted trp-hint">In-app messages open when your driver is on the way and close when the trip ends. Until then, call if you need anything.</p>'}`;
    return `<div class="card trp-drv">
      <div class="drv"><div class="avatar lg">${esc(APP.ini(c.nombre))}</div><div class="tx"><b>${esc(c.nombre)}</b><span><span class="stars">★</span> ${c.calificacion.toFixed(1)} · Your driver</span></div></div>
      <div class="trp-veh"><span class="vimg"><img src="${APP.fotoVeh(veh.tipo)}" alt="${esc(A.TIPOS_VEHICULO[veh.tipo].nombre)}" loading="lazy"></span><div class="tx"><b>${esc(A.TIPOS_VEHICULO[veh.tipo].nombre)}</b><span>${esc(veh.color)}${prov && !prov.propio ? ' · partner fleet, All Cabo standard' : ''}</span></div><span class="plate">${esc(veh.placa)}</span></div>
      ${acciones}</div>`;
  };

  const cardDetalles = (v, it) => {
    const f = v.vuelo && v.vuelo.num ? v.vuelo : null;
    const vueloTxt = f ? (f.salida ? 'Departs ' + A.hora12(f.programada) : (f.estado === 'a tiempo' ? 'On time' : (f.estado === 'retrasado' ? 'Delayed ' + f.minutos + ' min · pickup adjusted' : 'Early · pickup adjusted'))) : '';
    const filas = [
      ['When', `${esc(A.fechaLarga(v.fecha, true))} · ${A.hora12(v.hora)}${v.horaOriginal ? `<br><span class="faint">moved from ${A.hora12(v.horaOriginal)}</span>` : ''}`],
      ['Passengers', String(v.pasajeros)],
      ['Vehicle', esc(A.TIPOS_VEHICULO[v.vehiculo].nombre)],
      v.modo === 'horas' ? ['With driver', `${v.horas} h`] : null,
      v.regresoHora ? ['Pickup back', A.hora12(v.regresoHora)] : null,
      it ? ['Part of your stay', `${esc(APP.lugarN(it.hotelId))} · ${it.noches} nights · ${it.viajeIds.length} rides`] : null,
      f ? [`Flight ${esc(f.num)}`, `<span class="pill ${f.estado === 'a tiempo' ? 'ok' : 'warn'}">${vueloTxt}</span><br><span class="tiny faint">simulated flight status</span>`] : null,
    ].filter(Boolean);
    return `<div class="card trp-card"><h3>Trip details</h3>${filas.map(([k, x]) => `<div class="kv"><span>${k}</span><span>${x}</span></div>`).join('')}</div>`;
  };

  const cardPago = (v, u, mio) => {
    const lbl = !mio ? 'Total' : (v.pago.estado === 'reembolsado' ? 'Refunded' : (v.pago.estado === 'pendiente' ? 'To pay' : 'Paid'));
    const extras = (v.extras || []).map(x => String((A.db.config.extras.find(e => e.id === x) || {}).en || x).split(' · ')[0]);
    const partes = v.partes ? Object.entries(v.partes) : [];
    return `<div class="card trp-card"><h3>Payment</h3>
      <div class="kv"><span>${lbl}</span><span><b class="num">${A.usd(v.precio.total)}</b> · ${esc(A.METODOS[v.pago.metodo].en)}${v.pago.estado === 'pendiente_confirmar' ? ' <span class="pill warn">confirming</span>' : ''}</span></div>
      ${extras.length ? `<div class="kv"><span>Extras</span><span>${esc(extras.join(', '))}</span></div>` : ''}
      ${partes.length ? `<div class="trp-parts"><p class="eyebrow">Split ${partes.length} ways</p>${partes.map(([id, p]) => `<div class="trp-part"><span class="avatar sm">${esc(APP.ini((A.cliente(id) || {}).nombre || id))}</span><b>${id === u.id ? 'You' : esc(APP.first((A.cliente(id) || {}).nombre || id))}</b><span class="num">${dinero(p.monto)}</span><span class="pill ${p.estado === 'pagado' ? 'ok' : 'warn'}">${p.estado === 'pagado' ? 'paid' : 'pending'}</span></div>`).join('')}</div>` : ''}</div>`;
  };

  function detalle(p) {
    const u = APP.user(); const v = p.id ? A.viaje(p.id) : null;
    if (!v || !puedeVer(v, u)) {
      APP.screen({ back: true, title: 'Trip', body: `<div class="sp16"></div>${vacio('Trip not found', 'This ride is not in your account. It may belong to another guest.', false)}<button class="btn full" id="tAll" style="margin-top:12px;">See your trips</button>` });
      $('#tAll').onclick = () => APP.go('trips'); return;
    }
    const c = choferDe(v); const veh = vehDe(c); const isDone = APP.done(v); const live = vivo(v); const mio = v.clienteId === u.id;
    const it = v.itinerarioId ? A.itinerario(v.itinerarioId) : null; const parte = v.partes && v.partes[u.id];
    const idx = PASOS.indexOf(v.estado === 'aceptado' ? 'asignado' : v.estado);
    const gps = live && !(c && c.gpsReal) ? `<span class="pill gold">Demo GPS · ${A.db.config.factorDemo}× speed</span>` : (c && c.gpsReal ? '<span class="pill ok">Live GPS</span>' : '');
    const body = `
      ${APP.desktop() ? '' : etaCard(v)}
      <div class="trp-st">${pillEstado(v)}${gps}${(v.compartidoCon || []).length ? '<span class="pill info">Shared</span>' : ''}</div>
      ${isDone ? '' : linea(idx)}
      ${rutaCard(v)}
      ${parte && parte.estado !== 'pagado' && !isDone ? `<div class="card gold trp-card"><b>${esc(APP.first(v.nombre))} shared this ride with you.</b><p class="small muted" style="margin-top:3px;">Your share is ${dinero(parte.monto)}. Pay it and you are on the list.</p><button class="applebtn press" id="tPayPart" style="margin-top:12px;"> Pay · ${dinero(parte.monto)}</button></div>` : ''}
      ${cardChofer(v, c, veh, true)}
      ${cardDetalles(v, it)}
      ${cardPago(v, u, mio)}
      ${isDone ? '' : `<div class="grid2 trp-acts ${mio ? '' : 'one'}"><button class="btn sec" id="tShare">${APP.ICO.share}Share live trip</button>${mio ? `<button class="btn sec" id="tSplit">${APP.ICO.split}${v.partes ? 'Manage split' : 'Split fare'}</button>` : ''}</div>`}
      ${v.estado === 'completado' && mio ? `<div class="card trp-card"><h3>How was your ride${c ? ' with ' + esc(APP.first(c.nombre)) : ''}?</h3><div class="trp-stars">${[1, 2, 3, 4, 5].map(n => `<button class="star press ${(v.calificacion || 0) >= n ? 'on' : ''}" data-star="${n}" aria-label="${n} star${n > 1 ? 's' : ''}">★</button>`).join('')}</div>${v.calificacion ? '<p class="small muted trp-center">Thank you. Your receipt was sent by email.</p>' : ''}</div>` : ''}
      ${!isDone && mio && ['asignado', 'aceptado', 'solicitado'].includes(v.estado) ? '<div class="trp-center"><button class="linkbtn" id="tCancel">Cancel ride · free until 24 h before</button></div>' : ''}
      <p class="demo-note">Demo: the vehicle moves along the real highway route unless the driver turns on live GPS on their phone. In production the vans carry GPS trackers, so you see them even before the driver opens the app. Vehicle photos show the type, not the exact unit.</p>`;
    const map = APP.screen({ map: true, back: true, title: v.etiqueta || (live ? 'Your ride' : 'Trip details'), body });
    if (map) APP.mapa.viaje(v, map);
    const on = (id, f) => { const b = $('#' + id); if (b) b.onclick = f; };
    on('tChat', () => chat(v.id));
    on('tShare', () => compartir(v.id));
    on('tSplit', () => dividir(v.id));
    on('tCancel', () => cancelar(v.id));
    on('tPayPart', () => APP.pagar({ metodo: 'applepay', monto: parte.monto, concepto: 'Your share · ' + ruta(v), onDone: () => { A.pagarParte(v.id, u.id, 'applepay'); APP.toast('Paid · you are on the ride'); APP.render(); } }));
    $$('#root [data-star]').forEach(b => { b.onclick = () => { A.calificar(v.id, Number(b.dataset.star)); APP.toast('Thanks for rating your ride!'); APP.render(); }; });
  }
  function detalleSide(el, p) {
    const v = p.id ? A.viaje(p.id) : null;
    if (!v || !puedeVer(v, APP.user())) { APP.mapa.contexto(el); return; }
    APP.mapa.viaje(v, el); $('#sideOver').innerHTML = etaCard(v, 'trp-side');
  }

  // ───────── hojas: compartir, dividir, cancelar ─────────
  function compartir(id) {
    const v = A.viaje(id); const u = APP.user(); const c = choferDe(v); const veh = vehDe(c); const am = v.clienteId === u.id ? APP.amigos() : [];
    const link = A.enlaceSeguimiento(v.id); let cambio = false;
    const txt = `Follow my All Cabo ride live: ${ruta(v)} · ${A.fechaLarga(v.fecha, true)} ${A.hora12(v.hora)}${c && veh ? ' · driver ' + c.nombre + ' · ' + veh.placa : ''}`;
    const copiar = () => { if (navigator.clipboard) navigator.clipboard.writeText(link).catch(() => { }); };
    APP.sheet(`${APP.sheetH('Share live trip')}
      <p class="small muted">Anyone with the link sees the car on the map, the driver's name and plate, and your ETA. Nothing else.</p>
      <div class="trp-link">${esc(link)}</div>
      <div class="grid2"><button class="btn sec" id="shCopy">Copy link</button><button class="btn" id="shNative">${APP.ICO.share}Send…</button></div>
      ${am.length ? `<label class="lbl">Or share with a friend in the app</label><div>${am.map(a => fchip(a, (v.compartidoCon || []).includes(a.id), 'data-shf')).join('')}</div>` : ''}`, { onClose: () => { if (cambio) APP.render(); } });
    $('#shCopy').onclick = () => { copiar(); APP.toast('Link copied'); };
    $('#shNative').onclick = () => { if (navigator.share) navigator.share({ title: 'My ride', text: txt, url: link }).catch(() => { }); else { copiar(); APP.toast('Sharing sheet not available here · link copied'); } };
    // compartir con amigos conserva el modo: si el pago ya estaba dividido, sigue dividido
    $$('#overlay [data-shf]').forEach(b => { b.onclick = () => {
      const w = A.viaje(id); const f = b.dataset.shf; const cur = w.compartidoCon || []; const ids = cur.includes(f) ? cur.filter(x => x !== f) : cur.concat([f]);
      A.compartirViaje(w.id, ids, w.division === 'igual' ? 'igual' : 'solo_ver'); b.classList.toggle('on', ids.includes(f)); cambio = true;
      APP.toast(ids.includes(f) ? 'Trip shared' : 'Stopped sharing');
    }; });
  }

  function dividir(id) {
    const v = A.viaje(id); const am = APP.amigos();
    if (!am.length) { APP.toast('Add friends first · Friends tab'); return; }
    const cur = (v.compartidoCon || []).slice();
    APP.sheet(`${APP.sheetH('Split the fare')}
      <p class="small muted">${A.usd(v.precio.total)} total. Each person pays their share in their own app; you cover anything unpaid at pickup.</p>
      <div class="trp-fr">${am.map(a => fchip(a, cur.includes(a.id), 'data-spf')).join('')}</div>
      <button class="btn xl full" id="spGo"></button>`);
    const upd = () => {
      const b = $('#spGo'); const n = cur.length;
      b.textContent = n ? `Split with ${n} friend${n === 1 ? '' : 's'} · ${dinero(v.precio.total / (n + 1))} each` : (v.partes ? 'Remove the split' : 'Pick who is riding with you');
      b.disabled = !n && !v.partes;
    };
    upd();
    $$('#overlay [data-spf]').forEach(b => { b.onclick = () => { const f = b.dataset.spf; const i = cur.indexOf(f); if (i >= 0) cur.splice(i, 1); else cur.push(f); b.classList.toggle('on', i < 0); upd(); }; });
    $('#spGo').onclick = () => { A.compartirViaje(v.id, cur, cur.length ? 'igual' : 'solo_ver'); APP.closeSheet(); APP.toast(cur.length ? 'Fare split · your friends got the ride' : 'Split removed'); APP.render(); };
  }

  function cancelar(id) {
    const v = A.viaje(id);
    APP.sheet(`${APP.sheetH('Cancel this ride?')}
      <p class="small muted">${esc(ruta(v))} · ${esc(A.fechaLarga(v.fecha, true))} · ${A.hora12(v.hora)}. Cancelling is free until 24 h before pickup.</p>
      <div class="grid2" style="margin-top:16px;"><button class="btn sec" id="cxNo">Keep my ride</button><button class="btn trp-danger" id="cxGo">Cancel ride</button></div>`);
    $('#cxNo').onclick = APP.closeSheet;
    $('#cxGo').onclick = () => { A.cambiarEstado(v.id, 'cancelado', APP.user().nombre); APP.closeSheet(); APP.toast('Ride cancelled. Refund issued (simulated).'); APP.render(); };
  }

  // ───────── chat con el chofer (solo mientras el viaje está en curso) ─────────
  APP.chatRefresh = () => {
    const box = $('#chatBox'); const v = APP.chatViaje ? A.viaje(APP.chatViaje) : null; if (!box || !v) return;
    const ms = A.mensajesDe(v.id);
    box.innerHTML = ms.map(m => `<div class="cb ${m.de === 'cliente' ? 'me' : 'them'}">${esc(m.texto)}<time>${A.hora12(new Date(m.t).toTimeString().slice(0, 5))}</time></div>`).join('')
      || '<div class="small muted trp-chat-empty">Say hi to your driver. Messages are translated for them if needed.</div>';
    box.scrollTop = box.scrollHeight;
    if (!A.chatAbierto(v)) { $$('#overlay #chatIn, #overlay #chatGo, #overlay [data-q]').forEach(x => { x.disabled = true; }); const n = $('#chatClosed'); if (n) n.classList.remove('hide'); }
  };
  function chat(id) {
    const v = A.viaje(id); if (!A.chatAbierto(v)) { APP.toast('Messaging is available during the trip only'); return; }
    const c = choferDe(v); const veh = vehDe(c);
    const rapidas = ['We are at Door 3', 'Running 10 min late', 'We have 2 extra bags', 'Can we stop for groceries?'].filter(t => v.origenId === 'sjd' || t.indexOf('Door 3') < 0);
    APP.sheet(`<div class="sheet-h"><div class="drv"><div class="avatar">${esc(APP.ini(c.nombre))}</div><div class="trp-eta-tx"><b>${esc(c.nombre)}</b><div class="small muted">Your driver${veh ? ' · ' + esc(veh.placa) : ''}</div></div></div><button class="sheet-x press" data-close aria-label="Close">${APP.ICO.close}</button></div>
      <div class="chat" id="chatBox"></div>
      <p class="small muted trp-center hide" id="chatClosed">This trip has ended · messages are closed.</p>
      <div class="chips trp-quick">${rapidas.map(t => `<button class="chip" data-q="${esc(t)}">${esc(t)}</button>`).join('')}</div>
      <div class="trp-chat-in"><input class="txt" id="chatIn" placeholder="Message…" autocomplete="off" enterkeyhint="send" aria-label="Message to your driver"><button class="btn" id="chatGo">Send</button></div>`, { onClose: APP.render });
    APP.chatViaje = v.id; APP.chatRefresh();
    const enviar = (t) => { t = String(t || '').trim(); if (!t) return; if (!A.enviarMensaje(v.id, 'cliente', t)) { APP.toast('This trip has ended · messages are closed'); return; } $('#chatIn').value = ''; APP.chatRefresh(); };
    $('#chatGo').onclick = () => enviar($('#chatIn').value);
    $('#chatIn').onkeydown = (e) => { if (e.key === 'Enter') enviar($('#chatIn').value); };
    $$('#overlay [data-q]').forEach(b => { b.onclick = () => enviar(b.dataset.q); });
    if (APP.desktop()) setTimeout(() => { const i = $('#chatIn'); if (i) i.focus(); }, 60);
  }

  // ═════════════ ENLACE PÚBLICO (?track=ID): siempre en formato de teléfono, sin barra ni datos del huésped ═════════════
  function seguimiento(p) {
    const v = A.viaje(p.id); if (!v) return;
    document.documentElement.dataset.device = 'mobile';
    const c = choferDe(v); const veh = vehDe(c); const live = vivo(v);
    $('#root').innerHTML = `<div class="ms trk">
      <div class="ms-map"><div id="map" class="map"></div></div>
      <div class="ms-top"><span class="brand"><img src="../shared/img/logo.png" alt="All Cabo Services"></span><span class="trp-chip">${live ? '<i class="trp-dot"></i>Live trip' : esc(A.ESTADOS[v.estado].en)}</span></div>
      <div class="ms-panel">
        ${etaCard(v)}
        <div class="trk-h"><b>${esc(APP.first(v.nombre))}'s ride</b>${pillEstado(v)}</div>
        <p class="small muted trk-sub">${esc(A.fechaLarga(v.fecha, true))} · pickup ${A.hora12(v.hora)}</p>
        ${rutaCard(v)}
        ${c && veh ? cardChofer(v, c, veh, false) : ''}
        <p class="demo-note">Shared by ${esc(v.nombre)} through All Cabo Services. This page shows the vehicle position, driver and plate only.${live && !(c && c.gpsReal) ? ' Demo: the vehicle position is simulated.' : ''}</p>
      </div></div>`;
    APP.mapa.viaje(v, $('#map'));
  }
  // el navegador de escritorio vuelve a marcar «desktop» al cambiar de tamaño: el enlace público sigue en teléfono
  window.addEventListener('resize', () => { if (APP.view === 'track') document.documentElement.dataset.device = 'mobile'; });

  // ───────── tic local: en una sola pestaña core no avisa a sus propios oyentes, así que el mapa y el ETA
  // se refrescan aquí cada segundo mientras se ve un viaje (con varias pestañas base también lo hace; no estorba) ─────────
  setInterval(() => {
    if (document.hidden || !['trips', 'trip', 'track'].includes(APP.view)) return;
    APP.mapa.actualizar();
    $$('#root [data-live]').forEach(el => { const v = A.viaje(el.dataset.live); if (!v) return; const [t1, t2] = APP.etaLineas(v); const b = el.querySelector('b'), s = el.querySelector('.eta2'); if (b) b.textContent = t1; if (s) s.textContent = t2; });
  }, 1000);

  APP.register('trips', { render: lista, side: listaSide, tab: 'trips' });
  APP.register('trip', { render: detalle, side: detalleSide, tab: 'trips', back: 'trips' });
  APP.register('track', { render: seguimiento, nonav: true });
  APP.trips = { open: irA, card: tarjeta };
})();
