/**
 * Prueba de contenido.js con un DOM simulado.
 * Uso: node probar-contenido.js <carpeta\del\proyecto>
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const carpeta = process.argv[2] || path.join(__dirname, '..');
const html = fs.readFileSync(path.join(carpeta, 'index.html'), 'utf8');
const gs = fs.readFileSync(path.join(carpeta, 'Code.gs'), 'utf8');
const js = fs.readFileSync(path.join(carpeta, 'contenido.js'), 'utf8');

/* --------- texto por defecto (bloque POR_DEFECTO de Code.gs) -------- */
const m = gs.match(/\/\/ --- INICIO POR_DEFECTO[\s\S]*?\/\/ --- FIN POR_DEFECTO ---/);
if (!m) { console.error('No se encontró POR_DEFECTO'); process.exit(1); }
const cuerpo = m[0].replace(/\/\/[^\n]*/g, '').trim().replace(/,$/, '');
const POR_DEFECTO = JSON.parse('{' + cuerpo + '}');

/* ------------------- elementos del HTML (regex) --------------------- */
const RE_TAG = /<([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
const RE_ATTR = /([a-zA-Z_:][-\w:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

function atributos(bruto) {
  const attrs = {};
  let a;
  RE_ATTR.lastIndex = 0;
  while ((a = RE_ATTR.exec(bruto)) !== null) {
    attrs[a[1].toLowerCase()] = a[2] !== undefined ? a[2]
      : a[3] !== undefined ? a[3] : a[4] !== undefined ? a[4] : '';
  }
  return attrs;
}

const elementos = [];
let t;
RE_TAG.lastIndex = 0;
while ((t = RE_TAG.exec(html)) !== null) {
  const attrs = atributos(t[2] || '');
  const esClave = ['data-key', 'data-tel', 'data-mailto', 'data-css-var'].some(k => k in attrs);
  if (!esClave) continue;
  elementos.push({
    tagName: t[1].toUpperCase(),
    attrs: attrs,
    hrefOriginal: 'href' in attrs ? attrs.href : null,
    innerHTML: null,
    textContent: null,
    getAttribute(n) { return n in this.attrs ? this.attrs[n] : null; },
    hasAttribute(n) { return n in this.attrs; },
    setAttribute(n, v) { this.attrs[n] = v; }
  });
}

console.log('Elementos marcados en el HTML: ' + elementos.length);

/* --------------------------- DOM simulado --------------------------- */
const cssVars = {};
const consola = { warn: [], info: [] };

function nuevoDOM() {
  elementos.forEach(e => { e.innerHTML = null; e.textContent = null; e.attrs.href = e.hrefOriginal; });
  cssVars && Object.keys(cssVars).forEach(k => delete cssVars[k]);
}

global.window = global;
const warnOriginal = console.warn;
const infoOriginal = console.info;
console.warn = (...a) => { consola.warn.push(a.map(String).join(' ')); };
console.info = (...a) => { consola.info.push(a.map(String).join(' ')); };

global.document = {
  title: '',
  documentElement: { style: { setProperty(n, v) { cssVars[n] = v; } } },
  querySelectorAll(sel) {
    const attr = /^\[([^\]]+)\]$/.exec(sel)[1];
    return elementos.filter(e => attr in e.attrs);
  },
  createElement() {
    const s = { onerror: null, parentNode: { removeChild() {} }, _src: '' };
    Object.defineProperty(s, 'src', { set(v) { s._src = v; }, get() { return s._src; } });
    return s;
  },
  head: {
    appendChild(script) {
      const cb = /callback=([A-Za-z_$][\w$]*)/.exec(script._src);
      setTimeout(() => global[cb[1]]({ ok: true, textos: mapa }), 0);
    }
  },
  body: {}
};

let mapa = {};

function lanzar() {
  vm.runInThisContext(js, { filename: 'contenido.js' });
  return new Promise(r => setTimeout(r, 30));
}

let fallos = 0;
function ok(cond, msg) {
  if (cond) console.log('  ✓ ' + msg);
  else { console.log('  ✗ ' + msg); fallos++; }
}
const espera = ms => new Promise(r => setTimeout(r, ms));

(async function () {

  /* 1. sin URL configurada → no toca nada */
  console.log('\n1. Sin apiUrl configurada');
  global.CONFIG_CONTENIDO = { apiUrl: '' };
  nuevoDOM();
  mapa = { 'hero.titulo': 'DEBERÍA IGNORARSE' };
  await lanzar();
  ok(elementos.every(e => e.innerHTML === null && e.textContent === null),
    'ningún elemento se modifica');

  /* 2. ida y vuelta: aplicar los textos por defecto no cambia nada */
  console.log('\n2. Textos por defecto (ida y vuelta)');
  global.CONFIG_CONTENIDO = { apiUrl: 'https://example.test/exec' };
  global.fetch = () => Promise.resolve({
    ok: true, status: 200,
    json: () => Promise.resolve({ ok: true, textos: mapa })   // siempre el mapa vigente
  });
  nuevoDOM();
  mapa = POR_DEFECTO;
  await lanzar();

  let errores = [];
  elementos.forEach(e => {
    const clave = e.getAttribute('data-key');
    if (!clave) return;
    const esperado = POR_DEFECTO[clave];
    if (e.tagName === 'TITLE') {
      if (global.document.title !== esperado) errores.push('title: ' + global.document.title);
    } else if (e.hasAttribute('data-html')) {
      if (e.innerHTML !== esperado) errores.push(clave + ' → ' + JSON.stringify(e.innerHTML));
    } else if (e.textContent !== esperado) {
      errores.push(clave + ' → ' + JSON.stringify(e.textContent));
    }
  });
  ok(errores.length === 0, 'los ' + elementos.filter(e => e.getAttribute('data-key')).length +
    ' textos vuelven a ser idénticos' + (errores.length ? '\n      ' + errores.slice(0, 5).join('\n      ') : ''));

  /* 3. tel y mailto */
  console.log('\n3. Teléfonos y correos');
  const tels = elementos.filter(e => e.getAttribute('data-tel'));
  const malos = tels.filter(e => e.attrs.href !== e.hrefOriginal);
  ok(malos.length === 0, tels.length + ' enlaces tel: reconstruidos igual que en el HTML' +
    (malos.length ? ' → ' + malos.map(x => x.attrs.href + ' vs ' + x.hrefOriginal).join(', ') : ''));

  const mails = elementos.filter(e => e.getAttribute('data-mailto'));
  const malosM = mails.filter(e => e.attrs.href !== e.hrefOriginal);
  ok(malosM.length === 0, mails.length + ' enlaces mailto: reconstruidos igual que en el HTML' +
    (malosM.length ? ' → ' + malosM.map(x => x.attrs.href + ' vs ' + x.hrefOriginal).join(', ') : ''));

  /* 4. variables CSS */
  console.log('\n4. Variables CSS');
  ok(cssVars['--decor-vineta'] === '"✦"' && cssVars['--decor-aviso'] === '"⛔"',
    'viñetas decorativas: ' + JSON.stringify(cssVars));

  /* 5. ediciones del usuario */
  console.log('\n5. Ediciones simuladas en la hoja');
  nuevoDOM();
  mapa = Object.assign({}, POR_DEFECTO, {
    'pagina.titulo': 'Título nuevo',
    'hero.titulo': 'Stop<br>a la violencia',
    'c1.nac.1.tel': '300 123 4567',
    'com.1.email': '📧 contacto@nuevo.gov.co',
    'c2.li1': 'Texto sin etiquetas',
    'c1.nac.2.badge': ''            // celda vacía → se conserva el original
  });
  await lanzar();

  const porClave = k => elementos.find(e => e.getAttribute('data-key') === k);
  const porTel = k => elementos.find(e => e.getAttribute('data-tel') === k);
  const porMail = k => elementos.find(e => e.getAttribute('data-mailto') === k);

  ok(global.document.title === 'Título nuevo', 'el <title> se actualiza');
  ok(porClave('hero.titulo').innerHTML === 'Stop<br>a la violencia', 'título con <br> (data-html)');
  ok(porClave('c2.li1').innerHTML === 'Texto sin etiquetas', 'texto plano reemplaza al formateado');
  ok(porTel('c1.nac.1.tel').attrs.href === 'tel:3001234567', 'tel: ' + porTel('c1.nac.1.tel').attrs.href);
  ok(porMail('com.1.email').attrs.href === 'mailto:contacto@nuevo.gov.co',
    'mailto: ' + porMail('com.1.email').attrs.href);
  ok(porClave('com.1.email').textContent === '📧 contacto@nuevo.gov.co', 'correo visible');
  ok(porClave('c1.nac.2.badge').textContent === null && porClave('c1.nac.2.badge').innerHTML === null,
    'celda vacía → se conserva el texto del HTML');
  ok(consola.info.some(s => /textos aplicados/.test(s)), 'mensaje de confirmación en consola');

  /* 6. JSONP de respaldo */
  console.log('\n6. Respaldo JSONP (cuando fetch está bloqueado)');
  nuevoDOM();
  global.fetch = () => Promise.reject(new TypeError('Failed to fetch'));
  mapa = Object.assign({}, POR_DEFECTO, { 'hero.insignia': '🎀 Otra campaña' });
  await lanzar();
  await espera(30);
  ok(porClave('hero.insignia').textContent === '🎀 Otra campaña',
    'los textos se aplican igualmente vía JSONP');
  ok(consola.warn.some(s => /No se pudieron cargar/.test(s)) === false,
    'sin error en consola cuando el JSONP funciona');

  console.log(fallores(fallos));
  process.exit(fallos ? 1 : 0);

  function fallores(n) { return n === 0 ? '\nTODO OK\n' : '\n' + n + ' FALLOS\n'; }
})().catch(e => { console.error(e); process.exit(1); });
