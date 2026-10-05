"use strict";

import assert from "node:assert/strict";
import test from "node:test";
import { BehaviorEngine } from "../core/BehaviorEngine.js";
import { ContextEngine } from "../core/ContextEngine.js";
import { MoodEngine } from "../core/MoodEngine.js";
import { ResponseEngine } from "../core/ResponseEngine.js";

const atHour = hour => {
  const date = new Date(2026, 9, 5, hour, 30);
  return date.getTime();
};

test("ContextEngine builds time, activity, weather, and reminder context", () => {
  const now = atHour(13);
  const context = ContextEngine.build({
    now,
    lastInteraction: now - 5000,
    recentInteractions: [now - 4000, now - 1000],
    interactionsToday: 3,
    totalInteractions: 12,
    lastAction: "user_interaction",
    state: "awake",
    mood: "curious",
    weather: { code: 61, temp: 12 },
    reminders: [
      { id: "soon", text: "Llamar", when: now + 5 * 60_000, fired: false },
      { id: "later", text: "Comprar", when: now + 60 * 60_000, fired: false },
      { id: "done", text: "Terminado", when: now - 60_000, fired: true },
    ],
  });

  assert.equal(context.hour, 13);
  assert.equal(context.minute, 30);
  assert.equal(context.period, "afternoon");
  assert.equal(context.millisSinceLastInteraction, 5000);
  assert.equal(context.recentInteractionCount, 2);
  assert.equal(context.pendingReminderCount, 2);
  assert.equal(context.upcomingReminders[0].id, "soon");
  assert.deepEqual(context.weather, { code: 61, temp: 12 });
});

test("interaction behavior distinguishes first visit, returns, sleep, boredom, and bursts", () => {
  const common = {
    previousState: "awake",
    firstInteractionToday: false,
    millisSinceLastInteraction: 1000,
    period: "afternoon",
    lateNight: false,
    mood: "curious",
  };
  assert.equal(BehaviorEngine.decide("USER_INTERACTION", {
    ...common, firstInteractionToday: true,
  }), "first_interaction_today");
  assert.equal(BehaviorEngine.decide("USER_INTERACTION", {
    ...common, millisSinceLastInteraction: 31 * 60_000,
  }), "user_returned");
  assert.equal(BehaviorEngine.decide("USER_INTERACTION", {
    ...common, previousState: "sleeping", millisSinceLastInteraction: 31 * 60_000,
  }), "user_returned");
  assert.equal(BehaviorEngine.decide("USER_INTERACTION", {
    ...common, previousState: "sleeping",
  }), "interaction_while_sleeping");
  assert.equal(BehaviorEngine.decide("USER_INTERACTION", {
    ...common, mood: "bored",
  }), "interaction_while_bored");

  for (const count of [2, 3, 4, 5]) {
    assert.equal(
      BehaviorEngine.decide("USER_INTERACTION", { ...common, recentInteractionCount: count }),
      `interaction_burst_${count}`,
    );
  }
});

test("time and weather select contextual behavior without fixed UI states", () => {
  assert.equal(BehaviorEngine.decide("USER_INTERACTION", {
    previousState: "awake", millisSinceLastInteraction: 0, lateNight: true,
  }), "late_night_interaction");
  assert.equal(BehaviorEngine.decide("USER_INTERACTION", {
    previousState: "awake", millisSinceLastInteraction: 0, period: "morning",
  }), "morning_interaction");
  assert.equal(BehaviorEngine.weatherBehavior({ code: 61, temp: 14, wind: 10 }), "weather_rain");
  assert.equal(BehaviorEngine.weatherBehavior({ code: 0, temp: 32, wind: 5 }), "weather_hot");
  assert.equal(BehaviorEngine.weatherBehavior({ code: 0, temp: 2, wind: 5 }), "weather_cold");
  assert.equal(BehaviorEngine.weatherBehavior({ code: 3, temp: 15, wind: 40 }), "weather_windy");
  assert.equal(BehaviorEngine.weatherBehavior({ code: 0, temp: 20, wind: 5 }), "weather_clear");
});

test("reminder behaviors distinguish creation, upcoming, and due events", () => {
  const context = { lastReminder: { text: "Tomar agua" } };
  assert.equal(BehaviorEngine.decide("REMINDER_CREATED", context), "reminder_created");
  assert.equal(BehaviorEngine.decide("REMINDER_UPCOMING", context), "reminder_upcoming");
  assert.equal(BehaviorEngine.decide("REMINDER_DUE", context), "reminder_due");
  const response = ResponseEngine.respond("reminder_due", context);
  assert.match(response.message, /Tomar agua/);
});

test("idle stages select distinct behavior", () => {
  assert.equal(BehaviorEngine.decide("IDLE_STARTED", { idleStage: "short" }), "idle_short");
  assert.equal(BehaviorEngine.decide("IDLE_STARTED", { idleStage: "medium" }), "idle_medium");
  assert.equal(BehaviorEngine.decide("LONG_IDLE", { idleStage: "long" }), "idle_long");
});

