/* All Cabo Services · demo · núcleo compartido (datos, tarifas, despacho, simulación de GPS, métricas)
   Datos ilustrativos con semilla fija. Pagos, vuelos, WhatsApp y GPS de la flota son SIMULADOS (el GPS del teléfono del chofer puede ser real si lo permite). */
(function () {
  'use strict';
  const KEY = 'acs_demo_v6';
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
    // restaurantes y actividades (para sugerencias e itinerarios; posiciones aproximadas)
    { id: 'ff', nombre: 'Flora Farms', corto: 'Flora Farms', tipo: 'restaurante', nodo: 'sanjose', zona: 'sj', area: 'San José', pos: [23.0895, -109.6885] },
    { id: 'ac', nombre: 'Acre Restaurant', corto: 'Acre', tipo: 'restaurante', nodo: 'sanjose', zona: 'sj', area: 'San José', pos: [23.0820, -109.6930] },
    { id: 'ed', nombre: "Edith's Restaurant", corto: "Edith's", tipo: 'restaurante', nodo: 'csl', zona: 'csl', area: 'Cabo San Lucas', pos: [22.8885, -109.9045] },
    { id: 'sm', nombre: 'Sunset Monalisa', corto: 'Sunset Monalisa', tipo: 'restaurante', nodo: 'csl', zona: 'csl', area: 'Cabo San Lucas', pos: [22.8960, -109.8830] },
    { id: 'fa', nombre: 'El Farallón · Waldorf Astoria Pedregal', corto: 'El Farallón', tipo: 'restaurante', nodo: 'pedregal', zona: 'csl', area: 'Cabo San Lucas', pos: [22.8755, -109.9225] },
    { id: 'ofc', nombre: 'The Office on the Beach', corto: 'The Office', tipo: 'restaurante', nodo: 'csl', zona: 'csl', area: 'Cabo San Lucas', pos: [22.8895, -109.9030] },
    { id: 'art', nombre: 'San José del Cabo · Gallery District', corto: 'Gallery District', tipo: 'actividad', nodo: 'sanjose', zona: 'sj', area: 'San José', pos: [23.0620, -109.6975] },
    { id: 'mar', nombre: 'Marina Cabo San Lucas · boat tours', corto: 'Marina CSL', tipo: 'actividad', nodo: 'csl', zona: 'csl', area: 'Cabo San Lucas', pos: [22.8850, -109.9110] },
    { id: 'chb', nombre: 'Chileno Bay Beach', corto: 'Chileno Bay', tipo: 'actividad', nodo: 'chileno', zona: 'sj', area: 'Corridor', pos: [22.9440, -109.8130] },
    { id: 'cds', nombre: 'Cabo del Sol Golf', corto: 'Cabo del Sol', tipo: 'actividad', nodo: 'chileno', zona: 'sj', area: 'Corridor', pos: [22.9330, -109.8300] },
    { id: 'plg', nombre: 'Puerto Los Cabos Golf Club', corto: 'Puerto Los Cabos Golf', tipo: 'actividad', nodo: 'plc', zona: 'sj', area: 'San José', pos: [23.0630, -109.6600] },
    { id: 'qvg', nombre: 'Quivira Golf Club', corto: 'Quivira Golf', tipo: 'actividad', nodo: 'diamante', zona: 'csl', area: 'Pacific', pos: [22.9330, -110.0250] },
    { id: 'md', nombre: 'Médano Beach', corto: 'Médano Beach', tipo: 'actividad', nodo: 'csl', zona: 'csl', area: 'Cabo San Lucas', pos: [22.8900, -109.9020] },
  ];
  // sugerencias curadas (lista del demo; el dueño la edita desde la central)
  const SUGERENCIAS = [
    { id: 's_oo', cat: 'hotel', nombre: 'One&Only Palmilla', lugarId: 'oo', tagline: 'The Corridor classic', desc: 'Legendary resort on Palmilla Point with a swimmable beach, villas and a Jack Nicklaus course next door.', icono: '🏝️', color: '#2B2418' },
    { id: 's_lv', cat: 'hotel', nombre: 'Las Ventanas al Paraíso', lugarId: 'lv', tagline: 'Quiet luxury', desc: 'Adults-first hideaway with butler service, rooftop terraces and one of the best spas in Baja.', icono: '🌅', color: '#26201A' },
    { id: 's_es', cat: 'hotel', nombre: 'Esperanza, Auberge Resorts', lugarId: 'es', tagline: 'Cliffside, two coves', desc: 'Casitas over the sea, a beach club on Punta Ballena and an award-winning restaurant.', icono: '🌊', color: '#1C2430' },
    { id: 's_wa', cat: 'hotel', nombre: 'Waldorf Astoria Los Cabos Pedregal', lugarId: 'wa', tagline: 'Through the tunnel', desc: 'Reached through a private tunnel; every room has a plunge pool and a Pacific view.', icono: '🏔️', color: '#241E2A' },
    { id: 's_cb', cat: 'hotel', nombre: 'Chileno Bay Resort', lugarId: 'cb', tagline: 'Best swimming beach', desc: 'Modern resort on Chileno Bay, a protected cove with the calmest water on the Corridor.', icono: '🐠', color: '#1B2A2A' },
    { id: 's_mo', cat: 'hotel', nombre: 'Montage Los Cabos', lugarId: 'mo', tagline: 'Santa María Bay', desc: 'Family-friendly luxury on a snorkeling bay, with a huge spa and kids club.', icono: '🐚', color: '#2A2620' },
    { id: 's_ff', cat: 'restaurant', nombre: 'Flora Farms', lugarId: 'ff', tagline: 'Farm to table', desc: 'Dinner among the vegetable fields in the foothills of San José. Book ahead; ask your driver to wait.', icono: '🌿', color: '#1E2A1C', duracion: 3, cuando: 'Dinner · 6–10 PM' },
    { id: 's_ac', cat: 'restaurant', nombre: 'Acre', lugarId: 'ac', tagline: 'Cocktails in a mango grove', desc: 'Restaurant, bar and treehouses in a 25-acre farm outside San José. Great for sunset drinks.', icono: '🥭', color: '#2A2418', duracion: 3, cuando: 'Sunset · 5–9 PM' },
    { id: 's_ed', cat: 'restaurant', nombre: "Edith's", lugarId: 'ed', tagline: 'The Cabo classic', desc: 'Baja-Mexican cooking, tableside Caesar salad and a view of the bay near Médano Beach.', icono: '🍽️', color: '#2A1E18', duracion: 3, cuando: 'Dinner · 5–11 PM' },
    { id: 's_sm', cat: 'restaurant', nombre: 'Sunset Monalisa', lugarId: 'sm', tagline: 'Sunset over the Arch', desc: 'Cliffside Mediterranean dinner on the Corridor with the best view of Land\'s End.', icono: '🌇', color: '#2C2216', duracion: 3, cuando: 'Book for sunset' },
    { id: 's_fa', cat: 'restaurant', nombre: 'El Farallón', lugarId: 'fa', tagline: 'Seafood on the cliff', desc: 'At the Waldorf Astoria Pedregal: catch of the day sold by weight, waves under your table.', icono: '🦞', color: '#1F2230', duracion: 3, cuando: 'Dinner · 6–10 PM' },
    { id: 's_ofc', cat: 'restaurant', nombre: 'The Office on the Beach', lugarId: 'ofc', tagline: 'Feet in the sand', desc: 'Médano Beach institution for breakfast, ceviche and margaritas with the Arch in front of you.', icono: '🍹', color: '#1E2A2C', duracion: 3, cuando: 'Brunch or lunch' },
    { id: 's_arco', cat: 'activity', nombre: 'El Arco & Lover\'s Beach by boat', lugarId: 'mar', tagline: 'From the marina', desc: 'Glass-bottom boats and private charters leave from the Cabo San Lucas marina to the Arch and Lover\'s Beach.', icono: '⛵', color: '#1B2633', duracion: 3, cuando: 'Mornings are calmest' },
    { id: 's_whale', cat: 'activity', nombre: 'Whale watching', lugarId: 'mar', tagline: 'December to April', desc: 'Humpback and gray whales pass Land\'s End in winter. Tours leave from the marina; bring a jacket.', icono: '🐋', color: '#182634', duracion: 3, cuando: 'Dec–Apr · morning' },
    { id: 's_snork', cat: 'activity', nombre: 'Snorkel at Chileno Bay', lugarId: 'chb', tagline: 'Protected cove', desc: 'The easiest snorkeling on the Corridor, straight from the beach. We can wait while you swim.', icono: '🤿', color: '#1A2A2E', duracion: 4, cuando: 'Morning' },
    { id: 's_golf', cat: 'activity', nombre: 'Golf day', lugarId: 'cds', tagline: 'Cabo del Sol · Quivira · Puerto Los Cabos', desc: 'Three of the most photographed courses in Mexico. Tell us the course and tee time; your driver waits.', icono: '⛳', color: '#1F2A1E', duracion: 5, cuando: 'Tee times from 7 AM' },
    { id: 's_art', cat: 'activity', nombre: 'San José Art Walk', lugarId: 'art', tagline: 'Thursday evenings', desc: 'Galleries open late in the historic district, November to June. Pair it with dinner in town.', icono: '🎨', color: '#2A2030', duracion: 3, cuando: 'Thursdays · 5–9 PM · Nov–Jun' },
    { id: 's_medano', cat: 'activity', nombre: 'Médano Beach day', lugarId: 'md', tagline: 'Beach clubs & water sports', desc: 'The swimmable town beach in Cabo San Lucas, lined with beach clubs. We drop you off and pick you up.', icono: '🏖️', color: '#2A2618', duracion: 5, cuando: 'Any day' },
  ];
  // fotos ilustrativas por palabra clave (servicio público de fotos; si no carga, la app muestra el color de fondo)
  const FOTOS_KW = { s_oo: 'resort,pool', s_lv: 'luxury,hotel,pool', s_es: 'cliff,resort,sea', s_wa: 'hotel,ocean,view', s_cb: 'beach,resort', s_mo: 'bay,resort', s_ff: 'farm,restaurant', s_ac: 'cocktail,garden,bar', s_ed: 'mexican,food,dinner', s_sm: 'sunset,dinner,terrace', s_fa: 'seafood,dinner', s_ofc: 'beach,bar,sand', s_arco: 'boat,sea,rocks', s_whale: 'whale,ocean', s_snork: 'snorkel,reef', s_golf: 'golf,course,ocean', s_art: 'art,gallery,street', s_medano: 'beach,club,umbrella' };
  SUGERENCIAS.forEach((sg, i) => { sg.foto = 'https://loremflickr.com/480/320/' + (FOTOS_KW[sg.id] || 'travel,mexico') + '?lock=' + ((i + 3) * 11); });
  const lugar = (id) => LUGARES.find(l => l.id === id);
  const TIPOS_VEHICULO = {
    suburban: { id: 'suburban', nombre: 'Chevrolet Suburban', corto: 'Suburban', pax: 7, maletas: 7, icono: '🚙', tanque: 106, rendimiento: 6.5, desc: 'Black SUV · leather · cold water' },
    escalade: { id: 'escalade', nombre: 'Cadillac Escalade', corto: 'Escalade', pax: 6, maletas: 6, icono: '🚘', tanque: 90, rendimiento: 6, desc: 'Premium SUV · captain seats' },
    hiace: { id: 'hiace', nombre: 'Toyota Hiace', corto: 'Hiace', pax: 12, maletas: 12, icono: '🚐', tanque: 70, rendimiento: 8.5, desc: 'Group van · big luggage space' },
    sprinter: { id: 'sprinter', nombre: 'Mercedes-Benz Sprinter', corto: 'Sprinter', pax: 14, maletas: 16, icono: '🚐', tanque: 93, rendimiento: 9, desc: 'Luxury van · groups & weddings' },
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
    // choferes de flotas aliadas (proveedores de la plataforma)
    { id: 'd7', nombre: 'Héctor Salas', tel: '6241007788', vehiculoId: 'v9', nodo: 'csl', enLinea: true, calificacion: 4.8, ingreso: 2018, licenciaVence: '2027-05-11', idiomas: 'ES · EN', proveedorId: 'p2' },
    { id: 'd8', nombre: 'Paola Núñez', tel: '6241008899', vehiculoId: 'v10', nodo: 'sanjose', enLinea: true, calificacion: 4.9, ingreso: 2020, licenciaVence: '2028-02-03', idiomas: 'ES · EN', proveedorId: 'p2' },
    { id: 'd9', nombre: 'Raúl Cota', tel: '6241009900', vehiculoId: 'v11', nodo: 'sjd', enLinea: true, calificacion: 4.7, ingreso: 2016, licenciaVence: '2027-08-27', idiomas: 'ES · EN', proveedorId: 'p3' },
    { id: 'd10', nombre: 'Iván Beltrán', tel: '6241001010', vehiculoId: 'v12', nodo: 'pacifico', enLinea: false, calificacion: 4.8, ingreso: 2019, licenciaVence: '2027-12-15', idiomas: 'ES · EN', proveedorId: 'p4' },
    { id: 'd11', nombre: 'Fernando Lugo', tel: '6241111213', vehiculoId: 'v13', nodo: 'sjd', enLinea: true, calificacion: 4.9, ingreso: 2017, licenciaVence: '2028-01-20', idiomas: 'ES · EN', proveedorId: 'p5' },
    { id: 'd12', nombre: 'Karla Mendoza', tel: '6241121314', vehiculoId: 'v14', nodo: 'palmilla', enLinea: true, calificacion: 4.8, ingreso: 2020, licenciaVence: '2027-07-09', idiomas: 'ES · EN', proveedorId: 'p5' },
    { id: 'd13', nombre: 'Omar Verdugo', tel: '6241131415', vehiculoId: 'v15', nodo: 'csl', enLinea: true, calificacion: 4.7, ingreso: 2015, licenciaVence: '2027-04-02', idiomas: 'ES · EN', proveedorId: 'p6' },
    { id: 'd14', nombre: 'Lucía Amador', tel: '6241141516', vehiculoId: 'v16', nodo: 'pedregal', enLinea: false, calificacion: 4.9, ingreso: 2021, licenciaVence: '2028-05-17', idiomas: 'ES · EN · FR', proveedorId: 'p6' },
    { id: 'd15', nombre: 'Tomás Arriola', tel: '6241151617', vehiculoId: 'v17', nodo: 'plc', enLinea: true, calificacion: 4.8, ingreso: 2018, licenciaVence: '2027-10-30', idiomas: 'ES · EN', proveedorId: 'p3' },
    { id: 'd16', nombre: 'Gabriela Soto', tel: '6241161718', vehiculoId: 'v18', nodo: 'sanjose', enLinea: true, calificacion: 4.9, ingreso: 2019, licenciaVence: '2028-03-08', idiomas: 'ES · EN', proveedorId: 'p2' },
  ];
  const PROVEEDORES = [
    { id: 'acs', nombre: 'All Cabo Services', propio: true, contacto: 'Juan Carlos Macías', comision: 0, zona: 'Los Cabos', desde: 2011 },
    { id: 'p2', nombre: 'Baja Elite Transfers', propio: false, contacto: 'Mariana Ochoa', tel: '6241112233', comision: 0.20, zona: 'Cabo San Lucas', desde: 2026, banco: 'Pago semanal por transferencia' },
    { id: 'p3', nombre: 'Corridor Luxury Vans', propio: false, contacto: 'Esteban Villarreal', tel: '6241223344', comision: 0.20, zona: 'Corredor y San José', desde: 2026, banco: 'Pago semanal por transferencia' },
    { id: 'p4', nombre: 'Pacific Coast Rides', propio: false, contacto: 'Diana Arce', tel: '6241334455', comision: 0.18, zona: 'Pacífico', desde: 2026, banco: 'Pago quincenal por transferencia' },
    { id: 'p5', nombre: 'Cabo Executive Shuttle', propio: false, contacto: 'Ernesto Villalobos', tel: '6241445566', comision: 0.20, zona: 'Aeropuerto y Corredor', desde: 2026, banco: 'Pago semanal por transferencia' },
    { id: 'p6', nombre: "Land's End Limo", propio: false, contacto: 'Renata Osuna', tel: '6241556677', comision: 0.22, zona: 'Cabo San Lucas y Pedregal', desde: 2026, banco: 'Pago semanal por transferencia' },
  ];
  const AEROLINEAS = [['UA', 'United', 'Los Angeles (LAX)'], ['AA', 'American', 'Dallas (DFW)'], ['AS', 'Alaska', 'Seattle (SEA)'], ['DL', 'Delta', 'Atlanta (ATL)'], ['WN', 'Southwest', 'Denver (DEN)'], ['WS', 'WestJet', 'Calgary (YYC)'], ['AC', 'Air Canada', 'Vancouver (YVR)'], ['AM', 'Aeroméxico', 'Ciudad de México (MEX)'], ['Y4', 'Volaris', 'Guadalajara (GDL)'], ['UA', 'United', 'San Francisco (SFO)'], ['AA', 'American', 'Phoenix (PHX)'], ['DL', 'Delta', 'Salt Lake City (SLC)']];

  function semilla() {
    const rnd = mulberry32(2026_0914); const pick = (a) => a[Math.floor(rnd() * a.length)];
    const H = hoy();
    const db = { version: 1, creado: new Date().toISOString(), config: { tipoCambio: 17.13, esperaAeropuerto: 35, pagoChoferPct: 0.25, mxnPorKm: 4.2, caseta: 89, comisionAliadoPct: 0.10, comisionPlataforma: 0.20, horaVehiculo: { suburban: 75, escalade: 95, hiace: 90, sprinter: 110 }, horasMin: 3, paradaPrecio: 25, velocidadKmh: 60, factorDemo: 25, zonas: JSON.parse(JSON.stringify(ZONAS)), extras: JSON.parse(JSON.stringify(EXTRAS)), whatsapp: true } };
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
    db.vehiculos.forEach(v => { v.proveedorId = 'acs'; });
    db.vehiculos.push(
      { id: 'v9', tipo: 'suburban', anio: 2023, placa: 'BCS-771-J', color: 'Negro', km: 54200, seguroVence: sumaDias(H, 190), permisoVence: sumaDias(H, 240), servicioCadaKm: 10000, ultimoServicioKm: 50000, proveedorId: 'p2' },
      { id: 'v10', tipo: 'escalade', anio: 2024, placa: 'BCS-415-K', color: 'Negro', km: 21700, seguroVence: sumaDias(H, 280), permisoVence: sumaDias(H, 300), servicioCadaKm: 10000, ultimoServicioKm: 20000, proveedorId: 'p2' },
      { id: 'v11', tipo: 'sprinter', anio: 2022, placa: 'BCS-628-L', color: 'Negro', km: 97300, seguroVence: sumaDias(H, 75), permisoVence: sumaDias(H, 150), servicioCadaKm: 15000, ultimoServicioKm: 90000, proveedorId: 'p3' },
      { id: 'v12', tipo: 'suburban', anio: 2022, placa: 'BCS-233-M', color: 'Blanco', km: 76800, seguroVence: sumaDias(H, 120), permisoVence: sumaDias(H, 90), servicioCadaKm: 10000, ultimoServicioKm: 70000, proveedorId: 'p4' },
      { id: 'v13', tipo: 'escalade', anio: 2024, placa: 'BCS-812-N', color: 'Negro', km: 18400, seguroVence: sumaDias(H, 260), permisoVence: sumaDias(H, 310), servicioCadaKm: 10000, ultimoServicioKm: 10000, proveedorId: 'p5' },
      { id: 'v14', tipo: 'suburban', anio: 2023, placa: 'BCS-377-O', color: 'Negro', km: 43900, seguroVence: sumaDias(H, 150), permisoVence: sumaDias(H, 200), servicioCadaKm: 10000, ultimoServicioKm: 40000, proveedorId: 'p5' },
      { id: 'v15', tipo: 'sprinter', anio: 2023, placa: 'BCS-590-P', color: 'Negro', km: 66100, seguroVence: sumaDias(H, 95), permisoVence: sumaDias(H, 180), servicioCadaKm: 15000, ultimoServicioKm: 60000, proveedorId: 'p6' },
      { id: 'v16', tipo: 'escalade', anio: 2023, placa: 'BCS-104-Q', color: 'Negro', km: 39200, seguroVence: sumaDias(H, 210), permisoVence: sumaDias(H, 140), servicioCadaKm: 10000, ultimoServicioKm: 30000, proveedorId: 'p6' },
      { id: 'v17', tipo: 'suburban', anio: 2024, placa: 'BCS-655-R', color: 'Negro', km: 22600, seguroVence: sumaDias(H, 330), permisoVence: sumaDias(H, 290), servicioCadaKm: 10000, ultimoServicioKm: 20000, proveedorId: 'p3' },
      { id: 'v18', tipo: 'sprinter', anio: 2024, placa: 'BCS-720-S', color: 'Negro', km: 31500, seguroVence: sumaDias(H, 240), permisoVence: sumaDias(H, 350), servicioCadaKm: 15000, ultimoServicioKm: 30000, proveedorId: 'p2' },
    );
    db.vehiculos.forEach((v, i) => { v.combustible = [72, 38, 91, 55, 64, 27, 83, 46, 69, 58, 34, 77, 88, 41, 62, 95, 29, 73][i] || 60; });
    db.proveedores = JSON.parse(JSON.stringify(PROVEEDORES));
    db.sugerencias = SUGERENCIAS.map(x => ({ ...x, activa: true }));
    db.itinerarios = []; db.invitaciones = [];
    // requisitos para aceptar flotas ajenas (el dueño los edita) y solicitudes recibidas
    db.config.requisitosFlota = { anioMin: 2021, tipos: ['suburban', 'escalade', 'sprinter'], colores: ['Negro'], calificacionMin: 4.7, ingles: true, seguro: true, permisoTuristico: true };
    db.solicitudes = [
      { id: 'sol1', empresa: 'Baja Premier Transport', contacto: 'Rodrigo Esparza', tel: '6241556677', zona: 'Corredor y San José', desde: 2019, estado: 'pendiente', fecha: sumaDias(H, -2), mensaje: 'Trabajamos con Las Ventanas y Palmilla; queremos tomar traslados de aeropuerto en temporada alta.', vehiculos: [{ tipo: 'escalade', anio: 2024, placa: 'BCS-908-P', color: 'Negro' }, { tipo: 'suburban', anio: 2023, placa: 'BCS-611-Q', color: 'Negro' }], choferes: [{ nombre: 'Rodrigo Esparza', calificacion: 4.9, idiomas: 'ES · EN', anios: 9 }, { nombre: 'Marisol Peña', calificacion: 4.8, idiomas: 'ES · EN', anios: 6 }], docs: { seguro: true, permisoTuristico: true, licencias: true, factura: true } },
      { id: 'sol2', empresa: 'Cabo Vans Express', contacto: 'Julio Cárdenas', tel: '6241667788', zona: 'Cabo San Lucas', desde: 2015, estado: 'pendiente', fecha: sumaDias(H, -5), mensaje: 'Tenemos dos Hiace y mucha experiencia con grupos grandes.', vehiculos: [{ tipo: 'hiace', anio: 2018, placa: 'BCS-233-R', color: 'Blanco' }, { tipo: 'hiace', anio: 2020, placa: 'BCS-234-S', color: 'Blanco' }], choferes: [{ nombre: 'Julio Cárdenas', calificacion: 4.5, idiomas: 'ES', anios: 11 }], docs: { seguro: true, permisoTuristico: false, licencias: true, factura: false } },
      { id: 'sol3', empresa: "Land's End Black Cars", contacto: 'Andrea Fierro', tel: '6241778899', zona: 'Pacífico', desde: 2022, estado: 'pendiente', fecha: sumaDias(H, -1), mensaje: 'Una Sprinter 2024 de lujo con chofer bilingüe calificado 4.9.', vehiculos: [{ tipo: 'sprinter', anio: 2024, placa: 'BCS-450-T', color: 'Negro' }], choferes: [{ nombre: 'Mauricio Fierro', calificacion: 4.9, idiomas: 'ES · EN', anios: 7 }], docs: { seguro: true, permisoTuristico: true, licencias: true, factura: true } },
      { id: 'sol4', empresa: 'Todos Santos Rides', contacto: 'Beatriz Ceseña', tel: '6121234567', zona: 'Todos Santos', desde: 2021, estado: 'rechazada', fecha: sumaDias(H, -12), resuelta: sumaDias(H, -10), motivo: 'Fuera de la zona de servicio de Los Cabos', vehiculos: [{ tipo: 'suburban', anio: 2022, placa: 'BCS-102-U', color: 'Gris' }], choferes: [{ nombre: 'Beatriz Ceseña', calificacion: 4.8, idiomas: 'ES · EN', anios: 4 }], docs: { seguro: true, permisoTuristico: true, licencias: true, factura: true } },
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
    const meses = (m) => [5.0, 4.8, 5.2, 4.3, 3.4, 3.2, 4.4, 5.4, 6.0, 2.6, 3.6, 5.2][m]; // viajes por día según temporada (ilustrativo; agosto y septiembre muy movidos)
    const finVeh = (tipo) => db.vehiculos.filter(v => v.tipo === tipo);
    for (let back = 365; back >= 1; back--) {
      const fecha = sumaDias(H, -back); const m = Number(fecha.split('-')[1]) - 1; const dow = new Date(fecha + 'T12:00:00').getDay();
      let n = meses(m) * (dow === 5 || dow === 6 || dow === 0 ? 1.35 : 0.85); n = Math.floor(n) + (rnd() < n % 1 ? 1 : 0);
      for (let k = 0; k < n; k++) {
        const hotel = pick(hoteles); const desdeAero = rnd() < 0.62; const redondo = rnd() < 0.22;
        const origenId = desdeAero ? 'sjd' : hotel.id, destinoId = desdeAero ? hotel.id : (rnd() < 0.85 ? 'sjd' : pick(hoteles).id);
        const cliente = pick(db.clientes); const canal = pick(['app', 'app', 'app', 'whatsapp', 'whatsapp', 'concierge', 'concierge', 'concierge', 'planner', 'repeticion', 'telefono']);
        const pax = 1 + Math.floor(rnd() * 8); const tipo = pax > 7 ? (rnd() < 0.6 ? 'sprinter' : 'hiace') : (rnd() < 0.3 ? 'escalade' : 'suburban');
        const aliada = back <= 180 && rnd() < 0.3; const cand = finVeh(tipo).filter(x => aliada ? x.proveedorId !== 'acs' : x.proveedorId === 'acs'); const veh = cand.length ? pick(cand) : pick(finVeh(tipo)); const chofer = db.choferes.find(c => c.vehiculoId === veh.id) || pick(db.choferes.filter(c => (c.proveedorId || 'acs') === veh.proveedorId));
        const extras = EXTRAS.filter(e => e.precio && rnd() < 0.22).map(e => e.id);
        const q = cotizarCon(db.config, { origenId, destinoId, redondo, extras });
        const estado = rnd() < 0.92 ? 'completado' : (rnd() < 0.6 ? 'cancelado' : 'no_show');
        const aliadoId = canal === 'concierge' || canal === 'planner' ? (cliente.aliadoId || pick(db.aliados).id) : null;
        const hora = hmDe(480 + Math.floor(rnd() * 780)); const dist = distanciaViaje(origenId, destinoId);
        const metodo = pick(['tarjeta', 'tarjeta', 'tarjeta', 'tarjeta', 'zelle', 'zelle', 'zelle', 'efectivo', 'efectivo', 'applepay', 'transferencia']);
        const v = { id: 'h' + back + '_' + k, fecha, hora, creado: new Date(fecha + 'T' + hora + ':00').getTime() - 86400000 * (1 + Math.floor(rnd() * 20)), origenId, destinoId, zona: q.zona, redondo, vehiculo: tipo, vehiculoId: veh.id, choferId: chofer.id, clienteId: cliente.id, nombre: cliente.nombre, pasajeros: pax, maletas: pax + Math.floor(rnd() * 3), vuelo: desdeAero ? { num: pick(AEROLINEAS)[0] + ' ' + (100 + Math.floor(rnd() * 2400)), estado: 'a tiempo', minutos: 0 } : null, extras, precio: q, pago: { metodo, estado: estado === 'completado' ? 'aprobado' : (estado === 'no_show' ? 'aprobado' : 'reembolsado'), ref: '' }, canal, aliadoId, cuentaId: cliente.cuentaId, estado, km: dist.km * (redondo ? 2 : 1), min: dist.min, costo: costoDe(db.config, dist.km * (redondo ? 2 : 1), usaAutopista(origenId, destinoId), redondo, q.total), calificacion: estado === 'completado' ? (rnd() < 0.85 ? 5 : 4) : null, tiempos: {} };
        if (estado === 'completado') { cliente.gasto += q.total; }
        v.proveedorId = veh.proveedorId; v.modo = redondo ? 'redondo' : 'sencillo'; v.paradas = []; v.compartidoCon = []; aplicarLiquidacion(db.config, v, back > 21);
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
      // día movido: más viajes, varios cubiertos por flotas aliadas
      { hora: '07:40', o: 'sjd', d: 'cb', c: 'c21', ch: 'd7', tipo: 'suburban', pax: 3, estado: 'completado', canal: 'app', metodo: 'applepay', vuelo: null },
      { hora: '08:50', o: 'gv', d: 'sjd', c: 'c22', ch: 'd9', tipo: 'sprinter', pax: 9, estado: 'completado', canal: 'concierge', aliado: 'a10', metodo: 'tarjeta', vuelo: null },
      { hora: '10:10', o: 'sjd', d: 'pbs', c: 'c23', ch: 'd12', tipo: 'suburban', pax: 4, estado: 'completado', canal: 'app', metodo: 'zelle', vuelo: db.vuelos[1].num },
      { hora: '11:45', o: 'sjd', d: 'es', c: 'c24', ch: 'd1', tipo: 'escalade', pax: 2, estado: 'completado', canal: 'repeticion', metodo: 'applepay', vuelo: db.vuelos[2].num },
      { hora: '12:20', o: 'wa', d: 'ff', c: 'c25', ch: 'd13', tipo: 'sprinter', pax: 8, estado: 'completado', canal: 'app', metodo: 'tarjeta', vuelo: null },
      { hora: '13:30', o: 'sjd', d: 'vi', c: 'c26', ch: 'd8', tipo: 'escalade', pax: 2, estado: 'a_bordo', canal: 'app', metodo: 'applepay', vuelo: db.vuelos[3].num },
      { hora: '14:05', o: 'sjd', d: 'gs', c: 'c27', ch: 'd11', tipo: 'escalade', pax: 3, estado: 'en_camino', canal: 'concierge', aliado: 'a3', metodo: 'tarjeta', vuelo: db.vuelos[5].num },
      { hora: '14:15', o: 'mo', d: 'sjd', c: 'c28', ch: 'd15', tipo: 'suburban', pax: 4, estado: 'a_bordo', canal: 'app', metodo: 'zelle', vuelo: null },
      { hora: '15:10', o: 'sjd', d: 'lv', c: 'c29', ch: 'd16', tipo: 'sprinter', pax: 10, estado: 'asignado', canal: 'planner', aliado: 'a6', metodo: 'transferencia', vuelo: db.vuelos[6].num },
      { hora: '17:30', o: 'oo', d: 'sm', c: 'c30', ch: 'd3', tipo: 'suburban', pax: 4, estado: 'asignado', canal: 'app', metodo: 'applepay', vuelo: null, redondo: true },
      { hora: '19:15', o: 'sjd', d: 'hr', c: 'c31', ch: 'd12', tipo: 'suburban', pax: 5, estado: 'asignado', canal: 'whatsapp', metodo: 'efectivo', vuelo: db.vuelos[10].num },
    ];
    const manana = sumaDias(H, 1), pasado = sumaDias(H, 2);
    const proxV = [
      { fecha: manana, hora: '10:15', o: 'sjd', d: 'cb', c: 'c19', ch: 'd3', tipo: 'suburban', pax: 2, estado: 'asignado', canal: 'app', metodo: 'tarjeta', vuelo: 'AS 1522' },
      { fecha: manana, hora: '13:40', o: 'sjd', d: 'oo', c: 'c6', ch: 'd4', tipo: 'sprinter', pax: 9, estado: 'asignado', canal: 'planner', aliado: 'a5', metodo: 'transferencia', vuelo: 'UA 1712', cuenta: 'cta1' },
      { fecha: pasado, hora: '11:00', o: 'wa', d: 'sjd', c: 'c20', ch: 'd2', tipo: 'suburban', pax: 3, estado: 'asignado', canal: 'concierge', aliado: 'a3', metodo: 'zelle', vuelo: null },
      { fecha: manana, hora: '09:20', o: 'sjd', d: 'es', c: 'c32', ch: 'd11', tipo: 'escalade', pax: 2, estado: 'asignado', canal: 'app', metodo: 'applepay', vuelo: 'DL 388' },
      { fecha: manana, hora: '12:05', o: 'sjd', d: 'wa', c: 'c33', ch: 'd7', tipo: 'suburban', pax: 4, estado: 'asignado', canal: 'concierge', aliado: 'a3', metodo: 'tarjeta', vuelo: 'AA 1177' },
      { fecha: manana, hora: '16:40', o: 'cb', d: 'sjd', c: 'c34', ch: 'd16', tipo: 'sprinter', pax: 11, estado: 'asignado', canal: 'planner', aliado: 'a5', metodo: 'transferencia', vuelo: null, cuenta: 'cta1' },
      { fecha: pasado, hora: '14:30', o: 'sjd', d: 'no', c: 'c35', ch: 'd13', tipo: 'sprinter', pax: 7, estado: 'asignado', canal: 'app', metodo: 'zelle', vuelo: 'WN 2231' },
    ];
    [...hoyV.map(x => ({ ...x, fecha: H })), ...proxV].forEach((x, i) => {
      const cli = db.clientes.find(c => c.id === x.c); const q = cotizarCon(db.config, { origenId: x.o, destinoId: x.d, redondo: !!x.redondo, extras: x.extras || [] }); const dist = distanciaViaje(x.o, x.d);
      const vuelo = x.vuelo ? (db.vuelos.find(f => f.num === x.vuelo) || { num: x.vuelo, aerolinea: 'United', origen: 'Los Angeles (LAX)', programada: hmDe(minutosDe(x.hora) - 35), estado: 'a tiempo', minutos: 0 }) : null;
      const veh = db.vehiculos.find(v => x.ch ? v.id === db.choferes.find(c => c.id === x.ch).vehiculoId : v.tipo === x.tipo);
      const v = { id: 't' + i, fecha: x.fecha, hora: x.hora, creado: Date.now() - 86400000 * (2 + i), origenId: x.o, destinoId: x.d, zona: q.zona, redondo: !!x.redondo, vehiculo: veh.tipo, vehiculoId: veh.id, choferId: x.ch, clienteId: x.c, nombre: cli.nombre, pasajeros: x.pax, maletas: x.pax + 1, vuelo: vuelo ? { num: vuelo.num, aerolinea: vuelo.aerolinea, origen: vuelo.origen, programada: vuelo.programada, estado: vuelo.estado, minutos: vuelo.minutos } : null, extras: x.extras || [], precio: q, pago: { metodo: x.metodo, estado: x.pagoEstado || (x.metodo === 'efectivo' ? (x.estado === 'completado' ? 'cobrado' : 'pendiente') : 'aprobado'), ref: x.metodo === 'zelle' ? 'ZL-' + (48211 + i) : '' }, canal: x.canal, aliadoId: x.aliado || null, cuentaId: x.cuenta || cli.cuentaId || null, estado: x.estado, km: dist.km * (x.redondo ? 2 : 1), min: dist.min, costo: costoDe(db.config, dist.km * (x.redondo ? 2 : 1), usaAutopista(x.o, x.d), !!x.redondo, q.total), calificacion: x.estado === 'completado' ? 5 : null, notas: x.notas || '', tiempos: x.estado === 'completado' ? { asignado: '07:00', en_camino: hmDe(minutosDe(x.hora) - 40), llegue: hmDe(minutosDe(x.hora) - 8), a_bordo: x.hora, completado: hmDe(minutosDe(x.hora) + dist.min + 5) } : (x.estado === 'a_bordo' ? { asignado: '07:00', en_camino: hmDe(minutosDe(x.hora) - 45), llegue: hmDe(minutosDe(x.hora) - 6), a_bordo: x.hora } : (x.estado === 'en_camino' ? { asignado: '07:00', en_camino: ahoraHM() } : { asignado: '07:00' })) };
      if (vuelo && vuelo.minutos) { v.horaOriginal = v.hora; v.hora = hmDe(minutosDe(vuelo.programada) + vuelo.minutos + db.config.esperaAeropuerto); }
      v.proveedorId = veh.proveedorId; v.modo = v.redondo ? 'redondo' : 'sencillo'; v.paradas = []; v.compartidoCon = []; aplicarLiquidacion(db.config, v, false);
      db.viajes.push(v);
    });
    // viaje compartido entre amigos (la cena de esta noche: c2 invita a c1 y c3 y dividen el pago)
    const cena = db.viajes.find(v => v.id === 't7'); if (cena) { compartirEn(db, cena, ['c1', 'c3'], 'igual'); cena.partes.c1.estado = 'pagado'; }
    // una estancia planeada desde la app (itinerario de Sarah Thompson, llega en 3 días)
    crearItinerarioEn(db, { clienteId: 'c1', hotelId: 'oo', llegada: { fecha: sumaDias(H, 3), hora: '13:20', vuelo: 'UA 1234' }, salida: { fecha: sumaDias(H, 8), hora: '14:05', vuelo: 'UA 1235' }, pax: 4, maletas: 5, vehiculo: 'escalade', extras: ['cervezas', 'silla'], actividades: [{ sugerenciaId: 's_ff', fecha: sumaDias(H, 4), hora: '18:30', esperar: true }, { sugerenciaId: 's_arco', fecha: sumaDias(H, 5), hora: '09:00', esperar: false }, { sugerenciaId: 's_sm', fecha: sumaDias(H, 7), hora: '17:30', esperar: true }], notas: 'Anniversary trip · Lucas (3) needs a car seat', pago: { metodo: 'applepay', estado: 'aprobado' }, creado: Date.now() - 86400000 * 4 });
    db.invitaciones.push({ id: 'inv1', de: 'c5', para: 'c1', contacto: 'sarah.thompson@mail.com', estado: 'pendiente', t: Date.now() - 3600000 * 5 });
    // los dos viajes vivos arrancan su simulación
    db.viajes.filter(v => v.fecha === H && (v.estado === 'a_bordo' || v.estado === 'en_camino')).forEach(v => { const ch = db.choferes.find(c => c.id === v.choferId); if (v.estado === 'a_bordo') { const o = lugar(v.origenId); ch.pos = o.pos.slice(); ch.nodo = o.nodo; } iniciarSimEn(db, v, v.estado === 'a_bordo' ? 'a_destino' : 'a_recoger'); if (v.estado === 'a_bordo') v.sim.avance = v.sim.km * 0.35; else v.sim.avance = v.sim.km * 0.2; });
    // mensajes de ejemplo
    const t4 = db.viajes.find(v => v.id === 't4'), t5 = db.viajes.find(v => v.id === 't5');
    db.mensajes.push({ id: 'm1', viajeId: t4.id, de: 'cliente', texto: 'Hi Ana! We are 5 with 6 bags, is that ok?', t: Date.now() - 3600000 }, { id: 'm2', viajeId: t4.id, de: 'chofer', texto: 'Perfect, the Suburban fits all. See you at Door 3 with the ACS sign.', t: Date.now() - 3500000 }, { id: 'm3', viajeId: t5.id, de: 'chofer', texto: 'Good afternoon Mr. Hoffman, I am on my way to Chileno Bay. ETA 15 min.', t: Date.now() - 600000 });
    // gastos de 12 meses de la flota propia: gasolina y casetas por viaje, lavado semanal, seguro mensual y servicios en taller
    let gi = 0; const propiosV = db.vehiculos.filter(v => v.proveedorId === 'acs');
    db.viajes.filter(v => v.estado === 'completado' && (!v.proveedorId || v.proveedorId === 'acs')).forEach(v => { db.gastos.push({ id: 'g' + (gi++), fecha: v.fecha, choferId: v.choferId, vehiculoId: v.vehiculoId, tipo: 'gasolina', monto: v.costo.gasolina, viajeId: v.id, foto: rnd() < 0.7, detalle: 'Gasolina · ' + Math.round(v.km) + ' km' }); if (v.costo.casetas) db.gastos.push({ id: 'g' + (gi++), fecha: v.fecha, choferId: v.choferId, vehiculoId: v.vehiculoId, tipo: 'caseta', monto: v.costo.casetas, viajeId: v.id, foto: rnd() < 0.5, detalle: 'Autopista SJD · ' + (v.redondo ? 'ida y vuelta' : 'un tramo') }); });
    for (let back = 364; back >= 0; back -= 7) { const f = sumaDias(H, -back); propiosV.forEach(ve => { const ch = db.choferes.find(c => c.vehiculoId === ve.id); db.gastos.push({ id: 'g' + (gi++), fecha: f, choferId: ch ? ch.id : null, vehiculoId: ve.id, tipo: 'lavado', monto: 250, viajeId: null, foto: false, detalle: 'Lavado y aspirado semanal' }); }); }
    for (let mb = 11; mb >= 0; mb--) { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - mb); const f = fechaISO(d); if (f > H) continue; propiosV.forEach(ve => { db.gastos.push({ id: 'g' + (gi++), fecha: f, choferId: null, vehiculoId: ve.id, tipo: 'seguro', monto: ve.tipo === 'sprinter' || ve.tipo === 'hiace' ? 4900 : 4200, viajeId: null, foto: false, detalle: 'Póliza de seguro · mensualidad' }); }); }
    const SERVICIOS = [['Servicio de aceite y filtros', 3800], ['Frenos delanteros', 6200], ['Llantas (4)', 16800], ['Servicio mayor · afinación', 9400], ['Batería', 4100], ['Alineación y balanceo', 1500], ['Aire acondicionado', 5600], ['Suspensión · amortiguadores', 7300]];
    propiosV.forEach((ve, i) => { const n = 3 + (i % 3); for (let k = 0; k < n; k++) { const f = sumaDias(H, -(15 + Math.floor(rnd() * 345))); const sv = pick(SERVICIOS); db.gastos.push({ id: 'g' + (gi++), fecha: f, choferId: null, vehiculoId: ve.id, tipo: 'mantenimiento', monto: sv[1] + Math.floor(rnd() * 600), viajeId: null, foto: true, detalle: sv[0] + ' · taller' }); } });
    db.gastos.sort((a, b) => a.fecha < b.fecha ? 1 : -1);
    db.checklists = db.choferes.filter(c => c.enLinea).map(c => ({ id: 'ck' + c.id, fecha: H, choferId: c.id, vehiculoId: c.vehiculoId, items: { limpieza: true, llantas: true, agua: true, gasolina: true, documentos: true, silla: c.id === 'd1' }, hora: c.checkin }));
    db.bitacora.push({ t: Date.now() - 7200000, quien: 'sistema', que: 'Viaje t2 completado · One&Only Palmilla' }, { t: Date.now() - 5400000, quien: 'sistema', que: 'Vuelo UA 1234 retrasado 25 min · recogida ajustada' }, { t: Date.now() - 1800000, quien: 'Ana Castro', que: 'Pasajero a bordo · viaje t4' });
    db.viajes.sort((a, b) => (a.fecha + a.hora) < (b.fecha + b.hora) ? -1 : 1);
    return db;
  }

  // ───────────────────────── tarifas y costos ─────────────────────────
  function zonaDe(origenId, destinoId) { const o = lugar(origenId), d = lugar(destinoId); return (d && d.zona) || (o && o.zona) || 'sj'; }
  function cotizarCon(cfg, d) {
    const zona = zonaDe(d.origenId, d.destinoId); const z = cfg.zonas[zona]; const modo = d.modo || (d.redondo ? 'redondo' : 'sencillo');
    let base, horas = null, tarifaHora = null;
    if (modo === 'horas') { horas = Math.max(cfg.horasMin || 3, Number(d.horas) || cfg.horasMin || 3); tarifaHora = (cfg.horaVehiculo || {})[d.vehiculo] || 75; base = horas * tarifaHora; }
    else base = modo === 'redondo' ? z.redondo : z.sencillo;
    const det = (d.extras || []).map(id => cfg.extras.find(e => e.id === id)).filter(Boolean); const ext = det.reduce((a, e) => a + e.precio, 0);
    const paradas = (d.paradas || []).filter(p => p && (p.texto || p.lugarId)); const pp = cfg.paradaPrecio == null ? 25 : cfg.paradaPrecio; const par = paradas.length * pp;
    const detalle = det.map(e => ({ id: e.id, en: e.en, es: e.es, precio: e.precio })).concat(paradas.map(p => { const l = p.lugarId ? lugar(p.lugarId) : null; const t = p.texto || (l ? (l.corto || l.nombre) : 'Stop'); return { id: 'parada', en: 'Stop · ' + t, es: 'Parada · ' + t, precio: pp }; }));
    return { zona, modo, base, horas, tarifaHora, extras: ext, paradas: par, total: base + ext + par, detalle };
  }
  // liquidación por viaje: flota propia = ingreso completo; flota aliada = comisión de plataforma para ACS, el resto al dueño de la camioneta (que paga chofer y gasolina)
  function aplicarLiquidacion(cfg, v, liquidado) {
    const propio = !v.proveedorId || v.proveedorId === 'acs'; const total = v.precio.total;
    if (propio) { v.liquidacion = { propio: true, plataforma: total, proveedor: 0, pct: 0, liquidado: true }; v.neto = total; return; }
    const prov = (PROVEEDORES.find(p => p.id === v.proveedorId) || {}); const pct = prov.comision == null ? (cfg.comisionPlataforma || 0.2) : prov.comision; const plataforma = Math.round(total * pct * 100) / 100;
    v.liquidacion = { propio: false, pct, plataforma, proveedor: Math.round((total - plataforma) * 100) / 100, liquidado: !!liquidado }; v.neto = plataforma;
    v.costo = { gasolina: 0, casetas: 0, chofer: 0, totalMXN: 0 }; // los costos del viaje son del proveedor
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
    v.choferId = c.id; v.vehiculoId = c.vehiculoId; v.vehiculo = vehiculo(c.vehiculoId).tipo; v.proveedorId = vehiculo(c.vehiculoId).proveedorId || 'acs'; aplicarLiquidacion(db.config, v, false); v.estado = 'asignado'; v.tiempos.asignado = ahoraHM(); v.distanciaChofer = Math.round(haversine(c.pos, o.pos) * 10) / 10;
    log('despacho', `Viaje de ${v.nombre} asignado a ${c.nombre} (${v.distanciaChofer} km del punto)`); emitir({ tipo: 'viaje_asignado', viajeId: v.id, choferId: c.id });
    return c;
  }
  function solicitarViaje(d) {
    const cli = cliente(d.clienteId); const q = cotizarCon(db.config, d); const dist = distanciaViaje(d.origenId, d.destinoId);
    let hora = d.hora; let vuelo = null;
    if (d.vuelo) { const f = vueloDe(d.vuelo); vuelo = f ? { num: f.num, aerolinea: f.aerolinea, origen: f.origen, programada: f.programada, estado: f.estado, minutos: f.minutos } : { num: d.vuelo.toUpperCase(), aerolinea: '', origen: '', programada: d.hora, estado: 'a tiempo', minutos: 0 }; if (f && d.fecha === hoy()) hora = hmDe(minutosDe(f.programada) + f.minutos + db.config.esperaAeropuerto); }
    const v = { id: uid('t'), fecha: d.fecha, hora, horaOriginal: d.hora !== hora ? d.hora : undefined, creado: Date.now(), origenId: d.origenId, destinoId: d.destinoId, zona: q.zona, modo: q.modo, redondo: q.modo === 'redondo', horas: q.horas, regresoHora: d.regresoHora || null, paradas: (d.paradas || []).filter(p => p && (p.texto || p.lugarId)), itinerarioId: d.itinerarioId || null, compartidoCon: [], vehiculo: d.vehiculo, vehiculoId: null, choferId: null, clienteId: d.clienteId, nombre: cli ? cli.nombre : d.nombre, pasajeros: d.pasajeros || 2, maletas: d.maletas || 2, vuelo, extras: d.extras || [], precio: q, pago: d.pago || { metodo: 'tarjeta', estado: 'aprobado', ref: '' }, canal: d.canal || 'app', aliadoId: d.aliadoId || (cli ? cli.aliadoId : null), cuentaId: d.cuentaId || (cli ? cli.cuentaId : null), estado: 'solicitado', km: dist.km * (q.modo === 'redondo' ? 2 : 1), min: dist.min, costo: costoDe(db.config, dist.km * (q.modo === 'redondo' ? 2 : 1), usaAutopista(d.origenId, d.destinoId), q.modo === 'redondo', q.total), calificacion: null, notas: d.notas || '', tiempos: {} };
    if (d.asap) { v.asap = true; v.fecha = hoy(); v.hora = ahoraHM(); }
    aplicarLiquidacion(db.config, v, false);
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
    if (estado === 'completado' && c) { const d = lugar(v.destinoId); c.pos = d.pos.slice(); c.nodo = d.nodo; c.semanaViajes = (c.semanaViajes || 0) + 1; delete v.sim; const cli = cliente(v.clienteId); if (cli) { cli.visitas += 1; cli.gasto += v.precio.total; } if (v.pago.metodo === 'efectivo' && v.pago.estado === 'pendiente') v.pago.estado = 'cobrado'; const veh = vehiculo(v.vehiculoId); if (veh) veh.km += Math.round(v.km); aplicarLiquidacion(db.config, v, false); }
    if ((estado === 'cancelado' || estado === 'no_show') && c) { delete v.sim; }
    log(quien || (c ? c.nombre : 'sistema'), `${ESTADOS[estado].es} · ${v.nombre}`); emitir({ tipo: 'estado', viajeId: v.id, estado, choferId: v.choferId }); persist('datos'); return v;
  }
  function reasignar(id, choferId) { const v = viaje(id); const c = chofer(choferId); if (!v || !c) return; v.choferId = c.id; v.vehiculoId = c.vehiculoId; v.vehiculo = vehiculo(c.vehiculoId).tipo; v.proveedorId = vehiculo(c.vehiculoId).proveedorId || 'acs'; aplicarLiquidacion(db.config, v, false); v.estado = 'asignado'; v.tiempos.asignado = ahoraHM(); delete v.sim; log('central', `Reasignado a ${c.nombre} · ${v.nombre}`); emitir({ tipo: 'viaje_asignado', viajeId: v.id, choferId: c.id }); persist('datos'); }
  function setEnLinea(choferId, on) { const c = chofer(choferId); c.enLinea = !!on; if (on && !c.checkin) c.checkin = ahoraHM(); log(c.nombre, on ? 'En línea' : 'Fuera de línea'); if (on) { db.viajes.filter(v => v.estado === 'solicitado' && v.fecha >= hoy()).forEach(v => despachar(v)); } persist('datos'); }
  function setPosicion(choferId, lat, lng, real) { const c = chofer(choferId); c.pos = [lat, lng]; c.gpsReal = !!real; c.gpsT = Date.now(); persist('sim'); }
  function setGpsReal(choferId, on) { const c = chofer(choferId); c.gpsReal = !!on; if (!on) { const v = viajeActivo(choferId); if (v && v.sim) { /* retoma la simulación desde la posición actual */ iniciarSimEn(db, v, v.sim.fase); } } persist('datos'); }
  function registrarPago(id, metodo, datos) { const v = viaje(id); const est = metodo === 'applepay' || metodo === 'tarjeta' ? 'aprobado' : (metodo === 'efectivo' ? 'pendiente' : 'pendiente_confirmar'); v.pago = { metodo, estado: est, ref: datos && datos.ref || (metodo === 'zelle' ? 'ZL-' + Math.floor(10000 + Math.random() * 89999) : (metodo === 'transferencia' ? 'SPEI-' + Math.floor(100000 + Math.random() * 899999) : '')), ultimos4: datos && datos.ultimos4 || '' }; log(v.nombre, `Pago ${METODOS[metodo].es} · ${usd(v.precio.total)} · ${est}`); persist('datos'); return v.pago; }
  function confirmarPago(id) { const v = viaje(id); v.pago.estado = v.pago.metodo === 'efectivo' ? 'cobrado' : 'aprobado'; log('central', `Pago confirmado · ${v.nombre} · ${usd(v.precio.total)}`); persist('datos'); }
  const chatAbierto = (v) => !!v && EN_RUTA.includes(v.estado); // la mensajería solo vive mientras el viaje está en curso
  function enviarMensaje(viajeId, de, texto) { const v = viaje(viajeId); if (!chatAbierto(v)) return null; const m = { id: uid('m'), viajeId, de, texto, t: Date.now() }; db.mensajes.push(m); emitir({ tipo: 'mensaje', viajeId, de }); persist('datos'); return m; }
  function registrarGasto(g) { const x = { id: uid('g'), fecha: hoy(), hora: ahoraHM(), ...g }; db.gastos.unshift(x); log(chofer(g.choferId).nombre, `Gasto ${g.tipo} · ${mxn(g.monto)}`); persist('datos'); return x; }
  function guardarChecklist(choferId, items) { const c = chofer(choferId); const ck = { id: uid('ck'), fecha: hoy(), hora: ahoraHM(), choferId, vehiculoId: c.vehiculoId, items }; db.checklists = db.checklists.filter(x => !(x.choferId === choferId && x.fecha === hoy())); db.checklists.push(ck); log(c.nombre, 'Checklist del vehículo guardado'); persist('datos'); return ck; }
  function calificar(id, estrellas, comentario) { const v = viaje(id); v.calificacion = estrellas; v.comentario = comentario || ''; persist('datos'); }
  // ───────────────────────── itinerarios (la estancia completa planeada desde la app) ─────────────────────────
  function crearItinerarioEn(base, d) {
    const cli = base.clientes.find(c => c.id === d.clienteId); const hotel = lugar(d.hotelId); const cfg = base.config; const sug = (id) => base.sugerencias.find(s => s.id === id);
    const it = { id: d.id || uid('it'), clienteId: d.clienteId, nombre: cli ? cli.nombre : '', hotelId: d.hotelId, llegada: d.llegada, salida: d.salida, pax: d.pax || 2, maletas: d.maletas || 2, vehiculo: d.vehiculo || 'suburban', extras: d.extras || [], actividades: (d.actividades || []).map(a => ({ ...a })), notas: d.notas || '', viajeIds: [], total: 0, pago: d.pago || { metodo: 'applepay', estado: 'aprobado' }, creado: d.creado || Date.now(), estado: 'planeada' };
    const noches = Math.max(1, Math.round((new Date(d.salida.fecha) - new Date(d.llegada.fecha)) / 86400000)); it.noches = noches;
    const mk = (x) => { const q = cotizarCon(cfg, x); const dist = distanciaViaje(x.origenId, x.destinoId); const v = { id: uid('t'), fecha: x.fecha, hora: x.hora, creado: it.creado, origenId: x.origenId, destinoId: x.destinoId, zona: q.zona, modo: q.modo, redondo: q.modo === 'redondo', horas: q.horas, regresoHora: x.regresoHora || null, paradas: [], itinerarioId: it.id, compartidoCon: [], vehiculo: it.vehiculo, vehiculoId: null, choferId: null, clienteId: it.clienteId, nombre: it.nombre, pasajeros: it.pax, maletas: x.maletas == null ? 1 : x.maletas, vuelo: x.vuelo || null, extras: x.extras || [], precio: q, pago: { ...it.pago, ref: '' }, canal: 'app', aliadoId: cli ? cli.aliadoId : null, cuentaId: cli ? cli.cuentaId : null, estado: 'solicitado', km: dist.km * (q.modo === 'redondo' ? 2 : 1), min: dist.min, costo: costoDe(cfg, dist.km * (q.modo === 'redondo' ? 2 : 1), usaAutopista(x.origenId, x.destinoId), q.modo === 'redondo', q.total), calificacion: null, notas: x.notas || '', tiempos: {}, etiqueta: x.etiqueta }; delete v.precio.detalle; aplicarLiquidacion(cfg, v, false); base.viajes.push(v); it.viajeIds.push(v.id); it.total += q.total; return v; };
    const f = d.llegada.vuelo ? base.vuelos.find(x => x.num === String(d.llegada.vuelo).toUpperCase()) : null;
    mk({ fecha: d.llegada.fecha, hora: hmDe(minutosDe(d.llegada.hora) + (cfg.esperaAeropuerto || 35)), origenId: 'sjd', destinoId: d.hotelId, modo: 'sencillo', vehiculo: it.vehiculo, extras: it.extras, maletas: it.maletas, vuelo: { num: String(d.llegada.vuelo || '').toUpperCase(), aerolinea: f ? f.aerolinea : '', origen: f ? f.origen : '', programada: d.llegada.hora, estado: 'a tiempo', minutos: 0 }, etiqueta: 'Arrival', notas: d.notas || '' });
    it.actividades.forEach(a => { const s = sug(a.sugerenciaId); if (!s) return; const dur = a.horas || s.duracion || 3; a.horas = dur; if (a.esperar) mk({ fecha: a.fecha, hora: a.hora, origenId: d.hotelId, destinoId: s.lugarId, modo: 'horas', horas: dur, vehiculo: it.vehiculo, etiqueta: s.nombre, notas: 'Driver waits · ' + dur + ' h' }); else mk({ fecha: a.fecha, hora: a.hora, origenId: d.hotelId, destinoId: s.lugarId, modo: 'redondo', regresoHora: hmDe(minutosDe(a.hora) + dur * 60), vehiculo: it.vehiculo, etiqueta: s.nombre, notas: 'Pickup back at ' + hora12(hmDe(minutosDe(a.hora) + dur * 60)) }); });
    mk({ fecha: d.salida.fecha, hora: hmDe(minutosDe(d.salida.hora) - 180), origenId: d.hotelId, destinoId: 'sjd', modo: 'sencillo', vehiculo: it.vehiculo, maletas: it.maletas, vuelo: { num: String(d.salida.vuelo || '').toUpperCase(), aerolinea: '', origen: '', programada: d.salida.hora, estado: 'a tiempo', minutos: 0, salida: true }, etiqueta: 'Departure', notas: 'Flight departs ' + hora12(d.salida.hora) + ' · pickup 3 h before' });
    base.itinerarios.push(it); return it;
  }
  function crearItinerario(d) { const it = crearItinerarioEn(db, d); it.viajeIds.forEach(id => { const v = viaje(id); if (v.fecha <= sumaDias(hoy(), 1)) despachar(v); }); db.viajes.sort((a, b) => (a.fecha + a.hora) < (b.fecha + b.hora) ? -1 : 1); log(it.nombre || 'cliente', `Estancia planeada: ${it.noches} noches · ${it.viajeIds.length} traslados · ${usd(it.total)}`); persist('datos'); return it; }
  function cancelarItinerario(id) { const it = db.itinerarios.find(x => x.id === id); if (!it) return; it.estado = 'cancelada'; it.viajeIds.forEach(vid => { const v = viaje(vid); if (v && !['completado', 'cancelado'].includes(v.estado)) { v.estado = 'cancelado'; delete v.sim; } }); persist('datos'); }
  const itinerario = (id) => db.itinerarios.find(x => x.id === id);
  const itinerariosDe = (clienteId) => db.itinerarios.filter(x => x.clienteId === clienteId && x.estado !== 'cancelada');
  // ───────────────────────── amigos y viajes compartidos ─────────────────────────
  function compartirEn(base, v, ids, division) {
    ids = (ids || []).filter(id => id && id !== v.clienteId); v.compartidoCon = ids; v.division = division || 'solo_ver';
    if (v.division === 'igual' && ids.length) { const n = ids.length + 1; const parte = Math.round(v.precio.total / n * 100) / 100; v.partes = {}; v.partes[v.clienteId] = { monto: Math.round((v.precio.total - parte * ids.length) * 100) / 100, estado: v.pago && (v.pago.estado === 'aprobado' || v.pago.estado === 'cobrado') ? 'pagado' : 'pendiente' }; ids.forEach(id => { v.partes[id] = { monto: parte, estado: 'pendiente' }; }); }
    else v.partes = null;
  }
  function compartirViaje(viajeId, ids, division) { const v = viaje(viajeId); if (!v) return; compartirEn(db, v, ids, division); ids.forEach(id => emitir({ tipo: 'compartido', viajeId, para: id, de: v.clienteId })); log(v.nombre, `Viaje compartido con ${ids.length} amigo(s) · ${division === 'igual' ? 'pago dividido' : 'solo seguimiento'}`); persist('datos'); return v; }
  function pagarParte(viajeId, clienteId, metodo) { const v = viaje(viajeId); if (!v || !v.partes || !v.partes[clienteId]) return; v.partes[clienteId].estado = 'pagado'; v.partes[clienteId].metodo = metodo || 'applepay'; const c = cliente(clienteId); log(c ? c.nombre : clienteId, `Pagó su parte · ${usd(v.partes[clienteId].monto)} · ${METODOS[metodo || 'applepay'].es}`); persist('datos'); return v; }
  function agregarAmigo(a, b) { const ca = cliente(a), cb = cliente(b); if (!ca || !cb || a === b) return false; ca.amigos = Array.from(new Set((ca.amigos || []).concat([b]))); cb.amigos = Array.from(new Set((cb.amigos || []).concat([a]))); db.invitaciones = db.invitaciones.filter(i => !((i.de === a && i.para === b) || (i.de === b && i.para === a))); persist('datos'); return true; }
  function invitarAmigo(de, contacto) { const t = String(contacto || '').trim().toLowerCase(); const match = db.clientes.find(c => c.id !== de && (c.email.toLowerCase() === t || c.tel.replace(/\D/g, '') === t.replace(/\D/g, '') && t.replace(/\D/g, '').length >= 7 || c.nombre.toLowerCase() === t)); if (match) { agregarAmigo(de, match.id); return { estado: 'agregado', cliente: match }; } const inv = { id: uid('inv'), de, para: null, contacto: String(contacto || '').trim(), estado: 'pendiente', t: Date.now() }; db.invitaciones.push(inv); persist('datos'); return { estado: 'pendiente', invitacion: inv }; }
  function aceptarInvitacion(id) { const inv = db.invitaciones.find(i => i.id === id); if (!inv || !inv.para) return; agregarAmigo(inv.de, inv.para); }
  const viajesCompartidosCon = (clienteId) => db.viajes.filter(v => (v.compartidoCon || []).includes(clienteId));
  function enlaceSeguimiento(viajeId) { const base = location.href.replace(/[#?].*$/, '').replace(/[^\/]*$/, ''); return base.replace(/(cliente|chofer|central)\/$/, '') + 'cliente/?track=' + viajeId; }
  // ───────────────────────── proveedores (otras flotas) y sugerencias ─────────────────────────
  const proveedor = (id) => db.proveedores.find(p => p.id === (id || 'acs'));
  function liquidarProveedor(id) { let n = 0, monto = 0; db.viajes.forEach(v => { if (v.proveedorId === id && v.estado === 'completado' && v.liquidacion && !v.liquidacion.liquidado) { v.liquidacion.liquidado = true; v.liquidacion.fecha = hoy(); n++; monto += v.liquidacion.proveedor; } }); log('central', `Liquidación a ${proveedor(id).nombre}: ${n} viajes · ${usd(monto)}`); persist('datos'); return { n, monto }; }
  function guardarProveedor(p) { const x = db.proveedores.find(y => y.id === p.id); if (x) Object.assign(x, p); else db.proveedores.push({ id: uid('p'), propio: false, comision: db.config.comisionPlataforma, ...p }); persist('datos'); }
  function guardarSugerencia(sg) { const x = db.sugerencias.find(y => y.id === sg.id); if (x) Object.assign(x, sg); else db.sugerencias.push({ id: uid('s'), activa: true, icono: '✨', color: '#26221C', duracion: 3, ...sg }); log('central', 'Sugerencia guardada: ' + (sg.nombre || '')); persist('datos'); }
  function quitarSugerencia(id) { db.sugerencias = db.sugerencias.filter(s => s.id !== id); persist('datos'); }
  const sugerencia = (id) => db.sugerencias.find(s => s.id === id);
  // ───────────────────────── flotas ajenas: requisitos y solicitudes (el dueño elige a quién deja entrar) ─────────────────────────
  function evaluarSolicitud(s) {
    const r = db.config.requisitosFlota || { anioMin: 2021, tipos: ['suburban', 'escalade', 'sprinter'], colores: ['Negro'], calificacionMin: 4.7, ingles: true, seguro: true, permisoTuristico: true }; const out = [];
    (s.vehiculos || []).forEach(v => { const t = TIPOS_VEHICULO[v.tipo] || { corto: v.tipo }; out.push({ ok: v.anio >= r.anioMin, texto: `${t.corto} ${v.placa} · modelo ${v.anio} (se pide ${r.anioMin} o más reciente)` }); out.push({ ok: (r.tipos || []).includes(v.tipo), texto: `${t.corto} ${v.placa} · tipo de unidad aceptado (${(r.tipos || []).map(x => TIPOS_VEHICULO[x] ? TIPOS_VEHICULO[x].corto : x).join(', ')})` }); out.push({ ok: (r.colores || []).includes(v.color), texto: `${t.corto} ${v.placa} · color ${v.color} (se pide ${(r.colores || []).join(' o ')})` }); });
    (s.choferes || []).forEach(c => { out.push({ ok: c.calificacion >= r.calificacionMin, texto: `${c.nombre} · calificación ${Number(c.calificacion).toFixed(1)} (mínimo ${r.calificacionMin})` }); if (r.ingles) out.push({ ok: /EN/.test(c.idiomas || ''), texto: `${c.nombre} · habla inglés` }); });
    const d = s.docs || {}; if (r.seguro) out.push({ ok: !!d.seguro, texto: 'Seguro de pasajeros vigente' }); if (r.permisoTuristico) out.push({ ok: !!d.permisoTuristico, texto: 'Permiso estatal de transporte turístico' }); out.push({ ok: !!d.licencias, texto: 'Licencias de los choferes en orden' }); out.push({ ok: !!d.factura, texto: 'Puede facturar (CFDI) para las liquidaciones' });
    return { checks: out, cumple: out.every(x => x.ok), fallas: out.filter(x => !x.ok).length };
  }
  function aprobarSolicitud(id, comision) {
    const s = (db.solicitudes || []).find(x => x.id === id); if (!s || s.estado !== 'pendiente') return null;
    const p = { id: uid('p'), nombre: s.empresa, propio: false, contacto: s.contacto, tel: s.tel, comision: comision == null ? (db.config.comisionPlataforma || 0.2) : comision, zona: s.zona, desde: new Date().getFullYear(), banco: 'Pago semanal por transferencia' }; db.proveedores.push(p);
    const nodo = /pac[ií]fico/i.test(s.zona) ? 'pacifico' : /san lucas|pedregal/i.test(s.zona) ? 'csl' : /san jos/i.test(s.zona) ? 'sanjose' : /aeropuerto/i.test(s.zona) ? 'sjd' : 'palmilla';
    (s.vehiculos || []).forEach((v, i) => { const veh = { id: uid('v'), tipo: v.tipo, anio: v.anio, placa: v.placa, color: v.color, km: 20000 + Math.floor(Math.random() * 40000), seguroVence: sumaDias(hoy(), 200), permisoVence: sumaDias(hoy(), 250), servicioCadaKm: 10000, ultimoServicioKm: 20000, proveedorId: p.id, combustible: 80 }; db.vehiculos.push(veh); const c = (s.choferes || [])[i] || (s.choferes || [])[0]; if (c) db.choferes.push({ id: uid('d'), nombre: c.nombre, tel: s.tel, vehiculoId: veh.id, nodo, pos: NODOS[nodo].slice(), enLinea: false, calificacion: c.calificacion, ingreso: new Date().getFullYear() - (c.anios || 1), licenciaVence: sumaDias(hoy(), 400), idiomas: c.idiomas, proveedorId: p.id, gpsReal: false, checkin: null, semanaViajes: 0 }); });
    s.estado = 'aprobada'; s.resuelta = hoy(); s.proveedorId = p.id; log('central', `Flota aliada aprobada: ${s.empresa} · ${(s.vehiculos || []).length} camioneta(s)`); persist('datos'); return p;
  }
  function rechazarSolicitud(id, motivo) { const s = (db.solicitudes || []).find(x => x.id === id); if (!s) return; s.estado = 'rechazada'; s.motivo = motivo || ''; s.resuelta = hoy(); log('central', `Solicitud de flota rechazada: ${s.empresa}`); persist('datos'); }
  function guardarRequisitos(r) { db.config.requisitosFlota = Object.assign(db.config.requisitosFlota || {}, r); persist('datos'); }
  function vueloDe(num) { if (!num) return null; const n = String(num).toUpperCase().replace(/\s+/g, ' ').trim(); return db.vuelos.find(f => f.num === n || f.num.replace(' ', '') === n.replace(' ', '')); }

  // ───────────────────────── simulación de GPS ─────────────────────────
  function iniciarSimEn(base, v, fase) {
    const c = base.choferes.find(x => x.id === v.choferId); if (!c) return; const o = lugar(v.origenId), d = lugar(v.destinoId);
    const r = fase === 'a_recoger' ? rutaLugares(c.pos, c.nodo, o) : rutaLugares(c.pos, o.nodo, d);
    const cum = [0]; for (let i = 1; i < r.pts.length; i++) cum.push(cum[i - 1] + haversine(r.pts[i - 1], r.pts[i]));
    v.sim = { fase, pts: r.pts, cum, km: cum[cum.length - 1], min: r.min, avance: 0, llegado: false, t0: Date.now() };
  }
  function rumbo(a, b) { const toR = Math.PI / 180; const y = Math.sin((b[1] - a[1]) * toR) * Math.cos(b[0] * toR); const x = Math.cos(a[0] * toR) * Math.sin(b[0] * toR) - Math.sin(a[0] * toR) * Math.cos(b[0] * toR) * Math.cos((b[1] - a[1]) * toR); return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360; }
  function posEnSim(s) { const a = Math.min(s.avance, s.km); let i = 1; while (i < s.cum.length && s.cum[i] < a) i++; if (i >= s.cum.length) return s.pts[s.pts.length - 1]; const p0 = s.pts[i - 1], p1 = s.pts[i]; const seg = s.cum[i] - s.cum[i - 1] || 1; const f = (a - s.cum[i - 1]) / seg; return [p0[0] + (p1[0] - p0[0]) * f, p0[1] + (p1[1] - p0[1]) * f]; }
  function tick() {
    let cambio = false; const kmPorTick = db.config.velocidadKmh * db.config.factorDemo / 3600;
    db.viajes.forEach(v => {
      if (!EN_RUTA.includes(v.estado) || v.estado === 'llegue') return; const c = chofer(v.choferId); if (!c) return;
      if (!v.sim) iniciarSimEn(db, v, v.estado === 'a_bordo' ? 'a_destino' : 'a_recoger');
      if (c.gpsReal) return; const s = v.sim; if (s.llegado) return;
      const prev = c.pos; s.avance = Math.min(s.km, s.avance + kmPorTick); c.pos = posEnSim(s); if (prev && (prev[0] !== c.pos[0] || prev[1] !== c.pos[1])) c.rumbo = rumbo(prev, c.pos);
      c.velocidad = Math.round(db.config.velocidadKmh * (0.82 + 0.34 * Math.abs(Math.sin(Date.now() / 6000 + v.id.length * 1.7))));
      const veh = vehiculo(c.vehiculoId); if (veh) { const t = TIPOS_VEHICULO[veh.tipo]; veh.combustible = Math.max(2, (veh.combustible == null ? 60 : veh.combustible) - kmPorTick / (t.rendimiento || 7) / (t.tanque || 90) * 100); }
      if (s.avance >= s.km - 0.001) { s.llegado = true; c.velocidad = 0; c.nodo = (s.fase === 'a_recoger' ? lugar(v.origenId) : lugar(v.destinoId)).nodo; emitir({ tipo: 'llegada', viajeId: v.id, fase: s.fase }); }
      cambio = true;
    });
    db.choferes.forEach(c => { const va = viajeActivo(c.id); if (!va || va.estado === 'llegue' || (va.sim && va.sim.llegado)) c.velocidad = 0; });
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
  M.porVehiculo = function (dias = 90) { const desde = sumaDias(hoy(), -dias); const vs = db.viajes.filter(v => comp(v) && v.fecha >= desde); const gs = db.gastos.filter(g => g.fecha >= desde); return db.vehiculos.map(ve => { const x = vs.filter(v => v.vehiculoId === ve.id); const ingreso = x.reduce((a, v) => a + v.precio.total, 0); const neto = x.reduce((a, v) => a + (v.neto == null ? v.precio.total : v.neto), 0); const costoMXN = x.reduce((a, v) => a + (v.costo ? v.costo.totalMXN : 0), 0); const gastosMXN = gs.filter(g => g.vehiculoId === ve.id).reduce((a, g) => a + g.monto, 0); const horas = x.reduce((a, v) => a + (v.horas ? v.horas : (v.min || 40) / 60 + 0.5), 0); return { vehiculo: ve, proveedor: (db.proveedores || []).find(p => p.id === (ve.proveedorId || 'acs')), viajes: x.length, ingreso, neto, km: Math.round(x.reduce((a, v) => a + v.km, 0)), costoMXN, gastosMXN, utilidadMXN: neto * db.config.tipoCambio - costoMXN, horas: Math.round(horas), viajesDia: x.length / dias, costoPorKm: x.length ? costoMXN / Math.max(1, x.reduce((a, v) => a + v.km, 0)) : 0 }; }).sort((a, b) => b.ingreso - a.ingreso); };
  M.porProveedor = function (dias = 90) { const desde = sumaDias(hoy(), -dias); const vs = db.viajes.filter(v => comp(v) && v.fecha >= desde); return (db.proveedores || []).map(p => { const x = vs.filter(v => (v.proveedorId || 'acs') === p.id); const bruto = x.reduce((a, v) => a + v.precio.total, 0); const plataforma = x.reduce((a, v) => a + (v.liquidacion ? v.liquidacion.plataforma : v.precio.total), 0); const aPagar = x.reduce((a, v) => a + (v.liquidacion && !v.liquidacion.propio ? v.liquidacion.proveedor : 0), 0); const pendiente = db.viajes.filter(v => comp(v) && (v.proveedorId || 'acs') === p.id && v.liquidacion && !v.liquidacion.propio && !v.liquidacion.liquidado).reduce((a, v) => a + v.liquidacion.proveedor, 0); return { proveedor: p, vehiculos: db.vehiculos.filter(v => (v.proveedorId || 'acs') === p.id), choferes: db.choferes.filter(c => (c.proveedorId || 'acs') === p.id), viajes: x.length, bruto, plataforma, aPagar, pendiente, enLinea: db.choferes.filter(c => (c.proveedorId || 'acs') === p.id && c.enLinea).length }; }).sort((a, b) => b.bruto - a.bruto); };
  M.plataforma = function (dias = 30) { const desde = sumaDias(hoy(), -dias); const vs = db.viajes.filter(v => comp(v) && v.fecha >= desde && v.fecha < hoy()); const propios = vs.filter(v => !v.proveedorId || v.proveedorId === 'acs'); const aliados = vs.filter(v => v.proveedorId && v.proveedorId !== 'acs'); return { viajes: vs.length, viajesPropios: propios.length, viajesAliados: aliados.length, bruto: vs.reduce((a, v) => a + v.precio.total, 0), ingresoPropio: propios.reduce((a, v) => a + v.precio.total, 0), comision: aliados.reduce((a, v) => a + (v.liquidacion ? v.liquidacion.plataforma : 0), 0), pagoProveedores: aliados.reduce((a, v) => a + (v.liquidacion ? v.liquidacion.proveedor : 0), 0), pendienteLiquidar: db.viajes.filter(v => comp(v) && v.liquidacion && !v.liquidacion.propio && !v.liquidacion.liquidado).reduce((a, v) => a + v.liquidacion.proveedor, 0) }; };
  M.estancias = function () { const H = hoy(); return (db.itinerarios || []).filter(it => it.estado !== 'cancelada' && it.salida.fecha >= H).map(it => ({ it, cliente: cliente(it.clienteId), hotel: lugar(it.hotelId), enCurso: it.llegada.fecha <= H, dia: Math.max(0, Math.round((new Date(H) - new Date(it.llegada.fecha)) / 86400000)) + 1, viajes: it.viajeIds.map(viaje).filter(Boolean) })).sort((a, b) => a.it.llegada.fecha < b.it.llegada.fecha ? -1 : 1); };
  M.sugerenciasTop = function (dias = 180) { const desde = sumaDias(hoy(), -dias); const cnt = {}; (db.itinerarios || []).forEach(it => it.actividades.forEach(a => { cnt[a.sugerenciaId] = (cnt[a.sugerenciaId] || 0) + 1; })); db.viajes.filter(v => v.fecha >= desde).forEach(v => { const s = db.sugerencias.find(x => x.lugarId === v.destinoId); if (s) cnt[s.id] = (cnt[s.id] || 0) + 1; }); return Object.entries(cnt).map(([id, n]) => ({ sugerencia: sugerencia(id), n })).filter(x => x.sugerencia).sort((a, b) => b.n - a.n); };
  M.porChofer = function (dias = 30) { const desde = sumaDias(hoy(), -dias); return db.choferes.map(c => { const x = db.viajes.filter(v => v.choferId === c.id && comp(v) && v.fecha >= desde); const cal = x.filter(v => v.calificacion); return { chofer: c, viajes: x.length, ingreso: x.reduce((a, v) => a + v.precio.total, 0), pagoMXN: x.reduce((a, v) => a + v.costo.chofer, 0), calif: cal.length ? cal.reduce((a, v) => a + v.calificacion, 0) / cal.length : null, hoy: db.viajes.filter(v => v.choferId === c.id && v.fecha === hoy() && v.estado !== 'cancelado').length }; }).sort((a, b) => b.viajes - a.viajes); };
  M.hoy = function () { const H = hoy(); const vs = db.viajes.filter(v => v.fecha === H); const done = vs.filter(comp); return { total: vs.length, completados: done.length, enCurso: vs.filter(v => EN_RUTA.includes(v.estado)).length, porSalir: vs.filter(v => v.estado === 'asignado' || v.estado === 'aceptado').length, sinChofer: vs.filter(v => v.estado === 'solicitado').length, ingreso: done.reduce((a, v) => a + v.precio.total, 0), ingresoProgramado: vs.filter(v => v.estado !== 'cancelado' && v.estado !== 'no_show').reduce((a, v) => a + v.precio.total, 0), pasajeros: done.reduce((a, v) => a + v.pasajeros, 0), enLinea: db.choferes.filter(c => c.enLinea).length }; };
  M.periodo = function (dias = 30) { const desde = sumaDias(hoy(), -dias); const vs = db.viajes.filter(v => v.fecha >= desde && v.fecha < hoy()); const done = vs.filter(comp); const ingreso = done.reduce((a, v) => a + v.precio.total, 0); const neto = done.reduce((a, v) => a + (v.neto == null ? v.precio.total : v.neto), 0); const costo = done.reduce((a, v) => a + v.costo.totalMXN, 0); const ingresoMXN = ingreso * db.config.tipoCambio; const netoMXN = neto * db.config.tipoCambio; const propios = db.vehiculos.filter(v => !v.proveedorId || v.proveedorId === 'acs').length; return { dias, viajes: done.length, ingreso, ingresoMXN, neto, netoMXN, comision: done.reduce((a, v) => a + (v.liquidacion && !v.liquidacion.propio ? v.liquidacion.plataforma : 0), 0), costoMXN: costo, margenMXN: netoMXN - costo, margenPct: netoMXN ? (netoMXN - costo) / netoMXN * 100 : 0, ticket: done.length ? ingreso / done.length : 0, costoViajeMXN: done.length ? costo / done.length : 0, cancelPct: vs.length ? vs.filter(v => v.estado === 'cancelado').length / vs.length * 100 : 0, noshowPct: vs.length ? vs.filter(v => v.estado === 'no_show').length / vs.length * 100 : 0, viajesPorVehiculoDia: done.length / (dias * (propios || 1)) }; };
  M.aliados = function (dias = 90) { const desde = sumaDias(hoy(), -dias); return db.aliados.map(a => { const x = db.viajes.filter(v => v.aliadoId === a.id && comp(v) && v.fecha >= desde); const ingreso = x.reduce((s, v) => s + v.precio.total, 0); return { aliado: a, viajes: x.length, ingreso, comision: ingreso * a.comision }; }).sort((a, b) => b.ingreso - a.ingreso); };
  M.alertasFlota = function () { const H = hoy(); const out = []; const dias = (iso) => Math.round((new Date(iso) - new Date(H)) / 86400000); db.vehiculos.forEach(v => { const t = TIPOS_VEHICULO[v.tipo]; const ds = dias(v.seguroVence), dp = dias(v.permisoVence); const kmServ = v.ultimoServicioKm + v.servicioCadaKm - v.km; if (ds <= 30) out.push({ nivel: ds <= 14 ? 'bad' : 'warn', vehiculoId: v.id, texto: `Seguro de la ${t.corto} ${v.placa} vence en ${ds} días` }); if (dp <= 30) out.push({ nivel: dp <= 14 ? 'bad' : 'warn', vehiculoId: v.id, texto: `Permiso de transporte de la ${t.corto} ${v.placa} vence en ${dp} días` }); if (kmServ <= 1500) out.push({ nivel: kmServ <= 0 ? 'bad' : 'warn', vehiculoId: v.id, texto: `Servicio de la ${t.corto} ${v.placa}: ${kmServ <= 0 ? 'vencido por ' + (-kmServ) : 'faltan ' + kmServ} km` }); }); db.choferes.forEach(c => { const dl = dias(c.licenciaVence); if (dl <= 60) out.push({ nivel: dl <= 30 ? 'bad' : 'warn', choferId: c.id, texto: `Licencia de ${c.nombre} vence en ${dl} días` }); }); return out; };
  M.conciliacion = function () { const pend = db.viajes.filter(v => v.pago.estado === 'pendiente_confirmar' || (v.pago.metodo === 'efectivo' && v.pago.estado === 'pendiente')); const H = hoy(); const hoyPag = db.viajes.filter(v => v.fecha === H && (comp(v) || EN_RUTA.includes(v.estado) || ACTIVOS.includes(v.estado))); const porMetodo = Object.keys(METODOS).map(m => ({ metodo: m, total: hoyPag.filter(v => v.pago.metodo === m).reduce((a, v) => a + v.precio.total, 0), n: hoyPag.filter(v => v.pago.metodo === m).length })); return { pendientes: pend, porMetodo }; };
  M.clientesTop = function () { return db.clientes.slice().sort((a, b) => b.gasto - a.gasto).slice(0, 10); };
  M.recurrentes = function () { const rec = db.clientes.filter(c => c.visitas >= 2).length; return { recurrentes: rec, total: db.clientes.length, pct: rec / db.clientes.length * 100 }; };
  M.gastosMes = function () { const desde = sumaDias(hoy(), -30); const g = db.gastos.filter(x => x.fecha >= desde); const por = {}; g.forEach(x => { por[x.tipo] = (por[x.tipo] || 0) + x.monto; }); return { total: g.reduce((a, x) => a + x.monto, 0), por, n: g.length }; };

  // ───────────────────────── telemetría de flota (velocidad, combustible, avance, rumbo, alertas) ─────────────────────────
  M.telemetria = function () {
    const H = hoy(); const alertas = M.alertasFlota();
    return db.vehiculos.map(veh => {
      const c = db.choferes.find(x => x.vehiculoId === veh.id); const va = c ? viajeActivo(c.id) : null; const prov = (db.proveedores || []).find(p => p.id === (veh.proveedorId || 'acs')); const t = TIPOS_VEHICULO[veh.tipo];
      const al = alertas.filter(a => a.vehiculoId === veh.id || (c && a.choferId === c.id)).map(a => ({ nivel: a.nivel, texto: a.texto }));
      const kmServ = veh.ultimoServicioKm + veh.servicioCadaKm - veh.km; const mant = kmServ <= 0 || !!veh.enTaller;
      const estado = va ? 'activo' : (mant ? 'mantenimiento' : (c && c.enLinea ? 'libre' : 'fuera'));
      let progreso = null, etaV = null, ruta = null; if (va) { etaV = eta(va); if (va.sim) progreso = Math.round(Math.min(1, va.sim.avance / Math.max(0.01, va.sim.km)) * 100); ruta = { origen: lugar(va.origenId), destino: lugar(va.destinoId), fase: va.sim ? va.sim.fase : (va.estado === 'a_bordo' ? 'a_destino' : 'a_recoger'), km: va.sim ? va.sim.km : (va.km || 0) }; }
      const horas = c && c.enLinea && c.checkin ? Math.max(0, (minutosDe(ahoraHM()) - minutosDe(c.checkin)) / 60) : 0; if (horas >= 8 && va) al.unshift({ nivel: 'warn', texto: `Descanso requerido: 30 min (lleva ${horas.toFixed(1)} h en línea)` });
      const combustible = veh.combustible == null ? 60 : veh.combustible; if (combustible < 20) al.push({ nivel: combustible < 10 ? 'bad' : 'warn', texto: `Combustible bajo: ${Math.round(combustible)}%` });
      const hoyV = db.viajes.filter(v => v.vehiculoId === veh.id && v.fecha === H && v.estado === 'completado');
      return { vehiculo: veh, tipo: t, chofer: c, proveedor: prov, propio: !veh.proveedorId || veh.proveedorId === 'acs', viaje: va, estado, velocidad: va && c && va.estado !== 'llegue' && !(va.sim && va.sim.llegado) ? (c.velocidad || db.config.velocidadKmh) : 0, combustible, litros: Math.round(combustible / 100 * (t.tanque || 90)), progreso, eta: etaV, ruta, rumbo: c && c.rumbo != null ? c.rumbo : 315, horas, alertas: al, viajesHoy: hoyV.length, ingresoHoy: hoyV.reduce((a, v) => a + v.precio.total, 0) };
    });
  };
  // ───────────────────────── finanzas por mes (ingresos, gastos, utilidad, comparación) ─────────────────────────
  const ymDe = (iso) => String(iso || '').slice(0, 7);
  M.meses12 = function () { const out = []; for (let i = 11; i >= 0; i--) { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); out.push({ ym: d.getFullYear() + '-' + pad(d.getMonth() + 1), mes: MESES[d.getMonth()], anio: d.getFullYear() }); } return out; };
  M.finanzasMes = function (ym) {
    const vsAll = db.viajes.filter(v => ymDe(v.fecha) === ym); const vs = vsAll.filter(comp); const propios = vs.filter(v => !v.proveedorId || v.proveedorId === 'acs'); const aliados = vs.filter(v => v.proveedorId && v.proveedorId !== 'acs'); const tc = db.config.tipoCambio;
    const ingreso = vs.reduce((a, v) => a + v.precio.total, 0); const ingresoPropio = propios.reduce((a, v) => a + v.precio.total, 0); const ventaAliados = aliados.reduce((a, v) => a + v.precio.total, 0); const comision = aliados.reduce((a, v) => a + (v.liquidacion ? v.liquidacion.plataforma : 0), 0); const pagoProveedores = ventaAliados - comision; const neto = ingresoPropio + comision;
    const gs = db.gastos.filter(g => ymDe(g.fecha) === ym); const por = {}; gs.forEach(g => { por[g.tipo] = (por[g.tipo] || 0) + g.monto; }); por.choferes = propios.reduce((a, v) => a + (v.costo ? v.costo.chofer : 0), 0); const gastos = Object.values(por).reduce((a, b) => a + b, 0);
    const netoMXN = neto * tc; const m = M.meses12().find(x => x.ym === ym) || { ym, mes: ym, anio: '' };
    return { ym, mes: m.mes, anio: m.anio, viajes: vs.length, viajesPropios: propios.length, viajesAliados: aliados.length, ingreso, ingresoPropio, ventaAliados, comision, pagoProveedores, neto, ingresoMXN: ingreso * tc, netoMXN, gastos, por, utilidadMXN: netoMXN - gastos, margenPct: netoMXN ? (netoMXN - gastos) / netoMXN * 100 : 0, ticket: vs.length ? ingreso / vs.length : 0, pasajeros: vs.reduce((a, v) => a + v.pasajeros, 0), km: Math.round(vs.reduce((a, v) => a + (v.km || 0), 0)), cancelados: vsAll.filter(v => v.estado === 'cancelado').length, noshow: vsAll.filter(v => v.estado === 'no_show').length, registrosGasto: gs.length };
  };
  M.finanzas12 = function () { return M.meses12().map(m => M.finanzasMes(m.ym)); };
  M.gastosDe = function (ym, tipo) { if (tipo === 'choferes') return db.viajes.filter(v => comp(v) && ymDe(v.fecha) === ym && (!v.proveedorId || v.proveedorId === 'acs')).map(v => ({ id: 'ch' + v.id, fecha: v.fecha, hora: v.hora, tipo: 'choferes', monto: v.costo ? v.costo.chofer : 0, vehiculoId: v.vehiculoId, choferId: v.choferId, viajeId: v.id, detalle: `Pago al chofer · ${Math.round(db.config.pagoChoferPct * 100)}% de ${usd(v.precio.total)}` })).sort((a, b) => (a.fecha + a.hora) < (b.fecha + b.hora) ? 1 : -1); return db.gastos.filter(g => ymDe(g.fecha) === ym && (!tipo || g.tipo === tipo)).slice().sort((a, b) => (a.fecha + (a.hora || '')) < (b.fecha + (b.hora || '')) ? 1 : -1); };
  M.ingresoPorDia = function (ym) { const por = {}; db.viajes.filter(v => comp(v) && ymDe(v.fecha) === ym).forEach(v => { por[v.fecha] = (por[v.fecha] || 0) + v.precio.total; }); return Object.keys(por).sort().map(f => ({ fecha: f, dia: Number(f.slice(8)), ingreso: por[f] })); };
  M.ingresoPorZonaMes = function (ym) { const vs = db.viajes.filter(v => comp(v) && ymDe(v.fecha) === ym); return Object.values(ZONAS).map(z => ({ zona: z, viajes: vs.filter(v => v.zona === z.id).length, ingreso: vs.filter(v => v.zona === z.id).reduce((a, v) => a + v.precio.total, 0) })); };
  M.ingresoPorCanalMes = function (ym) { const vs = db.viajes.filter(v => comp(v) && ymDe(v.fecha) === ym); return Object.entries(CANALES).map(([id, nombre]) => ({ id, nombre, viajes: vs.filter(v => v.canal === id).length, ingreso: vs.filter(v => v.canal === id).reduce((a, v) => a + v.precio.total, 0) })).filter(x => x.viajes).sort((a, b) => b.ingreso - a.ingreso); };
  M.viajesMes = function (ym) { return db.viajes.filter(v => ymDe(v.fecha) === ym).slice().sort((a, b) => (a.fecha + a.hora) < (b.fecha + b.hora) ? 1 : -1); };
  M.flotaAliada = function (ym) {
    const vs = db.viajes.filter(v => comp(v) && v.proveedorId && v.proveedorId !== 'acs' && (!ym || ymDe(v.fecha) === ym));
    const proveedores = (db.proveedores || []).filter(p => !p.propio).map(p => { const x = vs.filter(v => v.proveedorId === p.id); const venta = x.reduce((a, v) => a + v.precio.total, 0); const com = x.reduce((a, v) => a + (v.liquidacion ? v.liquidacion.plataforma : 0), 0); const chs = db.choferes.filter(c => c.proveedorId === p.id).map(c => { const cv = x.filter(v => v.choferId === c.id); const cal = cv.filter(v => v.calificacion); return { chofer: c, vehiculo: vehiculo(c.vehiculoId), viajes: cv.length, ingreso: cv.reduce((a, v) => a + v.precio.total, 0), calif: cal.length ? cal.reduce((a, v) => a + v.calificacion, 0) / cal.length : c.calificacion, n5: cal.filter(v => v.calificacion === 5).length }; }).sort((a, b) => b.viajes - a.viajes); const cl = {}; x.forEach(v => { const k = v.clienteId || v.nombre; cl[k] = cl[k] || { id: v.clienteId, nombre: v.nombre, viajes: 0, gasto: 0, ultimo: v.fecha }; cl[k].viajes++; cl[k].gasto += v.precio.total; if (v.fecha > cl[k].ultimo) cl[k].ultimo = v.fecha; }); return { proveedor: p, viajes: x.length, venta, comision: com, aPagar: venta - com, porViaje: x.length ? com / x.length : 0, choferes: chs, clientes: Object.values(cl).sort((a, b) => b.gasto - a.gasto), vehiculos: db.vehiculos.filter(v => v.proveedorId === p.id), pendiente: db.viajes.filter(v => comp(v) && v.proveedorId === p.id && v.liquidacion && !v.liquidacion.liquidado).reduce((a, v) => a + v.liquidacion.proveedor, 0), calif: chs.length ? chs.reduce((a, c) => a + c.calif, 0) / chs.length : null }; }).sort((a, b) => b.venta - a.venta);
    const venta = vs.reduce((a, v) => a + v.precio.total, 0); const comision = vs.reduce((a, v) => a + (v.liquidacion ? v.liquidacion.plataforma : 0), 0);
    return { viajes: vs.length, venta, comision, aPagar: venta - comision, porViaje: vs.length ? comision / vs.length : 0, proveedores, clientes: vs.reduce((set, v) => set.add(v.clienteId || v.nombre), new Set()).size };
  };

  function asistente(q) {
    const s = (q || '').toLowerCase(); const p = M.periodo(30); const z = M.porZona(90).sort((a, b) => b.ingreso - a.ingreso); const meses = M.porMes(); const mejor = meses.slice().sort((a, b) => b.ingreso - a.ingreso)[0]; const peor = meses.slice().sort((a, b) => a.ingreso - b.ingreso)[0]; const can = M.porCanal(90); const ch = M.porChofer(30); const al = M.aliados(90); const fl = M.alertasFlota(); const con = M.conciliacion(); const h = M.hoy();
    if (/proveedor|otras? flotas?|aliad[oa]s? de flota|plataforma|socios? de flota|comisi[oó]n de (la )?plataforma|baja elite|corridor luxury|pacific coast/.test(s)) { const pl = M.plataforma(30); const pp = M.porProveedor(30).filter(x => !x.proveedor.propio && x.viajes); return `Últimos 30 días: ${pl.viajesAliados} de ${pl.viajes} viajes los cubrieron flotas aliadas (${usd(pl.bruto - pl.ingresoPropio)} de venta). La plataforma se quedó ${usd(pl.comision)} de comisión y a los proveedores les corresponden ${usd(pl.pagoProveedores)}; hay ${usd(pl.pendienteLiquidar)} pendientes de liquidar. ${pp.length ? 'Por proveedor: ' + pp.map(x => `${x.proveedor.nombre} ${x.viajes} viajes · comisión ${usd(x.plataforma)}`).join(' · ') + '.' : ''}`; }
    if (/estancia|itinerario|plan(es)? de viaje|cu[aá]ntos d[ií]as|se queda/.test(s)) { const es = M.estancias(); if (!es.length) return 'No hay estancias planeadas desde la app en este momento.'; return `Estancias planeadas desde la app: ${es.map(e => `${e.cliente ? e.cliente.nombre : ''} · ${e.hotel ? (e.hotel.corto || e.hotel.nombre) : ''} · ${e.it.noches} noches (${e.it.llegada.fecha} a ${e.it.salida.fecha}) · ${e.viajes.length} traslados · ${usd(e.it.total)}${e.enCurso ? ' · en curso, día ' + e.dia : ''}`).join(' | ')}.`; }
    if (/sugerenc|recomend|restauran|actividad|qu[eé] piden|top/.test(s)) { const t = M.sugerenciasTop(); return t.length ? `Lo más pedido de la lista de sugerencias: ${t.slice(0, 5).map(x => `${x.sugerencia.nombre} (${x.n})`).join(' · ')}. La lista la edita usted en Configuración; los clientes la ven en su app y reservan el traslado desde ahí.` : 'Todavía no hay traslados ligados a la lista de sugerencias.'; }
    if (/compartid|amig|dividid|split/.test(s)) { const vs = db.viajes.filter(v => (v.compartidoCon || []).length); const pend = vs.reduce((a, v) => a + Object.values(v.partes || {}).filter(p => p.estado !== 'pagado').length, 0); return `Viajes compartidos entre amigos: ${vs.length}; partes pendientes de pago: ${pend}. El organizador responde por el total si un amigo no paga antes de la recogida.`; }
    if (/zona|corredor|pac[ií]fico|san jos|cabo san lucas/.test(s)) return `En 90 días, ${z[0].zona.es} dejó ${usd(z[0].ingreso)} en ${z[0].viajes} viajes (margen ${mxn(z[0].margenMXN)}), contra ${usd(z[1].ingreso)} de ${z[1].zona.es}. Por viaje, ${z[0].zona.id === 'csl' ? 'Cabo San Lucas paga más pero recorre más kilómetros' : 'el Corredor es más corto y por eso deja mejor margen por hora de camioneta'}.`;
    if (/temporada|mes|mejor época|alta|baja/.test(s)) return `El mejor mes del año fue ${mejor.mes} con ${usd(mejor.ingreso)} en ${mejor.viajes} viajes; el más flojo, ${peor.mes} con ${usd(peor.ingreso)}. La temporada alta va de diciembre a abril; septiembre y octubre son el hueco para vacaciones y mantenimiento de la flota.`;
    if (/canal|de d[oó]nde|whatsapp|concierge|planner|app/.test(s)) return `Últimos 90 días: ${can.map(c => `${c.nombre} ${usd(c.ingreso)} (${c.viajes})`).join(' · ')}. Lo que entra por concierge y planner lleva comisión; lo que entra por la app es margen completo.`;
    if (/cliente|hu[eé]sped|vip|repite|frecuente/.test(s)) { const cl = {}; db.viajes.filter(v => v.estado === 'completado' && v.clienteId).forEach(v => { const c = cl[v.clienteId] = cl[v.clienteId] || { n: 0, total: 0 }; c.n++; c.total += v.precio ? v.precio.total : 0; }); const top = Object.entries(cl).map(([id, c]) => ({ c: cliente(id), ...c })).filter(x => x.c).sort((a, b) => b.total - a.total).slice(0, 3); if (!top.length) return 'Todavía no hay clientes con viajes completados.'; return `Sus mejores clientes por gasto: ${top.map(x => `${x.c.nombre} (${x.n} viajes, ${usd(x.total)})`).join(' · ')}. Los clientes registrados repiten sin escribirle a nadie: piden desde su propia app.`; }
    if (/chofer|conductor|qui[eé]n/.test(s)) return `En 30 días el chofer con más viajes es ${ch[0].chofer.nombre} (${ch[0].viajes} viajes, ${usd(ch[0].ingreso)}, calificación ${ch[0].calif ? ch[0].calif.toFixed(2) : '—'}). Pago acumulado a choferes: ${mxn(ch.reduce((a, x) => a + x.pagoMXN, 0))}.`;
    if (/aliad|comisi|hotel|referid/.test(s)) return `Aliado que más refiere en 90 días: ${al[0].aliado.nombre} con ${al[0].viajes} viajes y ${usd(al[0].ingreso)}; comisión a pagar ${usd(al[0].comision)}. Comisiones totales del periodo: ${usd(al.reduce((a, x) => a + x.comision, 0))}.`;
    if (/no.?show|cancel|no lleg/.test(s)) return `En 30 días: ${pct(p.cancelPct)} de cancelaciones y ${pct(p.noshowPct)} de no-shows sobre ${p.viajes} viajes completados. Con anticipo cobrado en la app el no-show baja casi a cero: el cliente ya pagó.`;
    if (/flota|seguro|permiso|servicio|manten|venc/.test(s)) return fl.length ? `Alertas de flota: ${fl.map(a => a.texto).join('; ')}.` : 'La flota está al día en seguros, permisos y servicios.';
    if (/zelle|efectivo|pendiente|conciliac|cobr/.test(s)) return `Hay ${con.pendientes.length} pagos por confirmar (${usd(con.pendientes.reduce((a, v) => a + v.precio.total, 0))}): ${con.pendientes.map(v => `${v.nombre} · ${METODOS[v.pago.metodo].es}`).join(', ') || 'ninguno'}.`;
    if (/margen|costo|gana|utilidad|rentab/.test(s)) return `Últimos 30 días: ingreso ${usd(p.ingreso)} (${mxn(p.ingresoMXN)} a ${db.config.tipoCambio}), costo directo ${mxn(p.costoMXN)} (gasolina, casetas y pago a choferes), margen ${mxn(p.margenMXN)} = ${pct(p.margenPct)}. Costo promedio por viaje ${mxn(p.costoViajeMXN)}, ticket ${usd(p.ticket)}.`;
    if (/hoy|ahora|en curso/.test(s)) return `Hoy: ${h.total} viajes, ${h.completados} completados, ${h.enCurso} en curso, ${h.porSalir} por salir y ${h.sinChofer} sin chofer. Ingreso programado del día ${usd(h.ingresoProgramado)}; ${h.enLinea} choferes en línea.`;
    if (/camioneta|veh[ií]culo|suburban|escalade|sprinter|hiace|placa/.test(s)) { const pv = M.porVehiculo(90).filter(x => x.viajes).sort((a, b) => b.ingreso - a.ingreso); if (!pv.length) return 'Aún no hay viajes completados por camioneta en este periodo.'; const t = pv[0], u = pv[pv.length - 1]; return `En 90 días la camioneta que más produce es la ${TIPOS_VEHICULO[t.vehiculo.tipo].corto} ${t.vehiculo.placa} con ${t.viajes} viajes y ${usd(t.ingreso)}; la que menos, la ${TIPOS_VEHICULO[u.vehiculo.tipo].corto} ${u.vehiculo.placa} con ${u.viajes} viajes y ${usd(u.ingreso)}. Si una unidad produce poco, conviene revisar si pasa mucho tiempo en taller o si se asigna menos.`; }
    return `Puedo responder con los números del sistema: qué zona rinde más, la mejor temporada, de dónde vienen los viajes, choferes, camionetas, clientes, aliados y comisiones, flotas aliadas y comisión de plataforma, estancias planeadas, sugerencias más pedidas, viajes compartidos, no-shows, flota, pagos pendientes, margen y el día de hoy. Pruebe, por ejemplo: «¿qué zona rinde más?» o «¿qué hay pendiente de cobrar?».`;
  }

  // ───────────────────────── mapa (estilos) y dispositivo ─────────────────────────
  const ESRI = 'https://services.arcgisonline.com/ArcGIS/rest/services/';
  const ATTR = 'Tiles © Esri · Maxar, Earthstar Geographics · © OpenStreetMap contributors';
  const MAPAS = {
    hibrido: { nombre: { es: 'Híbrido', en: 'Hybrid' }, capas: [{ url: ESRI + 'World_Imagery/MapServer/tile/{z}/{y}/{x}', maxZoom: 19 }, { url: ESRI + 'Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', maxZoom: 19, opacity: .95 }, { url: ESRI + 'Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', maxZoom: 19, opacity: .95 }] },
    mapa: { nombre: { es: 'Mapa', en: 'Map' }, capas: [{ url: ESRI + 'World_Street_Map/MapServer/tile/{z}/{y}/{x}', maxZoom: 19 }] },
    gris: { nombre: { es: 'Sobrio', en: 'Minimal' }, capas: [{ url: ESRI + 'Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', maxZoom: 16 }, { url: ESRI + 'Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}', maxZoom: 16, opacity: .9 }] },
    oscuro: { nombre: { es: 'Oscuro', en: 'Dark' }, capas: [{ url: ESRI + 'Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', maxZoom: 16 }, { url: ESRI + 'Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', maxZoom: 16, opacity: .85 }] },
  };
  function estiloMapa(m, estilo) { if (!window.L) return; (m._acsCapas || []).forEach(l => m.removeLayer(l)); const def = MAPAS[estilo] || MAPAS.hibrido; m._acsCapas = def.capas.map((c, i) => L.tileLayer(c.url, { maxZoom: c.maxZoom || 19, opacity: c.opacity == null ? 1 : c.opacity, attribution: i === 0 ? ATTR : '' }).addTo(m)); m._acsEstilo = MAPAS[estilo] ? estilo : 'hibrido'; if (!m._acsFijo) { try { localStorage.setItem('acs_mapa', m._acsEstilo); } catch (e) { } } if (m._acsBtn) m._acsBtn.textContent = def.nombre[m._acsIdioma || 'es']; }
  function mapa(el, opts) { opts = opts || {}; const m = L.map(el, Object.assign({ zoomControl: false, attributionControl: true }, opts.leaflet || {})); m._acsIdioma = opts.idioma || 'es'; m._acsFijo = !!opts.fijo; let estilo = opts.estilo || 'hibrido'; if (!opts.fijo) { try { estilo = localStorage.getItem('acs_mapa') || estilo; } catch (e) { } } estiloMapa(m, estilo);
    if (opts.selector !== false) { const wrap = el.parentElement; const b = document.createElement('button'); b.className = 'mapstyle press'; b.type = 'button'; b.title = m._acsIdioma === 'en' ? 'Map style' : 'Estilo de mapa'; b.textContent = (MAPAS[m._acsEstilo] || MAPAS.hibrido).nombre[m._acsIdioma]; b.onclick = () => { const ks = Object.keys(MAPAS); estiloMapa(m, ks[(ks.indexOf(m._acsEstilo) + 1) % ks.length]); }; m._acsBtn = b; (wrap || el).appendChild(b); }
    return m; }
  function dispositivo() { const q = new URLSearchParams(location.search).get('device'); if (q === 'desktop' || q === 'mobile') sessionStorage.setItem('acs_device', q); if (q === 'auto') sessionStorage.removeItem('acs_device'); const forzado = sessionStorage.getItem('acs_device'); const d = forzado || (window.matchMedia && matchMedia('(min-width: 1024px)').matches ? 'desktop' : 'mobile'); document.documentElement.dataset.device = d; document.documentElement.dataset.deviceForzado = forzado ? '1' : ''; return d; }
  dispositivo(); window.addEventListener('resize', () => { if (!sessionStorage.getItem('acs_device')) dispositivo(); });
  function fijarDispositivo(d) { if (d) sessionStorage.setItem('acs_device', d); else sessionStorage.removeItem('acs_device'); return dispositivo(); }

  // ───────────────────────── API pública ─────────────────────────
  window.ACS = {
    get db() { return db; }, KEY, save: () => persist('datos'), reset, on: (f) => listeners.push(f), onEvento: (f) => listenersEv.push(f), log, esLider,
    uid, hoy, ahoraHM, fechaISO, fechaLarga, sumaDias, minutosDe, hmDe, hora12, usd, mxn, pct, haversine, MESES, MESES_EN, DIAS, DIAS_EN,
    ZONAS, LUGARES, lugar, NODOS, TIPOS_VEHICULO, EXTRAS, CANALES, ESTADOS, METODOS, ACTIVOS, EN_RUTA, RUTAS: R, PROVEEDORES, SUGERENCIAS, MAPAS,
    mapa, estiloMapa, dispositivo, fijarDispositivo,
    crearItinerario, cancelarItinerario, itinerario, itinerariosDe, compartirViaje, pagarParte, agregarAmigo, invitarAmigo, aceptarInvitacion, viajesCompartidosCon, enlaceSeguimiento,
    proveedor, liquidarProveedor, guardarProveedor, guardarSugerencia, quitarSugerencia, sugerencia, evaluarSolicitud, aprobarSolicitud, rechazarSolicitud, guardarRequisitos, chatAbierto,
    cotizar: (d) => cotizarCon(db.config, d), distanciaViaje, rutaEntre, rutaLugares, rutaViaje, eta, usaAutopista,
    solicitarViaje, despachar: (id) => { const v = viaje(id); const c = despachar(v); persist('datos'); return c; }, cambiarEstado, reasignar, setEnLinea, setPosicion, setGpsReal, registrarPago, confirmarPago, enviarMensaje, registrarGasto, guardarChecklist, calificar, vueloDe,
    chofer, vehiculo, cliente, aliado, viaje, viajeActivo, mensajesDe: (viajeId) => db.mensajes.filter(m => m.viajeId === viajeId), viajesDe: (choferId, fecha) => db.viajes.filter(v => v.choferId === choferId && (!fecha || v.fecha === fecha)),
    M, asistente,
  };
})();
