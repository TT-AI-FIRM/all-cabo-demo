/* All Cabo Services · app del huésped · Amigos y Cuenta (v3)
   Amigos: invitar, aceptar invitaciones, tu círculo con «reservar juntos» (tarifa dividida), viajes compartidos y seguridad.
   Cuenta: perfil, formas de pago, cuenta de evento o empresa, historial, controles del demo y créditos de las fotos. */
(function () {
  'use strict';
  const APP = window.APP; const A = APP.A; const esc = APP.esc; const $ = APP.$; const $$ = APP.$$;

  // ───────── tarjetas de viaje ─────────
  // Usa la tarjeta de Viajes (trips.js) si existe; si no, la tarjeta .trip del sistema de diseño con lo esencial.
  const TONO = { completado: 'ok', a_bordo: 'ok', cancelado: 'bad', no_show: 'bad', solicitado: 'warn', en_camino: 'accent', llegue: 'accent' };
  const tarjetaSimple = (v, extra) => {
    const [, m, d] = v.fecha.split('-'); const est = A.ESTADOS[v.estado] || { en: v.estado }; const t = A.TIPOS_VEHICULO[v.vehiculo];
    return `<button class="trip press" data-trip="${esc(v.id)}">
      <div class="dt"><b>${Number(d)}</b><span>${A.MESES_EN[Number(m) - 1]}</span></div>
      <div class="rt"><b>${esc(APP.lugarN(v.origenId))} → ${esc(APP.lugarN(v.destinoId))}</b>
        <span>${A.hora12(v.hora)}${t ? ' · ' + esc(t.corto) : ''} · ${v.pasajeros} pax</span>
        <div class="pills"><span class="pill ${TONO[v.estado] || 'info'}">${esc(est.en)}</span>${extra || ''}</div></div>
      <div class="amt num">${APP.usd(v.precio.total)}</div></button>`;
  };
  const tarjetaViaje = (v, extra) => (APP.trips && APP.trips.card ? APP.trips.card(v, extra) : tarjetaSimple(v, extra));

  // ───────── amigos ─────────
  // correo de ejemplo para el demo: Emily Chen, salvo que ya esté en tu círculo; entonces otro huésped sin relación contigo
  const correoDemo = (u) => {
    const ocupados = new Set([u.id].concat(u.amigos || []));
    A.db.invitaciones.forEach(i => { if (i.estado === 'pendiente' && (i.de === u.id || i.para === u.id)) { ocupados.add(i.de); ocupados.add(i.para); } });
    const emily = A.db.clientes.find(c => c.email === 'emily.chen@mail.com');
    const c = emily && !ocupados.has(emily.id) ? emily : A.db.clientes.slice(0, 12).find(x => !ocupados.has(x.id));
    return c ? c.email : 'emily.chen@mail.com';
  };

  const amigoTile = (a) => `
    <div class="sc-fr glass">
      <div class="row start sc-fr-top"><span class="avatar">${esc(APP.ini(a.nombre))}</span>${a.vip ? '<span class="pill gold">VIP</span>' : ''}</div>
      <div class="sc-fr-tx"><b>${esc(a.nombre)}</b><span>${esc(a.ciudad)}</span><span>${a.visitas} ${a.visitas === 1 ? 'trip' : 'trips'} with us</span></div>
      <button class="btn sc-fr-btn" data-book="${esc(a.id)}">${APP.ICO.ride}<span>Book together</span></button>
    </div>`;
  // último mosaico: atajo para invitar (llena el hueco si el número de amigos es impar; si no, ocupa la fila entera)
  const invitarTile = () => `<button class="sc-fr sc-fr-add press" id="fAddTile"><span class="ic">${APP.ICO.plus}</span><span class="sc-fr-tx"><b>Invite someone</b><span>Share rides, split fares</span></span></button>`;

  function renderFriends() {
    const u = APP.user(); const am = APP.amigos();
    const recibidas = A.db.invitaciones.filter(i => i.para === u.id && i.estado === 'pendiente' && A.cliente(i.de));
    const enviadas = A.db.invitaciones.filter(i => i.de === u.id && i.estado === 'pendiente');
    const conmigo = A.viajesCompartidosCon(u.id).filter(v => !APP.done(v));
    const mios = APP.misViajes().filter(v => (v.compartidoCon || []).length && !APP.done(v));
    const demo = correoDemo(u);

    const invit = recibidas.length ? `
      <div class="sec-h"><h2>Invitations</h2><span class="pill accent">${recibidas.length} new</span></div>
      <div class="card gold sc-flush">${recibidas.map(i => { const c = A.cliente(i.de); return `
        <div class="lrow"><span class="avatar">${esc(APP.ini(c.nombre))}</span>
          <div class="tx"><b>${esc(c.nombre)}</b><span>${esc(c.ciudad)} · wants to share rides with you</span></div>
          <button class="btn sm" data-acc="${esc(i.id)}">Accept</button></div>`; }).join('')}</div>` : '';

    const circulo = `<div class="sc-circle">${am.map(amigoTile).join('')}${invitarTile()}</div>`;

    const pendientes = enviadas.length ? `
      <div class="list sc-sent">${enviadas.map(i => `
        <div class="lrow"><span class="ic">${APP.ICO.clock}</span>
          <div class="tx"><b>${esc(i.contacto)}</b><span>Invite sent · waiting for them to join</span></div>
          <span class="pill warn">Pending</span></div>`).join('')}</div>` : '';

    const parte = (v) => {
      const p = v.partes && v.partes[u.id];
      if (!p) return `<span class="pill info">by ${esc(APP.first(v.nombre))}</span>`;
      const pagado = p.estado === 'pagado';
      return `<span class="pill ${pagado ? 'ok' : 'warn'}">Your share ${APP.usd(p.monto)} · ${pagado ? 'paid' : 'to pay'}</span>`;
    };
    const con = (v) => `<span class="pill info">With ${v.compartidoCon.map(id => esc(APP.first((A.cliente(id) || {}).nombre || ''))).join(', ')}</span>`;

    const body = `<div class="soc">
      <div class="hello"><h1>Friends<span>&amp; family</span></h1><p>Share a live trip so they know where you are, or split the fare so everyone pays their part.</p></div>
      <div class="card glass">
        <h3>Add a friend</h3>
        <div class="search sc-add"><span>${APP.ICO.user}</span><input id="fInv" type="text" placeholder="Email, phone or name" autocomplete="off" aria-label="Friend's email, phone or name"><button class="btn" id="fGo">Invite</button></div>
        <p class="small muted sc-hint">They get a link to All Cabo Services; once they accept, you can share rides and split fares.</p>
        <div class="row start sc-demo"><span class="tiny faint">Demo · try</span><button class="sc-try press" data-try="${esc(demo)}">${esc(demo)}</button></div>
      </div>
      ${invit}
      <div class="sec-h"><h2>Your circle</h2><span class="muted small">${am.length} ${am.length === 1 ? 'friend' : 'friends'}</span></div>
      ${circulo}
      ${pendientes}
      ${conmigo.length ? `<div class="sec-h"><h2>Shared with you</h2></div><div class="sc-trips">${conmigo.map(v => tarjetaViaje(v, parte(v))).join('')}</div>` : ''}
      ${mios.length ? `<div class="sec-h"><h2>Your rides shared with friends</h2></div><div class="sc-trips">${mios.map(v => tarjetaViaje(v, con(v))).join('')}</div>` : ''}
      <div class="card tint sc-safe"><span class="ic">${APP.ICO.share}</span><div><h3>Safety first</h3><p class="small muted">Every ride has a live link with the car on the map, the driver's name and the plate. Share it with anyone from the trip screen; no account needed on their side.</p></div></div>
    </div>`;
    APP.screen({ body });

    const inp = $('#fInv');
    const invitar = () => {
      const t = inp.value.trim();
      if (!t) { inp.focus(); APP.toast('Type an email, phone or name'); return; }
      const antes = new Set(u.amigos || []);
      const r = A.invitarAmigo(u.id, t);
      if (r.estado === 'agregado') APP.toast(antes.has(r.cliente.id) ? `${r.cliente.nombre} is already in your circle` : `${r.cliente.nombre} is now in your circle`);
      else APP.toast('Invitation sent (simulated)');
      APP.render();
    };
    $('#fGo').onclick = invitar;
    inp.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); invitar(); } };
    $$('#root [data-try]').forEach(b => { b.onclick = () => { inp.value = b.dataset.try; inp.focus(); }; });
    $('#fAddTile').onclick = () => { inp.scrollIntoView({ behavior: 'smooth', block: 'center' }); inp.focus({ preventScroll: true }); };
    $$('#root [data-acc]').forEach(b => { b.onclick = () => { A.aceptarInvitacion(b.dataset.acc); APP.toast('Friend added'); APP.render(); }; });
    $$('#root [data-book]').forEach(b => { b.onclick = () => {
      const a = A.cliente(b.dataset.book); if (!a) return;
      if (!APP.ride) { APP.toast('Booking is not available right now'); return; }
      const cena = APP.sugs('restaurant').find(s => A.lugar(s.lugarId));
      APP.ride.start({ servicio: 'ride', split: true, splitCon: [a.id], origenId: APP.hotelDe(u), destinoId: cena ? cena.lugarId : 'ff', cuando: 'schedule', hora: '18:30' });
      APP.toast('Fare will be split with ' + APP.first(a.nombre));
    }; });
    $$('#root [data-trip]').forEach(b => { b.onclick = () => APP.go('trip', { id: b.dataset.trip }); });
  }

  // ───────── cuenta ─────────
  const TIPO_CUENTA = { Boda: 'Wedding', Corporativo: 'Corporate' };
  const kv = (k, v) => `<div class="kv"><span>${k}</span><span>${v}</span></div>`;

  // créditos de las fotos (window.ACS_CREDITOS, si existe): acepta lista u objeto por id, en español o inglés
  const creditos = () => {
    const c = window.ACS_CREDITOS; if (!c || typeof c !== 'object') return [];
    const lista = Array.isArray(c) ? c : Object.keys(c).map(k => (c[k] && typeof c[k] === 'object' ? Object.assign({ id: k }, c[k]) : null));
    return lista.filter(x => x && typeof x === 'object').map(x => {
      const s = A.sugerencia ? A.sugerencia(x.sugId || x.id) : null;
      const url = x.url || x.link || x.fuente || x.source || x.href || '';
      return { lugar: x.lugar || x.place || x.nombre || x.name || x.titulo || x.title || (s && s.nombre) || '', autor: x.autor || x.author || x.by || '', licencia: x.licencia || x.license || '', url: /^https?:\/\//i.test(url) ? url : '' };
    }).filter(x => x.lugar || x.autor);
  };
  const seccionCreditos = () => {
    const cs = creditos(); if (!cs.length) return '';
    const fila = (x) => { const dentro = `<div class="tx"><b>${esc(x.lugar || 'Photo')}</b><span>${esc([x.autor, x.licencia].filter(Boolean).join(' · ') || 'Source')}</span></div>`;
      return x.url ? `<a class="lrow" href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${dentro}<span class="chev">${APP.ICO.ext}</span></a>` : `<div class="lrow">${dentro}</div>`; };
    return `<details class="more sc-credits"><summary><span>Photo credits <span class="muted small">· ${cs.length}</span></span><span class="chev">${APP.ICO.down}</span></summary><div class="body"><p class="small muted">Photos of places come from their authors under the licenses shown. Tap one to see the source.</p><div class="list sc-cr-list">${cs.map(fila).join('')}</div></div></details>`;
  };

  function renderAccount() {
    const u = APP.user();
    const cta = u.cuentaId ? (A.db.cuentas || []).find(x => x.id === u.cuentaId) : null;
    const hechos = APP.misViajes().filter(v => v.estado === 'completado').length;
    const body = `<div class="soc">
      <div class="card glass sc-hero">
        <span class="avatar lg">${esc(APP.ini(u.nombre))}</span>
        <div class="sc-hero-tx"><h1>${esc(u.nombre)}</h1><p>${esc(u.ciudad)} · ${u.visitas} ${u.visitas === 1 ? 'trip' : 'trips'} with us</p>${u.vip ? `<span class="pill gold">${APP.ICO.star}VIP guest</span>` : ''}</div>
      </div>

      <div class="sec-h"><h2>Profile</h2></div>
      <div class="card">
        ${kv('Name', esc(u.nombre))}${kv('Phone', esc(u.tel))}${kv('Email', esc(u.email))}
        ${kv('Usual hotel', esc(APP.lugarN(APP.hotelDe(u))))}${kv('Preferences', esc(u.preferencias || 'None yet'))}
      </div>

      <div class="sec-h"><h2>Payment</h2></div>
      <div class="list">
        <div class="lrow"><span class="ic sc-apple" aria-hidden="true"></span><div class="tx"><b>Apple Pay</b><span>Face ID · one tap</span></div><span class="pill ok">Default</span></div>
        <div class="lrow"><span class="ic sc-zelle" aria-hidden="true">Z</span><div class="tx"><b>Zelle</b><span>${esc(u.email)}</span></div></div>
        <div class="lrow"><span class="ic sc-visa" aria-hidden="true">VISA</span><div class="tx"><b>Visa •••• 4242</b><span>Exp 09/28</span></div></div>
      </div>

      ${cta ? `<div class="card gold sc-cta"><span class="eyebrow">${esc(TIPO_CUENTA[cta.tipo] || cta.tipo)} account</span><b>${esc(cta.nombre)}</b><p class="small muted">Coordinator ${esc(cta.contacto)} · one monthly invoice. Your rides are billed to the account.</p></div>` : ''}

      <div class="sec-h"><h2>With All Cabo Services</h2></div>
      <div class="sc-stats">
        <div class="sc-stat"><span class="eyebrow">Completed rides</span><b class="num">${hechos}</b></div>
        <div class="sc-stat"><span class="eyebrow">Spent with us</span><b class="num">${APP.usd(u.gasto)}</b></div>
      </div>
      <p class="small muted sc-note">Receipts per trip by email. Add this app to your home screen for one-tap booking.</p>

      <div class="sec-h"><h2>Demo controls</h2></div>
      <div class="card">
        <div class="grid2"><button class="btn sec" id="acDev">${APP.desktop() ? 'Phone layout' : 'Desktop layout'}</button><button class="btn ghost" id="acReset">Reset demo data</button></div>
        <p class="tiny muted sc-note">The app detects the device on its own; this switch is only to preview both layouts.</p>
      </div>

      ${seccionCreditos()}
      <p class="demo-note">Demo data lives in this browser only. Payments, WhatsApp and emails are simulated.</p>
    </div>`;
    APP.screen({ body });
    $('#acDev').onclick = () => { A.fijarDispositivo(APP.desktop() ? 'mobile' : 'desktop'); APP.render(); };
    $('#acReset').onclick = () => { if (confirm('Reset all demo data in this browser?')) { A.reset(); APP.toast('Demo data reset'); APP.render(); } };
  }

  APP.register('friends', { render: renderFriends, tab: 'friends' });
  APP.register('account', { render: renderAccount, tab: 'account' });
})();
