"use strict";

import { BehaviorEngine } from "./BehaviorEngine.js";
import { ContextEngine } from "./ContextEngine.js";
import { MoodEngine } from "./MoodEngine.js";
import { ResponseEngine } from "./ResponseEngine.js";
import { ReminderService } from "../services/ReminderService.js";
import { WeatherService } from "../services/WeatherService.js";

const PERSONALITY_KEY = "nexa.personality.v1";
const RECENT_INTERACTION_WINDOW = 20_000;
const IDLE_SHORT_AFTER = 45_000;
const IDLE_MEDIUM_AFTER = 3 * 60_000;
const IDLE_LONG_AFTER = 10 * 60_000;
const SPEECH_COOLDOWN = 8 * 60_000;
const WEATHER_COOLDOWN = 20 * 60_000;

function copyReminder(reminder) {
  return reminder ? {
    id: reminder.id,
    text: reminder.text,
    when: reminder.when,
    fired: reminder.fired,
  } : null;
}

function localDayKey(timestamp) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function loadPersonality() {
  const stored = localStorage.getItem(PERSONALITY_KEY);
  if (stored === null) {
    return {
      lastInteraction: null,
      interactionsToday: 0,
      interactionDay: null,
      totalInteractions: 0,
      recentInteractions: [],
      lastAction: null,
      mood: "curious",
      moodChangedAt: 0,
      lastResponse: null,
      lastByBehavior: {},
      announcedReminderIds: [],
      lastWeatherSignature: null,
      lastWeatherReactionAt: 0,
      lastVisibleEventAt: 0,
      idleStage: null,
      lastObservedPeriod: null,
    };
  }

  const data = JSON.parse(stored);
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new TypeError("La personalidad guardada de Nexa tiene un formato inválido.");
  }
  return {
    lastInteraction: Number.isFinite(data.lastInteraction) ? data.lastInteraction : null,
    interactionsToday: Number.isInteger(data.interactionsToday) ? data.interactionsToday : 0,
    interactionDay: typeof data.interactionDay === "string" ? data.interactionDay : null,
    totalInteractions: Number.isInteger(data.totalInteractions) ? data.totalInteractions : 0,
    recentInteractions: Array.isArray(data.recentInteractions)
      ? data.recentInteractions.filter(Number.isFinite)
      : [],
    lastAction: typeof data.lastAction === "string" ? data.lastAction : null,
    mood: MoodEngine.MOODS.includes(data.mood) ? data.mood : "curious",
    moodChangedAt: Number.isFinite(data.moodChangedAt) ? data.moodChangedAt : 0,
    lastResponse: typeof data.lastResponse === "string" ? data.lastResponse : null,
    lastByBehavior: data.lastByBehavior && typeof data.lastByBehavior === "object"
      ? data.lastByBehavior
      : {},
    announcedReminderIds: Array.isArray(data.announcedReminderIds)
      ? data.announcedReminderIds.filter(id => typeof id === "string").slice(-25)
      : [],
    lastWeatherSignature: typeof data.lastWeatherSignature === "string" ? data.lastWeatherSignature : null,
    lastWeatherReactionAt: Number.isFinite(data.lastWeatherReactionAt) ? data.lastWeatherReactionAt : 0,
    lastVisibleEventAt: Number.isFinite(data.lastVisibleEventAt) ? data.lastVisibleEventAt : 0,
    idleStage: typeof data.idleStage === "string" ? data.idleStage : null,
    lastObservedPeriod: typeof data.lastObservedPeriod === "string" ? data.lastObservedPeriod : null,
  };
}