test("ResponseEngine varies responses and avoids an immediate repeat", () => {
  const first = ResponseEngine.respond("user_returned");
  const second = ResponseEngine.respond("user_returned", {}, first.memory);
  assert.notEqual(first.message, second.message);
});

test("MoodEngine applies mood changes and cooldowns, while honoring due reminders", () => {
  const now = atHour(23);
  const first = MoodEngine.update({
    mood: "curious",
    changedAt: now - 60_000,
    event: "USER_INTERACTION",
    context: { previousState: "awake", lateNight: true, recentInteractionCount: 1 },
    now,
  });
  assert.equal(first.mood, "sleepy");
  const cooled = MoodEngine.update({
    mood: first.mood,
    changedAt: now,
    event: "USER_INTERACTION",
    context: { previousState: "awake", lateNight: false, recentInteractionCount: 1 },
    now: now + 10_000,
  });
  assert.equal(cooled.mood, "sleepy");
  const burst = MoodEngine.update({
    mood: "happy",
    changedAt: now,
    event: "USER_INTERACTION",
    context: { previousState: "awake", recentInteractionCount: 4 },
    now: now + 10_000,
  });
  assert.equal(burst.mood, "annoyed");
  const due = MoodEngine.update({
    mood: cooled.mood,
    changedAt: now,
    event: "REMINDER_DUE",
    context: {},
    now: now + 10_000,
  });
  assert.equal(due.mood, "concerned");
});

test("NexaCore wakes, varies repeated interactions, recognizes returns, and alerts on due reminders", async t => {
  const values = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: key => values.has(key) ? values.get(key) : null,
      setItem: (key, value) => values.set(key, value),
    },
  });
  const { NexaCore } = await import("../core/NexaCore.js");
  t.after(() => {
    clearTimeout(NexaCore.timers.rest);
    clearTimeout(NexaCore.timers.think);
    clearInterval(NexaCore.timers.activity);
    NexaCore.timers = {};
  });

  NexaCore.state = "sleeping";
  NexaCore.mood = "curious";
  NexaCore.context = { lastAction: null, lastInteraction: null, lastReminder: null };
  NexaCore.personality = {
    lastInteraction: null, interactionsToday: 0, interactionDay: null, totalInteractions: 0,
    recentInteractions: [], lastAction: null, mood: "curious", moodChangedAt: 0,
    lastResponse: null, lastByBehavior: {}, announcedReminderIds: [],
    lastWeatherSignature: null, lastWeatherReactionAt: 0, lastVisibleEventAt: 0,
    idleStage: null, lastObservedPeriod: null,
  };
  NexaCore.interact();
  assert.equal(NexaCore.state, "awake");
  const firstMessage = NexaCore.message;
  NexaCore.interact();
  assert.equal(NexaCore.state, "thinking");
  assert.notEqual(NexaCore.message, firstMessage);

  NexaCore.state = "awake";
  NexaCore.personality.lastInteraction = Date.now() - 31 * 60_000;
  NexaCore.personality.interactionsToday = 2;
  const today = new Date();
  NexaCore.personality.interactionDay =
    `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
  NexaCore.personality.recentInteractions = [];
  NexaCore.interact();
  assert.equal(NexaCore.state, "happy");
  assert.match(NexaCore.message, /regres|volvió|esperando/i);

  NexaCore.onReminderDue([{
    id: "due", text: "Revisar la cena", when: Date.now() - 1000, fired: true,
  }]);
  assert.equal(NexaCore.state, "alert");
  assert.match(NexaCore.message, /Revisar la cena/);
  assert.equal(NexaCore.mood, "concerned");

  const created = NexaCore.addReminder("Preparar té", Date.now() + 60 * 60_000);
  assert.equal(NexaCore.state, "happy");
  assert.match(NexaCore.message, /Preparar té/);
  const upcoming = NexaCore.addReminder("Revisar horno", Date.now() + 5 * 60_000);
  NexaCore.checkUpcomingReminders();
  assert.ok(NexaCore.personality.announcedReminderIds.includes(upcoming.id));
  assert.ok(NexaCore.getReminder(created.id));

  const base = Date.now();
  NexaCore.personality.lastInteraction = base - 50_000;
  NexaCore.personality.idleStage = null;
  NexaCore.personality.lastVisibleEventAt = base;
  NexaCore.personality.mood = "happy";
  NexaCore.mood = "happy";
  NexaCore.personality.moodChangedAt = base - 60_000;
  NexaCore.personality.lastObservedPeriod = ContextEngine.getDayPeriod(new Date(base).getHours());
  NexaCore.tick(base);
  assert.equal(NexaCore.personality.idleStage, "short");
  assert.equal(NexaCore.mood, "curious");
  NexaCore.personality.lastVisibleEventAt = base + 4 * 60_000;
  NexaCore.tick(base + 4 * 60_000);
  assert.equal(NexaCore.personality.idleStage, "medium");
  assert.equal(NexaCore.mood, "bored");
  NexaCore.personality.lastVisibleEventAt = base + 10 * 60_000;
  NexaCore.tick(base + 10 * 60_000);
  assert.equal(NexaCore.personality.idleStage, "long");
  assert.equal(NexaCore.mood, "sleepy");
});
