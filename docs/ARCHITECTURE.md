# Arquitectura v0.1
Todo vive en `app.js`, en tres capas (de abajo hacia arriba):

1. **Services** — `WeatherService` (provider mock reemplazable) y `ReminderService` (localStorage).
2. **NexaCore** — máquina de estados (`idle, awake, thinking, happy, sleeping, alert`) y frases. No toca el DOM; notifica con `onChange`.
3. **UI** — renderiza estado, reloj, clima y recordatorios; solo llama a NexaCore/Services.

Reglas: la UI no habla con los Services de IA/ESP32 directamente. Cuando llegue el momento, NexaCore se moverá a un backend (o al ESP32) y la UI seguirá igual.

Comportamiento: inactividad `awake→idle` (10 s), `idle→sleeping` (60 s). Un recordatorio vencido con la página abierta pone a Nexa en `alert`.
Datos: `localStorage["nexa.reminders.v1"]` = `[{id, text, when(ms), fired}]`.
