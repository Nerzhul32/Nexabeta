# Arquitectura v0.1
Todo vive en `app.js`, organizado en tres capas:

1. **Services** — `WeatherService` delega en un proveedor reemplazable (actualmente `MockWeatherProvider`); `ReminderService` valida y persiste recordatorios en localStorage.
2. **NexaCore** — mantiene la máquina de estados (`idle, awake, thinking, happy, sleeping, alert`), el contexto, los timers y coordina ambos servicios. No toca el DOM. `getState()` expone una copia del estado y `onChange()` notifica a la UI.
3. **UI** — renderiza estado, reloj, clima y recordatorios. Solo llama a NexaCore; no accede directamente a los Services.

`NexaCore.version` identifica el formato del estado en memoria. Su contexto conserva la última acción, interacción y recordatorio. Los cambios de estado pasan por `NexaCore.set()`, que valida el estado y mantiene los timers de descanso.

Comportamiento: inactividad `awake→idle` (10 s), `idle→sleeping` (60 s). La interacción simula el paso `thinking→happy`; es el punto de integración futuro para IA, todavía sin conectar un servicio. Un recordatorio vencido con la página abierta se marca como notificado en `ReminderService` y Nexa pasa a `alert` mediante NexaCore.
Datos: `localStorage["nexa.reminders.v1"]` = `[{id, text, when(ms), fired}]`. El texto se representa como texto, nunca como HTML.
