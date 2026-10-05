/* NEXA WEB v0.1
 * Capas: Services -> NexaCore -> UI.
 * La UI se comunica únicamente con NexaCore; el Core coordina los Services.
 */
"use strict";

/* ---------- SERVICES ---------- */

const MockWeatherProvider = {
  async fetch() {
    return { temp: 18, condition: "Nublado", city: "Villarrica" };
  },
};

const WeatherService = {
  provider: MockWeatherProvider,
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

  say: {
    sleeping: "Zzz....",
    idle: "Cualquier cosa, me avisas.",
    awake: "Estoy atento. ¿Qué hacemos?",
    thinking: "Hmm... déjame pensar.",
    happy: ["¡Aquí estoy!", "¡Qué bueno verte!", "Todo en orden!", "Listo para lo que necesites."],
  },

  onChange(fn) {
    if (typeof fn !== "function") throw new TypeError("El listener debe ser una función.");
    this.listeners.push(fn);
    fn(this.state, this.message);
  },
  set(state, message, meta = {}) {
    if (!this.STATES.includes(state)) {
      throw new RangeError(`Estado de Nexa no válido: ${state}`);
    }
    if (meta.action !== undefined) this.context.lastAction = meta.action;

    this.state = state;
    this.message = message ?? (
      Array.isArray(this.say[state])
        ? this.say[state][Math.floor(Math.random() * this.say[state].length)]
        : this.say[state]
    );
    this.listeners.forEach(fn => fn(this.state, this.message));
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
    // AIService can replace this simulated response in a future phase.
    this.timers.think = setTimeout(() => this.set("happy"), 1200);
  },
  getWeather() {
    return WeatherService.get();
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

function renderState(state, text) {
  $("kraken").dataset.state = state;
  $("stateLabel").textContent = state;
  $("bubble").textContent = text;
  $("fx").textContent = KRAKEN_FX[state] || "";
}

function renderClock() {
  const now = new Date();
  $("time").textContent = now.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", hour12: false });
  const date = now.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  $("date").textContent = date[0].toUpperCase() + date.slice(1);
}

async function renderWeather() {
  try {
    const weather = await NexaCore.getWeather();
    $("wxTemp").textContent = `${weather.temp}°C`;
    $("wxCond").textContent = weather.condition;
    $("wxCity").textContent = weather.city;
  } catch (error) {
    console.error("No se pudo cargar el clima.", error);
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
  renderWeather();
  renderReminders();
  setInterval(() => {
    renderClock();
    checkReminders();
  }, 1000);
  checkReminders();
}

document.addEventListener("DOMContentLoaded", init);
