/**
 * Prueba de Code.gs con un simulador mínimo de Google Apps Script.
 * Uso: node scripts/probar-code-gs.js [ruta/Code.gs]
 */
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ruta = process.argv[2] || path.join(__dirname, '..', 'Code.gs');
const codigo = fs.readFileSync(ruta, 'utf8');

/* ------------------------- mocks de Apps Script --------------------- */
const estado = { hojas: {}, logs: [], alertas: [] };

function nuevaHoja(nombre) {
  const hoja = {
    nombre: nombre,
    valores: [],
    getLastRow() { return this.valores.length; },
    getDataRange() {
      const self = this;
      return { getValues() { return self.valores.slice(); } };
    },
    setName(nuevo) {
      for (const k in estado.hojas) if (estado.hojas[k] === hoja) delete estado.hojas[k];
      hoja.nombre = nuevo;
      estado.hojas[nuevo] = hoja;
    },
    setFrozenRows() {},
    setColumnWidth() {},
    getRange(fila, col) {
      const self = this;
      return {
        getValue() {
          const f = self.valores[fila - 1];
          return f ? f[col - 1] : '';
        },
        setValues(vals) {
          for (let i = 0; i < vals.length; i++) {
            const f = fila - 1 + i;
            if (!self.valores[f]) self.valores[f] = [];
            for (let j = 0; j < vals[i].length; j++) self.valores[f][col - 1 + j] = vals[i][j];
          }
          return this;
        },
        setFontWeight() { return this; },
        setVerticalAlignment() { return this; },
        setWrap() { return this; },
        setFontFamily() { return this; },
        setFontColor() { return this; }
      };
    }
  };
  return hoja;
}

global.SpreadsheetApp = {
  openById() {
    return {
      getSheetByName(n) { return estado.hojas[n] || null; },
      insertSheet(n) { estado.hojas[n] = nuevaHoja(n); return estado.hojas[n]; },
      deleteSheet(h) {
        for (const k in estado.hojas) if (estado.hojas[k] === h) delete estado.hojas[k];
      }
    };
  },
  getUi() { throw new Error('sin interfaz en la prueba'); }
};

global.ContentService = {
  MimeType: { JSON: 'application/json', JS: 'text/javascript' },
  createTextOutput(t) {
    return { texto: t, mime: null, setMimeType(m) { this.mime = m; return this; } };
  }
};

global.Logger = { log(m) { estado.logs.push(String(m)); } };

/* ------------------------------ ejecuta ----------------------------- */
vm.runInThisContext(codigo, { filename: 'Code.gs' });

let fallos = 0;
function ok(cond, msg) {
  if (cond) console.log('  ✓ ' + msg);
  else { console.log('  ✗ ' + msg); fallos++; }
}

/** Busca una clave en todas las pestañas. Devuelve { hoja, fila, valores }. */
function buscarFila(clave) {
  for (const nombre in estado.hojas) {
    const v = estado.hojas[nombre].valores;
    const i = v.findIndex(f => f[0] === clave);
    if (i > -1) return { hoja: nombre, fila: i, valores: v };
  }
  return null;
}

/* 1. doGet sin ninguna pestaña → error controlado */
console.log('\n1. Estado inicial');
let res = JSON.parse(global.doGet().texto);
ok(res.ok === false && /crearHojaTextos/.test(res.error), 'doGet sin pestañas devuelve ok:false con instrucción');

/* 2. Migración de la pestaña antigua "Textos" */
console.log('\n2. Migración de la pestaña antigua "Textos"');
const antigua = global.SpreadsheetApp.openById().insertSheet('Textos');
antigua.valores = [['clave', 'texto', 'nota']];
res = JSON.parse(global.doGet().texto);
ok(res.ok === true && res.total === 0, 'con "Textos" vacía responde total:0 (como en tu hoja)');

global.crearHojaTextos();
ok(!!estado.hojas['General'] && !!estado.hojas['Comisarías'] && !!estado.hojas['Violencia sexual'],
  'crea las 3 pestañas: General, Comisarías y Violencia sexual');
ok(!estado.hojas['Textos'], 'la pestaña antigua "Textos" desaparece (estaba vacía)');

