# Arquitectura v0.1
Todo vive en `app.js`, organizado en tres capas:

1. **Services** — `WeatherService` delega en un proveedor reemplazable (Open-Meteo en producción; `MockWeatherProvider` para pruebas); `ReminderService` valida y persiste recordatorios en localStorage.
2. **NexaCore** — mantiene la máquina de estados (`idle, awake, thinking, happy, sleeping, alert`), el contexto, los timers y coordina ambos servicios. No toca el DOM. `getState()` expone una copia del estado y `onChange()` notifica a la UI.
3. **UI** — renderiza estado, reloj, clima y recordatorios. Solo llama a NexaCore; no accede directamente a los Services.

`NexaCore.version` identifica el formato del estado en memoria. Su contexto conserva la última acción, interacción y recordatorio. Los cambios de estado pasan por `NexaCore.set()`, que valida el estado y mantiene los timers de descanso.

El proveedor meteorológico consulta las condiciones actuales de Open-Meteo sin API key. Usa geolocalización del dispositivo (permiso del navegador); si el usuario la deniega o el navegador no la ofrece, utiliza Villarrica como ubicación de referencia. Las coordenadas permitidas se envían a Open-Meteo para consultar el pronóstico. Actualiza al cargar, manualmente y cada 15 minutos. La atribución a Open-Meteo aparece junto a los datos. Su API gratuita se usa conforme a sus condiciones de uso no comercial y licencia CC BY 4.0; revisar esos términos antes de emplearla en un producto comercial.

NexaCore adapta su frase y animación a la condición observada: cielo despejado, nubes, lluvia, nieve, niebla o tormenta. Al tocar el Kraken, la respuesta simulada también toma en cuenta el último clima cargado. Los mensajes de reacción son temporales; no agregan estados a la máquina actual.

Comportamiento: inactividad `awake→idle` (10 s), `idle→sleeping` (60 s). La interacción sigue siendo simulada; no hay un servicio de IA. Un recordatorio vencido con la página abierta se marca como notificado en `ReminderService` y Nexa pasa a `alert` mediante NexaCore.
Datos: `localStorage["nexa.reminders.v1"]` = `[{id, text, when(ms), fired}]`. El texto se representa como texto, nunca como HTML.
