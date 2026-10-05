/* NEXA WEB v0.1
 * Capas: Services -> NexaCore -> UI.
 * La UI se comunica únicamente con NexaCore; el Core coordina los Services.
 */
"use strict";

/* ---------- SERVICES ---------- */

const MockWeatherProvider = {
  async fetch() {
    return {
      temp: 18,
      feelsLike: 18,
      humidity: 70,
      wind: 8,
      windUnit: "km/h",
      condition: "Parcialmente nublado",
      code: 2,
      city: "Villarrica",
      locationSource: "fallback",
      updatedAt: Date.now(),
    };
  },
};

const OpenMeteoWeatherProvider = {
  FALLBACK_LOCATION: {
    latitude: -39.2823,
    longitude: -72.227,
    city: "Villarrica",
  },
  weatherConditions: {
    0: "Despejado",
    1: "Mayormente despejado",
    2: "Parcialmente nublado",
    3: "Nublado",
    45: "Niebla",
    48: "Niebla con escarcha",
    51: "Llovizna ligera",
    53: "Llovizna moderada",
    55: "Llovizna intensa",
    56: "Llovizna helada ligera",
    57: "Llovizna helada intensa",
    61: "Lluvia ligera",
    63: "Lluvia moderada",
    65: "Lluvia intensa",
    66: "Lluvia helada ligera",
    67: "Lluvia helada intensa",
    71: "Nieve ligera",
    73: "Nieve moderada",
    75: "Nieve intensa",
    77: "Granos de nieve",
    80: "Chubascos ligeros",
    81: "Chubascos moderados",
    82: "Chubascos intensos",
    85: "Chubascos de nieve ligeros",
    86: "Chubascos de nieve intensos",
    95: "Tormenta eléctrica",
    96: "Tormenta con granizo ligero",
    99: "Tormenta con granizo intenso",
  },
  async getCoordinates() {
    if (!navigator.geolocation) {
      return { ...this.FALLBACK_LOCATION, source: "fallback" };
    }

    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          maximumAge: 300_000,
          timeout: 12_000,
        });
      });
      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        city: "Tu ubicación",
        source: "device",
      };
    } catch (error) {
      if (error.code !== error.PERMISSION_DENIED) throw error;
      return { ...this.FALLBACK_LOCATION, source: "fallback" };
    }
  },
  async fetch() {
    const location = await this.getCoordinates();
    const parameters = new URLSearchParams({
      latitude: location.latitude,
      longitude: location.longitude,
      current: "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m",
      timezone: "auto",
      forecast_days: "1",
    });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);

    try {
      const response = await fetch(`https://api.open-meteo.com/v1/forecast?${parameters}`, {
        signal: controller.signal,
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`Open-Meteo respondió con HTTP ${response.status}.`);
      }
      const data = await response.json();
      const current = data.current;
      const units = data.current_units;
      if (!current || !units || !Number.isFinite(current.temperature_2m)
        || !Number.isFinite(current.weather_code) || !Number.isFinite(current.wind_speed_10m)) {
        throw new TypeError("La respuesta del servicio meteorológico está incompleta.");
      }

      return {
        temp: Math.round(current.temperature_2m),
        feelsLike: Number.isFinite(current.apparent_temperature) ? Math.round(current.apparent_temperature) : null,
        humidity: Number.isFinite(current.relative_humidity_2m) ? current.relative_humidity_2m : null,
        wind: Number.isFinite(current.wind_speed_10m) ? Math.round(current.wind_speed_10m) : null,
        windUnit: units.wind_speed_10m || "km/h",
        condition: this.weatherConditions[current.weather_code] || `Condición meteorológica ${current.weather_code}`,
        code: current.weather_code,
        isDay: current.is_day === 1,
        city: location.city,
        locationSource: location.source,
        updatedAt: Date.now(),
      };
    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error("La consulta del clima tardó demasiado. Intenta actualizar otra vez.");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  },
};

