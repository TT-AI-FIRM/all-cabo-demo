/* All Cabo Services · demo · núcleo compartido (datos, tarifas, despacho, simulación de GPS, métricas)
   Datos ilustrativos con semilla fija. Pagos, vuelos, WhatsApp y GPS de la flota son SIMULADOS (el GPS del teléfono del chofer puede ser real si lo permite). */
(function () {
  'use strict';
  const KEY = 'acs_demo_v4';
  const R = window.ACS_RUTAS || { puntos: {}, rutas: {} };

  // ───────────────────────── utilidades ─────────────────────────
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const pad = (n) => String(n).padStart(2, '0');
  const fechaISO = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const hoy = () => fechaISO(new Date());
  const ahoraHM = () => { const d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const MESES_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const DIAS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  function fechaLarga(iso, en) { const [y, m, d] = iso.split('-').map(Number); const dt = new Date(y, m - 1, d); return en ? `${DIAS_EN[dt.getDay()].slice(0, 3)}, ${MESES_EN[m - 1]} ${d}, ${y}` : `${DIAS[dt.getDay()]} ${d} de ${MESES[m - 1].toLowerCase()} de ${y}`; }
  const usd = (v, dec = 0) => '$' + Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  const mxn = (v) => '$' + Math.round(v || 0).toLocaleString('es-MX') + ' MXN';
  const pct = (v, d = 1) => (Number(v) || 0).toFixed(d) + '%';
  let seq = 0; const uid = (p) => p + '_' + Date.now().toString(36) + (seq++).toString(36);
  function haversine(a, b) { const Rk = 6371, toR = Math.PI / 180; const dLat = (b[0] - a[0]) * toR, dLng = (b[1] - a[1]) * toR; const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * toR) * Math.cos(b[0] * toR) * Math.sin(dLng / 2) ** 2; return 2 * Rk * Math.asin(Math.sqrt(s)); }
  const minutosDe = (hm) => { const [h, m] = String(hm || '00:00').split(':').map(Number); return h * 60 + m; };
  const hmDe = (min) => { min = ((Math.round(min) % 1440) + 1440) % 1440; return pad(Math.floor(min / 60)) + ':' + pad(min % 60); };
  const hora12 = (hm) => { const [h, m] = hm.split(':').map(Number); const s = h >= 12 ? 'PM' : 'AM'; return `${((h + 11) % 12) + 1}:${pad(m)} ${s}`; };
  const sumaDias = (iso, n) => { const [y, m, d] = iso.split('-').map(Number); const dt = new Date(y, m - 1, d + n); return fechaISO(dt); };

  // ───────────────────────── catálogos ─────────────────────────
  const ZONAS = {
    sj: { id: 'sj', en: 'San José del Cabo & Corridor', es: 'San José y Corredor', sencillo: 100, redondo: 200 },
    csl: { id: 'csl', en: 'Cabo San Lucas & Pacific', es: 'Cabo San Lucas y Pacífico', sencillo: 125, redondo: 250 },
  };
  const NODOS = R.puntos; // id → [lat, lng]
  // Ubicaciones aproximadas (para el demo). nodo = punto de la red de rutas al que se conecta el lugar.
  const LUGARES = [
    { id: 'sjd', nombre: 'Los Cabos International Airport (SJD)', corto: 'SJD Airport', tipo: 'aeropuerto', nodo: 'sjd', zona: null, area: 'Airport', pos: [23.1518, -109.7211] },
    { id: 'oo', nombre: 'One&Only Palmilla', tipo: 'hotel', nodo: 'palmilla', zona: 'sj', area: 'Corridor', pos: [23.0000, -109.7200] },
    { id: 'lv', nombre: 'Las Ventanas al Paraíso', tipo: 'hotel', nodo: 'palmilla', zona: 'sj', area: 'Corridor', pos: [22.9930, -109.7420] },
    { id: 'zo', nombre: 'Zoëtry Casa del Mar', tipo: 'hotel', nodo: 'palmilla', zona: 'sj', area: 'Corridor', pos: [22.9950, -109.7500] },
    { id: 'mq', nombre: 'Marquis Los Cabos', tipo: 'hotel', nodo: 'palmilla', zona: 'sj', area: 'Corridor', pos: [22.9880, -109.7600] },
    { id: 'hi', nombre: 'Hilton Los Cabos', tipo: 'hotel', nodo: 'palmilla', zona: 'sj', area: 'Corridor', pos: [22.9900, -109.7550] },
    { id: 'lb', nombre: 'Le Blanc Spa Resort', tipo: 'hotel', nodo: 'palmilla', zona: 'sj', area: 'Corridor', pos: [22.9860, -109.7650] },
    { id: 'gv', nombre: 'Grand Velas Los Cabos', tipo: 'hotel', nodo: 'chileno', zona: 'sj', area: 'Corridor', pos: [22.9750, -109.7800] },
    { id: 'so', nombre: 'Solaz, a Luxury Collection', tipo: 'hotel', nodo: 'chileno', zona: 'sj', area: 'Corridor', pos: [22.9600, -109.7950] },
    { id: 'cb', nombre: 'Chileno Bay Resort', tipo: 'hotel', nodo: 'chileno', zona: 'sj', area: 'Corridor', pos: [22.9480, -109.8100] },
    { id: 'mo', nombre: 'Montage Los Cabos', tipo: 'hotel', nodo: 'chileno', zona: 'sj', area: 'Corridor', pos: [22.9470, -109.8150] },
    { id: 'es', nombre: 'Esperanza, Auberge Resorts', tipo: 'hotel', nodo: 'chileno', zona: 'sj', area: 'Corridor', pos: [22.9200, -109.8500] },
    { id: 'sp', nombre: 'Secrets Puerto Los Cabos', tipo: 'hotel', nodo: 'plc', zona: 'sj', area: 'San José', pos: [23.0600, -109.6650] },
    { id: 'jw', nombre: 'JW Marriott Los Cabos', tipo: 'hotel', nodo: 'plc', zona: 'sj', area: 'San José', pos: [23.0580, -109.6620] },
    { id: 'vi', nombre: 'Viceroy Los Cabos', tipo: 'hotel', nodo: 'sanjose', zona: 'sj', area: 'San José', pos: [23.0470, -109.6850] },
    { id: 'hz', nombre: 'Hyatt Ziva Los Cabos', tipo: 'hotel', nodo: 'sanjose', zona: 'sj', area: 'San José', pos: [23.0440, -109.6900] },
    { id: 'wa', nombre: 'Waldorf Astoria Los Cabos Pedregal', tipo: 'hotel', nodo: 'pedregal', zona: 'csl', area: 'Cabo San Lucas', pos: [22.8760, -109.9230] },
    { id: 'gs', nombre: "Grand Solmar Land's End", tipo: 'hotel', nodo: 'pedregal', zona: 'csl', area: 'Cabo San Lucas', pos: [22.8730, -109.9050] },
    { id: 'br', nombre: 'Breathless Cabo San Lucas', tipo: 'hotel', nodo: 'csl', zona: 'csl', area: 'Cabo San Lucas', pos: [22.8930, -109.9000] },
    { id: 'me', nombre: 'ME Cabo', tipo: 'hotel', nodo: 'csl', zona: 'csl', area: 'Cabo San Lucas', pos: [22.8890, -109.9060] },
    { id: 'ba', nombre: 'Bahia Hotel & Beach House', tipo: 'hotel', nodo: 'csl', zona: 'csl', area: 'Cabo San Lucas', pos: [22.8900, -109.9020] },
    { id: 'vle', nombre: 'Villa La Estancia', tipo: 'hotel', nodo: 'csl', zona: 'csl', area: 'Cabo San Lucas', pos: [22.8960, -109.8990] },
    { id: 'pbp', nombre: 'Pueblo Bonito Pacifica', tipo: 'hotel', nodo: 'pacifico', zona: 'csl', area: 'Pacific', pos: [22.9200, -109.9850] },
    { id: 'pbs', nombre: 'Pueblo Bonito Sunset Beach', tipo: 'hotel', nodo: 'pacifico', zona: 'csl', area: 'Pacific', pos: [22.9160, -109.9800] },
    { id: 'hr', nombre: 'Hard Rock Hotel Los Cabos', tipo: 'hotel', nodo: 'diamante', zona: 'csl', area: 'Pacific', pos: [22.9550, -110.0400] },
    { id: 'no', nombre: 'Nobu Hotel Los Cabos', tipo: 'hotel', nodo: 'diamante', zona: 'csl', area: 'Pacific', pos: [22.9520, -110.0450] },
    { id: 'di', nombre: 'Diamante Cabo San Lucas', tipo: 'hotel', nodo: 'diamante', zona: 'csl', area: 'Pacific', pos: [22.9480, -110.0480] },
    { id: 'qv', nombre: 'Quivira · Rancho San Lucas', tipo: 'hotel', nodo: 'diamante', zona: 'csl', area: 'Pacific', pos: [22.9350, -110.0300] },
    { id: 'villa_sj', nombre: 'Private villa · Corridor / San José', tipo: 'villa', nodo: 'palmilla', zona: 'sj', area: 'Corridor', pos: [23.0080, -109.7150] },
    { id: 'villa_csl', nombre: 'Private villa · Cabo San Lucas / Pacific', tipo: 'villa', nodo: 'pedregal', zona: 'csl', area: 'Cabo San Lucas', pos: [22.8800, -109.9300] },
  ];
  const lugar = (id) => LUGARES.find(l => l.id === id);
  const TIPOS_VEHICULO = {
    suburban: { id: 'suburban', nombre: 'Chevrolet Suburban', corto: 'Suburban', pax: 7, maletas: 7, icono: '🚙' },
    escalade: { id: 'escalade', nombre: 'Cadillac Escalade', corto: 'Escalade', pax: 6, maletas: 6, icono: '🚘' },
    hiace: { id: 'hiace', nombre: 'Toyota Hiace', corto: 'Hiace', pax: 12, maletas: 12, icono: '🚐' },
    sprinter: { id: 'sprinter', nombre: 'Mercedes-Benz Sprinter', corto: 'Sprinter', pax: 14, maletas: 16, icono: '🚐' },
  };
  const EXTRAS = [
    { id: 'host', en: 'Host driver · bilingual concierge on board', es: 'Chofer anfitrión', precio: 25 },
    { id: 'super', en: 'Grocery stop on the way', es: 'Parada al súper', precio: 45 },
    { id: 'cervezas', en: 'Cold beers on board', es: 'Cervezas frías', precio: 25 },
    { id: 'silla', en: 'Child seat', es: 'Silla para bebé', precio: 0, nota: 'on request' },
  ];
  const CANALES = { app: 'App / web', whatsapp: 'WhatsApp', concierge: 'Concierge de hotel', planner: 'Wedding planner', repeticion: 'Cliente que repite', telefono: 'Teléfono' };
  const ESTADOS = {
    solicitado: { es: 'Solicitado', en: 'Requested', color: '#F1C453' }, asignado: { es: 'Asignado', en: 'Driver assigned', color: '#8FD0FF' }, aceptado: { es: 'Aceptado', en: 'Confirmed by driver', color: '#8FD0FF' },
    en_camino: { es: 'En camino', en: 'Driver en route', color: '#E4B15C' }, llegue: { es: 'Chofer en el punto', en: 'Driver arrived', color: '#E4B15C' }, a_bordo: { es: 'A bordo', en: 'On board', color: '#5FBF8A' },
    completado: { es: 'Completado', en: 'Completed', color: '#5FBF8A' }, cancelado: { es: 'Cancelado', en: 'Cancelled', color: '#FB7185' }, no_show: { es: 'No llegó', en: 'No-show', color: '#FB7185' },
  };
  const METODOS = { applepay: { en: 'Apple Pay', es: 'Apple Pay' }, tarjeta: { en: 'Card', es: 'Tarjeta' }, zelle: { en: 'Zelle', es: 'Zelle' }, transferencia: { en: 'Bank transfer', es: 'Transferencia' }, efectivo: { en: 'Cash on arrival', es: 'Efectivo' } };
  const ACTIVOS = ['asignado', 'aceptado', 'en_camino', 'llegue', 'a_bordo'];
  const EN_RUTA = ['en_camino', 'llegue', 'a_bordo'];

  // ───────────────────────── red de rutas ─────────────────────────
  const ARISTAS = {}; // nodo → [{a, km}]
  Object.entries(R.rutas).forEach(([k, r]) => { const [a, b] = k.split('-'); (ARISTAS[a] = ARISTAS[a] || []).push({ a: b, km: r.km }); (ARISTAS[b] = ARISTAS[b] || []).push({ a: a, km: r.km }); });
  function tramo(a, b) { const d = R.rutas[a + '-' + b]; if (d) return { pts: d.pts, km: d.km, min: d.min }; const i = R.rutas[b + '-' + a]; if (i) return { pts: i.pts.slice().reverse(), km: i.km, min: i.min }; return null; }
  function caminoNodos(a, b) { // Dijkstra en 9 nodos
    if (a === b) return [a]; const dist = { [a]: 0 }, prev = {}, vistos = new Set(); const nodos = Object.keys(NODOS);
    while (true) { let u = null; nodos.forEach(n => { if (!vistos.has(n) && dist[n] != null && (u === null || dist[n] < dist[u])) u = n; }); if (u === null || u === b) break; vistos.add(u); (ARISTAS[u] || []).forEach(e => { const nd = dist[u] + e.km; if (dist[e.a] == null || nd < dist[e.a]) { dist[e.a] = nd; prev[e.a] = u; } }); }
    if (dist[b] == null) return [a, b]; const out = [b]; let c = b; while (c !== a) { c = prev[c]; out.unshift(c); } return out;
  }
  function rutaEntre(a, b) { // → {pts:[[lat,lng]...], km, min}
    const nodos = caminoNodos(a, b); if (nodos.length === 1) return { pts: [NODOS[a]], km: 0, min: 0 };
    let pts = [], km = 0, min = 0;
    for (let i = 0; i < nodos.length - 1; i++) { const t = tramo(nodos[i], nodos[i + 1]); if (!t) { pts.push(NODOS[nodos[i]], NODOS[nodos[i + 1]]); km += haversine(NODOS[nodos[i]], NODOS[nodos[i + 1]]) * 1.3; min += km; continue; } pts = pts.concat(i ? t.pts.slice(1) : t.pts); km += t.km; min += t.min; }
    return { pts, km: Math.round(km * 10) / 10, min: Math.round(min) };
  }
  function rutaLugares(desdePos, desdeNodo, hastaLugar) { // posición actual → nodo → ruta → lugar exacto
    const r = rutaEntre(desdeNodo, hastaLugar.nodo); let pts = r.pts.slice(); let km = r.km;
    if (desdePos && haversine(desdePos, pts[0]) > 0.05) { km += haversine(desdePos, pts[0]); pts.unshift(desdePos); }
    const fin = hastaLugar.pos; if (haversine(pts[pts.length - 1], fin) > 0.05) { km += haversine(pts[pts.length - 1], fin); pts.push(fin); }
    return { pts, km: Math.round(km * 10) / 10, min: Math.max(2, Math.round(r.min + (km - r.km) / 40 * 60)) };
  }
  function distanciaViaje(origenId, destinoId) { const o = lugar(origenId), d = lugar(destinoId); const r = rutaEntre(o.nodo, d.nodo); return { km: Math.round((r.km + haversine(o.pos, NODOS[o.nodo]) + haversine(d.pos, NODOS[d.nodo])) * 10) / 10, min: r.min + 4 }; }
  const usaAutopista = (origenId, destinoId) => { const z = [lugar(origenId), lugar(destinoId)].map(l => l.nodo); return z.includes('sjd') && z.some(n => ['csl', 'pedregal', 'pacifico', 'diamante', 'chileno'].includes(n)); };

  // ───────────────────────── semilla ─────────────────────────
  const NOMBRES = ['Sarah Thompson', 'Michael Thompson', 'Emily Chen', 'David Miller', 'Jessica Nguyen', "Ryan O'Connor", 'Ashley Martinez', 'Brandon Lee', 'Lauren Walsh', 'Kevin Patel', 'Megan Foster', 'Tyler Brooks', 'Rachel Kim', 'Jason Rivera', 'Amanda Cole', 'Chris Hoffman', 'Natalie Grant', 'Eric Sullivan', 'Hannah Price', 'Daniel Reyes', 'Olivia Bennett', 'Matthew Ward', 'Sophia Ross', 'Andrew Hayes', 'Chloe Morgan', 'Justin Park', 'Victoria Adams', 'Nathan Cooper', 'Isabella Cruz', 'Jordan Blake', 'Grace Turner', 'Ethan Wright', 'Madison Hill', 'Logan Scott', 'Avery Long', 'Caleb Young', 'Zoe Campbell', 'Aaron Mitchell', 'Lily Perez', 'Connor Evans', 'Julia Stewart', 'Blake Sanders', 'Ella Morris', 'Hunter Rogers', 'Mia Reed', 'Owen Cook', 'Harper Bell', 'Liam Murphy', 'Ava Bailey', 'Noah Kelly', 'Emma Howard', 'Mason Torres', 'Charlotte Ward', 'Lucas Peterson', 'Amelia Gray', 'Henry James', 'Evelyn Watson', 'Jack Brooks', 'Scarlett Hughes', 'Sebastian Wood'];
  const CIUDADES = [['Los Angeles, CA', 'US'], ['Dallas, TX', 'US'], ['Phoenix, AZ', 'US'], ['Denver, CO', 'US'], ['Seattle, WA', 'US'], ['San Diego, CA', 'US'], ['Chicago, IL', 'US'], ['Calgary, AB', 'CA'], ['Vancouver, BC', 'CA'], ['Toronto, ON', 'CA'], ['Ciudad de México', 'MX'], ['Austin, TX', 'US'], ['New York, NY', 'US'], ['San Francisco, CA', 'US']];
  const CHOFERES = [
    { id: 'd1', nombre: 'Luis Ramírez', tel: '6241001122', vehiculoId: 'v4', nodo: 'palmilla', enLinea: true, calificacion: 4.9, ingreso: 2016, licenciaVence: '2027-03-14', idiomas: 'ES · EN' },
    { id: 'd2', nombre: 'Ana Castro', tel: '6241002233', vehiculoId: 'v1', nodo: 'csl', enLinea: true, calificacion: 5.0, ingreso: 2019, licenciaVence: '2026-11-02', idiomas: 'ES · EN' },
    { id: 'd3', nombre: 'Jorge Peña', tel: '6241003344', vehiculoId: 'v3', nodo: 'sjd', enLinea: true, calificacion: 4.8, ingreso: 2014, licenciaVence: '2028-06-30', idiomas: 'ES · EN' },
    { id: 'd4', nombre: 'Miguel Ángel Ruiz', tel: '6241004455', vehiculoId: 'v7', nodo: 'chileno', enLinea: true, calificacion: 4.7, ingreso: 2021, licenciaVence: '2027-09-21', idiomas: 'ES · EN' },
    { id: 'd5', nombre: 'Daniela Ortega', tel: '6241005566', vehiculoId: 'v2', nodo: 'sanjose', enLinea: true, calificacion: 4.9, ingreso: 2022, licenciaVence: '2026-10-08', idiomas: 'ES · EN · FR' },
    { id: 'd6', nombre: 'Roberto Sandoval', tel: '6241006677', vehiculoId: 'v6', nodo: 'pedregal', enLinea: false, calificacion: 4.8, ingreso: 2012, licenciaVence: '2027-01-19', idiomas: 'ES · EN' },
  ];
  const AEROLINEAS = [['UA', 'United', 'Los Angeles (LAX)'], ['AA', 'American', 'Dallas (DFW)'], ['AS', 'Alaska', 'Seattle (SEA)'], ['DL', 'Delta', 'Atlanta (ATL)'], ['WN', 'Southwest', 'Denver (DEN)'], ['WS', 'WestJet', 'Calgary (YYC)'], ['AC', 'Air Canada', 'Vancouver (YVR)'], ['AM', 'Aeroméxico', 'Ciudad de México (MEX)'], ['Y4', 'Volaris', 'Guadalajara (GDL)'], ['UA', 'United', 'San Francisco (SFO)'], ['AA', 'American', 'Phoenix (PHX)'], ['DL', 'Delta', 'Salt Lake City (SLC)']];

  function semilla() {
    const rnd = mulberry32(2026_0914); const pick = (a) => a[Math.floor(rnd() * a.length)];
    const H = hoy();
    const db = { version: 1, creado: new Date().toISOString(), config: { tipoCambio: 17.13, esperaAeropuerto: 35, pagoChoferPct: 0.25, mxnPorKm: 4.2, caseta: 89, comisionAliadoPct: 0.10, velocidadKmh: 60, factorDemo: 25, zonas: JSON.parse(JSON.stringify(ZONAS)), extras: JSON.parse(JSON.stringify(EXTRAS)), whatsapp: true } };
    db.vehiculos = [
      { id: 'v1', tipo: 'suburban', anio: 2023, placa: 'BCS-482-A', color: 'Negro', km: 61200, seguroVence: sumaDias(H, 140), permisoVence: sumaDias(H, 210), servicioCadaKm: 10000, ultimoServicioKm: 60000 },
      { id: 'v2', tipo: 'suburban', anio: 2022, placa: 'BCS-517-B', color: 'Negro', km: 88400, seguroVence: sumaDias(H, 62), permisoVence: sumaDias(H, 300), servicioCadaKm: 10000, ultimoServicioKm: 80000 },
      { id: 'v3', tipo: 'suburban', anio: 2024, placa: 'BCS-903-C', color: 'Negro', km: 24900, seguroVence: sumaDias(H, 250), permisoVence: sumaDias(H, 250), servicioCadaKm: 10000, ultimoServicioKm: 20000 },
      { id: 'v4', tipo: 'escalade', anio: 2023, placa: 'BCS-221-D', color: 'Negro', km: 47300, seguroVence: sumaDias(H, 180), permisoVence: sumaDias(H, 95), servicioCadaKm: 10000, ultimoServicioKm: 40000 },
      { id: 'v5', tipo: 'escalade', anio: 2024, placa: 'BCS-664-E', color: 'Negro', km: 19800, seguroVence: sumaDias(H, 310), permisoVence: sumaDias(H, 330), servicioCadaKm: 10000, ultimoServicioKm: 10000 },
      { id: 'v6', tipo: 'hiace', anio: 2022, placa: 'BCS-775-F', color: 'Blanco', km: 102300, seguroVence: sumaDias(H, 45), permisoVence: sumaDias(H, 120), servicioCadaKm: 10000, ultimoServicioKm: 100000 },
      { id: 'v7', tipo: 'sprinter', anio: 2023, placa: 'BCS-318-G', color: 'Negro', km: 58900, seguroVence: sumaDias(H, 200), permisoVence: sumaDias(H, 160), servicioCadaKm: 15000, ultimoServicioKm: 45000 },
      { id: 'v8', tipo: 'sprinter', anio: 2021, placa: 'BCS-140-H', color: 'Negro', km: 131500, seguroVence: sumaDias(H, 12), permisoVence: sumaDias(H, 400), servicioCadaKm: 15000, ultimoServicioKm: 120000 },
    ];
    db.choferes = CHOFERES.map(c => ({ ...c, pos: NODOS[c.nodo].slice(), gpsReal: false, checkin: c.enLinea ? '07:' + pad(30 + Math.floor(rnd() * 25)) : null, semanaViajes: 0 }));
    db.aliados = [
      { id: 'a1', nombre: 'Concierge · One&Only Palmilla', tipo: 'Hotel', contacto: 'Fernanda L.', comision: 0.10, lugarId: 'oo' }, { id: 'a2', nombre: 'Concierge · Las Ventanas al Paraíso', tipo: 'Hotel', contacto: 'Gerardo M.', comision: 0.10, lugarId: 'lv' },
      { id: 'a3', nombre: 'Concierge · Waldorf Astoria Pedregal', tipo: 'Hotel', contacto: 'Paola R.', comision: 0.10, lugarId: 'wa' }, { id: 'a4', nombre: 'Concierge · Chileno Bay', tipo: 'Hotel', contacto: 'Iván S.', comision: 0.10, lugarId: 'cb' },
      { id: 'a5', nombre: 'Cabo Weddings by Marina', tipo: 'Wedding planner', contacto: 'Marina V.', comision: 0.10, lugarId: null }, { id: 'a6', nombre: 'Baja Bliss Events', tipo: 'Wedding planner', contacto: 'Kate D.', comision: 0.10, lugarId: null },
      { id: 'a7', nombre: 'Villas del Mar · property management', tipo: 'Villas', contacto: 'Sofía A.', comision: 0.08, lugarId: 'villa_sj' }, { id: 'a8', nombre: 'Cabo Villas Rentals', tipo: 'Villas', contacto: 'Mark H.', comision: 0.08, lugarId: 'villa_csl' },
      { id: 'a9', nombre: 'Diamante Golf Group', tipo: 'Corporativo', contacto: 'Andrés P.', comision: 0, lugarId: 'di' }, { id: 'a10', nombre: 'Concierge · Montage Los Cabos', tipo: 'Hotel', contacto: 'Lucía T.', comision: 0.10, lugarId: 'mo' },
    ];
    db.cuentas = [
      { id: 'cta1', nombre: 'Wedding · Ramírez & Lee · Nov 21', tipo: 'Boda', aliadoId: 'a5', contacto: 'Marina V.', invitados: 18, facturaMensual: true, notas: 'Un coordinador, una factura. Llegadas escalonadas del 19 al 21.' },
      { id: 'cta2', nombre: 'Corporate · Diamante Golf Group', tipo: 'Corporativo', aliadoId: 'a9', contacto: 'Andrés P.', invitados: null, facturaMensual: true, notas: 'Factura mensual con CFDI; traslados de ejecutivos y clientes.' },
    ];
    db.clientes = NOMBRES.map((n, i) => { const [ciudad, pais] = i === 0 || i === 1 ? ['Los Angeles, CA', 'US'] : pick(CIUDADES); const visitas = i < 6 ? [6, 6, 3, 2, 1, 4][i] : Math.floor(rnd() * 5); const aliado = rnd() < 0.35 ? pick(db.aliados).id : null; return { id: 'c' + (i + 1), nombre: n, ciudad, pais, email: n.toLowerCase().replace(/[^a-z ]/g, '').replace(/ /g, '.') + '@mail.com', tel: pais === 'MX' ? '55' + String(10000000 + Math.floor(rnd() * 89999999)) : '+1 ' + String(200 + Math.floor(rnd() * 700)) + ' ' + String(200 + Math.floor(rnd() * 700)) + ' ' + String(1000 + Math.floor(rnd() * 9000)), visitas, gasto: 0, vip: visitas >= 4, preferencias: i === 0 ? 'Cold beers on board · child seat for Lucas' : (rnd() < 0.3 ? pick(['Grocery stop', 'Cold beers', 'Quiet ride', 'Child seat', 'Extra luggage space']) : ''), aliadoId: aliado, cuentaId: i >= 4 && i < 9 ? 'cta1' : (i >= 9 && i < 12 ? 'cta2' : null), amigos: [] }; });
    db.clientes[0].amigos = ['c2', 'c3', 'c4']; db.clientes[1].amigos = ['c1'];
    // vuelos de hoy (simulados)
    const horasVuelo = ['09:40', '10:55', '11:30', '12:15', '13:20', '13:55', '14:35', '14:55', '15:25', '16:10', '17:05', '18:40'];
    db.vuelos = horasVuelo.map((h, i) => { const [cod, nombre, origen] = i === 7 ? ['UA', 'United', 'Los Angeles (LAX)'] : AEROLINEAS[i % AEROLINEAS.length]; const est = i === 7 ? 'retrasado' : (i === 3 ? 'adelantado' : (rnd() < 0.2 ? 'retrasado' : 'a tiempo')); const num = cod + ' ' + (i === 7 ? '1234' : String(100 + Math.floor(rnd() * 2400))); return { num, aerolinea: nombre, origen, programada: h, estado: est, minutos: est === 'retrasado' ? (i === 7 ? 25 : 15 + Math.floor(rnd() * 40)) : (est === 'adelantado' ? -10 : 0), fecha: H }; });
    // historial de 12 meses
    db.viajes = []; db.mensajes = []; db.gastos = []; db.checklists = []; db.bitacora = [];
    const hoteles = LUGARES.filter(l => l.tipo === 'hotel');
    const meses = (m) => [2.7, 2.6, 2.8, 2.3, 1.7, 1.6, 1.9, 1.6, 1.0, 1.1, 1.8, 2.7][m]; // viajes por día según temporada (ilustrativo)
    const finVeh = (tipo) => db.vehiculos.filter(v => v.tipo === tipo);
    for (let back = 365; back >= 1; back--) {
      const fecha = sumaDias(H, -back); const m = Number(fecha.split('-')[1]) - 1; const dow = new Date(fecha + 'T12:00:00').getDay();
      let n = meses(m) * (dow === 5 || dow === 6 || dow === 0 ? 1.35 : 0.85); n = Math.floor(n) + (rnd() < n % 1 ? 1 : 0);
      for (let k = 0; k < n; k++) {
        const hotel = pick(hoteles); const desdeAero = rnd() < 0.62; const redondo = rnd() < 0.22;
        const origenId = desdeAero ? 'sjd' : hotel.id, destinoId = desdeAero ? hotel.id : (rnd() < 0.85 ? 'sjd' : pick(hoteles).id);
        const cliente = pick(db.clientes); const canal = pick(['app', 'app', 'app', 'whatsapp', 'whatsapp', 'concierge', 'concierge', 'concierge', 'planner', 'repeticion', 'telefono']);
        const pax = 1 + Math.floor(rnd() * 8); const tipo = pax > 7 ? (rnd() < 0.6 ? 'sprinter' : 'hiace') : (rnd() < 0.3 ? 'escalade' : 'suburban');
        const veh = pick(finVeh(tipo)); const chofer = pick(db.choferes.filter(c => c.vehiculoId === veh.id).concat(db.choferes[Math.floor(rnd() * 6)]));
        const extras = EXTRAS.filter(e => e.precio && rnd() < 0.22).map(e => e.id);
        const q = cotizarCon(db.config, { origenId, destinoId, redondo, extras });
        const estado = rnd() < 0.92 ? 'completado' : (rnd() < 0.6 ? 'cancelado' : 'no_show');
        const aliadoId = canal === 'concierge' || canal === 'planner' ? (cliente.aliadoId || pick(db.aliados).id) : null;
        const hora = hmDe(480 + Math.floor(rnd() * 780)); const dist = distanciaViaje(origenId, destinoId);
        const metodo = pick(['tarjeta', 'tarjeta', 'tarjeta', 'tarjeta', 'zelle', 'zelle', 'zelle', 'efectivo', 'efectivo', 'applepay', 'transferencia']);
        const v = { id: 'h' + back + '_' + k, fecha, hora, creado: new Date(fecha + 'T' + hora + ':00').getTime() - 86400000 * (1 + Math.floor(rnd() * 20)), origenId, destinoId, zona: q.zona, redondo, vehiculo: tipo, vehiculoId: veh.id, choferId: chofer.id, clienteId: cliente.id, nombre: cliente.nombre, pasajeros: pax, maletas: pax + Math.floor(rnd() * 3), vuelo: desdeAero ? { num: pick(AEROLINEAS)[0] + ' ' + (100 + Math.floor(rnd() * 2400)), estado: 'a tiempo', minutos: 0 } : null, extras, precio: q, pago: { metodo, estado: estado === 'completado' ? 'aprobado' : (estado === 'no_show' ? 'aprobado' : 'reembolsado'), ref: '' }, canal, aliadoId, cuentaId: cliente.cuentaId, estado, km: dist.km * (redondo ? 2 : 1), min: dist.min, costo: costoDe(db.config, dist.km * (redondo ? 2 : 1), usaAutopista(origenId, destinoId), redondo, q.total), calificacion: estado === 'completado' ? (rnd() < 0.85 ? 5 : 4) : null, tiempos: {} };
        if (estado === 'completado') { cliente.gasto += q.total; }
        delete v.precio.detalle; db.viajes.push(v);
      }
    }
    // viajes de hoy y próximos (guion del demo)
    const hoyV = [
      { hora: '08:10', o: 'lv', d: 'sjd', c: 'c12', ch: 'd1', tipo: 'escalade', pax: 2, estado: 'completado', canal: 'concierge', aliado: 'a2', metodo: 'tarjeta', vuelo: null },
      { hora: '09:35', o: 'sjd', d: 'wa', c: 'c13', ch: 'd2', tipo: 'suburban', pax: 4, estado: 'completado', canal: 'app', metodo: 'applepay', vuelo: db.vuelos[0].num },
      { hora: '11:20', o: 'sjd', d: 'oo', c: 'c14', ch: 'd3', tipo: 'suburban', pax: 3, estado: 'completado', canal: 'repeticion', metodo: 'zelle', vuelo: db.vuelos[1].num },
      { hora: '12:45', o: 'sjd', d: 'hr', c: 'c15', ch: 'd4', tipo: 'sprinter', pax: 11, estado: 'completado', canal: 'planner', aliado: 'a6', metodo: 'transferencia', vuelo: db.vuelos[2].num },
      { hora: '13:55', o: 'sjd', d: 'me', c: 'c16', ch: 'd2', tipo: 'suburban', pax: 5, estado: 'a_bordo', canal: 'whatsapp', metodo: 'efectivo', vuelo: db.vuelos[4].num, extras: ['cervezas'] },
      { hora: '14:30', o: 'cb', d: 'sjd', c: 'c17', ch: 'd5', tipo: 'suburban', pax: 2, estado: 'en_camino', canal: 'concierge', aliado: 'a4', metodo: 'tarjeta', vuelo: null },
      { hora: '16:20', o: 'sjd', d: 'oo', c: 'c5', ch: 'd4', tipo: 'sprinter', pax: 12, estado: 'asignado', canal: 'planner', aliado: 'a5', metodo: 'transferencia', vuelo: db.vuelos[8].num, cuenta: 'cta1', notas: 'Wedding party · welcome signs · 2 coolers' },
      { hora: '18:00', o: 'oo', d: 'vi', c: 'c2', ch: 'd1', tipo: 'escalade', pax: 4, estado: 'asignado', canal: 'app', metodo: 'applepay', vuelo: null, notas: 'Dinner transfer · pick up back at 10:30 PM', redondo: true },
      { hora: '20:30', o: 'sjd', d: 'di', c: 'c18', ch: null, tipo: 'escalade', pax: 2, estado: 'solicitado', canal: 'whatsapp', metodo: 'zelle', vuelo: db.vuelos[11].num, pagoEstado: 'pendiente_confirmar' },
    ];
    const manana = sumaDias(H, 1), pasado = sumaDias(H, 2);
    const proxV = [
      { fecha: manana, hora: '10:15', o: 'sjd', d: 'cb', c: 'c19', ch: 'd3', tipo: 'suburban', pax: 2, estado: 'asignado', canal: 'app', metodo: 'tarjeta', vuelo: 'AS 1522' },
      { fecha: manana, hora: '13:40', o: 'sjd', d: 'oo', c: 'c6', ch: 'd4', tipo: 'sprinter', pax: 9, estado: 'asignado', canal: 'planner', aliado: 'a5', metodo: 'transferencia', vuelo: 'UA 1712', cuenta: 'cta1' },
      { fecha: pasado, hora: '11:00', o: 'wa', d: 'sjd', c: 'c20', ch: 'd2', tipo: 'suburban', pax: 3, estado: 'asignado', canal: 'concierge', aliado: 'a3', metodo: 'zelle', vuelo: null },
    ];
    [...hoyV.map(x => ({ ...x, fecha: H })), ...proxV].forEach((x, i) => {
      const cli = db.clientes.find(c => c.id === x.c); const q = cotizarCon(db.config, { origenId: x.o, destinoId: x.d, redondo: !!x.redondo, extras: x.extras || [] }); const dist = distanciaViaje(x.o, x.d);
      const vuelo = x.vuelo ? (db.vuelos.find(f => f.num === x.vuelo) || { num: x.vuelo, aerolinea: 'United', origen: 'Los Angeles (LAX)', programada: hmDe(minutosDe(x.hora) - 35), estado: 'a tiempo', minutos: 0 }) : null;
      const veh = db.vehiculos.find(v => x.ch ? v.id === db.choferes.find(c => c.id === x.ch).vehiculoId : v.tipo === x.tipo);
      const v = { id: 't' + i, fecha: x.fecha, hora: x.hora, creado: Date.now() - 86400000 * (2 + i), origenId: x.o, destinoId: x.d, zona: q.zona, redondo: !!x.redondo, vehiculo: veh.tipo, vehiculoId: veh.id, choferId: x.ch, clienteId: x.c, nombre: cli.nombre, pasajeros: x.pax, maletas: x.pax + 1, vuelo: vuelo ? { num: vuelo.num, aerolinea: vuelo.aerolinea, origen: vuelo.origen, programada: vuelo.programada, estado: vuelo.estado, minutos: vuelo.minutos } : null, extras: x.extras || [], precio: q, pago: { metodo: x.metodo, estado: x.pagoEstado || (x.metodo === 'efectivo' ? (x.estado === 'completado' ? 'cobrado' : 'pendiente') : 'aprobado'), ref: x.metodo === 'zelle' ? 'ZL-' + (48211 + i) : '' }, canal: x.canal, aliadoId: x.aliado || null, cuentaId: x.cuenta || cli.cuentaId || null, estado: x.estado, km: dist.km * (x.redondo ? 2 : 1), min: dist.min, costo: costoDe(db.config, dist.km * (x.redondo ? 2 : 1), usaAutopista(x.o, x.d), !!x.redondo, q.total), calificacion: x.estado === 'completado' ? 5 : null, notas: x.notas || '', tiempos: x.estado === 'completado' ? { asignado: '07:00', en_camino: hmDe(minutosDe(x.hora) - 40), llegue: hmDe(minutosDe(x.hora) - 8), a_bordo: x.hora, completado: hmDe(minutosDe(x.hora) + dist.min + 5) } : (x.estado === 'a_bordo' ? { asignado: '07:00', en_camino: hmDe(minutosDe(x.hora) - 45), llegue: hmDe(minutosDe(x.hora) - 6), a_bordo: x.hora } : (x.estado === 'en_camino' ? { asignado: '07:00', en_camino: ahoraHM() } : { asignado: '07:00' })) };
      if (vuelo && vuelo.minutos) { v.horaOriginal = v.hora; v.hora = hmDe(minutosDe(vuelo.programada) + vuelo.minutos + db.config.esperaAeropuerto); }
      db.viajes.push(v);
    });
    // los dos viajes vivos arrancan su simulación
    db.viajes.filter(v => v.fecha === H && (v.estado === 'a_bordo' || v.estado === 'en_camino')).forEach(v => { const ch = db.choferes.find(c => c.id === v.choferId); if (v.estado === 'a_bordo') { const o = lugar(v.origenId); ch.pos = o.pos.slice(); ch.nodo = o.nodo; } iniciarSimEn(db, v, v.estado === 'a_bordo' ? 'a_destino' : 'a_recoger'); if (v.estado === 'a_bordo') v.sim.avance = v.sim.km * 0.35; else v.sim.avance = v.sim.km * 0.2; });
    // mensajes de ejemplo
    const t4 = db.viajes.find(v => v.id === 't4'), t5 = db.viajes.find(v => v.id === 't5');
    db.mensajes.push({ id: 'm1', viajeId: t4.id, de: 'cliente', texto: 'Hi Ana! We are 5 with 6 bags, is that ok?', t: Date.now() - 3600000 }, { id: 'm2', viajeId: t4.id, de: 'chofer', texto: 'Perfect, the Suburban fits all. See you at Door 3 with the ACS sign.', t: Date.now() - 3500000 }, { id: 'm3', viajeId: t5.id, de: 'chofer', texto: 'Good afternoon Mr. Hoffman, I am on my way to Chileno Bay. ETA 15 min.', t: Date.now() - 600000 });
    // gastos del mes
    db.viajes.filter(v => v.estado === 'completado' && v.fecha >= sumaDias(H, -30)).forEach((v, i) => { if (i % 3 === 0) db.gastos.push({ id: 'g' + i, fecha: v.fecha, choferId: v.choferId, vehiculoId: v.vehiculoId, tipo: 'gasolina', monto: 500 + Math.floor(rnd() * 500), viajeId: v.id, foto: true }); if (v.costo.casetas) db.gastos.push({ id: 'gc' + i, fecha: v.fecha, choferId: v.choferId, vehiculoId: v.vehiculoId, tipo: 'caseta', monto: v.costo.casetas, viajeId: v.id, foto: false }); });
    db.checklists = db.choferes.filter(c => c.enLinea).map(c => ({ id: 'ck' + c.id, fecha: H, choferId: c.id, vehiculoId: c.vehiculoId, items: { limpieza: true, llantas: true, agua: true, gasolina: true, documentos: true, silla: c.id === 'd1' }, hora: c.checkin }));
    db.bitacora.push({ t: Date.now() - 7200000, quien: 'sistema', que: 'Viaje t2 completado · One&Only Palmilla' }, { t: Date.now() - 5400000, quien: 'sistema', que: 'Vuelo UA 1234 retrasado 25 min · recogida ajustada' }, { t: Date.now() - 1800000, quien: 'Ana Castro', que: 'Pasajero a bordo · viaje t4' });
    db.viajes.sort((a, b) => (a.fecha + a.hora) < (b.fecha + b.hora) ? -1 : 1);
    return db;
  }

  // ───────────────────────── tarifas y costos ─────────────────────────
  function zonaDe(origenId, destinoId) { const o = lugar(origenId), d = lugar(destinoId); return (d && d.zona) || (o && o.zona) || 'sj'; }
  function cotizarCon(cfg, { origenId, destinoId, redondo, extras }) {
    const zona = zonaDe(origenId, destinoId); const z = cfg.zonas[zona]; const base = redondo ? z.redondo : z.sencillo;
    const det = (extras || []).map(id => cfg.extras.find(e => e.id === id)).filter(Boolean); const ext = det.reduce((a, e) => a + e.precio, 0);
    return { zona, base, extras: ext, total: base + ext, detalle: det.map(e => ({ id: e.id, en: e.en, es: e.es, precio: e.precio })) };
  }
  function costoDe(cfg, km, autopista, redondo, precioUSD) { const gasolina = Math.round(km * cfg.mxnPorKm); const casetas = autopista ? cfg.caseta * (redondo ? 2 : 1) : 0; const chofer = Math.round(precioUSD * cfg.pagoChoferPct * cfg.tipoCambio); return { gasolina, casetas, chofer, totalMXN: gasolina + casetas + chofer }; }

  // ───────────────────────── almacén ─────────────────────────
  let db = null; const canal = ('BroadcastChannel' in window) ? new BroadcastChannel('acs-demo') : null; const tabId = Math.random().toString(36).slice(2, 9);
  const listeners = [], listenersEv = []; const vistos = {};
  function reload() { try { const raw = localStorage.getItem(KEY); if (raw) { db = JSON.parse(raw); return true; } } catch (e) { } return false; }
  function persist(motivo) { db.actualizado = Date.now(); try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { console.warn('sin espacio', e); } if (canal) canal.postMessage({ tipo: 'cambio', motivo: motivo || 'datos', de: tabId }); }
  function reset() { db = semilla(); persist('datos'); }
  function log(quien, que) { db.bitacora.unshift({ t: Date.now(), quien, que }); if (db.bitacora.length > 300) db.bitacora.length = 300; }
  function emitir(ev) { if (canal) canal.postMessage({ tipo: 'evento', evento: ev, de: tabId }); listenersEv.forEach(f => { try { f(ev); } catch (e) { } }); }
  if (!reload() || db.version !== 1) reset();
  if (canal) canal.onmessage = (e) => { const d = e.data || {}; if (d.de === tabId) return; if (d.tipo === 'hb') { vistos[d.de] = Date.now(); return; } if (d.tipo === 'cambio') { reload(); listeners.forEach(f => { try { f(d.motivo); } catch (x) { } }); } if (d.tipo === 'evento') listenersEv.forEach(f => { try { f(d.evento); } catch (x) { } }); };
  window.addEventListener('storage', (e) => { if (e.key === KEY && !canal) { reload(); listeners.forEach(f => f('datos')); } });
  setInterval(() => { if (canal) canal.postMessage({ tipo: 'hb', de: tabId }); }, 1000);
  function esLider() { const t = Date.now(); const ids = Object.keys(vistos).filter(k => t - vistos[k] < 3500).concat([tabId]).sort(); return ids[0] === tabId; }

  // ───────────────────────── despacho ─────────────────────────
  const chofer = (id) => db.choferes.find(c => c.id === id); const vehiculo = (id) => db.vehiculos.find(v => v.id === id); const cliente = (id) => db.clientes.find(c => c.id === id); const aliado = (id) => db.aliados.find(a => a.id === id);
  const viaje = (id) => db.viajes.find(v => v.id === id);
  const viajeActivo = (choferId) => db.viajes.find(v => v.choferId === choferId && EN_RUTA.includes(v.estado));
  function ocupadoA(c, fecha, hora) { return db.viajes.some(v => v.choferId === c.id && v.fecha === fecha && ACTIVOS.includes(v.estado) && Math.abs(minutosDe(v.hora) - minutosDe(hora)) < 90); }
  function despachar(v) {
    const o = lugar(v.origenId); const cand = db.choferes.filter(c => c.enLinea && !viajeActivo(c.id) && !ocupadoA(c, v.fecha, v.hora) && TIPOS_VEHICULO[vehiculo(c.vehiculoId).tipo].pax >= v.pasajeros && (!v.vehiculo || vehiculo(c.vehiculoId).tipo === v.vehiculo));
    let pool = cand.length ? cand : db.choferes.filter(c => c.enLinea && !viajeActivo(c.id) && !ocupadoA(c, v.fecha, v.hora) && TIPOS_VEHICULO[vehiculo(c.vehiculoId).tipo].pax >= v.pasajeros);
    if (!pool.length) { v.estado = 'solicitado'; v.choferId = null; log('despacho', 'Sin chofer disponible para ' + v.nombre + ' · ' + v.hora); return null; }
    pool.sort((a, b) => haversine(a.pos, o.pos) - haversine(b.pos, o.pos)); const c = pool[0];
    v.choferId = c.id; v.vehiculoId = c.vehiculoId; v.vehiculo = vehiculo(c.vehiculoId).tipo; v.estado = 'asignado'; v.tiempos.asignado = ahoraHM(); v.distanciaChofer = Math.round(haversine(c.pos, o.pos) * 10) / 10;
    log('despacho', `Viaje de ${v.nombre} asignado a ${c.nombre} (${v.distanciaChofer} km del punto)`); emitir({ tipo: 'viaje_asignado', viajeId: v.id, choferId: c.id });
    return c;
  }
  function solicitarViaje(d) {
    const cli = cliente(d.clienteId); const q = cotizarCon(db.config, d); const dist = distanciaViaje(d.origenId, d.destinoId);
    let hora = d.hora; let vuelo = null;
    if (d.vuelo) { const f = vueloDe(d.vuelo); vuelo = f ? { num: f.num, aerolinea: f.aerolinea, origen: f.origen, programada: f.programada, estado: f.estado, minutos: f.minutos } : { num: d.vuelo.toUpperCase(), aerolinea: '', origen: '', programada: d.hora, estado: 'a tiempo', minutos: 0 }; if (f && d.fecha === hoy()) hora = hmDe(minutosDe(f.programada) + f.minutos + db.config.esperaAeropuerto); }
    const v = { id: uid('t'), fecha: d.fecha, hora, horaOriginal: d.hora !== hora ? d.hora : undefined, creado: Date.now(), origenId: d.origenId, destinoId: d.destinoId, zona: q.zona, redondo: !!d.redondo, vehiculo: d.vehiculo, vehiculoId: null, choferId: null, clienteId: d.clienteId, nombre: cli ? cli.nombre : d.nombre, pasajeros: d.pasajeros || 2, maletas: d.maletas || 2, vuelo, extras: d.extras || [], precio: q, pago: d.pago || { metodo: 'tarjeta', estado: 'aprobado', ref: '' }, canal: d.canal || 'app', aliadoId: d.aliadoId || (cli ? cli.aliadoId : null), cuentaId: d.cuentaId || (cli ? cli.cuentaId : null), estado: 'solicitado', km: dist.km * (d.redondo ? 2 : 1), min: dist.min, costo: costoDe(db.config, dist.km * (d.redondo ? 2 : 1), usaAutopista(d.origenId, d.destinoId), !!d.redondo, q.total), calificacion: null, notas: d.notas || '', tiempos: {} };
    if (d.asap) { v.asap = true; v.fecha = hoy(); v.hora = ahoraHM(); }
    db.viajes.push(v); db.viajes.sort((a, b) => (a.fecha + a.hora) < (b.fecha + b.hora) ? -1 : 1);
    log(cli ? cli.nombre : 'central', `Nueva reserva ${lugar(v.origenId).corto || lugar(v.origenId).nombre} → ${lugar(v.destinoId).corto || lugar(v.destinoId).nombre} · ${v.hora} · ${usd(q.total)}`);
    const ch = despachar(v);
    if (d.asap && ch) { v.estado = 'en_camino'; v.tiempos.aceptado = ahoraHM(); v.tiempos.en_camino = ahoraHM(); iniciarSimEn(db, v, 'a_recoger'); log(ch.nombre, 'Aceptó el viaje inmediato y va en camino'); emitir({ tipo: 'estado', viajeId: v.id, estado: 'en_camino', choferId: ch.id }); }
    persist('datos'); return v;
  }
  function cambiarEstado(id, estado, quien) {
    const v = viaje(id); if (!v) return null; const c = v.choferId ? chofer(v.choferId) : null; v.estado = estado; v.tiempos[estado] = ahoraHM();
    if (estado === 'en_camino' && c) { iniciarSimEn(db, v, 'a_recoger'); }
    if (estado === 'llegue' && c) { const o = lugar(v.origenId); c.pos = o.pos.slice(); c.nodo = o.nodo; delete v.sim; }
    if (estado === 'a_bordo' && c) { const o = lugar(v.origenId); c.pos = o.pos.slice(); c.nodo = o.nodo; iniciarSimEn(db, v, 'a_destino'); }
    if (estado === 'completado' && c) { const d = lugar(v.destinoId); c.pos = d.pos.slice(); c.nodo = d.nodo; c.semanaViajes = (c.semanaViajes || 0) + 1; delete v.sim; const cli = cliente(v.clienteId); if (cli) { cli.visitas += 1; cli.gasto += v.precio.total; } if (v.pago.metodo === 'efectivo' && v.pago.estado === 'pendiente') v.pago.estado = 'cobrado'; const veh = vehiculo(v.vehiculoId); if (veh) veh.km += Math.round(v.km); }
    if ((estado === 'cancelado' || estado === 'no_show') && c) { delete v.sim; }
    log(quien || (c ? c.nombre : 'sistema'), `${ESTADOS[estado].es} · ${v.nombre}`); emitir({ tipo: 'estado', viajeId: v.id, estado, choferId: v.choferId }); persist('datos'); return v;
  }
  function reasignar(id, choferId) { const v = viaje(id); const c = chofer(choferId); if (!v || !c) return; v.choferId = c.id; v.vehiculoId = c.vehiculoId; v.vehiculo = vehiculo(c.vehiculoId).tipo; v.estado = 'asignado'; v.tiempos.asignado = ahoraHM(); delete v.sim; log('central', `Reasignado a ${c.nombre} · ${v.nombre}`); emitir({ tipo: 'viaje_asignado', viajeId: v.id, choferId: c.id }); persist('datos'); }
  function setEnLinea(choferId, on) { const c = chofer(choferId); c.enLinea = !!on; if (on && !c.checkin) c.checkin = ahoraHM(); log(c.nombre, on ? 'En línea' : 'Fuera de línea'); if (on) { db.viajes.filter(v => v.estado === 'solicitado' && v.fecha >= hoy()).forEach(v => despachar(v)); } persist('datos'); }
  function setPosicion(choferId, lat, lng, real) { const c = chofer(choferId); c.pos = [lat, lng]; c.gpsReal = !!real; c.gpsT = Date.now(); persist('sim'); }
  function setGpsReal(choferId, on) { const c = chofer(choferId); c.gpsReal = !!on; if (!on) { const v = viajeActivo(choferId); if (v && v.sim) { /* retoma la simulación desde la posición actual */ iniciarSimEn(db, v, v.sim.fase); } } persist('datos'); }
  function registrarPago(id, metodo, datos) { const v = viaje(id); const est = metodo === 'applepay' || metodo === 'tarjeta' ? 'aprobado' : (metodo === 'efectivo' ? 'pendiente' : 'pendiente_confirmar'); v.pago = { metodo, estado: est, ref: datos && datos.ref || (metodo === 'zelle' ? 'ZL-' + Math.floor(10000 + Math.random() * 89999) : (metodo === 'transferencia' ? 'SPEI-' + Math.floor(100000 + Math.random() * 899999) : '')), ultimos4: datos && datos.ultimos4 || '' }; log(v.nombre, `Pago ${METODOS[metodo].es} · ${usd(v.precio.total)} · ${est}`); persist('datos'); return v.pago; }
  function confirmarPago(id) { const v = viaje(id); v.pago.estado = v.pago.metodo === 'efectivo' ? 'cobrado' : 'aprobado'; log('central', `Pago confirmado · ${v.nombre} · ${usd(v.precio.total)}`); persist('datos'); }
  function enviarMensaje(viajeId, de, texto) { const m = { id: uid('m'), viajeId, de, texto, t: Date.now() }; db.mensajes.push(m); emitir({ tipo: 'mensaje', viajeId, de }); persist('datos'); return m; }
  function registrarGasto(g) { const x = { id: uid('g'), fecha: hoy(), hora: ahoraHM(), ...g }; db.gastos.unshift(x); log(chofer(g.choferId).nombre, `Gasto ${g.tipo} · ${mxn(g.monto)}`); persist('datos'); return x; }
  function guardarChecklist(choferId, items) { const c = chofer(choferId); const ck = { id: uid('ck'), fecha: hoy(), hora: ahoraHM(), choferId, vehiculoId: c.vehiculoId, items }; db.checklists = db.checklists.filter(x => !(x.choferId === choferId && x.fecha === hoy())); db.checklists.push(ck); log(c.nombre, 'Checklist del vehículo guardado'); persist('datos'); return ck; }
  function calificar(id, estrellas, comentario) { const v = viaje(id); v.calificacion = estrellas; v.comentario = comentario || ''; persist('datos'); }
  function vueloDe(num) { if (!num) return null; const n = String(num).toUpperCase().replace(/\s+/g, ' ').trim(); return db.vuelos.find(f => f.num === n || f.num.replace(' ', '') === n.replace(' ', '')); }

  // ───────────────────────── simulación de GPS ─────────────────────────
  function iniciarSimEn(base, v, fase) {
    const c = base.choferes.find(x => x.id === v.choferId); if (!c) return; const o = lugar(v.origenId), d = lugar(v.destinoId);
    const r = fase === 'a_recoger' ? rutaLugares(c.pos, c.nodo, o) : rutaLugares(c.pos, o.nodo, d);
    const cum = [0]; for (let i = 1; i < r.pts.length; i++) cum.push(cum[i - 1] + haversine(r.pts[i - 1], r.pts[i]));
    v.sim = { fase, pts: r.pts, cum, km: cum[cum.length - 1], min: r.min, avance: 0, llegado: false, t0: Date.now() };
  }
  function posEnSim(s) { const a = Math.min(s.avance, s.km); let i = 1; while (i < s.cum.length && s.cum[i] < a) i++; if (i >= s.cum.length) return s.pts[s.pts.length - 1]; const p0 = s.pts[i - 1], p1 = s.pts[i]; const seg = s.cum[i] - s.cum[i - 1] || 1; const f = (a - s.cum[i - 1]) / seg; return [p0[0] + (p1[0] - p0[0]) * f, p0[1] + (p1[1] - p0[1]) * f]; }
  function tick() {
    let cambio = false; const kmPorTick = db.config.velocidadKmh * db.config.factorDemo / 3600;
    db.viajes.forEach(v => {
      if (!EN_RUTA.includes(v.estado) || v.estado === 'llegue') return; const c = chofer(v.choferId); if (!c) return;
      if (!v.sim) iniciarSimEn(db, v, v.estado === 'a_bordo' ? 'a_destino' : 'a_recoger');
      if (c.gpsReal) return; const s = v.sim; if (s.llegado) return;
      s.avance = Math.min(s.km, s.avance + kmPorTick); c.pos = posEnSim(s); if (s.avance >= s.km - 0.001) { s.llegado = true; c.nodo = (s.fase === 'a_recoger' ? lugar(v.origenId) : lugar(v.destinoId)).nodo; emitir({ tipo: 'llegada', viajeId: v.id, fase: s.fase }); }
      cambio = true;
    });
    if (cambio) persist('sim');
  }
  setInterval(() => { if (esLider()) tick(); }, 1000);
  function eta(v) { // minutos reales estimados y km restantes
    const c = v.choferId ? chofer(v.choferId) : null; if (!c) return null;
    if (v.sim && !c.gpsReal) { const rest = Math.max(0, v.sim.km - v.sim.avance); return { km: rest, min: Math.round(rest / db.config.velocidadKmh * 60), llegado: v.sim.llegado, fase: v.sim.fase }; }
    const meta = v.estado === 'a_bordo' ? lugar(v.destinoId).pos : lugar(v.origenId).pos; const rest = haversine(c.pos, meta) * 1.25; return { km: rest, min: Math.round(rest / 50 * 60), llegado: rest < 0.15, fase: v.estado === 'a_bordo' ? 'a_destino' : 'a_recoger' };
  }
  function rutaViaje(v) { const o = lugar(v.origenId), d = lugar(v.destinoId); const c = v.choferId ? chofer(v.choferId) : null; const out = { destino: rutaLugares(o.pos, o.nodo, d).pts }; if (c && (v.estado === 'asignado' || v.estado === 'aceptado' || v.estado === 'en_camino')) out.recoger = (v.sim && v.sim.fase === 'a_recoger') ? v.sim.pts : rutaLugares(c.pos, c.nodo, o).pts; return out; }

  // ───────────────────────── métricas ─────────────────────────
  const M = {};
  const comp = (v) => v.estado === 'completado';
  M.porMes = function () { const H = hoy(); const out = []; for (let i = 11; i >= 0; i--) { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); const ym = d.getFullYear() + '-' + pad(d.getMonth() + 1); const vs = db.viajes.filter(v => v.fecha.startsWith(ym) && comp(v)); out.push({ ym, mes: MESES[d.getMonth()], viajes: vs.length, ingreso: vs.reduce((a, v) => a + v.precio.total, 0), costoMXN: vs.reduce((a, v) => a + v.costo.totalMXN, 0), cancel: db.viajes.filter(v => v.fecha.startsWith(ym) && (v.estado === 'cancelado' || v.estado === 'no_show')).length }); } return out; };
  M.porZona = function (dias = 90) { const desde = sumaDias(hoy(), -dias); const vs = db.viajes.filter(v => comp(v) && v.fecha >= desde); return Object.values(ZONAS).map(z => { const x = vs.filter(v => v.zona === z.id); return { zona: z, viajes: x.length, ingreso: x.reduce((a, v) => a + v.precio.total, 0), margenMXN: x.reduce((a, v) => a + v.precio.total * db.config.tipoCambio - v.costo.totalMXN, 0) }; }); };
  M.porCanal = function (dias = 90) { const desde = sumaDias(hoy(), -dias); const vs = db.viajes.filter(v => comp(v) && v.fecha >= desde); return Object.entries(CANALES).map(([id, nombre]) => { const x = vs.filter(v => v.canal === id); return { id, nombre, viajes: x.length, ingreso: x.reduce((a, v) => a + v.precio.total, 0) }; }).filter(x => x.viajes).sort((a, b) => b.ingreso - a.ingreso); };
  M.porVehiculo = function (dias = 90) { const desde = sumaDias(hoy(), -dias); const vs = db.viajes.filter(v => comp(v) && v.fecha >= desde); return db.vehiculos.map(ve => { const x = vs.filter(v => v.vehiculoId === ve.id); return { vehiculo: ve, viajes: x.length, ingreso: x.reduce((a, v) => a + v.precio.total, 0), km: Math.round(x.reduce((a, v) => a + v.km, 0)) }; }).sort((a, b) => b.ingreso - a.ingreso); };
  M.porChofer = function (dias = 30) { const desde = sumaDias(hoy(), -dias); return db.choferes.map(c => { const x = db.viajes.filter(v => v.choferId === c.id && comp(v) && v.fecha >= desde); const cal = x.filter(v => v.calificacion); return { chofer: c, viajes: x.length, ingreso: x.reduce((a, v) => a + v.precio.total, 0), pagoMXN: x.reduce((a, v) => a + v.costo.chofer, 0), calif: cal.length ? cal.reduce((a, v) => a + v.calificacion, 0) / cal.length : null, hoy: db.viajes.filter(v => v.choferId === c.id && v.fecha === hoy() && v.estado !== 'cancelado').length }; }).sort((a, b) => b.viajes - a.viajes); };
  M.hoy = function () { const H = hoy(); const vs = db.viajes.filter(v => v.fecha === H); const done = vs.filter(comp); return { total: vs.length, completados: done.length, enCurso: vs.filter(v => EN_RUTA.includes(v.estado)).length, porSalir: vs.filter(v => v.estado === 'asignado' || v.estado === 'aceptado').length, sinChofer: vs.filter(v => v.estado === 'solicitado').length, ingreso: done.reduce((a, v) => a + v.precio.total, 0), ingresoProgramado: vs.filter(v => v.estado !== 'cancelado' && v.estado !== 'no_show').reduce((a, v) => a + v.precio.total, 0), pasajeros: done.reduce((a, v) => a + v.pasajeros, 0), enLinea: db.choferes.filter(c => c.enLinea).length }; };
  M.periodo = function (dias = 30) { const desde = sumaDias(hoy(), -dias); const vs = db.viajes.filter(v => v.fecha >= desde && v.fecha < hoy()); const done = vs.filter(comp); const ingreso = done.reduce((a, v) => a + v.precio.total, 0); const costo = done.reduce((a, v) => a + v.costo.totalMXN, 0); const ingresoMXN = ingreso * db.config.tipoCambio; return { dias, viajes: done.length, ingreso, ingresoMXN, costoMXN: costo, margenMXN: ingresoMXN - costo, margenPct: ingresoMXN ? (ingresoMXN - costo) / ingresoMXN * 100 : 0, ticket: done.length ? ingreso / done.length : 0, costoViajeMXN: done.length ? costo / done.length : 0, cancelPct: vs.length ? vs.filter(v => v.estado === 'cancelado').length / vs.length * 100 : 0, noshowPct: vs.length ? vs.filter(v => v.estado === 'no_show').length / vs.length * 100 : 0, viajesPorVehiculoDia: done.length / (dias * db.vehiculos.length) }; };
  M.aliados = function (dias = 90) { const desde = sumaDias(hoy(), -dias); return db.aliados.map(a => { const x = db.viajes.filter(v => v.aliadoId === a.id && comp(v) && v.fecha >= desde); const ingreso = x.reduce((s, v) => s + v.precio.total, 0); return { aliado: a, viajes: x.length, ingreso, comision: ingreso * a.comision }; }).sort((a, b) => b.ingreso - a.ingreso); };
  M.alertasFlota = function () { const H = hoy(); const out = []; const dias = (iso) => Math.round((new Date(iso) - new Date(H)) / 86400000); db.vehiculos.forEach(v => { const t = TIPOS_VEHICULO[v.tipo]; const ds = dias(v.seguroVence), dp = dias(v.permisoVence); const kmServ = v.ultimoServicioKm + v.servicioCadaKm - v.km; if (ds <= 30) out.push({ nivel: ds <= 14 ? 'bad' : 'warn', vehiculoId: v.id, texto: `Seguro de la ${t.corto} ${v.placa} vence en ${ds} días` }); if (dp <= 30) out.push({ nivel: dp <= 14 ? 'bad' : 'warn', vehiculoId: v.id, texto: `Permiso de transporte de la ${t.corto} ${v.placa} vence en ${dp} días` }); if (kmServ <= 1500) out.push({ nivel: kmServ <= 0 ? 'bad' : 'warn', vehiculoId: v.id, texto: `Servicio de la ${t.corto} ${v.placa}: ${kmServ <= 0 ? 'vencido por ' + (-kmServ) : 'faltan ' + kmServ} km` }); }); db.choferes.forEach(c => { const dl = dias(c.licenciaVence); if (dl <= 60) out.push({ nivel: dl <= 30 ? 'bad' : 'warn', choferId: c.id, texto: `Licencia de ${c.nombre} vence en ${dl} días` }); }); return out; };
  M.conciliacion = function () { const pend = db.viajes.filter(v => v.pago.estado === 'pendiente_confirmar' || (v.pago.metodo === 'efectivo' && v.pago.estado === 'pendiente')); const H = hoy(); const hoyPag = db.viajes.filter(v => v.fecha === H && (comp(v) || EN_RUTA.includes(v.estado) || ACTIVOS.includes(v.estado))); const porMetodo = Object.keys(METODOS).map(m => ({ metodo: m, total: hoyPag.filter(v => v.pago.metodo === m).reduce((a, v) => a + v.precio.total, 0), n: hoyPag.filter(v => v.pago.metodo === m).length })); return { pendientes: pend, porMetodo }; };
  M.clientesTop = function () { return db.clientes.slice().sort((a, b) => b.gasto - a.gasto).slice(0, 10); };
  M.recurrentes = function () { const rec = db.clientes.filter(c => c.visitas >= 2).length; return { recurrentes: rec, total: db.clientes.length, pct: rec / db.clientes.length * 100 }; };
  M.gastosMes = function () { const desde = sumaDias(hoy(), -30); const g = db.gastos.filter(x => x.fecha >= desde); const por = {}; g.forEach(x => { por[x.tipo] = (por[x.tipo] || 0) + x.monto; }); return { total: g.reduce((a, x) => a + x.monto, 0), por, n: g.length }; };

  function asistente(q) {
    const s = (q || '').toLowerCase(); const p = M.periodo(30); const z = M.porZona(90).sort((a, b) => b.ingreso - a.ingreso); const meses = M.porMes(); const mejor = meses.slice().sort((a, b) => b.ingreso - a.ingreso)[0]; const peor = meses.slice().sort((a, b) => a.ingreso - b.ingreso)[0]; const can = M.porCanal(90); const ch = M.porChofer(30); const al = M.aliados(90); const fl = M.alertasFlota(); const con = M.conciliacion(); const h = M.hoy();
    if (/zona|corredor|pac[ií]fico|san jos|cabo san lucas/.test(s)) return `En 90 días, ${z[0].zona.es} dejó ${usd(z[0].ingreso)} en ${z[0].viajes} viajes (margen ${mxn(z[0].margenMXN)}), contra ${usd(z[1].ingreso)} de ${z[1].zona.es}. Por viaje, ${z[0].zona.id === 'csl' ? 'Cabo San Lucas paga más pero recorre más kilómetros' : 'el Corredor es más corto y por eso deja mejor margen por hora de camioneta'}.`;
    if (/temporada|mes|mejor época|alta|baja/.test(s)) return `El mejor mes del año fue ${mejor.mes} con ${usd(mejor.ingreso)} en ${mejor.viajes} viajes; el más flojo, ${peor.mes} con ${usd(peor.ingreso)}. La temporada alta va de diciembre a abril; septiembre y octubre son el hueco para vacaciones y mantenimiento de la flota.`;
    if (/canal|de d[oó]nde|whatsapp|concierge|planner|app/.test(s)) return `Últimos 90 días: ${can.map(c => `${c.nombre} ${usd(c.ingreso)} (${c.viajes})`).join(' · ')}. Lo que entra por concierge y planner lleva comisión; lo que entra por la app es margen completo.`;
    if (/chofer|conductor|qui[eé]n/.test(s)) return `En 30 días el chofer con más viajes es ${ch[0].chofer.nombre} (${ch[0].viajes} viajes, ${usd(ch[0].ingreso)}, calificación ${ch[0].calif ? ch[0].calif.toFixed(2) : '—'}). Pago acumulado a choferes: ${mxn(ch.reduce((a, x) => a + x.pagoMXN, 0))}.`;
    if (/aliad|comisi|hotel|referid/.test(s)) return `Aliado que más refiere en 90 días: ${al[0].aliado.nombre} con ${al[0].viajes} viajes y ${usd(al[0].ingreso)}; comisión a pagar ${usd(al[0].comision)}. Comisiones totales del periodo: ${usd(al.reduce((a, x) => a + x.comision, 0))}.`;
    if (/no.?show|cancel|no lleg/.test(s)) return `En 30 días: ${pct(p.cancelPct)} de cancelaciones y ${pct(p.noshowPct)} de no-shows sobre ${p.viajes} viajes completados. Con anticipo cobrado en la app el no-show baja casi a cero: el cliente ya pagó.`;
    if (/flota|seguro|permiso|servicio|manten|venc/.test(s)) return fl.length ? `Alertas de flota: ${fl.map(a => a.texto).join('; ')}.` : 'La flota está al día en seguros, permisos y servicios.';
    if (/zelle|efectivo|pendiente|conciliac|cobr/.test(s)) return `Hay ${con.pendientes.length} pagos por confirmar (${usd(con.pendientes.reduce((a, v) => a + v.precio.total, 0))}): ${con.pendientes.map(v => `${v.nombre} · ${METODOS[v.pago.metodo].es}`).join(', ') || 'ninguno'}.`;
    if (/margen|costo|gana|utilidad|rentab/.test(s)) return `Últimos 30 días: ingreso ${usd(p.ingreso)} (${mxn(p.ingresoMXN)} a ${db.config.tipoCambio}), costo directo ${mxn(p.costoMXN)} (gasolina, casetas y pago a choferes), margen ${mxn(p.margenMXN)} = ${pct(p.margenPct)}. Costo promedio por viaje ${mxn(p.costoViajeMXN)}, ticket ${usd(p.ticket)}.`;
    if (/hoy|ahora|en curso/.test(s)) return `Hoy: ${h.total} viajes, ${h.completados} completados, ${h.enCurso} en curso, ${h.porSalir} por salir y ${h.sinChofer} sin chofer. Ingreso programado del día ${usd(h.ingresoProgramado)}; ${h.enLinea} choferes en línea.`;
    return `Puedo responder con los números del sistema: qué zona rinde más, mejor temporada, canales, choferes, aliados y comisiones, no-shows, flota, pagos pendientes, margen y el día de hoy. En el demo la redacción es por reglas; en la fase real la hace un modelo de IA sobre la misma base.`;
  }

  // ───────────────────────── API pública ─────────────────────────
  window.ACS = {
    get db() { return db; }, KEY, save: () => persist('datos'), reset, on: (f) => listeners.push(f), onEvento: (f) => listenersEv.push(f), log, esLider,
    uid, hoy, ahoraHM, fechaISO, fechaLarga, sumaDias, minutosDe, hmDe, hora12, usd, mxn, pct, haversine, MESES, MESES_EN, DIAS, DIAS_EN,
    ZONAS, LUGARES, lugar, NODOS, TIPOS_VEHICULO, EXTRAS, CANALES, ESTADOS, METODOS, ACTIVOS, EN_RUTA, RUTAS: R,
    cotizar: (d) => cotizarCon(db.config, d), distanciaViaje, rutaEntre, rutaLugares, rutaViaje, eta, usaAutopista,
    solicitarViaje, despachar: (id) => { const v = viaje(id); const c = despachar(v); persist('datos'); return c; }, cambiarEstado, reasignar, setEnLinea, setPosicion, setGpsReal, registrarPago, confirmarPago, enviarMensaje, registrarGasto, guardarChecklist, calificar, vueloDe,
    chofer, vehiculo, cliente, aliado, viaje, viajeActivo, mensajesDe: (viajeId) => db.mensajes.filter(m => m.viajeId === viajeId), viajesDe: (choferId, fecha) => db.viajes.filter(v => v.choferId === choferId && (!fecha || v.fecha === fecha)),
    M, asistente,
  };
})();
