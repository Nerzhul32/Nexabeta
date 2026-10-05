"use strict";

const MockWeatherProvider = {
  async fetch() {
    return {
      temp: 18,
      feelsLike: 18,
      humidity: 70,
      wind: 8,
      windUnit: "km/h",
      condition: "Parcialmente nublado",
      code: 2,
      city: "Villarrica",
      locationSource: "fallback",
      updatedAt: Date.now(),
    };
  },
};

const OpenMeteoWeatherProvider = {
  FALLBACK_LOCATION: {
    latitude: -39.2823,
    longitude: -72.227,
    city: "Villarrica",
  },
  weatherConditions: {
    0: "Despejado",
    1: "Mayormente despejado",
    2: "Parcialmente nublado",
    3: "Nublado",
    45: "Niebla",
    48: "Niebla con escarcha",
    51: "Llovizna ligera",
    53: "Llovizna moderada",
    55: "Llovizna intensa",
    56: "Llovizna helada ligera",
    57: "Llovizna helada intensa",
    61: "Lluvia ligera",
    63: "Lluvia moderada",
    65: "Lluvia intensa",
    66: "Lluvia helada ligera",
    67: "Lluvia helada intensa",
    71: "Nieve ligera",
    73: "Nieve moderada",
    75: "Nieve intensa",
    77: "Granos de nieve",
    80: "Chubascos ligeros",
    81: "Chubascos moderados",
    82: "Chubascos intensos",
    85: "Chubascos de nieve ligeros",
    86: "Chubascos de nieve intensos",
    95: "Tormenta eléctrica",
    96: "Tormenta con granizo ligero",
    99: "Tormenta con granizo intenso",
  },
  async getCoordinates() {
    if (!navigator.geolocation) {
      return { ...this.FALLBACK_LOCATION, source: "fallback" };
    }

    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          maximumAge: 300_000,
          timeout: 12_000,
        });
      });
      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        city: "Tu ubicación",
        source: "device",
      };
    } catch (error) {
      if (error.code !== error.PERMISSION_DENIED) throw error;
      return { ...this.FALLBACK_LOCATION, source: "fallback" };
    }
  },
  async fetch() {
    const location = await this.getCoordinates();
    const parameters = new URLSearchParams({
      latitude: location.latitude,
      longitude: location.longitude,
      current: "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m",
      timezone: "auto",
      forecast_days: "1",
    });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);

    try {
      const response = await fetch(`https://api.open-meteo.com/v1/forecast?${parameters}`, {
        signal: controller.signal,
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`Open-Meteo respondió con HTTP ${response.status}.`);
      }
      const data = await response.json();
      const current = data.current;
      const units = data.current_units;
      if (!current || !units || !Number.isFinite(current.temperature_2m)
        || !Number.isFinite(current.weather_code) || !Number.isFinite(current.wind_speed_10m)) {
        throw new TypeError("La respuesta del servicio meteorológico está incompleta.");
      }

      return {
        temp: Math.round(current.temperature_2m),
        feelsLike: Number.isFinite(current.apparent_temperature) ? Math.round(current.apparent_temperature) : null,
        humidity: Number.isFinite(current.relative_humidity_2m) ? current.relative_humidity_2m : null,
        wind: Number.isFinite(current.wind_speed_10m) ? Math.round(current.wind_speed_10m) : null,
        windUnit: units.wind_speed_10m || "km/h",
        condition: this.weatherConditions[current.weather_code] || `Condición meteorológica ${current.weather_code}`,
        code: current.weather_code,
        isDay: current.is_day === 1,
        city: location.city,
        locationSource: location.source,
        updatedAt: Date.now(),
      };
    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error("La consulta del clima tardó demasiado. Intenta actualizar otra vez.");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  },
};

const WeatherService = {
  provider: OpenMeteoWeatherProvider,
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

window.MockWeatherProvider = MockWeatherProvider;
window.OpenMeteoWeatherProvider = OpenMeteoWeatherProvider;
window.WeatherService = WeatherService;