const WeatherService = {
  provider: OpenMeteoWeatherProvider,
  setProvider(provider) {
    if (!provider || typeof provider.fetch !== "function") {
      throw new TypeError("El proveedor del clima debe implementar fetch().");
    }
    this.provider = provider;
  },
  get() {
    return this.provider.fetch();
  },
};

const ReminderService = {
  KEY: "nexa.reminders.v1",
  MAX_TEXT_LENGTH: 80,

  load() {
    const stored = localStorage.getItem(this.KEY);
    if (stored === null) return [];
    const reminders = JSON.parse(stored);
    if (!Array.isArray(reminders)) {
      throw new TypeError("Los recordatorios guardados tienen un formato inválido.");
    }
    return reminders;
  },
  save(reminders) {
    localStorage.setItem(this.KEY, JSON.stringify(reminders));
  },
  list() {
    return this.load()
      .sort((a, b) => a.when - b.when)
      .map(reminder => ({ ...reminder }));
  },
  get(id) {
    const reminder = this.load().find(item => item.id === id);
    return reminder ? { ...reminder } : null;
  },
  add(text, when) {
    if (typeof text !== "string" || !text.trim()) {
      throw new TypeError("El recordatorio debe incluir texto.");
    }
    const normalizedText = text.trim();
    if (normalizedText.length > this.MAX_TEXT_LENGTH) {
      throw new RangeError(`El texto no puede superar ${this.MAX_TEXT_LENGTH} caracteres.`);
    }
    if (!Number.isFinite(when) || !Number.isFinite(new Date(when).getTime())) {
      throw new TypeError("La fecha del recordatorio no es válida.");
    }

    const reminder = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      text: normalizedText,
      when,
      fired: false,
    };
    const reminders = this.load();
    reminders.push(reminder);
    this.save(reminders);
    return { ...reminder };
  },
  remove(id) {
    const reminders = this.load();
    const reminder = reminders.find(item => item.id === id);
    if (!reminder) return null;
    this.save(reminders.filter(item => item.id !== id));
    return { ...reminder };
  },
  takeDue(now = Date.now()) {
    const reminders = this.load();
    const due = reminders.filter(reminder => !reminder.fired && reminder.when <= now);
    if (due.length) {
      due.forEach(reminder => { reminder.fired = true; });
      this.save(reminders);
    }
    return due.map(reminder => ({ ...reminder }));
  },
};

/* ---------- NEXA CORE: estado, contexto y comportamiento ---------- */

function copyReminder(reminder) {
  return reminder ? {
    id: reminder.id,
    text: reminder.text,
    when: reminder.when,
    fired: reminder.fired,
  } : null;
}

