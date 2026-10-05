# Arquitectura v0.1

La aplicación usa JavaScript plano con módulos ES nativos del navegador; no requiere framework, bundler ni backend.

```text
Nexa Web (app.js: UI)
        ↓
NexaCore (core/NexaCore.js: estado y comportamiento)
        ↓
Services (services/: integraciones actuales)
```

- **Web / UI — `app.js`:** conecta eventos de usuario, renderiza el estado, reloj, clima y recordatorios. Importa `NexaCore` y no utiliza los Services directamente.
- **NexaCore — `core/NexaCore.js`:** mantiene los estados `idle`, `awake`, `thinking`, `happy`, `sleeping` y `alert`, contexto, listeners y timers. Coordina las reacciones y las llamadas a servicios; no depende del DOM. `getState()` devuelve una copia y `onChange()` notifica a la UI.
- **WeatherService — `services/WeatherService.js`:** ofrece `get()` y `setProvider()`. El proveedor activo es Open-Meteo; también existe `MockWeatherProvider`. La consulta utiliza geolocalización del navegador cuando está disponible y Villarrica como fallback si no lo está o si se deniega el permiso.
- **ReminderService — `services/ReminderService.js`:** valida y persiste recordatorios en `localStorage["nexa.reminders.v1"]`; también lista, elimina y detecta los vencidos. La alerta de un vencimiento se coordina a través de NexaCore.

La interfaz meteorológica muestra las condiciones actuales, humedad, viento y hora de actualización. Se actualiza al cargar, manualmente y cada 15 minutos. Los datos provienen de Open-Meteo, con atribución visible en la UI; antes de cualquier uso comercial se deben revisar los términos del proveedor y la licencia aplicable.

La interacción sigue siendo simulada y puede reaccionar al último clima cargado; no hay integración de IA. La inactividad lleva `awake → idle` después de 10 segundos y `idle → sleeping` después de 60 segundos. No se evalúan los recordatorios cuando la página está cerrada.

La app debe servirse por HTTP/HTTPS para que el navegador resuelva los imports ES; abrir `index.html` directamente mediante `file://` no es compatible de forma consistente con módulos.