const NexaCore = {
  version: 2,
  STATES: ["idle", "awake", "thinking", "happy", "sleeping", "alert"],
  state: "sleeping",
  mood: "curious",
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
  weather: null,
  weatherPromise: null,
  weatherRefreshAt: 0,
  startedAt: Date.now(),
  personality: loadPersonality(),
  WEATHER_REFRESH_INTERVAL: 15 * 60_000,

  effects: {
    sleeping: ["z Z"],
    awake: ["✦", "♪", "¡"],
    thinking: ["...", "?", "✧"],
    happy: ["♥", "✦", "♪", "★", "♡", "!"],
    alert: ["!"],
  },

  persistPersonality() {
    localStorage.setItem(PERSONALITY_KEY, JSON.stringify(this.personality));
  },
  buildContext(now = Date.now(), extra = {}) {
    return ContextEngine.build({
      now,
      lastInteraction: this.personality.lastInteraction,
      recentInteractions: this.personality.recentInteractions,
      interactionsToday: this.personality.interactionsToday,
      totalInteractions: this.personality.totalInteractions,
      lastAction: this.personality.lastAction,
      state: this.state,
      mood: this.mood,
      weather: this.weather,
      reminders: ReminderService.list(),
      ...extra,
    });
  },
  notify() {
    const snapshot = this.getState();
    this.listeners.forEach(fn => fn(this.state, this.message, this.effect, snapshot));
  },
  onChange(fn) {
    if (typeof fn !== "function") throw new TypeError("El listener debe ser una función.");
    this.listeners.push(fn);
    fn(this.state, this.message, this.effect, this.getState());
  },
  set(state, message, meta = {}) {
    if (!this.STATES.includes(state)) {
      throw new RangeError(`Estado de Nexa no válido: ${state}`);
    }
    clearTimeout(this.timers.weatherReaction);
    clearTimeout(this.timers.think);
    this.timers.think = null;
    if (meta.action !== undefined) {
      this.context.lastAction = meta.action;
      this.personality.lastAction = meta.action;
      this.persistPersonality();
    }

    this.state = state;
    if (message !== undefined) this.message = message;
    const effects = this.effects[state] || [""];
    this.effect = effects[Math.floor(Math.random() * effects.length)];
    this.notify();
    this.scheduleRest();
  },
  getState() {
    const context = this.buildContext();
    return {
      version: this.version,
      state: this.state,
      mood: this.mood,
      context: {
        ...context,
        lastAction: this.personality.lastAction,
        lastInteraction: this.personality.lastInteraction,
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
  applyEvent(event, context, { speak = true } = {}) {
    this.context.lastAction = event.toLowerCase();
    this.personality.lastAction = this.context.lastAction;
    context.lastAction = this.context.lastAction;
    context.mood = this.mood;

    const moodResult = MoodEngine.update({
      mood: this.mood,
      changedAt: this.personality.moodChangedAt,
      event,
      context,
      now: context.timestamp,
    });
    this.mood = moodResult.mood;
    this.personality.mood = moodResult.mood;
    this.personality.moodChangedAt = moodResult.changedAt;

    const behavior = BehaviorEngine.decide(event, context);
    if (behavior && speak) {
      const response = ResponseEngine.respond(behavior, context, {
        lastResponse: this.personality.lastResponse,
        lastByBehavior: this.personality.lastByBehavior,
      });
      this.personality.lastResponse = response.memory.lastResponse;
      this.personality.lastByBehavior = response.memory.lastByBehavior;
      this.personality.lastVisibleEventAt = context.timestamp;
      this.applyResponseState(event, behavior, response.message, context.previousState);
      return behavior;
    }
    this.persistPersonality();
    this.notify();
    return behavior;
  },
  applyResponseState(event, behavior, message, previousState) {
    if (event === "USER_INTERACTION") {
      if (previousState === "sleeping" || previousState === "idle" || previousState === "alert") {
        this.set("awake", message, { action: "user_interaction" });
      } else if (behavior === "user_returned" || behavior === "interaction_burst_4"
        || behavior === "interaction_burst_5") {
        this.set("happy", message, { action: "user_interaction" });
      } else {
        this.set("thinking", message, { action: "user_interaction" });
        this.timers.think = setTimeout(() => {
          this.timers.think = null;
          if (this.state === "thinking") this.set("happy", this.message);
        }, 650);
      }
      return;
    }
    if (event === "REMINDER_DUE") {
      this.set("alert", message, { action: "reminder_due" });
      return;
    }
    if (event === "REMINDER_CREATED" || behavior === "weather_clear" || behavior === "weather_hot") {
      this.set("happy", message, { action: event.toLowerCase() });
      return;
    }
    if (event === "WEATHER_CHANGED") {
      this.set("thinking", message, { action: "weather_changed" });
      return;
    }
    this.set(this.state, message, { action: event.toLowerCase() });
  },
  weatherSignature(weather) {
    const behavior = BehaviorEngine.weatherBehavior(weather);
    const temperatureBand = weather.temp <= 5 ? "cold" : weather.temp >= 30 ? "hot" : "mild";
    return `${behavior}:${temperatureBand}:${weather.code}`;
  },
  weatherReaction(weather) {
    const context = { weather };
    const behavior = BehaviorEngine.weatherBehavior(weather);
    const response = ResponseEngine.respond(behavior, context);
    return {
      state: behavior === "weather_clear" || behavior === "weather_hot" ? "happy" : "thinking",
      message: response.message,
    };
  },
  async refreshWeather() {
    if (this.weatherPromise) return this.weatherPromise;
    this.weatherPromise = WeatherService.get()
      .then(weather => {
        const previousSignature = this.personality.lastWeatherSignature;
        const signature = this.weatherSignature(weather);
        this.weather = { ...weather };
        this.weatherRefreshAt = Date.now();
        this.personality.lastWeatherSignature = signature;
        this.persistPersonality();

        const weatherChanged = previousSignature
          ? previousSignature !== signature
          : Math.random() < 0.25;
        if (weatherChanged && this.state !== "alert"
          && Date.now() - this.personality.lastWeatherReactionAt >= WEATHER_COOLDOWN
          && (previousSignature === null || Math.random() < 0.45)) {
          this.personality.lastWeatherReactionAt = Date.now();
          this.applyEvent("WEATHER_CHANGED", this.buildContext(Date.now()), { speak: true });
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
    const now = Date.now();
    const previousState = this.state;
    const previousInteraction = this.personality.lastInteraction;
    const day = localDayKey(now);
    const firstInteractionToday = this.personality.interactionDay !== day
      || this.personality.interactionsToday === 0;
    if (this.personality.interactionDay !== day) {
      this.personality.interactionDay = day;
      this.personality.interactionsToday = 0;
    }
    this.personality.recentInteractions = this.personality.recentInteractions
      .filter(timestamp => now - timestamp <= RECENT_INTERACTION_WINDOW);
    this.personality.recentInteractions.push(now);
    this.personality.interactionsToday += 1;
    this.personality.totalInteractions += 1;
    this.personality.idleStage = null;
    this.personality.lastInteraction = now;
    this.context.lastInteraction = now;
    this.personality.lastVisibleEventAt = now;

    const context = this.buildContext(now, {
      lastInteraction: previousInteraction,
      firstInteractionToday,
      previousState,
    });
    this.persistPersonality();
    this.applyEvent("USER_INTERACTION", context);
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
    this.applyEvent("REMINDER_CREATED", this.buildContext(Date.now(), {
      lastReminder: copyReminder(reminder),
    }));
    this.checkReminders();
    return reminder;
  },
  removeReminder(id) {
    const reminder = ReminderService.get(id);
    if (!reminder) return null;
    ReminderService.remove(id);
    this.context.lastReminder = copyReminder(reminder);
    this.applyEvent("REMINDER_REMOVED", this.buildContext(Date.now(), {
      lastReminder: copyReminder(reminder),
    }));
    this.personality.announcedReminderIds = this.personality.announcedReminderIds
      .filter(announcedId => announcedId !== id);
    this.persistPersonality();
    return reminder;
  },
  checkReminders() {
    const due = ReminderService.takeDue();
    if (due.length) this.onReminderDue(due);
    return due;
  },
  onReminderDue(reminders) {
    if (!Array.isArray(reminders) || reminders.length === 0) return;
    clearTimeout(this.timers.think);
    this.context.lastReminder = copyReminder(reminders[reminders.length - 1]);
    this.applyEvent("REMINDER_DUE", this.buildContext(Date.now(), {
      lastReminder: this.context.lastReminder,
      dueReminders: reminders.map(copyReminder),
    }));
  },
  checkUpcomingReminders(now = Date.now()) {
    const announced = new Set(this.personality.announcedReminderIds);
    const next = ReminderService.list().find(reminder => !reminder.fired
      && reminder.when > now && reminder.when - now <= 15 * 60_000
      && !announced.has(reminder.id));
    if (!next) return;
    this.personality.announcedReminderIds.push(next.id);
    this.personality.announcedReminderIds = this.personality.announcedReminderIds.slice(-25);
    this.context.lastReminder = copyReminder(next);
    this.persistPersonality();
    this.applyEvent("REMINDER_UPCOMING", this.buildContext(now, {
      lastReminder: copyReminder(next),
    }), { speak: now - this.personality.lastVisibleEventAt >= SPEECH_COOLDOWN });
  },
  tick(now = Date.now()) {
    const day = localDayKey(now);
    if (this.personality.interactionDay !== null && this.personality.interactionDay !== day) {
      this.personality.interactionDay = day;
      this.personality.interactionsToday = 0;
      this.persistPersonality();
    }
    this.checkReminders();
    this.checkUpcomingReminders(now);

    const period = ContextEngine.getDayPeriod(new Date(now).getHours());
    if (this.personality.lastObservedPeriod === null) {
      this.personality.lastObservedPeriod = period;
    } else if (period !== this.personality.lastObservedPeriod) {
      this.personality.lastObservedPeriod = period;
      if (period === "morning") this.applyEvent("MORNING_STARTED", this.buildContext(now));
      if (period === "night") this.applyEvent("NIGHT_STARTED", this.buildContext(now));
    }

    const activityAt = this.personality.lastInteraction || this.startedAt;
    const idleFor = now - activityAt;
    const idleStage = idleFor >= IDLE_LONG_AFTER ? "long"
      : idleFor >= IDLE_MEDIUM_AFTER ? "medium"
        : idleFor >= IDLE_SHORT_AFTER ? "short" : null;
    if (idleStage && idleStage !== this.personality.idleStage) {
      this.personality.idleStage = idleStage;
      this.persistPersonality();
      const event = idleStage === "long" ? "LONG_IDLE" : "IDLE_STARTED";
      const shouldSpeak = now - this.personality.lastVisibleEventAt >= SPEECH_COOLDOWN
        && Math.random() < 0.25;
      this.applyEvent(event, this.buildContext(now, { idleStage }), { speak: shouldSpeak });
    }
  },
  start() {
    if (this.timers.activity) return;
    const now = Date.now();
    this.startedAt = now;
    if (!this.personality.lastVisibleEventAt) this.personality.lastVisibleEventAt = now;
    if (this.personality.lastObservedPeriod === null) {
      this.personality.lastObservedPeriod = ContextEngine.getDayPeriod(new Date(now).getHours());
    }
    this.persistPersonality();
    this.tick(now);
    this.timers.activity = setInterval(() => this.tick(), 15_000);
  },
};

NexaCore.mood = NexaCore.personality.mood;

export { NexaCore };