const NexaCore = {
  version: 1,
  STATES: ["idle", "awake", "thinking", "happy", "sleeping", "alert"],
  state: "sleeping",
  context: {
    lastAction: null,
    lastInteraction: null,
    lastReminder: null,
  },
  listeners: [],
  timers: {},
  IDLE_AFTER: 10_000,
  SLEEP_AFTER: 60_000,
  message: "Zzz....",
  effect: "z Z",
  lastHappyMessage: null,
  weather: null,
  weatherPromise: null,
  weatherRefreshAt: 0,
  WEATHER_REFRESH_INTERVAL: 15 * 60_000,

  say: {
    sleeping: "Zzz....",
    idle: "Cualquier cosa, me avisas.",
    awake: "Estoy atento. ¿Qué hacemos?",
    thinking: ["Hmm... déjame pensar.", "Un segundo, estoy ordenando mis tentáculos...", "A ver... ya casi lo tengo."],
    happy: [
      "¡Aquí estoy! ¿Qué hacemos?",
      "¡Qué bueno verte por aquí!",
      "¡Listo! Tentáculos a la obra.",
      "Todo en orden por el fondo del mar.",
      "¡Je! Esa interacción me animó.",
      "Cuéntame, ¿qué necesitas?",
      "¡Un momento! Mis tentáculos están consultando el pronóstico.",
    ],
  },
  effects: {
    sleeping: ["z Z"],
    awake: ["✦", "♪", "¡"],
    thinking: ["...", "?", "✧"],
    happy: ["♥", "✦", "♪", "★", "♡", "!"],
    alert: ["!"],
  },

  onChange(fn) {
    if (typeof fn !== "function") throw new TypeError("El listener debe ser una función.");
    this.listeners.push(fn);
    fn(this.state, this.message, this.effect);
  },
  set(state, message, meta = {}) {
    if (!this.STATES.includes(state)) {
      throw new RangeError(`Estado de Nexa no válido: ${state}`);
    }
    clearTimeout(this.timers.weatherReaction);
    clearTimeout(this.timers.think);
    this.timers.think = null;
    if (meta.action !== undefined) this.context.lastAction = meta.action;

    this.state = state;
    const messages = this.say[state];
    if (message !== undefined) {
      this.message = message;
    } else if (Array.isArray(messages)) {
      const choices = state === "happy"
        ? messages.filter(item => item !== this.lastHappyMessage)
        : messages;
      this.message = choices[Math.floor(Math.random() * choices.length)];
    } else {
      this.message = messages;
    }
    if (state === "happy") this.lastHappyMessage = this.message;

    const effects = this.effects[state] || [""];
    this.effect = effects[Math.floor(Math.random() * effects.length)];
    this.listeners.forEach(fn => fn(this.state, this.message, this.effect));
    this.scheduleRest();
  },
  getState() {
    return {
      version: this.version,
      state: this.state,
      context: {
        lastAction: this.context.lastAction,
        lastInteraction: this.context.lastInteraction,
        lastReminder: copyReminder(this.context.lastReminder),
      },
    };
  },
  scheduleRest() {
    clearTimeout(this.timers.rest);
    const next = {
      awake: ["idle", this.IDLE_AFTER],
      happy: ["awake", 5000],
      idle: ["sleeping", this.SLEEP_AFTER],
    }[this.state];
    if (next) this.timers.rest = setTimeout(() => this.set(next[0]), next[1]);
  },
  weatherReaction(weather) {
    const code = weather.code;
    if (!Number.isFinite(code)) {
      return { state: "happy", message: `¡Ya revisé el clima! ${weather.condition}, ${weather.temp}°C.` };
    }
    if (code >= 95) {
      return { state: "thinking", message: `¡Se viene tormenta! Mejor nos quedamos bajo techo. ${weather.temp}°C y ${weather.condition.toLowerCase()}.` };
    }
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
      return { state: "thinking", message: `¡Está lloviendo! Buen día para escuchar las gotas desde el refugio. ${weather.temp}°C.` };
    }
    if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) {
      return { state: "thinking", message: `¡Nieve en la superficie! Yo me quedo calentito bajo el mar. ${weather.temp}°C.` };
    }
    if (code === 45 || code === 48) {
      return { state: "thinking", message: `Hay niebla por ahí; navegaré con cuidado. ${weather.temp}°C.` };
    }
    if (weather.temp >= 32) {
      return { state: "happy", message: `¡Qué calor en la superficie! Aquí abajo se está fresquito. ${weather.temp}°C.` };
    }
    if (weather.temp <= 5) {
      return { state: "thinking", message: `¡Brrr, qué frío! Me esconderé entre las algas. ${weather.temp}°C.` };
    }
    if (code === 2 || code === 3) {
      return { state: "idle", message: `El cielo está ${weather.condition.toLowerCase()}. Un día tranquilo bajo el agua. ${weather.temp}°C.` };
    }
    return { state: "happy", message: `¡Qué buen día! El cielo está ${weather.condition.toLowerCase()} y hay ${weather.temp}°C. ¿Salimos a explorar?` };
  },
  async refreshWeather() {
    if (this.weatherPromise) return this.weatherPromise;
    this.weatherPromise = WeatherService.get()
      .then(weather => {
        this.weather = { ...weather };
        this.weatherRefreshAt = Date.now();
        if (this.state !== "alert" && !this.timers.think) {
          const reaction = this.weatherReaction(weather);
          this.set(reaction.state, reaction.message, { action: "weather_updated" });
          this.timers.weatherReaction = setTimeout(() => {
            if (this.state === reaction.state) this.set("idle", "Sigo de guardia por aquí.");
          }, 8000);
        }
        return { ...this.weather };
      })
      .finally(() => { this.weatherPromise = null; });
    return this.weatherPromise;
  },
  getWeatherSnapshot() {
    return this.weather ? { ...this.weather } : null;
  },
  interact() {
    clearTimeout(this.timers.think);
    this.context.lastInteraction = Date.now();
    if (this.state === "alert") {
      this.set("awake", "Recibido. ¿Qué hacemos?", { action: "user_interaction" });
      return;
    }
    if (this.state === "sleeping" || this.state === "idle") {
      this.set("awake", undefined, { action: "user_interaction" });
      return;
    }

    this.set("thinking", undefined, { action: "user_interaction" });
    const responseDelay = 800 + Math.random() * 1000;
    this.timers.think = setTimeout(() => {
      this.timers.think = null;
      if (this.weather) {
        const reaction = this.weatherReaction(this.weather);
        this.set(reaction.state, reaction.message, { action: "weather_interaction" });
        this.timers.weatherReaction = setTimeout(() => {
          if (this.state === reaction.state) this.set("idle", "Sigo de guardia por aquí.");
        }, 8000);
      } else {
        this.set("happy");
      }
    }, responseDelay);
  },
  setWeatherProvider(provider) {
    WeatherService.setProvider(provider);
  },
  getReminders() {
    return ReminderService.list();
  },
  getReminder(id) {
    return ReminderService.get(id);
  },
  addReminder(text, when) {
    const reminder = ReminderService.add(text, when);
    this.context.lastReminder = copyReminder(reminder);
    this.set("happy", "Anotado. Yo me encargo.", { action: "reminder_created" });
    this.checkReminders();
    return reminder;
  },
  removeReminder(id) {
    const reminder = ReminderService.get(id);
    if (!reminder) return null;
    ReminderService.remove(id);
    this.context.lastReminder = copyReminder(reminder);
    this.set("idle", "Listo, lo olvidé.", { action: "reminder_removed" });
    return reminder;
  },
  checkReminders() {
    const due = ReminderService.takeDue();
    if (due.length) this.onReminderDue(due);
    return due;
  },
  onReminderDue(reminders) {
    clearTimeout(this.timers.think);
    this.context.lastReminder = copyReminder(reminders[reminders.length - 1]);
    this.set(
      "alert",
      "¡Recordatorio! " + reminders.map(reminder => reminder.text).join(" · "),
      { action: "reminder_due" },
    );
  },
};

