/* All Cabo Services · app del huésped · Reserva (v3)
   Cuatro pasos sobre el mapa: a dónde → cuándo → camioneta → confirmar y pagar.
   Mismas funciones que la app anterior (cliente.js, líneas 53–175); el diseño sigue la referencia
   «Choose a Ride / Confirm Ride». El estado vive en memoria y sobrevive a la navegación.
   Dentro de la pantalla solo se repinta el cuerpo (#rdBody): el mapa se vuelve a dibujar
   únicamente cuando cambia la ruta, para que no parpadee con cada toque. */
(function () {
  'use strict';
  const APP = window.APP; const A = APP.A; const esc = APP.esc; const usd = APP.usd; const $ = APP.$; const $$ = APP.$$;
  const ICO = APP.ICO;

  // ───────── estado de la reserva ─────────
  let B = null;
  const nuevo = () => ({
    uid: APP.userId(), paso: 1, servicio: 'ride', modo: 'from_airport', origenId: 'sjd', destinoId: APP.hotelDe(APP.user()),
    redondo: false, fecha: APP.hoy, hora: '15:40', vuelo: 'UA 1234', pax: 2, maletas: 2, vehiculo: 'suburban',
    extras: [], paradas: [], notas: '', cuando: 'schedule', horas: 4, split: false, splitCon: [],
    abierto: { extras: null, split: null }, // null = automático (abierto si ya tiene algo)
  });
  // si cambia el huésped (demo), la reserva a medias era de otro: se empieza de nuevo
  const estado = () => { if (!B || B.uid !== APP.userId()) B = nuevo(); return B; };

  const horasMode = () => B.servicio === 'hours';
  const ahora = () => B.cuando === 'now' && !horasMode();
  const syncModo = () => {
    B.modo = horasMode() ? 'hours' : (B.origenId === 'sjd' ? 'from_airport' : (B.destinoId === 'sjd' ? 'to_airport' : 'between'));
    if (B.modo !== 'from_airport' && B.modo !== 'to_airport') B.redondo = false;
  };
  const cotB = (veh) => A.cotizar({ origenId: B.origenId, destinoId: B.destinoId, modo: B.modo === 'hours' ? 'horas' : (B.redondo ? 'redondo' : 'sencillo'), horas: B.horas, vehiculo: veh || B.vehiculo, extras: B.extras, paradas: B.paradas });
  const zonas = () => A.db.config.zonas || A.ZONAS;
  const parada = (r) => r.lugarId ? { lugarId: r.lugarId, texto: null } : { lugarId: '', texto: r.texto };
  const sinIguales = () => { if (B.origenId === B.destinoId) B.destinoId = B.origenId === 'sjd' ? 'oo' : 'sjd'; };
  function setServicio(id) {
    B.servicio = id; B.paso = 1;
    if (id === 'hours') {
      if (B.origenId === 'sjd') B.origenId = APP.hotelDe(APP.user());
      if (B.destinoId === 'sjd' || B.destinoId === B.origenId) B.destinoId = 'ff';
      B.cuando = 'schedule'; B.paradas = []; // por hora: primer destino, sin paradas
    }
    if (id === 'ride' && B.origenId !== 'sjd' && B.destinoId !== 'sjd') { B.origenId = 'sjd'; B.destinoId = APP.hotelDe(APP.user()); B.cuando = 'schedule'; }
    sinIguales(); syncModo();
  }
  function setLugares(o, d) {
    if (o) B.origenId = o; if (d) B.destinoId = d; sinIguales();
    if (B.origenId === 'sjd' || B.destinoId === 'sjd') B.cuando = 'schedule';
    syncModo();
  }
  // hora de recogida: del aeropuerto = aterrizaje + retraso + espera (si el vuelo es hoy); al aeropuerto = salida − 3 h
  const vueloLlegada = () => B.cuando === 'schedule' && B.modo === 'from_airport' && B.vuelo ? A.vueloDe(B.vuelo) : null;
  const recogida = () => {
    const f = vueloLlegada();
    if (f && B.fecha === APP.hoy) return A.hmDe(A.minutosDe(f.programada) + f.minutos + A.db.config.esperaAeropuerto);
    return B.modo === 'to_airport' && B.cuando === 'schedule' ? A.hmDe(A.minutosDe(B.hora) - 180) : B.hora;
  };
  const nParadas = () => B.paradas.length ? ` · ${B.paradas.length} stop${B.paradas.length > 1 ? 's' : ''}` : '';
  const partes = () => B.split && B.splitCon.length ? B.splitCon.length + 1 : 1;
  const estadoVuelo = (f) => `<span class="pill ${f.estado === 'a tiempo' ? 'ok' : 'warn'}">${f.estado === 'a tiempo' ? 'On time' : (f.estado === 'retrasado' ? 'Delayed ' + f.minutos + ' min' : 'Early ' + (-f.minutos) + ' min')}</span>`;
  const icoLugar = (l, dest) => l.tipo === 'aeropuerto' ? ICO.plane : (dest ? ICO.pin : ICO.dot);

  // ───────── paso 1 · a dónde ─────────
  const SERV = [['ride', 'Ride'], ['hours', 'By the hour'], ['stay', 'Plan my stay']];
  const filaRuta = (cls, ico, label, txt, attrs, pos) => `<button class="rt-row ${cls}" ${attrs}><span class="rt-dot">${ico}</span><div class="tx"><small>${label}</small><b>${esc(txt)}</b></div>${pos ? `<span class="rt-km">${APP.kmTxt(pos)}</span>` : ''}</button>`;
  function paso1() {
    const o = A.lugar(B.origenId), d = A.lugar(B.destinoId); const dist = A.distanciaViaje(B.origenId, B.destinoId); const q = cotB(); const hrs = horasMode(); const z = zonas();
    const yo = o.id === APP.MI_LUGAR;
    const stops = B.paradas.map((p, i) => { const l = p.lugarId ? A.lugar(p.lugarId) : null; return `<div class="rt-stopwrap">${filaRuta('stop', `<em>${i + 1}</em>`, 'Stop ' + (i + 1), p.texto || APP.lugarN(p.lugarId), `data-stop="${i}"`, l ? l.pos : null)}<button class="rt-x press" data-delstop="${i}" aria-label="Remove stop ${i + 1}">${ICO.close}</button></div>`; }).join('');
    return `
      <div class="seg rd-serv" role="group" aria-label="Service">${SERV.map(([id, l]) => `<button data-serv="${id}" class="${B.servicio === id ? 'on' : ''}" aria-pressed="${B.servicio === id}">${l}</button>`).join('')}</div>
      <div class="card rd-route"><div class="route ${B.paradas.length ? 'has-stops' : ''}">
        ${filaRuta('from', icoLugar(o), yo ? 'Pickup · current location' : 'Pickup', o.corto || o.nombre, 'data-pick="origen"', yo ? null : o.pos)}
        ${stops}
        ${filaRuta('to', icoLugar(d, true), hrs ? 'First destination' : 'Drop-off', d.corto || d.nombre, 'data-pick="destino"', d.pos)}
        <button class="rt-swap press" id="rdSwap" aria-label="Swap pickup and drop-off">${ICO.swap}</button>
      </div></div>
      <div class="rd-under">
        ${B.paradas.length < 3 && !hrs ? `<button class="chip press" id="rdAddStop">${ICO.plus}Add a stop · ${usd(A.db.config.paradaPrecio)}</button>` : '<span></span>'}
        <span class="small muted num">${dist.km} km · about ${dist.min} min</span>
      </div>
      <div class="rd-geo">${APP.geoChip()}</div>
      <button class="btn xl full rd-go" id="rdNext">Continue${hrs ? '' : ' · from ' + usd(q.base)}</button>
      <p class="legal rd-legal">${esc(z.sj.en)} ${usd(z.sj.sencillo)} · ${esc(z.csl.en)} ${usd(z.csl.sencillo)} one way, any vehicle that fits your party. Taxes included, no surprises.</p>`;
  }

  // ───────── paso 2 · cuándo ─────────
  const infoVuelo = () => {
    if (B.modo !== 'from_airport') return ''; const f = A.vueloDe(B.vuelo); if (!f) return '';
    return `<div class="rd-flight">${estadoVuelo(f)}<span class="small muted">${esc(f.aerolinea)} from ${esc(f.origen)} · scheduled ${A.hora12(f.programada)} · simulated status</span></div>`;
  };
  function paso2() {
    const aeroIn = B.origenId === 'sjd', aeroOut = B.destinoId === 'sjd'; const cfg = A.db.config; const hrs = horasMode(); const aero = (aeroIn || aeroOut) && !hrs;
    const min = APP.minCerca(A.lugar(B.origenId).pos);
    const opcion = (id, ico, titulo, txt) => `<button class="opt press rd-opt ${B.cuando === id ? 'on' : ''}" data-cuando="${id}" aria-pressed="${B.cuando === id}"><span class="ic">${ico}</span><div class="tx"><b>${titulo}</b><span>${txt}</span></div><span class="rd-radio">${B.cuando === id ? ICO.check : ''}</span></button>`;
    const opciones = hrs ? '' : opcion('now', ICO.bolt, 'Right now', `The nearest driver heads to you the moment you pay${aeroIn ? ' · meet at Door 3' : ''}.${min ? ` Closest one is about ${min} min away.` : ''}`)
      + opcion('schedule', ICO.cal, 'Schedule', aeroIn ? 'Give us your flight; the pickup follows it if it lands early or late.' : (aeroOut ? 'We pick you up 3 hours before an international departure.' : 'Pick a date and time; your driver is confirmed right away.'));
    const etiquetaHora = aeroIn && !hrs ? 'Landing time' : (aeroOut && !hrs ? 'Flight departs' : (hrs ? 'Start time' : 'Pickup time'));
    const form = B.cuando === 'schedule' || hrs ? `
      <div class="card rd-form">
        <div class="grid2">
          <div><label class="lbl" for="rdFecha">Date</label><input class="txt" id="rdFecha" type="date" value="${esc(B.fecha)}" min="${APP.hoy}"></div>
          <div><label class="lbl" for="rdHora">${etiquetaHora}</label><input class="txt" id="rdHora" type="time" value="${esc(B.hora)}"></div>
        </div>
        ${aero ? `<label class="lbl" for="rdVuelo">Flight number</label><input class="txt" id="rdVuelo" value="${esc(B.vuelo)}" placeholder="UA 1234" autocomplete="off" autocapitalize="characters">
        <p class="tiny muted rd-hint">${aeroIn ? 'We track it. Early or late, your pickup moves with it; no calls needed.' : 'International flights: pickup 3 hours before departure.'}</p>
        <div id="rdVueloInfo">${infoVuelo()}</div>` : ''}
        ${hrs ? `<label class="lbl">Hours with your driver <span class="faint">· ${usd(cfg.horaVehiculo[B.vehiculo])}/h · ${cfg.horasMin} h minimum</span></label>
        <div class="rd-hrs"><div class="step"><button data-st="horas,-1" aria-label="Fewer hours">−</button><b class="num">${B.horas}</b><button data-st="horas,1" aria-label="More hours">+</button></div><span class="small muted">Dinner, beach day, shopping: the car and driver stay with you.</span></div>` : ''}
      </div>` : '';
    const redondo = aero ? `<button class="card rd-toggle press" id="rdRound" aria-pressed="${B.redondo}"><div class="tx"><b>Round trip</b><span>Airport both ways · ${usd(zonas()[cotB().zona].redondo)}</span></div><span class="sw ${B.redondo ? 'on' : ''}"><i></i></span></button>` : '';
    return `${opciones}${form}${redondo}
      <div class="cta-bar"><button class="iconbtn press" id="rdBack" aria-label="Back">${ICO.back}</button><button class="btn xl" id="rdNext"><span class="rd-cta-t">Continue</span></button></div>`;
  }

  // ───────── paso 3 · camioneta ─────────
  function paso3() {
    const cfg = A.db.config; const hrs = B.modo === 'hours'; const now = ahora(); const o = A.lugar(B.origenId);
    // choferes libres en línea, del más cercano al más lejano a la recogida (datos del demo)
    const cerca = now ? A.db.choferes.filter(c => c.enLinea && !A.viajeActivo(c.id)).map(c => ({ tipo: (A.vehiculo(c.vehiculoId) || {}).tipo, km: A.haversine(c.pos, o.pos) })).sort((a, b) => a.km - b.km) : [];
    const minDe = (tipo) => { const x = cerca.find(y => y.tipo === tipo); return x ? Math.max(3, Math.round(x.km / 50 * 60)) : null; };
    const tipos = Object.values(A.TIPOS_VEHICULO).map(v => ({ v, cabe: v.pax >= B.pax && v.maletas >= B.maletas, q: cotB(v.id), min: minDe(v.id) }));
    // insignias calculadas: solo si una opción que cabe gana sola (precio más bajo o chofer más cerca)
    const unico = (lista, val) => { const m = Math.min(...lista.map(val)); const g = lista.filter(t => val(t) === m); return lista.length > 1 && g.length === 1 ? g[0].v.id : null; };
    const caben = tipos.filter(t => t.cabe);
    const barato = unico(caben, t => t.q.total);
    const cercano = now ? unico(caben.filter(t => t.min != null), t => t.min) : null;
    const tarjeta = ({ v, cabe, q, min }) => `
      <button class="opt press rd-veh ${B.vehiculo === v.id ? 'on' : ''}" data-veh="${v.id}" ${cabe ? '' : 'disabled'} aria-pressed="${B.vehiculo === v.id}">
        <span class="vimg"><img src="${APP.fotoVeh(v.id)}" alt="" loading="lazy"></span>
        <div class="tx">
          <b>${esc(v.nombre)}</b>
          <span class="rd-meta"><i>${ICO.user}${v.pax}</i><i>${ICO.bag}${v.maletas}</i>${now && cabe ? `<i class="eta">${min ? min + ' min away' : 'next available'}</i>` : ''}</span>
          <span>${esc(v.desc || '')}${cabe ? '' : ' · too small for your party'}</span>
        </div>
        <span class="pr num">${usd(q.total)}${hrs ? `<small class="muted">${usd(cfg.horaVehiculo[v.id])}/h</small>` : ''}${v.id === 'escalade' ? '<span class="pill gold">Premium</span>' : ''}${barato === v.id ? '<span class="badge">Best price</span>' : ''}${cercano === v.id ? '<span class="badge">Closest</span>' : ''}</span>
      </button>`;
    const stepper = (k, ico, label) => `<div class="rd-stp"><span class="l">${ico}${label}</span><div class="step"><button data-st="${k},-1" aria-label="Fewer ${label.toLowerCase()}">−</button><b class="num">${B[k]}</b><button data-st="${k},1" aria-label="More ${label.toLowerCase()}">+</button></div></div>`;
    return `
      <div class="card rd-party">${stepper('pax', ICO.user, 'Passengers')}${stepper('maletas', ICO.bag, 'Bags')}</div>
      <div class="rd-vehs">${tipos.map(tarjeta).join('')}</div>
      <div class="cta-bar"><button class="iconbtn press" id="rdBack" aria-label="Back">${ICO.back}</button><button class="btn xl" id="rdNext"><span class="rd-cta-t">Choose ${esc(A.TIPOS_VEHICULO[B.vehiculo].corto)} · ${usd(cotB().total)}</span></button></div>`;
  }

  // ───────── paso 4 · confirmar y pagar ─────────
  const EMOJI_EXTRA = { host: '🤵', super: '🛒', cervezas: '🍺', silla: '👶' };
  const abierto = (k, auto) => (B.abierto[k] != null ? B.abierto[k] : auto) ? 'open' : '';
  function paso4() {
    const q = cotB(); const veh = A.TIPOS_VEHICULO[B.vehiculo]; const cfg = A.db.config; const hrs = B.modo === 'hours'; const now = ahora();
    const o = A.lugar(B.origenId), d = A.lugar(B.destinoId); const f = vueloLlegada(); const am = APP.amigos(); const n = partes(); const parte = q.total / n;
    const fila = (cls, ico, label, txt) => `<div class="rt-row ${cls}"><span class="rt-dot">${ico}</span><div class="tx"><small>${label}</small><b>${esc(txt)}</b></div></div>`;
    const stops = B.paradas.map((p, i) => fila('stop', `<em>${i + 1}</em>`, 'Stop ' + (i + 1), p.texto || APP.lugarN(p.lugarId))).join('');
    const min = now ? APP.minCerca(o.pos) : null;
    const cuando = now ? ['Right now', `Your driver heads to you when you pay${min ? ` · about ${min} min away` : ''}`]
      : [(B.fecha === APP.hoy ? 'Today' : A.fechaLarga(B.fecha, true)) + ' · ' + A.hora12(recogida()), hrs ? `Start · ${B.horas} h with your driver` : (f && B.fecha === APP.hoy ? `Pickup ${cfg.esperaAeropuerto} min after landing` : 'Pickup time')];
    let vuelo = '';
    if (f) vuelo = `<div class="rd-info"><span class="ic">${ICO.plane}</span><div class="tx"><small>Flight ${esc(f.num)}</small><b>${esc(f.aerolinea)} from ${esc(f.origen)}</b></div>${estadoVuelo(f)}</div><p class="tiny faint rd-sim">Flight status is simulated · pickup ${cfg.esperaAeropuerto} min after landing</p>`;
    else if (B.modo === 'to_airport' && B.vuelo && B.cuando === 'schedule') vuelo = `<div class="rd-info"><span class="ic">${ICO.planeUp}</span><div class="tx"><small>Flight ${esc(B.vuelo.toUpperCase())}</small><b>Departs ${A.hora12(B.hora)} · pickup 3 h before</b></div></div>`;
    const base = hrs ? `${B.horas} h × ${usd(q.tarifaHora)}` : esc((zonas()[q.zona] || {}).en || '') + ' · ' + (B.redondo ? 'round trip' : 'one way');
    const extras = cfg.extras.map(e => `<button class="chip press ${B.extras.includes(e.id) ? 'on' : ''}" data-ex="${e.id}" aria-pressed="${B.extras.includes(e.id)}">${EMOJI_EXTRA[e.id] || '✨'} ${esc(e.en.split(' · ')[0])} · ${e.precio ? '+' + usd(e.precio) : 'free'}</button>`).join('');
    const split = am.length ? `
      <details class="more rd-more" data-more="split" ${abierto('split', B.split)}>
        <summary><span>Split with friends${B.split && B.splitCon.length ? ` <span class="pill gold">${usd(parte, 2)} each</span>` : ''}</span><span class="chev">${ICO.down}</span></summary>
        <div class="body">
          <p class="small muted rd-note">Pick who rides with you. Each friend gets the trip in their app and pays their share; you cover anything unpaid at pickup.</p>
          <div>${am.map(a => `<button class="fchip press ${B.splitCon.includes(a.id) ? 'on' : ''}" data-split="${a.id}" aria-pressed="${B.splitCon.includes(a.id)}"><span class="avatar">${esc(APP.ini(a.nombre))}</span>${esc(APP.first(a.nombre))}</button>`).join('')}</div>
          ${B.splitCon.length ? `<p class="small">${n} people · <b>${usd(parte, 2)}</b> each</p>` : ''}
        </div>
      </details>` : '';
    return `
      <div class="card rd-trip">
        <div class="route rd-ro">${fila('from', icoLugar(o), 'Pickup', o.corto || o.nombre)}${stops}${fila('to', icoLugar(d, true), hrs ? 'First destination' : 'Drop-off', d.corto || d.nombre)}</div>
        <div class="rd-info"><span class="ic">${now ? ICO.bolt : ICO.clock}</span><div class="tx"><small>${esc(cuando[1])}</small><b>${esc(cuando[0])}</b></div></div>
        ${vuelo}
      </div>
      <button class="opt press rd-veh rd-pick" id="rdVehChange" aria-label="Change vehicle">
        <span class="vimg"><img src="${APP.fotoVeh(veh.id)}" alt="" loading="lazy"></span>
        <div class="tx"><b>${esc(veh.nombre)}</b><span>${B.pax} passenger${B.pax > 1 ? 's' : ''} · ${B.maletas} bag${B.maletas === 1 ? '' : 's'}${hrs ? ` · ${B.horas} h` : (B.redondo ? ' · round trip' : '')}</span></div>
        <span class="rd-change">Change</span>
      </button>
      <div class="card rd-price">
        <div class="sum"><span>${base}</span><span class="num">${usd(q.base)}</span></div>
        ${q.detalle.map(e => `<div class="sum"><span>${esc(e.en)}</span><span class="num">${e.precio ? usd(e.precio) : 'Free'}</span></div>`).join('')}
        <div class="sum total"><span>Total</span><span class="num">${usd(q.total)} USD</span></div>
      </div>
      <details class="more rd-more" data-more="extras" ${abierto('extras', B.extras.length || B.notas)}>
        <summary><span>Extras & notes${B.extras.length ? ` <span class="pill gold">${B.extras.length} added</span>` : ''}</span><span class="chev">${ICO.down}</span></summary>
        <div class="body">
          <label class="lbl">Extras</label><div class="chips">${extras}</div>
          <label class="lbl" for="rdNotas">Anything else?</label><textarea class="txt" id="rdNotas" rows="2" placeholder="Celebrating something? Dietary needs for the grocery stop?">${esc(B.notas)}</textarea>
        </div>
      </details>
      ${split}
      <div class="rd-pay">
        <p class="rd-paylbl">Pay ${n > 1 ? 'your share · ' + usd(parte, 2) : usd(q.total)}</p>
        <button class="applebtn press" id="rdApple"> Pay</button>
        <button class="zellebtn press" id="rdZelle">Zelle <span>· send directly, no card fees</span></button>
        <div class="rd-other"><button class="linkbtn" id="rdOther">Card or cash instead</button></div>
      </div>
      <button class="btn sec xl full rd-backfull press" id="rdBack">${ICO.back}Back</button>
      <p class="legal rd-legal">Demo: payments are simulated, nothing is charged. Free cancellation up to 24 h before pickup.</p>`;
  }

  // ───────── pantalla ─────────
  const TITULOS = ['Where to?', 'When do you need it?', 'Choose a Ride', 'Confirm Ride'];
  const titulo = () => B.paso === 1 && horasMode() ? 'Where do we start?' : TITULOS[B.paso - 1];
  const subtitulo = () => {
    const dist = A.distanciaViaje(B.origenId, B.destinoId);
    if (B.paso === 2) return `${APP.lugarN(B.origenId)} → ${APP.lugarN(B.destinoId)}${nParadas()}`;
    if (B.paso === 3) return `${dist.km} km · about ${dist.min} min${B.modo === 'hours' ? ` · ${B.horas} h with driver` : (B.redondo ? ' · round trip' : '')}${nParadas()}`;
    if (B.paso === 4) return 'Review and pay';
    return '';
  };
  const cuerpo = () => {
    syncModo(); const sub = subtitulo();
    return `<div class="steps" aria-label="Step ${B.paso} of 4">${[1, 2, 3, 4].map(i => `<i class="${B.paso >= i ? 'on' : ''}"></i>`).join('')}</div>${sub ? `<p class="rd-sub">${esc(sub)}</p>` : ''}${[paso1, paso2, paso3, paso4][B.paso - 1]()}`;
  };
  // vista previa de la ruta; A.mapa agrega un botón de estilo al contenedor cada vez: se deja solo el último
  function dibujar(el) {
    if (!el) return; APP.mapa.preview(el, B.origenId, B.destinoId, B.paradas);
    const bs = el.parentElement ? el.parentElement.querySelectorAll('.mapstyle') : []; for (let i = 0; i < bs.length - 1; i++) bs[i].remove();
  }
  // tarjeta flotante sobre el mapa lateral (escritorio): ruta, km, minutos y precio
  function tarjetaLateral() {
    const so = $('#sideOver'); if (!APP.desktop() || !so || APP.view !== 'ride') return;
    const q = cotB(); const dist = A.distanciaViaje(B.origenId, B.destinoId);
    so.innerHTML = `<div class="glass rd-over"><span class="rd-over-ic">${ICO.ride}</span><div class="tx"><b>${esc(APP.lugarN(B.origenId))} → ${esc(APP.lugarN(B.destinoId))}</b><span>${dist.km} km · about ${dist.min} min${B.modo === 'hours' ? ` · ${B.horas} h with driver` : (B.redondo ? ' · round trip' : '')}${nParadas()}</span></div><div class="p"><small>${B.paso < 3 && B.modo !== 'hours' ? 'from' : 'Total'}</small><b class="num">${usd(B.paso < 3 && B.modo !== 'hours' ? q.base : q.total)}</b></div></div>`;
  }
  const arriba = () => { window.scrollTo(0, 0); const p = $('#panel'); if (p) p.scrollTo(0, 0); };
  // repinta solo el cuerpo; con mapa=true también la ruta del mapa
  function refrescar(mapa) {
    const body = $('#rdBody'); if (!body) { APP.render(); return; }
    body.innerHTML = cuerpo();
    const t = $('#root .ms-panel .ph-h') || $('#root .topbar .t'); if (t) t.textContent = titulo();
    bind(); if (mapa) dibujar(APP.desktop() ? $('#sideMap') : $('#map')); tarjetaLateral();
  }
  const irPaso = (n) => { B.paso = Math.max(1, Math.min(4, n)); refrescar(false); arriba(); };

  function render() {
    estado(); syncModo();
    const el = APP.screen({ map: true, back: true, title: titulo(), body: `<div class="rd" id="rdBody">${cuerpo()}</div>` });
    // la flecha de arriba regresa un paso; en el paso 1 sale a Inicio
    $$('#root [data-back]').forEach(b => { b.onclick = () => { if (B.paso > 1) irPaso(B.paso - 1); else APP.back(); }; });
    bind(); dibujar(el);
  }

  // ───────── eventos ─────────
  function bind() {
    const on = (sel, ev, f) => { const e = $(sel); if (e) e[ev] = f; };
    $$('#rdBody [data-serv]').forEach(b => { b.onclick = () => {
      const id = b.dataset.serv;
      if (id === 'stay') { if (APP.stay) APP.stay.start({}); else APP.go('stay'); return; }
      if (id !== B.servicio) { setServicio(id); refrescar(true); }
    }; });
    $$('#rdBody [data-pick]').forEach(b => { b.onclick = () => {
      const o = b.dataset.pick === 'origen';
      APP.pickerLugar(o ? 'Pickup' : (horasMode() ? 'First destination' : 'Drop-off'), o ? B.origenId : B.destinoId, (r) => {
        if (!r.lugarId) return; if (o) setLugares(r.lugarId, null); else setLugares(null, r.lugarId); refrescar(true);
      }, { aero: !o, yo: o });
    }; });
    $$('#rdBody [data-stop]').forEach(b => { b.onclick = () => {
      const i = Number(b.dataset.stop);
      APP.pickerLugar('Stop ' + (i + 1), B.paradas[i].lugarId, (r) => { B.paradas[i] = parada(r); refrescar(true); }, { aero: false, libre: true });
    }; });
    $$('#rdBody [data-delstop]').forEach(b => { b.onclick = () => { B.paradas.splice(Number(b.dataset.delstop), 1); refrescar(true); }; });
    on('#rdSwap', 'onclick', () => { setLugares(B.destinoId, B.origenId); refrescar(true); });
    on('#rdAddStop', 'onclick', () => { APP.pickerLugar('Add a stop', null, (r) => { if (B.paradas.length < 3) B.paradas.push(parada(r)); refrescar(true); }, { aero: false, libre: true }); });
    $$('#rdBody [data-cuando]').forEach(b => { b.onclick = () => { B.cuando = b.dataset.cuando; refrescar(false); }; });
    on('#rdFecha', 'oninput', (e) => { B.fecha = e.target.value || APP.hoy; });
    on('#rdHora', 'oninput', (e) => { B.hora = e.target.value || B.hora; });
    on('#rdVuelo', 'oninput', (e) => { B.vuelo = e.target.value; const i = $('#rdVueloInfo'); if (i) i.innerHTML = infoVuelo(); });
    on('#rdRound', 'onclick', () => { B.redondo = !B.redondo; refrescar(false); });
    $$('#rdBody [data-st]').forEach(b => { b.onclick = () => {
      const [k, d] = b.dataset.st.split(','); const min = k === 'pax' ? 1 : (k === 'horas' ? A.db.config.horasMin : 0); const max = k === 'horas' ? 12 : 14;
      B[k] = Math.max(min, Math.min(max, B[k] + Number(d)));
      // si el grupo ya no cabe en la camioneta elegida, se sube sola a una que sí
      const cap = A.TIPOS_VEHICULO[B.vehiculo];
      if (B.pax > cap.pax || B.maletas > cap.maletas) B.vehiculo = B.pax > 12 || B.maletas > 12 ? 'sprinter' : (B.pax > 7 || B.maletas > 7 ? 'hiace' : 'suburban');
      refrescar(false);
    }; });
    $$('#rdBody [data-veh]').forEach(b => { b.onclick = () => { B.vehiculo = b.dataset.veh; refrescar(false); }; });
    on('#rdVehChange', 'onclick', () => irPaso(3));
    $$('#rdBody [data-ex]').forEach(b => { b.onclick = () => { const id = b.dataset.ex; B.extras = B.extras.includes(id) ? B.extras.filter(x => x !== id) : B.extras.concat([id]); B.abierto.extras = true; refrescar(false); }; });
    on('#rdNotas', 'oninput', (e) => { B.notas = e.target.value; });
    $$('#rdBody [data-split]').forEach(b => { b.onclick = () => { const id = b.dataset.split; B.split = true; B.abierto.split = true; B.splitCon = B.splitCon.includes(id) ? B.splitCon.filter(x => x !== id) : B.splitCon.concat([id]); refrescar(false); }; });
    $$('#rdBody [data-more]').forEach(d => { d.ontoggle = () => { B.abierto[d.dataset.more] = d.open; }; });
    on('#rdNext', 'onclick', () => {
      if (B.paso === 1 && B.origenId === B.destinoId) { APP.toast('Pick a different drop-off'); return; }
      if (B.paso === 2) { const f = $('#rdFecha'), h = $('#rdHora'); if (f) B.fecha = f.value || B.fecha; if (h) B.hora = h.value || B.hora; if (B.fecha < APP.hoy) B.fecha = APP.hoy; }
      irPaso(B.paso + 1);
    });
    on('#rdBack', 'onclick', () => irPaso(B.paso - 1));
    on('#rdApple', 'onclick', () => pagar('applepay'));
    on('#rdZelle', 'onclick', () => pagar('zelle'));
    on('#rdOther', 'onclick', () => APP.otrosPagos(pagar));
  }

  // ───────── pago (misma lógica que la app anterior) ─────────
  function pagar(metodo) {
    syncModo(); const q = cotB();
    APP.pagar({ metodo, monto: q.total / partes(), concepto: 'All Cabo Services', onDone: (extra) => reservar(metodo, extra) });
  }
  function reservar(metodo, extra) {
    const aeroSale = B.modo === 'to_airport' && B.cuando === 'schedule';
    const v = A.solicitarViaje({
      clienteId: APP.userId(), fecha: B.fecha, hora: aeroSale ? A.hmDe(A.minutosDe(B.hora) - 180) : B.hora, asap: B.cuando === 'now' && B.modo !== 'hours',
      origenId: B.origenId, destinoId: B.destinoId, modo: B.modo === 'hours' ? 'horas' : (B.redondo ? 'redondo' : 'sencillo'), horas: B.horas, paradas: B.paradas,
      vehiculo: B.vehiculo, pasajeros: B.pax, maletas: B.maletas, vuelo: B.cuando === 'schedule' && B.modo === 'from_airport' ? B.vuelo : '', extras: B.extras,
      notas: (B.notas || '') + (aeroSale && B.vuelo ? ` · Flight ${B.vuelo.toUpperCase()} departs ${A.hora12(B.hora)}` : ''), canal: 'app', pago: { metodo, estado: 'aprobado' },
    });
    A.registrarPago(v.id, metodo, extra || {});
    if (B.split && B.splitCon.length) A.compartirViaje(v.id, B.splitCon, 'igual');
    Object.assign(B, { paso: 1, paradas: [], extras: [], notas: '', split: false, splitCon: [], servicio: 'ride', abierto: { extras: null, split: null } });
    const ch = v.choferId ? A.chofer(v.choferId) : null;
    APP.toast(ch ? `You're all set · ${APP.first(ch.nombre)} is your driver` : "You're all set · finding your driver");
    APP.go('trip', { id: v.id });
  }

  // ───────── API para las demás pantallas ─────────
  // start({}) abre la reserva como estaba; start({claves}) aplica esas claves y vuelve al paso 1
  function start(p) {
    estado(); p = p || {};
    if (Object.keys(p).length) {
      if ((p.servicio === 'ride' || p.servicio === 'hours') && p.servicio !== B.servicio) setServicio(p.servicio);
      if (p.origenId && A.lugar(p.origenId)) B.origenId = p.origenId;
      if (p.destinoId && A.lugar(p.destinoId)) B.destinoId = p.destinoId;
      sinIguales();
      if (p.cuando === 'now' || p.cuando === 'schedule') B.cuando = p.cuando;
      else if (p.origenId || p.destinoId) { if (B.origenId === 'sjd' || B.destinoId === 'sjd') B.cuando = 'schedule'; }
      if (p.fecha) B.fecha = p.fecha < APP.hoy ? APP.hoy : p.fecha;
      if (p.hora) B.hora = p.hora;
      if (p.vuelo != null) B.vuelo = String(p.vuelo);
      if (Array.isArray(p.paradas)) B.paradas = p.paradas.filter(x => x && ((x.lugarId && A.lugar(x.lugarId)) || x.texto)).slice(0, 3).map(parada);
      if (Array.isArray(p.splitCon)) { const ids = APP.amigos().map(a => a.id); B.splitCon = p.splitCon.filter(id => ids.includes(id)); }
      if (p.split != null) B.split = !!p.split; else if (Array.isArray(p.splitCon)) B.split = B.splitCon.length > 0;
      if (B.split) B.abierto.split = true;
      if (horasMode()) { B.paradas = []; B.cuando = 'schedule'; }
      B.paso = 1; syncModo();
    }
    APP.go('ride');
  }

  APP.ride = { start };
  APP.register('ride', { render, side: (el) => { dibujar(el); tarjetaLateral(); }, tab: 'ride', back: 'home', noAutoRender: true });
})();
