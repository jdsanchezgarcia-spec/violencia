#!/usr/bin/env node
/**
 * sincronizar-defaults.js
 *
 * Extrae de index.html (y styles.css) todos los textos marcados y reescribe
 * el bloque POR_DEFECTO del archivo Code.gs.
 *
 *   Uso:  node scripts/sincronizar-defaults.js
 *
 * Además informa de:
 *   - claves duplicadas
 *   - textos visibles de la página que todavía NO tienen clave
 *
 * Ejecutar cada vez que se cambie el HTML de la página.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const RUTA_HTML = path.join(RAIZ, 'index.html');
const RUTA_CSS = path.join(RAIZ, 'styles.css');
const RUTA_GS = path.join(RUTA_HTML, '..', 'Code.gs');

const html = fs.readFileSync(RUTA_HTML, 'utf8');
const css = fs.readFileSync(RUTA_CSS, 'utf8');

/* ------------------------------------------------------------------ */
/* Lector mínimo de HTML                                               */
/* ------------------------------------------------------------------ */

const VACIOS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link',
  'meta', 'param', 'source', 'track', 'wbr',
  // auto cierre dentro de SVG
  'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse',
  'stop', 'use', 'image', 'animate', 'set'
]);

const RE_TAG = new RegExp(
  '<!--[\\s\\S]*?-->' +                 // comentario
  '|<!DOCTYPE[^>]*>' +                  // doctype
  '|<\\/([a-zA-Z][\\w:-]*)\\s*>' +      // etiqueta de cierre
  '|<([a-zA-Z][\\w:-]*)((?:"[^"]*"|\'[^\']*\'|[^>"\'])*)>',  // etiqueta de apertura
  'g'
);