/* ---------- UI ---------- */

const $ = id => document.getElementById(id);
const fmtWhen = ts => new Date(ts).toLocaleString("es-CL", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const KRAKEN_FX = { sleeping: "z Z", thinking: "...", alert: "!", happy: "♥" };

function renderState(state, text, effect) {
  $("kraken").dataset.state = state;
  $("stateLabel").textContent = state;
  $("bubble").textContent = text;
  $("fx").textContent = effect || KRAKEN_FX[state] || "";
}

function renderClock() {
  const now = new Date();
  $("time").textContent = now.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", hour12: false });
  const date = now.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  $("date").textContent = date[0].toUpperCase() + date.slice(1);
}

function renderWeather(weather) {
  $("wxTemp").textContent = `${weather.temp}°C`;
  $("wxCond").textContent = weather.condition;
  $("wxCity").textContent = weather.city;
  $("wxHumidity").textContent = !Number.isFinite(weather.humidity)
    ? "humedad --%"
    : `humedad ${weather.humidity}%`;
  $("wxWind").textContent = !Number.isFinite(weather.wind)
    ? "viento --"
    : `viento ${weather.wind} ${weather.windUnit}`;
  const updated = new Date(weather.updatedAt).toLocaleTimeString("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
  });
  $("wxStatus").textContent = weather.locationSource === "device"
    ? `GPS → Open-Meteo · ${updated}`
    : `Villarrica · referencia · ${updated}`;
}

