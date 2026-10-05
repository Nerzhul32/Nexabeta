"use strict";

const ContextEngine = {
  getDayPeriod(hour) {
    if (hour >= 5 && hour < 12) return "morning";
    if (hour >= 12 && hour < 17) return "afternoon";
    if (hour >= 17 && hour < 21) return "evening";
    return "night";
  },
  build({
    now = Date.now(),
    lastInteraction = null,
    recentInteractions = [],
    interactionsToday = 0,
    totalInteractions = 0,
    lastAction = null,
    state = "sleeping",
    mood = "curious",
    weather = null,
    reminders = [],
    ...extra
  } = {}) {
    const date = new Date(now);
    const hour = date.getHours();
    const recent = recentInteractions.filter(timestamp => now - timestamp <= 20_000);
    const pendingReminders = reminders.filter(reminder => !reminder.fired && reminder.when > now);
    const upcomingReminders = pendingReminders.filter(reminder => reminder.when - now <= 15 * 60_000);

    return {
      timestamp: now,
      hour,
      minute: date.getMinutes(),
      dayOfWeek: date.getDay(),
      dayOfWeekName: new Intl.DateTimeFormat("es-CL", { weekday: "long" }).format(date),
      period: this.getDayPeriod(hour),
      lateNight: hour >= 0 && hour < 5,
      millisSinceLastInteraction: Number.isFinite(lastInteraction) ? Math.max(0, now - lastInteraction) : null,
      recentInteractionCount: recent.length,
      interactionsToday,
      totalInteractions,
      lastAction,
      state,
      mood,
      weather: weather ? { ...weather } : null,
      upcomingReminders: upcomingReminders.map(reminder => ({ ...reminder })),
      pendingReminderCount: pendingReminders.length,
      ...extra,
    };
  },
};

export { ContextEngine };
