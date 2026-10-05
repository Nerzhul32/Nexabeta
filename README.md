# Nexabeta - Nexa Web v0.1
Prototipo web interactivo de **Nexa**, representado por un Kraken pixel-art morado. La interacción es simulada; no incluye IA ni backend.

**Incluye:** interfaz responsive (columnas en escritorio y pantalla completa en móviles/tablets, sin scroll de página), Kraken con 6 estados, reloj, clima actual de Open-Meteo basado en la ubicación del dispositivo (Villarrica como referencia si se deniega el permiso), recordatorios (localStorage) e interacción simulada. Nexa reacciona al clima y lo actualiza cada 15 minutos. Si hay muchos recordatorios, la lista se desplaza dentro de su panel.

**Arquitectura actual (módulos ES nativos, sin bundler):**
- `services/WeatherService.js` encapsula los proveedores meteorológicos y la validación de la respuesta.
- `services/ReminderService.js` encapsula la persistencia de recordatorios y la lógica de vencimiento.
- `core/NexaCore.js` concentra el estado, los timers, la coordinación de servicios y la API del núcleo.
- `app.js` se mantiene como cliente de la UI y no define la lógica de negocio ni la persistencia.

Detalles técnicos en `docs/ARCHITECTURE.md`.
