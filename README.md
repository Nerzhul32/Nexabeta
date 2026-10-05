# Nexabeta - Nexa Web v0.1
Primer prototipo de **Nexa**, un AI Companion (Kraken pixel-art morado) que luego será un dispositivo ESP32.

**Ejecutar:** abre `index.html` en el navegador (doble clic). Para probar en el teléfono, sirve la carpeta en tu red local: `python3 -m http.server 8000` y abre `http://IP-DEL-PC:8000`.

**Incluye:** interfaz responsive (columnas en escritorio y pantalla completa en móviles/tablets, sin scroll de página), Kraken con 6 estados, reloj, clima simulado, recordatorios (localStorage) e interacción simulada. Si hay muchos recordatorios, la lista se desplaza dentro de su panel.
Detalles técnicos en `docs/ARCHITECTURE.md`.
