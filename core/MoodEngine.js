"use strict";

const MoodEngine = {
  MOODS: ["happy", "curious", "sleepy", "bored", "excited", "annoyed", "concerned"],
  CHANGE_COOLDOWN: 45_000,
  targetFor(event, context) {
    if (event === "LONG_IDLE" || context.idleStage === "long") return "sleepy";
    if (event === "IDLE_STARTED" && context.idleStage === "medium") return "bored";
    if (event === "IDLE_STARTED") return "curious";
    if (event === "REMINDER_DUE") return "concerned";
    if (event === "REMINDER_CREATED") return "happy";
    if (event === "USER_RETURNED") return "excited";
    if (event === "USER_INTERACTION") {
      if (context.previousState === "sleeping") return "excited";
      if (context.millisSinceLastInteraction !== null
        && context.millisSinceLastInteraction >= 30 * 60_000) return "excited";
      if (context.recentInteractionCount >= 4) return "annoyed";
      if (context.mood === "bored") return "curious";
      if (context.lateNight) return "sleepy";
      return "happy";
    }
    if (event === "WEATHER_CHANGED") {
      const code = context.weather && context.weather.code;
      if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)
        || (code >= 95 && code <= 99)) return "concerned";
      if (context.weather && context.weather.temp <= 5) return "sleepy";
      if (context.weather && context.weather.temp >= 30) return "excited";
      return "curious";
    }
    if (event === "NIGHT_STARTED") return "sleepy";
    if (event === "MORNING_STARTED") return "curious";
    return null;
  },
  update({ mood, changedAt = 0, event, context, now = Date.now() }) {
    const target = this.targetFor(event, context);
    const urgentEvent = event === "REMINDER_DUE" || event === "REMINDER_CREATED"
      || event === "MORNING_STARTED" || event === "NIGHT_STARTED"
      || (event === "USER_INTERACTION" && context.recentInteractionCount >= 4);
    if (!target || target === mood || (!urgentEvent && now - changedAt < this.CHANGE_COOLDOWN)) {
      return { mood, changedAt, changed: false };
    }
    return { mood: target, changedAt: now, changed: true };
  },
};

export { MoodEngine };
