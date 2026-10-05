# Guía para IAs/desarrolladores
- Solo HTML/CSS/JS plano; sin frameworks ni backend hasta nueva orden.
- Mantén las capas Services → NexaCore → UI. La UI solo llama a NexaCore; el Core coordina los Services.
- Los cambios de estado pasan por `NexaCore.set()`. No modifiques el estado interno desde servicios ni desde la UI.
- Expón el estado con `NexaCore.getState()` como copia; no entregues referencias al contexto interno.
- Cambios de clima: reemplaza el proveedor con `WeatherService.setProvider()`; no conectes APIs externas sin autorización.
- El clima en producción usa Open-Meteo: conserva la atribución visible y respeta los términos de uso no comercial y CC BY 4.0.
- Mantén seguros los textos de usuario: valida los recordatorios y renderízalos con `textContent`, nunca con `innerHTML`.
