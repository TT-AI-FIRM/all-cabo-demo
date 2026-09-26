/* All Cabo Services · app del huésped · Vuelos y hoteles (v3)
   Dos pestañas en un control segmentado:
   - Vuelos: tus vuelos (estancia + viajes con vuelo), rastrear un vuelo (tarjeta tipo pase de abordar con la hora
     de recogida), llegadas de hoy a SJD (SIMULADAS, se dice en pantalla) y un enlace a Google Flights.
   - Hoteles: dónde te hospedas (si hay estancia) y los hoteles curados con foto, con «traslado desde el aeropuerto»
     y «planear mi estancia aquí».
   Escritorio: el mapa lateral enseña aeropuerto + hotel (Vuelos) o los hoteles con foto (Hoteles).
   Ningún dato inventado: vuelos de A.vueloDe/A.db.vuelos, precios de A.cotizar, tiempos de A.distanciaViaje. */
(function () {
  'use strict';
  const APP = window.APP; const A = APP.A; const esc = APP.esc; const $ = APP.$; const $$ = APP.$$;

  // estado de la pantalla (se recuerda mientras la app está abierta)
  const T = { tab: 'flights', num: '', draft: '', sel: null, todas: false };
  const GOOGLE_FLIGHTS = 'https://www.google.com/travel/flights?q=Flights%20to%20SJD';
  const LLEGADAS_CORTO = 6; // cuántas llegadas se ven antes de «ver todas»

  // ───────── ayudantes ─────────
  const espera = () => A.db.config.esperaAeropuerto;
  const sinAnio = (iso) => A.fechaLarga(iso, true).replace(/, \d{4}$/, '');
  const diaTxt = (iso) => iso === APP.hoy ? 'Today' : (iso === A.sumaDias(APP.hoy, 1) ? 'Tomorrow' : sinAnio(iso));
  const aterriza = (f) => A.hmDe(A.minutosDe(f.programada) + (f.minutos || 0));
  const recogida = (f) => A.hmDe(A.minutosDe(aterriza(f)) + espera());
  const codigo = (origen) => { const m = /\(([A-Z0-9]{3})\)/.exec(origen || ''); return m ? m[1] : ''; };
  const ciudad = (origen) => String(origen || '').replace(/\s*\([^)]*\)\s*$/, '');
  const normaliza = (s) => String(s || '').toUpperCase().replace(/\s+/g, ' ').trim();
  const estadoTxt = (f) => f.estado === 'retrasado' ? `Delayed ${f.minutos} min` : (f.estado === 'adelantado' ? `Early ${-f.minutos} min` : 'On time');
  const estadoCls = (f) => f.estado === 'retrasado' ? 'warn' : (f.estado === 'adelantado' ? 'info' : 'ok');
  const estadoPill = (f) => `<span class="pill ${estadoCls(f)}">${estadoTxt(f)}</span>`;

  // llamadas a otras pantallas, protegidas por si ese módulo aún no está cargado
  const ir = {
    ride(pre) { if (APP.ride) APP.ride.start(pre); else APP.toast('Booking is not available right now'); },
    stay(pre) { if (APP.stay) APP.stay.start(pre); else APP.toast('Stay planner is not available right now'); },
    place(id) { if (APP.views.place) APP.go('place', { id }); else APP.toast('Hotel details are not available right now'); },
    trip(id) { if (APP.views.trip) APP.go('trip', { id }); else APP.go('trips'); },
  };
  const pickupDesdeAeropuerto = (extra) => Object.assign({ origenId: 'sjd', destinoId: APP.hotelDe(APP.user()), cuando: 'schedule' }, extra || {});

  // ───────── datos: tus vuelos ─────────
  // viajes próximos con número de vuelo + vuelos de la estancia que no tengan viaje (sin repetir número y fecha)
  function misVuelos(u) {
    const out = []; const vistos = new Set();
    const meter = (x) => { const k = x.num + '|' + x.fecha; if (vistos.has(k)) return; vistos.add(k); out.push(x); };
    APP.misViajes().filter(v => v.vuelo && v.vuelo.num && !APP.done(v) && v.fecha >= APP.hoy).forEach(v => {
      const sale = !!v.vuelo.salida || (v.destinoId === 'sjd' && v.origenId !== 'sjd');
      meter({ num: normaliza(v.vuelo.num), fecha: v.fecha, hora: v.vuelo.programada || null, sale, aerolinea: v.vuelo.aerolinea || '', origen: v.vuelo.origen || '', recoge: v.hora, viajeId: v.id });
    });
    A.itinerariosDe(u.id).filter(it => it.salida.fecha >= APP.hoy).forEach(it => {
      [[it.llegada, false], [it.salida, true]].forEach(([x, sale]) => {
        if (x && x.vuelo && x.fecha >= APP.hoy) meter({ num: normaliza(x.vuelo), fecha: x.fecha, hora: x.hora || null, sale, aerolinea: '', origen: '', recoge: null, viajeId: null });
      });
    });
    return out.sort((a, b) => (a.fecha + (a.hora || '')) < (b.fecha + (b.hora || '')) ? -1 : 1);
  }
  // el estado solo se conoce para las llegadas de hoy que están en la lista simulada de SJD
  const vivo = (x) => (!x.sale && x.fecha === APP.hoy) ? A.vueloDe(x.num) : null;

  // ───────── vista: pestaña Vuelos ─────────
  function filaMiVuelo(x) {
    const f = vivo(x);
    const aer = x.aerolinea || (f ? f.aerolinea : '');
    const hora = f ? `lands ${A.hora12(aterriza(f))}` : (x.hora ? `${x.sale ? 'departs' : 'lands'} ${A.hora12(x.hora)}` : '');
    const rec = x.recoge ? `pickup ${A.hora12(x.recoge)}` : '';
    const linea2 = [diaTxt(x.fecha), hora, rec].filter(Boolean).join(' · ');
    const fin = f ? estadoPill(f) : (x.viajeId ? `<span class="chev">${APP.ICO.chev}</span>` : '');
    const tag = x.viajeId ? 'button' : 'div';
    return `<${tag} class="lrow" ${x.viajeId ? `data-trip="${esc(x.viajeId)}"` : ''}><span class="ic ${x.sale ? '' : 'accent'}">${x.sale ? APP.ICO.planeUp : APP.ICO.plane}</span><div class="tx"><b>${x.sale ? 'Departure' : 'Arrival'} · ${esc(x.num)}${aer ? ' · ' + esc(aer) : ''}</b><span>${esc(linea2)}</span></div>${fin}</${tag}>`;
  }

  function seccionMisVuelos(u) {
    const vs = misVuelos(u);
    const h = `<div class="sec-h"><h2>Your flights</h2>${vs.length ? `<span class="small muted">${vs.length}</span>` : ''}</div>`;
    if (!vs.length) {
      return h + `<div class="card tv-empty"><span class="ic">${APP.ICO.plane}</span><div class="tx"><b>No flights on your upcoming rides</b><span>Add your flight number when you book an airport pickup and it shows up here.</span></div></div><button class="btn sec full tv-emptybtn" id="tvPickup">${APP.ICO.ride} Book an airport pickup</button>`;
    }
    return h + `<div class="list">${vs.map(filaMiVuelo).join('')}</div><p class="tv-note">We track arrival flights on the day. Early or late, your pickup moves with it.</p>`;
  }

  // tarjeta tipo pase de abordar con el vuelo rastreado
  function pase(f) {
    const hotel = APP.lugarN(APP.hotelDe(APP.user()));
    const cambio = f.minutos ? (f.minutos > 0 ? 'late' : 'early') : '';
    return `<div class="card tv-pass" id="tvRes">
      <div class="tv-pass-h"><div class="tv-air"><span class="ic">${APP.ICO.plane}</span><div class="tx"><b>${esc(f.aerolinea)}</b><span>${esc(f.num)} · today</span></div></div>${estadoPill(f)}</div>
      <div class="tv-route"><div><b>${esc(codigo(f.origen) || '—')}</b><span>${esc(ciudad(f.origen))}</span></div><div class="tv-line" aria-hidden="true">${APP.ICO.plane}</div><div class="r"><b>SJD</b><span>Los Cabos</span></div></div>
      <div class="tv-times"><div><small>Scheduled</small><b>${A.hora12(f.programada)}</b></div><div class="r"><small>Expected landing</small><b class="${cambio}">${A.hora12(aterriza(f))}</b></div></div>
      <div class="tv-pick"><span class="rt-dot">${APP.ICO.ride}</span><div class="tx"><small>Your pickup</small><b>${A.hora12(recogida(f))}</b><span>${espera()} min after landing · to ${esc(hotel)}</span></div></div>
      <button class="btn xl full" id="tvBook">Book pickup for this flight</button>
      <p class="tv-note tv-c">We track this flight: if it lands early or late, your pickup moves with it. Flight data is simulated for this demo.</p>
    </div>`;
  }

  function resultado() {
    if (!T.num) return '';
    const f = A.vueloDe(T.num);
    if (f) return pase(f);
    return `<div class="card tv-miss" id="tvRes"><b>${esc(T.num)} isn't among today's simulated arrivals at SJD.</b><span>This demo tracks the ${A.db.vuelos.length} arrivals listed below. Try one of them, for example UA 1234.</span><button class="chip" data-num="UA 1234">${APP.ICO.plane} Try UA 1234</button></div>`;
  }

  function seccionRastreo() {
    return `<div class="sec-h"><h2>Track a flight</h2></div>
      <form class="tv-track" id="tvForm" autocomplete="off"><span class="tv-track-ic">${APP.ICO.search}</span><input id="tvNum" name="flight" value="${esc(T.draft)}" placeholder="Flight number, e.g. UA 1234" autocapitalize="characters" spellcheck="false" enterkeyhint="search" aria-label="Flight number"><button class="go press" type="submit">Track</button></form>
      ${resultado()}`;
  }

  function seccionLlegadas() {
    const lista = A.db.vuelos.slice().sort((a, b) => a.programada < b.programada ? -1 : 1);
    const ver = T.todas ? lista : lista.slice(0, LLEGADAS_CORTO);
    const fila = (f) => { const [hm, ap] = A.hora12(f.programada).split(' ');
      return `<button class="lrow ${normaliza(T.num) === f.num ? 'tv-on' : ''}" data-num="${esc(f.num)}"><span class="tv-hr"><b>${hm}</b><small>${ap}</small></span><div class="tx"><b>${esc(f.num)} · ${esc(f.aerolinea)}</b><span>from ${esc(f.origen)}</span></div>${estadoPill(f)}</button>`; };
    const mas = lista.length > LLEGADAS_CORTO ? `<button class="linkbtn tv-more" id="tvAll">${T.todas ? 'Show fewer' : `Show all ${lista.length} arrivals`}</button>` : '';
    return `<div class="sec-h"><h2>Today's arrivals at SJD</h2><span class="pill">Simulated</span></div>
      <div class="list">${ver.map(fila).join('')}</div>${mas}
      <p class="tv-note">Tap a flight to see its pickup time. These arrivals are sample data for this demo.</p>`;
  }

  function tarjetaGoogle() {
    return `<a class="tv-find press" href="${GOOGLE_FLIGHTS}" target="_blank" rel="noopener"><span class="art"><img src="${APP.fotoSitio('escalade_jet')}" alt="" loading="lazy"></span><span class="tx"><b>Find flights to Los Cabos</b><span>Compare fares to SJD, then track your flight here.</span><span class="tv-ext">Opens Google Flights ${APP.ICO.ext}</span></span></a>`;
  }

  // ───────── vista: pestaña Hoteles ─────────
  function tarjetaEstancia(it) {
    const s = APP.sugs('hotel').find(x => x.lugarId === it.hotelId);
    const foto = s ? APP.fotoSug(s) : `<span class="tv-ic">${APP.ICO.hotel}</span>`;
    const enCurso = it.llegada.fecha <= APP.hoy;
    return `<div class="sec-h"><h2>Where you are staying</h2>${enCurso ? '<span class="pill ok">Now</span>' : ''}</div>
      <div class="card glass tv-stay">
        <div class="tv-stay-top"><span class="thumb">${foto}</span><div class="tx"><b>${esc(APP.lugarN(it.hotelId))}</b><span>${esc(sinAnio(it.llegada.fecha))} → ${esc(sinAnio(it.salida.fecha))}</span><span>${it.noches} nights · ${it.viajeIds.length} rides planned</span></div></div>
        <div class="tv-acts tv-acts-0">${s ? `<button class="btn sm sec" data-place="${esc(s.id)}">Hotel details</button>` : ''}<button class="btn sm" id="tvRides">${APP.ICO.trips} See your rides</button></div>
      </div>`;
  }

  function tarjetaHotel(s) {
    const l = A.lugar(s.lugarId); if (!l) return '';
    const d = A.distanciaViaje('sjd', s.lugarId); const precio = A.cotizar({ origenId: 'sjd', destinoId: s.lugarId }).total;
    return `<article class="tv-hotel ${T.sel === s.id ? 'on' : ''}" id="tvh-${esc(s.id)}">
      <button class="tv-hotel-main" data-place="${esc(s.id)}" aria-label="${esc(s.nombre)} · details">
        <span class="ph">${APP.fotoSug(s)}<span class="tagl badge">${esc(s.tagline)}</span></span>
        <span class="bd"><span class="tx"><b>${esc(s.nombre)}</b><span class="meta">${esc(l.area)} · ${d.min} min from SJD</span></span><span class="pr num">${A.usd(precio)}<small>airport ride</small></span></span>
        <span class="desc">${esc(s.desc)}</span>
      </button>
      <div class="tv-acts"><button class="btn sm" data-air="${esc(s.lugarId)}">${APP.ICO.plane} Ride from the airport</button><button class="btn sm sec" data-plan="${esc(s.lugarId)}">${APP.ICO.cal} Plan my stay here</button></div>
    </article>`;
  }

  function cuerpoHoteles(u) {
    const it = A.itinerariosDe(u.id).filter(x => x.salida.fecha >= APP.hoy)[0];
    const hs = APP.sugs('hotel');
    return `${it ? tarjetaEstancia(it) : ''}
      <div class="sec-h"><h2>Hotels we love</h2><span class="small muted">${hs.length} resorts</span></div>
      ${APP.desktop() ? '' : '<div class="mapwrap tv-map"><div id="tvMap" class="map"></div></div>'}
      <div class="tv-hotels">${hs.map(tarjetaHotel).join('')}</div>
      <p class="demo-note">Curated by All Cabo Services. Photos are illustrative. Ride prices are one way from SJD before extras. This app doesn't book rooms; it plans your rides to and from the hotel.</p>`;
  }

  // ───────── pantalla ─────────
  function render(p) {
    if (p && (p.id === 'flights' || p.id === 'hotels')) T.tab = p.id;
    const u = APP.user();
    const seg = `<div class="seg tv-seg" role="tablist" aria-label="Flights or hotels">${[['flights', 'Flights', 'plane'], ['hotels', 'Hotels', 'hotel']].map(([id, l, ic]) => `<button role="tab" aria-selected="${T.tab === id}" class="${T.tab === id ? 'on' : ''}" data-tab="${id}">${APP.ICO[ic]}${l}</button>`).join('')}</div>`;
    const cuerpo = T.tab === 'hotels' ? cuerpoHoteles(u)
      : `${seccionMisVuelos(u)}${seccionRastreo()}${seccionLlegadas()}${tarjetaGoogle()}`;
    APP.screen({ back: true, title: 'Flights & hotels', body: seg + cuerpo });
    enlazar(u);
    if (T.tab === 'hotels' && !APP.desktop()) APP.mapa.lugares($('#tvMap'), APP.sugs('hotel'), T.sel, (id) => elegirHotel(id, true));
  }

  function enlazar(u) {
    $$('#root [data-tab]').forEach(b => { b.onclick = () => { if (T.tab !== b.dataset.tab) APP.go('travel', { id: b.dataset.tab }); }; });
    $$('#root [data-trip]').forEach(b => { b.onclick = () => ir.trip(b.dataset.trip); });
    $$('#root [data-place]').forEach(b => { b.onclick = () => ir.place(b.dataset.place); });
    $$('#root [data-air]').forEach(b => { b.onclick = () => ir.ride({ origenId: 'sjd', destinoId: b.dataset.air, cuando: 'schedule' }); });
    $$('#root [data-plan]').forEach(b => { b.onclick = () => ir.stay({ hotelId: b.dataset.plan }); });
    $$('#root [data-num]').forEach(b => { b.onclick = () => rastrear(b.dataset.num, true); });
    const on = (id, fn) => { const e = $('#' + id); if (e) e.onclick = fn; };
    on('tvPickup', () => ir.ride(pickupDesdeAeropuerto()));
    on('tvRides', () => APP.go('trips'));
    on('tvAll', () => { T.todas = !T.todas; APP.render(); });
    on('tvBook', () => { const f = A.vueloDe(T.num); if (f) ir.ride(pickupDesdeAeropuerto({ fecha: APP.hoy, hora: f.programada, vuelo: f.num })); });
    const form = $('#tvForm');
    if (form) {
      const inp = $('#tvNum');
      inp.oninput = () => { T.draft = inp.value; };
      form.onsubmit = (e) => { e.preventDefault(); rastrear(inp.value, false); };
    }
  }

  // rastrea un número: guarda el estado, vuelve a pintar y enseña el resultado
  function rastrear(num, desdeLista) {
    const n = normaliza(num); if (!n) { APP.toast('Type a flight number, e.g. UA 1234'); return; }
    T.num = n; T.draft = n;
    const a = document.activeElement; if (a && a.blur) a.blur();
    APP.render();
    const r = $('#tvRes'); if (r) r.scrollIntoView({ behavior: 'smooth', block: desdeLista ? 'center' : 'nearest' });
  }

  // hotel elegido en el mapa: se marca la tarjeta y el marcador
  function elegirHotel(id, desdeMapa) {
    T.sel = id;
    $$('#root .tv-hotel').forEach(x => x.classList.toggle('on', x.id === 'tvh-' + id));
    APP.mapa.marcar(id);
    const c = $('#tvh-' + id); if (desdeMapa && c) c.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // ───────── mapa lateral (escritorio) ─────────
  function side(el) {
    if (T.tab === 'hotels') { APP.mapa.lugares(el, APP.sugs('hotel'), T.sel, (id) => elegirHotel(id, true)); return; }
    APP.mapa.preview(el, 'sjd', APP.hotelDe(APP.user()));
    const f = T.num ? A.vueloDe(T.num) : null; const over = $('#sideOver');
    if (f && over) over.innerHTML = `<div class="card glass tv-over"><span class="ic">${APP.ICO.plane}</span><div class="tx"><b>${esc(f.num)} · lands ${A.hora12(aterriza(f))}</b><span>Your pickup ${A.hora12(recogida(f))} · SJD → ${esc(APP.lugarN(APP.hotelDe(APP.user())))}</span></div>${estadoPill(f)}</div>`;
  }

  APP.register('travel', { render, side, tab: 'home', back: 'home' });
})();
