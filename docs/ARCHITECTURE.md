# Arquitectura de Nexa Web

La aplicación usa JavaScript plano y módulos ES del navegador; no requiere framework, bundler, backend ni conexión a un modelo de IA.

```text
app.js (UI)
   ↓
NexaCore → ContextEngine → MoodEngine → BehaviorEngine → ResponseEngine
   ↑                                                        │
   └────────────────────────────────────────────────────────┘
   └────────── WeatherService / ReminderService ────────────┘
```

- **UI — `app.js`:** conecta controles, renderiza el estado, reloj, clima y recordatorios. Solo consume NexaCore; no importa los servicios ni los motores.
- **NexaCore — `core/NexaCore.js`:** coordina eventos, timers, estado visual, mood, persistencia y servicios. No accede al DOM. Mantiene los estados operativos `idle`, `awake`, `thinking`, `happy`, `sleeping` y `alert`; el mood es una dimensión independiente (`happy`, `curious`, `sleepy`, `bored`, `excited`, `annoyed`, `concerned`).
- **ContextEngine — `core/ContextEngine.js`:** construye una instantánea contextual con hora, minuto, día, periodo, madrugada, tiempo e interacciones recientes, última acción, state/mood actuales, clima, recordatorios próximos y cantidad pendiente.
- **MoodEngine — `core/MoodEngine.js`:** propone cambios de ánimo a partir de eventos y contexto. Aplica un cooldown para evitar oscilaciones, con prioridad para eventos importantes como recordatorios.
- **BehaviorEngine — `core/BehaviorEngine.js`:** elige un comportamiento por evento y contexto; distingue regresos, primera interacción del día, secuencias de pulsaciones, sueño, ánimo, hora, clima y recordatorios.
- **ResponseEngine — `core/ResponseEngine.js`:** elige entre respuestas breves en español para cada comportamiento y evita repetir inmediatamente una respuesta.
- **WeatherService — `services/WeatherService.js`:** conserva Open-Meteo, su proveedor de prueba y el uso de geolocalización. Si la ubicación no está disponible o se deniega el permiso, usa Villarrica como referencia.
- **ReminderService — `services/ReminderService.js`:** conserva la validación y persistencia en `localStorage["nexa.reminders.v1"]`, la lista, eliminación y vencimientos.

## Flujo de comportamiento

```text
evento → contexto → mood → comportamiento → respuesta → state/effect → UI
```

Los eventos de usuario pasan por `NexaCore.interact()`. Las actualizaciones de clima y recordatorios también llegan al núcleo desde sus servicios; los motores reciben datos y no conocen el DOM. Mood describe la personalidad y no sustituye el state que controla las animaciones existentes.

La actividad se cuenta en una ventana corta para modular interacciones consecutivas. La primera interacción del día incorpora, si están disponibles, el clima actual, una sugerencia práctica y el próximo recordatorio cercano. La inactividad puede cambiar el mood y producir comentarios ocasionales solo mientras Nexa está despierta; nunca habla ni muestra efectos de texto cuando duerme. Cada diálogo desaparece automáticamente tras unos segundos y el cuadro no ocupa espacio cuando está vacío. Las respuestas y reacciones al clima también respetan cooldowns. Los cambios de periodo actualizan el mood sin interrumpir al usuario.

Los recordatorios vencidos mantienen el state `alert`; los próximos se anuncian una sola vez por recordatorio cuando entran en la ventana de 15 minutos. La app no puede evaluar recordatorios mientras está cerrada.

## Persistencia y compatibilidad

`NexaCore` guarda en `localStorage["nexa.personality.v1"]` datos pequeños de actividad, mood y última respuesta para conservar continuidad sin almacenar conversaciones. Los recordatorios siguen en su propia clave y servicio. La interfaz, los estados/animaciones, clima Open-Meteo, fallback de Villarrica y diseño responsive se mantienen.

El clima se muestra y actualiza al cargar, manualmente y cada 15 minutos. Las reacciones contextuales no se emiten en cada consulta: dependen de cambios, probabilidad y cooldown. La atribución de Open-Meteo permanece visible; antes de cualquier uso comercial se deben revisar sus términos y licencia.

La app debe servirse por HTTP/HTTPS para que el navegador resuelva los imports ES; abrir `index.html` directamente mediante `file://` no es compatible de forma consistente con módulos.
