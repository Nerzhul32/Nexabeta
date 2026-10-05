"use strict";

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
      id: typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
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

window.ReminderService = ReminderService;
