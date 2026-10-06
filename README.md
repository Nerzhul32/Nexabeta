# Nexabeta - Nexa Web

Nexa es un Kraken pixel-art interactivo que funciona en el navegador, sin backend, frameworks ni servicios de IA. Esta etapa convierte la interacción simulada en un **Living Companion**: sus respuestas varían según la hora, la actividad reciente, el ánimo, el clima y los recordatorios.

**Incluye:** interfaz responsive, seis estados visuales, personalidad con siete moods, reloj, clima de Open-Meteo con fallback de Villarrica, recordatorios en `localStorage` y respuestas contextuales en español. Nexa comparte el clima y el siguiente recordatorio al saludar, ofrece sugerencias prácticas y oculta el diálogo al terminar; mientras duerme no habla ni muestra efectos de texto. La app no requiere instalación de dependencias.

## Ejecutar

Sirve la carpeta por HTTP o HTTPS y abre `index.html` en el navegador. Por ejemplo, desde la raíz del repositorio:

```sh
python -m http.server 8000
```

Luego visita `http://localhost:8000`. Los módulos ES no funcionan de manera consistente abriendo el archivo directamente con `file://`.

Las pruebas de los motores y del flujo principal se ejecutan con `npm test`; usan el runner integrado de Node y no requieren instalar dependencias.

## Arquitectura

La UI en `app.js` delega en `core/NexaCore.js`, que coordina ContextEngine, MoodEngine, BehaviorEngine y ResponseEngine. Los servicios existentes mantienen sus dominios: `WeatherService` para Open-Meteo y `ReminderService` para recordatorios. NexaCore no accede al DOM.

La descripción completa del flujo, las reglas y los límites está en [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).
