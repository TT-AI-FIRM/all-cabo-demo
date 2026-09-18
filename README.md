# All Cabo Services · demo del sistema integral

Demo funcional (sin servidor) preparado por T.T AI Firm. Página de inicio editorial (`index.html`: cortina de carga, scroll suave con Lenis, hero con parallax, carrusel, lista del sistema, capturas, números y pie) y tres web apps estáticas que comparten datos en el mismo dispositivo:

- `cliente/` — Guest app (English): instant quote, flight-aware pickup, simulated payments (Apple Pay, card, Zelle, transfer, cash), live map with the driver, chat, receipts, accounts.
- `chofer/` — App del chofer (español): en línea/fuera, viajes asignados automáticamente al más cercano, mapa con ruta real, estados, checklist, gastos con foto, chat, GPS del teléfono opcional.
- `central/` — Central del dueño (español): mapa en vivo, despacho, vuelos, clientes, aliados y comisiones, cuentas de boda y corporativas, flota y cumplimiento, choferes, gastos, tablero financiero, configuración.
- `shared/core.js` — datos semilla deterministas (12 meses), tarifas por zona, despacho por distancia, simulación de GPS sobre rutas OSRM, métricas y asistente por reglas. `shared/rutas.js` — 19 rutas reales de carretera entre SJD, San José, Corredor, Cabo San Lucas y Pacífico.

Enlaces directos: `cliente/?user=c1`, `chofer/?id=d1`, `central/?rol=dueno#tablero`. Datos en `localStorage` (`acs_demo_v6`), sincronizados entre pestañas con `BroadcastChannel`. Todo lo simulado se indica en pantalla.

## v2 (18-sep-2026)
- **Cliente:** reserva paso a paso (a dónde → cuándo → camioneta → pagar) con selector de lugares con buscador, **paradas** en la ruta, cambio de sentido y mapa arriba; Explore con **fotos** y mapa de lugares; la mensajería con el chofer **solo durante el viaje**.
- **Chofer:** mensajería con el pasajero solo mientras el viaje está en curso.
- **Central:** módulo **Flota en vivo** (mapa oscuro con todas las camionetas, propias y de flotas aliadas; tarjeta por unidad con avance de ruta, ETA, velocímetro, combustible y alertas; brújula; filtros y lista), **Finanzas** (meses comparados, ingresos, gastos por tipo con cada registro, viajes del mes y vista aparte de lo que dejan las flotas aliadas: comisión, ganancia por viaje, clientes atendidos, choferes con calificación) y **Solicitudes de flota** (otras empresas piden entrar; el dueño fija requisitos y aprueba o rechaza).
- **Datos:** mes muy movido (≈5–6 viajes al día en la temporada actual), 18 camionetas (8 propias, 10 de 6 flotas aliadas), 16 choferes, gastos de 12 meses por camioneta y viaje, telemetría simulada (velocidad, combustible, rumbo).