const RE_ATTR = /([a-zA-Z_:][-\w:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

function leerAtributos(bruto) {
  const attrs = {};
  let m;
  RE_ATTR.lastIndex = 0;
  while ((m = RE_ATTR.exec(bruto)) !== null) {
    attrs[m[1].toLowerCase()] = m[2] !== undefined ? m[2]
      : m[3] !== undefined ? m[3]
      : m[4] !== undefined ? m[4] : '';
  }
  return attrs;
}

function parsear(fuente) {
  const raiz = { tag: '#raiz', attrs: {}, hijos: [], inicio: 0, fin: fuente.length };
  const pila = [raiz];
  let ultimo = 0;
  let m;
  RE_TAG.lastIndex = 0;

  while ((m = RE_TAG.exec(fuente)) !== null) {
    const texto = fuente.slice(ultimo, m.index);
    if (texto) pila[pila.length - 1].hijos.push({ tag: '#texto', texto, attrs: {}, hijos: [] });
    ultimo = RE_TAG.lastIndex;

    if (m[0].startsWith('<!--') || m[0].startsWith('<!')) continue;

    if (m[1]) {
      // cierre: busca la etiqueta correspondiente en la pila
      for (let i = pila.length - 1; i > 0; i--) {
        if (pila[i].tag === m[1].toLowerCase()) {
          pila[i].fin = m.index;
          pila.length = i;
          break;
        }
      }
      continue;
    }

    const tag = m[2].toLowerCase();
    const attrs = leerAtributos(m[3] || '');
    const autoCierre = /\/\s*$/.test(m[3] || '');
    const nodo = { tag, attrs, hijos: [], inicio: RE_TAG.lastIndex, fin: -1 };

    pila[pila.length - 1].hijos.push(nodo);
    if (!VACIOS.has(tag) && !autoCierre) pila.push(nodo);
    else nodo.fin = nodo.inicio;
  }

  const resto = fuente.slice(ultimo);
  if (resto) pila[pila.length - 1].hijos.push({ tag: '#texto', texto: resto, attrs: {}, hijos: [] });

  if (pila.length > 1) {
    console.error('✗ ETIQUETAS SIN CERRAR: ' + pila.slice(1).map(n => n.tag).join(' > '));
    process.exitCode = 1;
  }

  return raiz;
}

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */

function decodificar(s) {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

function normalizar(s) {
  return decodificar(s).replace(/\s+/g, ' ').trim();
}

function recorrer(nodo, cb, ancestros) {
  cb(nodo, ancestros);
  if (!nodo.hijos) return;
  for (const h of nodo.hijos) recorrer(h, cb, ancestros.concat([nodo]));
}

/* ------------------------------------------------------------------ */
/* Extracción                                                          */
/* ------------------------------------------------------------------ */

const raiz = parsear(html);
const porDefecto = {};          // clave -> valor (en orden de la página)
const origenDe = {};            // clave -> prioridad del origen
const sinClave = [];            // textos visibles sin data-key
const clavesDataKey = [];
const vistos = new Set();

// Un mismo valor puede declararse más de una vez (p. ej. un correo que se
// muestra en pantalla y a la vez se usa en el enlace mailto). En ese caso
// gana el texto visible (data-key).
const PRIORIDAD = { 'data-tel': 1, 'data-mailto': 1, 'data-css-var': 2, 'data-key': 3 };

function add(clave, valor, origen, prio) {
  prio = prio || 1;
  if (vistos.has(clave)) {
    if (porDefecto[clave] === valor) return;                 // mismo valor: ok
    if (prio > (origenDe[clave] || 1)) {                     // gana el más específico
      porDefecto[clave] = valor;
      origenDe[clave] = prio;
      return;
    }
    if (prio === (origenDe[clave] || 1)) {
      console.error('✗ CLAVE DUPLICADA CON VALORES DISTINTOS: ' + clave + ' (' + origen + ')');
      process.exitCode = 1;
    }
    return;
  }
  vistos.add(clave);
  porDefecto[clave] = valor;
  origenDe[clave] = prio;
}

recorrer(raiz, (nodo, ancestros) => {
  if (nodo.tag === '#texto') {
    const t = nodo.texto.trim();
    if (!t) return;
    const tieneClaveAncestro = ancestros.some(a => a.attrs && a.attrs['data-key']);
    if (!tieneClaveAncestro) {
      const padre = ancestros[ancestros.length - 1];
      sinClave.push('<' + (padre ? padre.tag : '?') + '> ' + t.slice(0, 70));
    }
    return;
  }

  const a = nodo.attrs || {};

  if (a['data-key']) {
    clavesDataKey.push(a['data-key']);
    if (nodo.tag === 'img') return;                 // sin contenido visible
    const bruto = html.slice(nodo.inicio, nodo.fin < 0 ? nodo.inicio : nodo.fin);
    const valor = normalizar(bruto);
    // Un elemento sin data-html escribe el valor con textContent: si el valor
    // lleva etiquetas, se verían en pantalla como texto literal.
    if (!('data-html' in a) && valor.indexOf('<') > -1) {
      console.error('✗ CON ETIQUETAS SIN data-html: <' + nodo.tag + ' data-key="' +
        a['data-key'] + '"> → ' + valor.slice(0, 90));
      console.error('   (añade data-html al elemento o quita las etiquetas internas)');
      process.exitCode = 1;
    }
    add(a['data-key'], valor, '<' + nodo.tag + '>', PRIORIDAD['data-key']);
  }

  if (a['data-tel'] && a.href) {
    add(a['data-tel'], normalizar(a.href.replace(/^tel:/i, '')), 'data-tel', PRIORIDAD['data-tel']);
  }

  if (a['data-mailto'] && a.href) {
    add(a['data-mailto'], normalizar(a.href.replace(/^mailto:/i, '')), 'data-mailto', PRIORIDAD['data-mailto']);
  }

  if (a['data-css-var']) {
    for (const clave of a['data-css-var'].split(/\s+/)) {
      if (!clave) continue;
      const nombreVar = '--' + clave.replace(/\./g, '-');
      const re = new RegExp('var\\(\\s*' + nombreVar.replace(/-/g, '\\-') + '\\s*,\\s*"([^"]*)"\\s*\\)');
      const m = css.match(re);
      if (!m) {
        console.error('✗ No se encontró ' + nombreVar + ' en styles.css');
        process.exitCode = 1;
        continue;
      }
      add(clave, m[1], 'data-css-var');
    }
  }
}, []);

/* ------------------------------------------------------------------ */
/* Reporte                                                             */
/* ------------------------------------------------------------------ */

const claves = Object.keys(porDefecto);
console.log('Claves extraídas: ' + claves.length);

const vacias = claves.filter(k => porDefecto[k] === '');
if (vacias.length) {
  console.log('⚠ Claves con texto vacío: ' + vacias.join(', '));
}

if (sinClave.length) {
  console.log('\nTextos SIN clave (' + sinClave.length + '):');
  sinClave.forEach(t => console.log('  · ' + t));
}

if (process.exitCode === 1) {
  console.error('\nNo se escribe Code.gs hasta corregir los errores.');
  process.exit(1);
}

/* ------------------------------------------------------------------ */
/* Escribe el bloque en Code.gs                                        */
/* ------------------------------------------------------------------ */

const lineas = claves.map(k => '  ' + JSON.stringify(k) + ': ' + JSON.stringify(porDefecto[k]));
const bloque =
  '  // --- INICIO POR_DEFECTO (no editar a mano) ---\n' +
  lineas.join(',\n') +
  '\n  // --- FIN POR_DEFECTO ---';

const gs = fs.readFileSync(RUTA_GS, 'utf8');
const RE_BLOQUE = /(\/\/ --- INICIO POR_DEFECTO[\s\S]*?\/\/ --- FIN POR_DEFECTO ---)/;

if (!RE_BLOQUE.test(gs)) {
  console.error('✗ No se encontró el bloque POR_DEFECTO en Code.gs');
  process.exit(1);
}

fs.writeFileSync(RUTA_GS, gs.replace(RE_BLOQUE, bloque), 'utf8');
console.log('✓ Code.gs actualizado (' + claves.length + ' textos).');
