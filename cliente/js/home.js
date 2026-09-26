/* All Cabo Services · app del huésped · Inicio (v3)
   Saludo, «¿a dónde?», viaje en curso, los cuatro accesos (viaje, vuelos y hoteles, qué hacer, comida),
   estancia y dos carruseles de sugerencias. Es la pantalla modelo: las demás siguen su forma. */
(function () {
  'use strict';
  const APP = window.APP; const A = APP.A; const esc = APP.esc; const $$ = APP.$$;

  const tarjeta = (s) => { const l = A.lugar(s.lugarId); return `<button class="pcard press" data-place="${s.id}"><div class="ph">${APP.fotoSug(s)}<span class="tagl badge">${esc(s.tagline)}</span></div><div class="bd"><b>${esc(s.nombre)}</b><span>${esc(l ? l.area : '')}${l ? ' · ' + APP.kmTxt(l.pos) : ''}</span></div></button>`; };
  const mosaico = (go, img, titulo, sub) => `<button class="tile press" data-go="${go}"><span class="art">${img}</span><b>${titulo}</b><span>${sub}</span></button>`;

  function render() {
    const u = APP.user(); const v = APP.proximoViaje(); const min = APP.minCerca();
    const its = A.itinerariosDe(u.id).filter(it => it.salida.fecha >= APP.hoy);
    const rest = APP.sugs('restaurant'); const act = APP.sugs('activity');
    const fotoDe = (id) => { const s = A.sugerencia(id); return s ? APP.fotoSug(s) : ''; };
    let viaje = '';
    if (v) {
      const [t1, t2] = APP.etaLineas ? APP.etaLineas(v) : [APP.lugarN(v.destinoId), ''];
      const c = v.choferId ? A.chofer(v.choferId) : null;
      viaje = `<button class="etacard press home-trip" data-trip="${v.id}" style="width:100%;text-align:left;margin-top:14px;"><div style="min-width:0;"><b>${esc(t1)}</b><span class="eta2">${esc(t2)}</span></div>${c ? `<span class="avatar">${esc(APP.ini(c.nombre))}</span>` : ''}</button>`;
    }
    const estancia = its.length ? `<button class="lrow card home-stay press" data-go="trips"><span class="ic accent">${APP.ICO.stay}</span><div class="tx"><b>Your stay at ${esc(APP.lugarN(its[0].hotelId))}</b><span>${its[0].noches} nights · ${its[0].viajeIds.length} rides planned</span></div><span class="chev">${APP.ICO.chev}</span></button>` : '';
    const body = `
      <div class="hello"><h1>Hey ${esc(APP.first(u.nombre))}<span>${u.visitas > 1 ? 'Welcome back!' : 'Welcome to Los Cabos!'}</span></h1></div>
      <button class="where press" id="hWhere"><span class="dotme"></span><span class="q">Where to?<small>From SJD Airport · demo location</small></span>${min ? `<span class="eta">${min} min</span>` : ''}<span class="go">Book a ride</span></button>
      ${viaje}
      <div class="tiles">
        ${mosaico('ride', `<img src="${APP.fotoVeh('suburban')}" alt="" loading="lazy">`, 'Find a ride', 'Airport, dinner, anywhere')}
        ${mosaico('travel', `<img src="${APP.fotoSitio('escalade_jet')}" alt="" loading="lazy">`, 'Flights & hotels', 'Track your flight, pick a resort')}
        ${mosaico('todo', fotoDe('s_arco'), 'Things to do', 'Beaches, boats, golf & more')}
        ${mosaico('food', fotoDe('s_ed'), 'Find food', 'Restaurants we love')}
      </div>
      <button class="ask press" id="hStay"><i></i><span><b>Plan your whole stay</b> · arrival, dinners, departure, one payment</span></button>
      ${estancia}
      <div class="sec-h"><h2>Dinner in Los Cabos</h2><button data-go="food">See all</button></div>
      <div class="hscroll">${rest.map(tarjeta).join('')}</div>
      <div class="sec-h"><h2>Things to do</h2><button data-go="todo">See all</button></div>
      <div class="hscroll">${act.map(tarjeta).join('')}</div>
      <p class="demo-note">Curated by All Cabo Services. Photos are illustrative; weather is live for Cabo San Lucas.</p>`;
    APP.screen({ body });
    $$('#root [data-go]').forEach(b => { b.onclick = () => { const g = b.dataset.go; if (g === 'ride' && APP.ride) APP.ride.start({}); else APP.go(g); }; });
    $$('#root [data-place]').forEach(b => { b.onclick = () => APP.go('place', { id: b.dataset.place }); });
    $$('#root [data-trip]').forEach(b => { b.onclick = () => APP.go('trip', { id: b.dataset.trip }); });
    APP.$('#hWhere').onclick = (e) => {
      if (e.target.closest('.go')) { APP.ride.start({}); return; }
      APP.pickerLugar('Where to?', null, (r) => { if (r.lugarId) APP.ride.start({ origenId: APP.MI_LUGAR, destinoId: r.lugarId === APP.MI_LUGAR ? APP.hotelDe(u) : r.lugarId }); }, { aero: true, yo: false });
    };
    APP.$('#hStay').onclick = () => { if (APP.stay) APP.stay.start({}); else APP.go('stay'); };
  }

  APP.register('home', { render, tab: 'home' });
})();
