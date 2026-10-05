/* NEXA WEB v0.1
 * Secciones: Services (clima, recordatorios) -> NexaCore (estado/personalidad) -> UI.
 * La UI solo habla con NexaCore; NexaCore solo habla con los Services.
 * Así, luego se puede mover NexaCore a un backend/ESP32 sin reescribir la UI.
 */
"use strict";

/* ---------- SERVICES ---------- */

// Clima: hoy simulado. Para una API real, reemplazar solo MockWeatherProvider.
const MockWeatherProvider = {
  async fetch() {
    return { temp: 18, condition: "Nublado", city: "Villarrica" };
  },
};
const WeatherService = {
  provider: MockWeatherProvider,
  get() { return this.provider.fetch(); },
};

// Recordatorios: persistencia en localStorage (reemplazable por otro storage).
const ReminderService = {
  KEY: "nexa.reminders.v1",
  load() {
    try { return JSON.parse(localStorage.getItem(this.KEY)) || []; }
    catch { return []; }
  },
  save(list) {
    try { localStorage.setItem(this.KEY, JSON.stringify(list)); } catch {}
  },
  list() { return this.load().sort((a, b) => a.when - b.when); },
  add(text, when) {
    const list = this.load();
    list.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), text, when, fired: false });
    this.save(list);
  },
  remove(id) { this.save(this.load().filter(r => r.id !== id)); },
  // Devuelve los recordatorios vencidos que aún no se avisaron y los marca.
  takeDue(now = Date.now()) {
    const list = this.load();
    const due = list.filter(r => !r.fired && r.when <= now);
    if (due.length) { due.forEach(r => (r.fired = true)); this.save(list); }
    return due;
  },
};

/* ---------- NEXA CORE: estados y personalidad ---------- */

const NexaCore = {
  STATES: ["idle", "awake", "thinking", "happy", "sleeping", "alert"],
  state: "sleeping",
  listeners: [],
  timers: {},
  IDLE_AFTER: 10_000,    // awake/happy -> idle
  SLEEP_AFTER: 60_000,   // idle -> sleeping

  say: {
    sleeping: "Zzz... Estoy descansando.",
    idle: "Estoy descansando.",
    awake: "Estoy atento. ¿Qué hacemos?",
    thinking: "Hmm... déjame pensar.",
    happy: ["¡Aquí estoy!", "¡Qué bueno verte!", "Todo en orden por el fondo del mar.", "Listo para lo que necesites."],
  },

  onChange(fn) { this.listeners.push(fn); },
  set(state, message) {
    this.state = state;
    const text = message ?? (Array.isArray(this.say[state])
      ? this.say[state][Math.floor(Math.random() * this.say[state].length)]
      : this.say[state]);
    this.listeners.forEach(fn => fn(state, text));
    this.scheduleRest();
  },
  scheduleRest() {
    clearTimeout(this.timers.rest);
    const next = { awake: ["idle", this.IDLE_AFTER], happy: ["awake", 5000], idle: ["sleeping", this.SLEEP_AFTER] }[this.state];
    if (next) this.timers.rest = setTimeout(() => this.set(next[0]), next[1]);
  },

  // Acciones que dispara el usuario
  interact() {
    clearTimeout(this.timers.think);
    if (this.state === "alert") return this.set("awake", "Recibido. ¿Qué hacemos?");
    if (this.state === "sleeping" || this.state === "idle") return this.set("awake");
    this.set("thinking");
    this.timers.think = setTimeout(() => this.set("happy"), 1200); // aquí irá la IA
  },
  onReminderCreated() { this.set("happy", "Anotado. Yo me encargo."); },
  onReminderRemoved() { this.set("idle", "Listo, lo olvidé."); },
  onReminderDue(list) {
    clearTimeout(this.timers.rest);
    this.state = "alert";
    this.listeners.forEach(fn => fn("alert", "¡Recordatorio! " + list.map(r => r.text).join(" · ")));
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
  const d = now.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long", year: "numeric" }); $("date").textContent = d[0].toUpperCase() + d.slice(1);
}

async function renderWeather() {
  const w = await WeatherService.get();
  $("wxTemp").textContent = `${w.temp}°C`;
  $("wxCond").textContent = w.condition;
  $("wxCity").textContent = w.city;
}

function renderReminders() {
  const ul = $("remList");
  const list = ReminderService.list();
  ul.replaceChildren();
  if (!list.length) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "Sin recordatorios.";
    ul.append(li);
    return;
  }
  for (const r of list) {
    const li = document.createElement("li");
    if (r.fired) li.className = "done";
    const info = document.createElement("span");
    info.textContent = r.text;               // textContent: sin riesgo de inyección HTML
    const when = document.createElement("span");
    when.className = "when";
    when.textContent = (r.fired ? "✓ " : "") + fmtWhen(r.when);
    info.append(when);
    const del = document.createElement("button");
    del.type = "button";
    del.title = "Eliminar";
    del.setAttribute("aria-label", "Eliminar recordatorio");
    del.textContent = "✕";
    del.onclick = () => { ReminderService.remove(r.id); NexaCore.onReminderRemoved(); renderReminders(); };
    li.append(info, del);
    ul.append(li);
  }
}

function checkReminders() {
  const due = ReminderService.takeDue();
  if (due.length) { NexaCore.onReminderDue(due); renderReminders(); }
}

function init() {
  NexaCore.onChange(renderState);
  $("interactBtn").onclick = () => NexaCore.interact();
  $("kraken").onclick = () => NexaCore.interact();

  $("reminderForm").onsubmit = e => {
    e.preventDefault();
    const text = $("remText").value.trim();
    const when = new Date($("remWhen").value).getTime();
    if (!text || Number.isNaN(when)) return;
    ReminderService.add(text, when);
    e.target.reset();
    NexaCore.onReminderCreated();
    renderReminders();
    checkReminders();
  };

  renderClock(); renderWeather(); renderReminders();
  renderState("sleeping", NexaCore.say.sleeping);
  setInterval(() => { renderClock(); checkReminders(); }, 1000);
  checkReminders();
}

document.addEventListener("DOMContentLoaded", init);
