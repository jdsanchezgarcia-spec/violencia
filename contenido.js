/**
 * contenido.js — Textos editados desde la hoja de Google.
 *
 * Lee el JSON que publica Code.gs (aplicación web) y reemplaza, uno a uno,
 * los textos marcados en index.html:
 *
 *   data-key="clave"          → texto del elemento
 *   data-key + data-html      → texto con etiquetas (<strong>, <em>, <br>, <a>…)
 *   data-tel="clave"          → href="tel:…" de un teléfono
 *   data-mailto="clave"       → href="mailto:…" de un correo
 *   data-css-var="clave …"    → variable CSS (viñetas decorativas)
 *
 * Reglas:
 *   - Celda vacía  → se conserva el texto original del HTML.
 *   - Sin conexión → la página funciona igual con sus textos originales.
 *
 * Primero intenta fetch(); si el navegador lo bloquea (CORS), reintenta
 * con JSONP, que siempre funciona con Apps Script.
 */
(function () {
  'use strict';

  var cfg = window.CONFIG_CONTENIDO || {};
  var url = typeof cfg.apiUrl === 'string' ? cfg.apiUrl.trim() : '';

  // Sin URL configurada todavía: no se toca nada.
  if (!url) return;

  var destino = url + (url.indexOf('?') === -1 ? '?' : '&') + '_=' + Date.now();

  pedir_(destino)
    .then(listo_)
    .catch(function (errFetch) {
      // Segundo intento por JSONP (no está sujeto a CORS).
      return jsonP_(destino).then(listo_).catch(function (errJsonp) {
        console.warn('[contenido] No se pudieron cargar los textos de la hoja.',
          errFetch, '| JSONP:', errJsonp);
      });
    });

  function listo_(data) {
    var map = (data && typeof data.textos === 'object' && data.textos) || {};
    var n = aplicar(map);
    if (data && data.ok === false) {
      console.warn('[contenido] La hoja respondió con un error:', data.error);
    } else {
      console.info('[contenido] ' + n + ' textos aplicados desde la hoja de Google.');
    }
  }

  /* --------------------------- transporte --------------------------- */

  function pedir_(u) {
    return fetch(u, { redirect: 'follow' }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    });
  }

  function jsonP_(u) {
    return new Promise(function (resolve, reject) {
      var nombre = '__contenidoCb' + Date.now();
      var script = document.createElement('script');
      var terminado = false;
      var reloj = null;

      function terminar(err, datos) {
        if (terminado) return;
        terminado = true;
        if (reloj) clearTimeout(reloj);
        try { delete window[nombre]; } catch (e) { window[nombre] = undefined; }
        if (script.parentNode) script.parentNode.removeChild(script);
        err ? reject(err) : resolve(datos);
      }

      window[nombre] = function (datos) { terminar(null, datos); };
      script.onerror = function () { terminar(new Error('JSONP sin respuesta')); };
      script.src = u + (u.indexOf('?') === -1 ? '?' : '&') + 'callback=' + nombre;
      reloj = setTimeout(function () { terminar(new Error('JSONP sin respuesta')); }, 15000);

      (document.head || document.body).appendChild(script);
    });
  }

  /* ---------------------------- aplicación -------------------------- */

  function aplicar(map) {
    return aplicarClaves_(map) + aplicarEnlaces_(map) + aplicarVariablesCss_(map);
  }

  /** Valor de una clave, o null si no existe / está vacía. */
  function valor_(map, clave) {
    if (!clave) return null;
    var v = map[clave];
    if (v === undefined || v === null) return null;
    v = String(v).replace(/^\s+|\s+$/g, '');
    return v === '' ? null : v;
  }

  function aplicarClaves_(map) {
    var elems = document.querySelectorAll('[data-key]');
    var n = 0;
    for (var i = 0; i < elems.length; i++) {
      var el = elems[i];
      var v = valor_(map, el.getAttribute('data-key'));
      if (v === null) continue;
      if (el.tagName === 'TITLE') {
        document.title = v;
      } else if (el.hasAttribute('data-html')) {
        el.innerHTML = v;
      } else {
        el.textContent = v;
      }
      n++;
    }
    return n;
  }

  function aplicarEnlaces_(map) {
    var n = 0;
    n += aplicarHref_(map, 'data-tel', 'tel:', function (v) {
      return v.replace(/[^\d+]/g, '');           // "01 8000 919 748" → "018000919748"
    });
    n += aplicarHref_(map, 'data-mailto', 'mailto:', function (v) {
      // "📧 correo@x.co" → "correo@x.co"
      return v.replace(/^[^\w.%+-]+/, '').replace(/\s+/g, '');
    });
    return n;
  }

  function aplicarHref_(map, attr, prefijo, limpiar) {
    var elems = document.querySelectorAll('[' + attr + ']');
    var n = 0;
    for (var i = 0; i < elems.length; i++) {
      var el = elems[i];
      var v = valor_(map, el.getAttribute(attr));
      if (v === null) continue;
      var enlace = limpiar(v);
      if (!enlace) continue;                     // valor ilegible → se conserva el enlace
      el.setAttribute('href', prefijo + enlace);
      n++;
    }
    return n;
  }

  function aplicarVariablesCss_(map) {
    var elems = document.querySelectorAll('[data-css-var]');
    var n = 0;
    for (var i = 0; i < elems.length; i++) {
      var claves = (elems[i].getAttribute('data-css-var') || '').split(/\s+/);
      for (var j = 0; j < claves.length; j++) {
        var clave = claves[j];
        if (!clave) continue;
        var v = valor_(map, clave);
        if (v === null) continue;
        var valor = '"' + v.replace(/[\r\n]+/g, ' ').replace(/["\\]/g, '\\$&') + '"';
        document.documentElement.style.setProperty('--' + clave.replace(/\./g, '-'), valor);
        n++;
      }
    }
    return n;
  }
})();
