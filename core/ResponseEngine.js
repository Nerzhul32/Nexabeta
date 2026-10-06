"use strict";

import { BehaviorEngine } from "./BehaviorEngine.js";

const RESPONSES = {
  alert_acknowledged: ["Anotado. Ya está bajo control.", "Recibido; no se me escapan los pendientes.", "Listo. Una cosa menos en la lista."],
  interaction_while_sleeping: ["¿Eh? Ya estoy despierta. ¿Qué pasó?", "Cinco tentáculos más... bueno, ya voy.", "Me estaba quedando dormida. Cuéntame."],
  user_returned: ["Ah, regresaste. ¿Qué me cuentas?", "Mira quién volvió; ya se notaba el silencio.", "Te estaba esperando... más o menos."],
  first_interaction_today: ["¡Hola! ¿Qué hacemos hoy?", "Buen día de nuevo por aquí. ¿Qué necesitas?", "Ya estoy contigo. ¿Por dónde empezamos?"],
  interaction_while_bored: ["Justo a tiempo: ya estaba buscando qué hacer.", "¡Una interrupción interesante! Te escucho.", "Se acabó la pausa. ¿Qué tienes en mente?"],
  interaction_burst_2: ["¿Otra vez? Veo que tienes algo entre tentáculos.", "Segunda llamada recibida. ¿Qué se te ofrece?", "Ajá, sigo aquí. ¿Me estás poniendo a prueba?"],
  interaction_burst_3: ["¿Me estás probando? Porque sigo aprobando.", "Tres veces seguidas... esto ya parece un patrón.", "Tengo toda tu atención. ¿Y ahora qué?"],
  interaction_burst_4: ["Creo que ya entendí el juego.", "Cuarta llamada. Mi récord de paciencia sigue intacto.", "Vale, vale, ya te vi."],
  interaction_burst_5: ["Definitivamente hoy tienes tiempo libre.", "Quinta vez: ¿hay algo detrás de tanto botón?", "Empiezo a sospechar que esto es un experimento."],
  late_night_interaction: ["¿A estas horas? Al menos alguien sigue despierto.", "La noche está tranquila. ¿Qué necesitas?", "Madrugada y tentáculos en servicio; te escucho."],
  morning_interaction: ["¡Buenos días! Arranquemos sin apuro.", "La mañana promete. ¿Qué hacemos primero?", "Ya desperté; todavía estoy ordenando mis tentáculos."],
  interaction: ["Aquí estoy. ¿Qué hacemos?", "Te escucho; dispara la idea.", "Presente, con tentáculos listos."],
  reminder_created: ["Lo tengo. Puedes contar conmigo.", "Anotado; me aseguraré de tenerlo presente.", "Queda apuntado. No se me va a escapar."],
  reminder_upcoming: ["Por cierto, se acerca uno de tus recordatorios.", "Ojo, pronto toca revisar algo que dejaste anotado.", "Te aviso con tiempo: hay un recordatorio cerca."],
  reminder_due: ["Ey, tienes algo pendiente.", "Llegó la hora; hay un recordatorio esperándote.", "No quiero interrumpir, pero toca revisar esto."],
  reminder_removed: ["Listo, lo quité de la lista.", "Hecho. Ese pendiente ya no me preocupa.", "Recordatorio eliminado; tentáculos liberados."],
  weather_rain: ["Parece que llueve. Buen momento para quedarse a cubierto.", "La lluvia ya llegó; yo escucho las gotas desde aquí.", "Día de lluvia afuera, calma por este lado."],
  weather_hot: ["Hace calor ahí fuera. Aquí abajo se está mejor.", "La superficie está calentita; no envidio esos tentáculos.", "Día caluroso. Hidratación para ti, calma para mí."],
  weather_cold: ["Brrr, hace frío. Yo me quedo entre las algas.", "Está fresco por ahí. Abrígate un poco.", "El clima pide algo calentito; yo pongo la compañía."],
  weather_windy: ["Vaya viento. Mejor sujeta bien el sombrero.", "El viento anda con energía hoy; yo me quedo a resguardo.", "Se nota el viento. Día para ir con calma."],
  weather_clear: ["Cielo despejado. Buen día para asomarse a explorar.", "Parece que el cielo dio una tregua. Qué agradable.", "Día despejado; hasta el fondo del mar se ve más alegre."],
  weather_other: ["El clima cambió un poco. Lo tendré en cuenta.", "Ya vi el cambio del tiempo; seguimos atentos.", "El cielo anda en otra. Yo sigo por aquí."],
  idle_short: ["¿Todo tranquilo por ahí?", "Me quedé pensando en qué estaremos haciendo.", "Silencio... sospechosamente cómodo."],
  idle_medium: ["Llevamos un rato en pausa. Aquí sigo.", "¿Te fuiste a explorar sin mí?", "Voy a asumir que estás ocupado. De momento."],
  idle_long: ["Me estaba quedando dormida; avísame cuando vuelvas.", "Llevamos un buen rato en calma. Zzz... casi.", "Pausa larga. Aquí estaré cuando me necesites."],
};

function dailyBriefing(context) {
  const details = [];
  const weather = context.weather;
  if (weather && Number.isFinite(weather.temp) && weather.condition) {
    const city = weather.city ? ` en ${weather.city}` : "";
    let advice = "";
    switch (BehaviorEngine.weatherBehavior(weather)) {
      case "weather_rain": advice = "Lleva paraguas si sales."; break;
      case "weather_hot": advice = "Recuerda hidratarte."; break;
      case "weather_cold": advice = "Abrígate si sales."; break;
      case "weather_windy": advice = "Considera una capa extra si sales."; break;
      case "weather_clear": advice = "Buen momento para dar un paseo si te apetece."; break;
      default: break;
    }
    details.push(`Ahora${city}: ${weather.temp}°C y ${weather.condition.toLocaleLowerCase("es-CL")}.${advice ? ` ${advice}` : ""}`);
  }

  const nextReminder = context.upcomingReminders && context.upcomingReminders[0];
  if (nextReminder) {
    const minutes = Math.ceil((nextReminder.when - context.timestamp) / 60_000);
    details.push(`En ${minutes} min: «${nextReminder.text}».`);
  }
  return details;
}

const ResponseEngine = {
  respond(behavior, context = {}, memory = {}) {
    const choices = RESPONSES[behavior];
    if (!choices) throw new RangeError(`No hay respuestas para el comportamiento: ${behavior}`);
    const lastByBehavior = memory.lastByBehavior || {};
    let available = choices.filter(message => message !== memory.lastResponse
      && message !== lastByBehavior[behavior]);
    if (!available.length) available = choices.filter(message => message !== memory.lastResponse);
    if (!available.length) available = choices;
    const template = available[Math.floor(Math.random() * available.length)];
    let message = template;

    if (behavior === "reminder_due" && context.lastReminder) {
      message += ` ${context.lastReminder.text}`;
    } else if (behavior === "reminder_created" && context.lastReminder) {
      message = `${template} «${context.lastReminder.text}»`;
    } else if (behavior.startsWith("weather_") && context.weather) {
      message += ` ${context.weather.temp}°C, ${context.weather.condition.toLowerCase()}.`;
    }
    if (behavior === "first_interaction_today") {
      const details = dailyBriefing(context);
      if (details.length) message += ` ${details.join(" ")}`;
    }

    return {
      message,
      memory: {
        lastResponse: template,
        lastByBehavior: { ...lastByBehavior, [behavior]: template },
      },
    };
  },
};

export { ResponseEngine };
