"use strict";

import { ReminderService } from "../services/ReminderService.js";
import { WeatherService } from "../services/WeatherService.js";

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
  dispatch(action = {}) {
    if (!action || typeof action !== "object") {
      throw new TypeError("La acción debe ser un objeto.");
    }

    switch (action.type) {
      case "USER_INTERACTION":
      case "VOICE_INPUT":
      case "SYSTEM_EVENT":
        this.interact();
        return { ok: true, type: action.type };
      case "WEATHER_UPDATE":
        return this.refreshWeather();
      case "REMINDER_DUE":
        this.onReminderDue(Array.isArray(action.payload) ? action.payload : []);
        return { ok: true, type: action.type };
      default:
        return { ok: true, ignored: true, type: action.type || "unknown" };
    }
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

export { NexaCore };
