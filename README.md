# Nexabeta - Nexa Web v0.1
Primer prototipo de **Nexa**, un AI Companion (Kraken pixel-art morado) que luego será un dispositivo ESP32.

**Incluye:** interfaz responsive (columnas en escritorio y pantalla completa en móviles/tablets, sin scroll de página), Kraken con 6 estados, reloj, clima actual de Open-Meteo basado en la ubicación del dispositivo (Villarrica como referencia si se deniega el permiso), recordatorios (localStorage) e interacción simulada. Nexa reacciona al clima y lo actualiza cada 15 minutos. Si hay muchos recordatorios, la lista se desplaza dentro de su panel.
Detalles técnicos en `docs/ARCHITECTURE.md`.