async function refreshWeather() {
  const button = $("wxRefresh");
  const status = $("wxStatus");
  button.disabled = true;
  status.textContent = NexaCore.getWeatherSnapshot()
    ? "Actualizando clima..."
    : "Consultando ubicación y clima...";
  try {
    renderWeather(await NexaCore.refreshWeather());
  } catch (error) {
    status.textContent = `No se pudo actualizar el clima. ${error.message}`;
    console.error("No se pudo cargar el clima.", error);
  } finally {
    button.disabled = false;
  }
}

function renderReminders() {
  const listElement = $("remList");
  const reminders = NexaCore.getReminders();
  listElement.replaceChildren();
  if (!reminders.length) {
    const item = document.createElement("li");
    item.className = "empty";
    item.textContent = "Sin recordatorios.";
    listElement.append(item);
    return;
  }
  for (const reminder of reminders) {
    const item = document.createElement("li");
    if (reminder.fired) item.className = "done";
    const info = document.createElement("span");
    info.textContent = reminder.text;
    const when = document.createElement("span");
    when.className = "when";
    when.textContent = (reminder.fired ? "✓ " : "") + fmtWhen(reminder.when);
    info.append(when);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.title = "Eliminar";
    remove.setAttribute("aria-label", "Eliminar recordatorio");
    remove.textContent = "✕";
    remove.onclick = () => {
      NexaCore.removeReminder(reminder.id);
      renderReminders();
    };
    item.append(info, remove);
    listElement.append(item);
  }
}

function checkReminders() {
  if (NexaCore.checkReminders().length) renderReminders();
}

function init() {
  NexaCore.onChange(renderState);
  $("interactBtn").onclick = () => NexaCore.interact();
  $("kraken").onclick = () => NexaCore.interact();
  $("wxRefresh").onclick = refreshWeather;

  const reminderText = $("remText");
  const reminderWhen = $("remWhen");
  reminderText.addEventListener("input", () => reminderText.setCustomValidity(""));
  reminderWhen.addEventListener("input", () => reminderWhen.setCustomValidity(""));
  $("reminderForm").onsubmit = event => {
    event.preventDefault();
    const text = reminderText.value.trim();
    const when = new Date(reminderWhen.value).getTime();
    if (!text) {
      reminderText.setCustomValidity("Escribe el texto del recordatorio.");
      reminderText.reportValidity();
      return;
    }
    if (!Number.isFinite(when)) {
      reminderWhen.setCustomValidity("Elige una fecha y hora válidas.");
      reminderWhen.reportValidity();
      return;
    }
    NexaCore.addReminder(text, when);
    event.target.reset();
    renderReminders();
  };

  renderClock();
  renderReminders();
  refreshWeather();
  setInterval(() => {
    renderClock();
    checkReminders();
  }, 1000);
  setInterval(() => {
    if (document.visibilityState === "visible") refreshWeather();
  }, NexaCore.WEATHER_REFRESH_INTERVAL);
  window.addEventListener("focus", () => {
    if (Date.now() - NexaCore.weatherRefreshAt >= NexaCore.WEATHER_REFRESH_INTERVAL) {
      refreshWeather();
    }
  });
  checkReminders();
}

document.addEventListener("DOMContentLoaded", init);