/* 3. Reparto de claves por pestaña */
console.log('\n3. Reparto de claves');
const nClaves = Object.keys(global.POR_DEFECTO).length;
const conteo = {};
Object.keys(global.POR_DEFECTO).forEach(k => {
  const h = global.hojaDe_(k);
  conteo[h] = (conteo[h] || 0) + 1;
});
let total = 0;
for (const nombre of global.HOJAS) {
  const filas = estado.hojas[nombre].getLastRow() - 1;
  total += filas;
  ok(filas === conteo[nombre], nombre + ': ' + filas + ' claves (esperadas ' + conteo[nombre] + ')');
}
ok(total === nClaves, 'las 3 pestañas suman las ' + nClaves + ' claves');
ok(conteo['Violencia sexual'] > 0 && conteo['Comisarías'] > 0,
  'violencia sexual y comisarías tienen su propia pestaña');
ok(estado.hojas['General'].valores[0][0] === 'clave' &&
   estado.hojas['General'].valores[0][1] === 'texto' &&
   estado.hojas['General'].valores[0][2] === 'nota', 'encabezados clave/texto/nota');

/* 4. Idempotencia */
console.log('\n4. Segunda ejecución');
global.crearHojaTextos();
total = global.HOJAS.reduce((s, n) => s + estado.hojas[n].getLastRow() - 1, 0);
ok(total === nClaves, 'no duplica filas (' + total + ')');

/* 5. leerTextos une todas las pestañas */
console.log('\n5. Lectura');
let textos = global.leerTextos();
ok(Object.keys(textos).length === nClaves, 'leerTextos devuelve las ' + nClaves + ' claves de las 3 pestañas');
ok(textos['pagina.titulo'].indexOf('Violencia de Género') === 0, 'lee el título (pestaña General)');
ok(textos['hero.titulo'].indexOf('<br>') > -1, 'conserva las etiquetas HTML');
ok('alerta.tab' in textos && 'com.1.nombre' in textos,
  'lee también Violencia sexual y Comisarías');

/* 6. Notas de la columna C */
console.log('\n6. Notas');
ok(/Admite etiquetas/.test(buscarFila('c2.li1').valores[buscarFila('c2.li1').fila][2]), 'nota de etiquetas');
ok(/Solo dígitos/.test(buscarFila('c1.nac.1.tel').valores[buscarFila('c1.nac.1.tel').fila][2]), 'nota de teléfono');
ok(/decorativo/.test(buscarFila('decor.vineta').valores[buscarFila('decor.vineta').fila][2]), 'nota decorativa');

/* 7. Celda vacía y número */
console.log('\n7. Ediciones');
let f = buscarFila('hero.titulo');
f.valores[f.fila][1] = '';
textos = global.leerTextos();
ok(!('hero.titulo' in textos), 'celda vacía → la clave no se envía');

f = buscarFila('c1.nac.1.tel');
f.valores[f.fila][1] = 155;
textos = global.leerTextos();
ok(textos['c1.nac.1.tel'] === '155', 'los números se convierten a texto');

/* 8. doGet JSON y JSONP */
console.log('\n8. Endpoint');
res = JSON.parse(global.doGet().texto);
ok(res.ok === true && res.total === nClaves - 1, 'doGet JSON: ok y total correctos');
ok(Array.isArray(res.hojas) && res.hojas.length === 3, 'informa las 3 pestañas');
ok(res.textos['hero.insignia'].indexOf('Campaña') > -1, 'doGet JSON incluye los textos');

const jsonp = global.doGet({ parameter: { callback: 'recibir' } });
ok(jsonp.texto.startsWith('recibir(') && jsonp.texto.endsWith(')') && jsonp.mime === 'text/javascript',
  'callback válido → JSONP');

res = JSON.parse(global.doGet({ parameter: { callback: 'x;alert(1)' } }).texto);
ok(res.ok === true, 'callback inválido → se responde JSON normal');

/* 9. revisarClaves */
console.log('\n9. Revisión');
global.revisarClaves();
const ultimo = estado.logs[estado.logs.length - 1];
ok(/REVISIÓN DE LAS PESTAÑAS/.test(ultimo) && /General: \d+ claves/.test(ultimo),
  'informe por pestañas en el Logger');

console.log(fallores(fallos));
function fallores(n) { return n === 0 ? '\nTODO OK (' + nClaves + ' claves en 3 pestañas)\n' : '\n' + n + ' FALLOS\n'; }
process.exit(fallos ? 1 : 0);
