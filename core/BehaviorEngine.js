"use strict";

const BehaviorEngine = {
  RETURN_AFTER: 30 * 60_000,
  weatherBehavior(weather) {
    if (!weather) return "weather_other";
    const code = weather.code;
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || (code >= 95 && code <= 99)) {
      return "weather_rain";
    }
    if (weather.temp >= 30) return "weather_hot";
    if (weather.temp <= 5) return "weather_cold";
    if (weather.wind >= 35) return "weather_windy";
    if (code === 0 || code === 1) return "weather_clear";
    return "weather_other";
  },
  decide(event, context) {
    switch (event) {
      case "USER_INTERACTION": {
        if (context.previousState === "alert") return "alert_acknowledged";
        if (context.millisSinceLastInteraction !== null
          && context.millisSinceLastInteraction >= this.RETURN_AFTER) return "user_returned";
        if (context.previousState === "sleeping") return "interaction_while_sleeping";
        if (context.firstInteractionToday) return "first_interaction_today";
        if (context.mood === "bored") return "interaction_while_bored";
        if (context.recentInteractionCount >= 5) return "interaction_burst_5";
        if (context.recentInteractionCount === 4) return "interaction_burst_4";
        if (context.recentInteractionCount === 3) return "interaction_burst_3";
        if (context.recentInteractionCount === 2) return "interaction_burst_2";
        if (context.lateNight) return "late_night_interaction";
        if (context.period === "morning") return "morning_interaction";
        return "interaction";
      }
      case "REMINDER_CREATED": return "reminder_created";
      case "REMINDER_UPCOMING": return "reminder_upcoming";
      case "REMINDER_DUE": return "reminder_due";
      case "REMINDER_REMOVED": return "reminder_removed";
      case "WEATHER_CHANGED": return this.weatherBehavior(context.weather);
      case "IDLE_STARTED":
        return context.idleStage === "medium" ? "idle_medium" : "idle_short";
      case "LONG_IDLE": return "idle_long";
      default: return null;
    }
  },
};

export { BehaviorEngine };
