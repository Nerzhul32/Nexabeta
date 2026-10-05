"use strict";

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
  status.textContent = window.NexaCore.getWeatherSnapshot()
    ? "Actualizando clima..."
    : "Consultando ubicación y clima...";
  try {
    renderWeather(await window.NexaCore.refreshWeather());
  } catch (error) {
    status.textContent = `No se pudo actualizar el clima. ${error.message}`;
    console.error("No se pudo cargar el clima.", error);
  } finally {
    button.disabled = false;
  }
}

function renderReminders() {
  const listElement = $("remList");
  const reminders = window.NexaCore.getReminders();
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
      window.NexaCore.removeReminder(reminder.id);
      renderReminders();
    };
    item.append(info, remove);
    listElement.append(item);
  }
}

function checkReminders() {
  if (window.NexaCore.checkReminders().length) renderReminders();
}

function init() {
  window.NexaCore.onChange(renderState);
  $("interactBtn").onclick = () => window.NexaCore.interact();
  $("kraken").onclick = () => window.NexaCore.interact();
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
    window.NexaCore.addReminder(text, when);
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
  }, window.NexaCore.WEATHER_REFRESH_INTERVAL);
  window.addEventListener("focus", () => {
    if (Date.now() - window.NexaCore.weatherRefreshAt >= window.NexaCore.WEATHER_REFRESH_INTERVAL) {
      refreshWeather();
    }
  });
  checkReminders();
}

document.addEventListener("DOMContentLoaded", init);
