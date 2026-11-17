/**
 * config.js — Conexión de la página con la hoja de Google.
 *
 * 1. Abre tu Google Sheet:  https://docs.google.com/spreadsheets/d/18c-g3MrhNmbZVVHiGXDBPkXjAIwbyFC1HCLy2ZuhBEY/edit
 * 2. Menú  Extensiones ▸ Apps Script.
 * 3. Pega el contenido de Code.gs y ejecuta  crearHojaTextos()  una sola vez.
 * 4. Implementar ▸ Nueva implementación ▸ Tipo: Aplicación web
 *      - Ejecutar como:  Yo
 *      - Quién tiene acceso:  Cualquier usuario
 * 5. Copia la URL que te entrega (termina en /exec) y pégala abajo.
 *
 * Mientras apiUrl esté vacío, la página muestra sus textos originales.
 */
window.CONFIG_CONTENIDO = {
  apiUrl: 'https://script.google.com/macros/s/AKfycbyA0djg4qttTaCEFE6NNGOzOcquPnLU0blNAtxWVajfE_KWHUkIuh_7aTNJqRwy8RPYxA/exec'
};
