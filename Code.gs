/**********************************************************************
 * Code.gs — Contenido editable de la infografía
 * "Violencia de Género — Villavicencio"
 *
 * Google Sheet:
 * https://docs.google.com/spreadsheets/d/18c-g3MrhNmbZVVHiGXDBPkXjAIwbyFC1HCLy2ZuhBEY/edit
 *
 * INSTALACIÓN (una sola vez)
 *   1. En el Google Sheet:  Extensiones ▸ Apps Script.
 *   2. Borra el contenido por defecto del editor y pega este archivo completo.
 *   3. Elige la función  crearHojaTextos  y pulsa Ejecutar (acepta los
 *      permisos). Se crean 3 pestañas, una por zona de la página:
 *        · General           → título, encabezado, tarjetas, línea, pie
 *        · Comisarías        → las 5 comisarías de familia
 *        · Violencia sexual  → el panel de violencia sexual
 *   4. Implementar ▸ Nueva implementación ▸ Tipo: Aplicación web
 *        · Ejecutar como: Yo
 *        · Quién tiene acceso: Cualquier usuario
 *      Copia la URL que entrega (termina en /exec).
 *   5. Pega esa URL en config.js de la página (campo apiUrl).
 *
 * USO DIARIO
 *   · Cada pestaña agrupa una zona de la página; edita en la que corresponda.
 *   · Columna A "clave": identificador técnico. No editar.
 *   · Columna B "texto": el texto que verás en la página.
 *       – Celda vacía  → se conserva el texto original del HTML.
 *       – Puedes usar <strong>, <em>, <br>, <span> y <a> en las filas
 *         marcadas como "con etiquetas".
 *   · Columna C "nota": opcional, solo para ti.
 *   · Guardas el Sheet y listo: los cambios aparecen al recargar la página.
 *
 * SI CAMBIAS EL HTML
 *   Ejecuta  node scripts/sincronizar-defaults.js  para regenerar el
 *   bloque POR_DEFECTO de este archivo.
 ********************************************************************/

var SPREADSHEET_ID = '18c-g3MrhNmbZVVHiGXDBPkXjAIwbyFC1HCLy2ZuhBEY';

/** Pestañas del Sheet, una por zona de la página. */
var HOJAS = ['General', 'Comisarías', 'Violencia sexual'];

/** Pestaña única de versiones anteriores (se migra automáticamente). */
var HOJA_LEGADA = 'Textos';

var ENCABEZADOS = ['clave', 'texto', 'nota'];

/**
 * Endpoint de la página: devuelve todos los textos en JSON.
 * Compatible con fetch y con JSONP (?callback=nombre).
 */
function doGet(e) {
  var respuesta;
  try {
    var textos = leerTextos();
    respuesta = { ok: true, hojas: HOJAS, total: Object.keys(textos).length, textos: textos };
  } catch (err) {
    respuesta = { ok: false, error: String(err), textos: {} };
  }

  var json = JSON.stringify(respuesta);
  var cb = e && e.parameter && e.parameter.callback;

  if (cb && /^[A-Za-z_$][0-9A-Za-z_$]*$/.test(cb)) {
    return ContentService.createTextOutput(cb + '(' + json + ')')
      .setMimeType(ContentService.MimeType.JS);
  }
  return ContentService.createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Lee todas las pestañas de HOJAS (y la antigua "Textos") y devuelve
 * { clave: texto }. Si una clave aparece en dos pestañas, gana la primera.
 */
function leerTextos() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var nombres = HOJAS.slice();
  if (ss.getSheetByName(HOJA_LEGADA)) nombres.push(HOJA_LEGADA);  // por si no se migró

  var textos = {};
  var leidas = 0;

  for (var i = 0; i < nombres.length; i++) {
    var hoja = ss.getSheetByName(nombres[i]);
    if (!hoja) continue;                       // una pestaña borrada no rompe la página
    leidas++;

    var datos = hoja.getDataRange().getValues();
    for (var f = 1; f < datos.length; f++) {   // la fila 0 son los encabezados
      var clave = texto_(datos[f][0]);
      if (!clave || (clave in textos)) continue;
      var celda = datos[f][1];
      if (celda === '' || celda === null || celda === undefined) continue;  // vacío = no tocar
      textos[clave] = String(celda);
    }
  }

  if (!leidas) {
    throw new Error('No hay ninguna pestaña (' + HOJAS.join(', ') +
      '). Ejecuta primero crearHojaTextos().');
  }
  return textos;
}

/**
 * Crea las pestañas de HOJAS y añade a cada una las claves que le tocan.
 * Nunca sobrescribe un texto que ya hayas editado.
 */
function crearHojaTextos() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  migrarHojaLegada_(ss);

  var resumen = [];
  var totalNuevas = 0;
  var totalReparadas = 0;

  for (var i = 0; i < HOJAS.length; i++) {
    var nombre = HOJAS[i];
    var hoja = ss.getSheetByName(nombre);
    if (!hoja) hoja = ss.insertSheet(nombre);

    if (hoja.getLastRow() === 0 || texto_(hoja.getRange(1, 1).getValue()).toLowerCase() !== 'clave') {
      hoja.getRange(1, 1, 1, ENCABEZADOS.length).setValues([ENCABEZADOS]);
      hoja.getRange(1, 1, 1, ENCABEZADOS.length).setFontWeight('bold');
      hoja.setFrozenRows(1);
    }

    darFormatoTexto_(hoja);          // antes de escribir: evita perder los ceros

    var existentes = {};
    var datos = hoja.getDataRange().getValues();
    for (var f = 1; f < datos.length; f++) {
      var claveFila = texto_(datos[f][0]);
      if (claveFila) existentes[claveFila] = true;
    }

    var nuevas = [];
    Object.keys(POR_DEFECTO).forEach(function (clave) {
      if (hojaDe_(clave) !== nombre) return;      // esta clave va en otra pestaña
      if (existentes[clave]) return;
      nuevas.push([clave, POR_DEFECTO[clave], nota_(clave, POR_DEFECTO[clave])]);
    });

    if (nuevas.length) {
      hoja.getRange(hoja.getLastRow() + 1, 1, nuevas.length, 3).setValues(nuevas);
      totalNuevas += nuevas.length;
    }

    totalReparadas += repararCeros_(hoja);        // recupera los ceros ya perdidos
    formatear_(hoja);

    var enEsta = Object.keys(POR_DEFECTO).filter(function (k) { return hojaDe_(k) === nombre; }).length;
    resumen.push('  · ' + nombre + ': ' + enEsta + ' claves (' + nuevas.length + ' añadidas)');
  }

  var mensaje = 'Pestañas listas:\n' + resumen.join('\n') +
    '\n\nClaves totales: ' + Object.keys(POR_DEFECTO).length +
    '\nAñadidas ahora: ' + totalNuevas +
    (totalReparadas ? '\nCeldas con ceros restauradas: ' + totalReparadas : '');
  Logger.log(mensaje);
  aviso_(mensaje);
}

/**
 * Pestaña a la que pertenece cada clave (según la zona de la página).
 */
function hojaDe_(clave) {
  if (clave.indexOf('alerta.') === 0) return 'Violencia sexual';
  if (clave.indexOf('com.') === 0) return 'Comisarías';
  return 'General';
}

/**
 * Migra la pestaña antigua "Textos" (versión con una sola hoja):
 *   · si "General" no existe, la renombra;
 *   · si existe, copia las claves que falten y borra "Textos" si ya está vacía.
 */
function migrarHojaLegada_(ss) {
  var vieja = ss.getSheetByName(HOJA_LEGADA);
  if (!vieja) return;

  var principal = ss.getSheetByName(HOJAS[0]);
  if (!principal) { vieja.setName(HOJAS[0]); return; }

  var existentes = {};
  var datos = principal.getDataRange().getValues();
  for (var f = 1; f < datos.length; f++) {
    var clave = texto_(datos[f][0]);
    if (clave) existentes[clave] = true;
  }

  var legadas = vieja.getDataRange().getValues();
  var filas = [];
  for (var g = 1; g < legadas.length; g++) {
    var k = texto_(legadas[g][0]);
    if (k && !existentes[k]) filas.push([k, legadas[g][1], legadas[g][2] || '']);
  }
  if (filas.length) {
    principal.getRange(principal.getLastRow() + 1, 1, filas.length, 3).setValues(filas);
  }

  if (vieja.getLastRow() <= 1) {
    ss.deleteSheet(vieja);                       // solo encabezados: no había nada que salvar
  } else {
    Logger.log('La pestaña antigua "' + HOJA_LEGADA + '" conserva datos. ' +
      'Revísalas y bórrala cuando quieras.');
  }
}

/**
 * Revisa las pestañas: claves que faltan, duplicadas entre pestañas,
 * sobrantes y textos vacíos. El detalle va al Logger del editor.
 */
function revisarClaves() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var nombres = HOJAS.slice();
  if (ss.getSheetByName(HOJA_LEGADA)) nombres.push(HOJA_LEGADA);

  var enHoja = {};                 // clave → pestaña en la que está
  var duplicadas = [];
  var vacias = [];
  var porPestana = [];
  var hayPestanas = false;

  for (var i = 0; i < nombres.length; i++) {
    var hoja = ss.getSheetByName(nombres[i]);
    if (!hoja) { porPestana.push('  · ' + nombres[i] + ': (no existe)'); continue; }
    hayPestanas = true;

    var datos = hoja.getDataRange().getValues();
    var cuenta = 0;
    for (var f = 1; f < datos.length; f++) {
      var clave = texto_(datos[f][0]);
      if (!clave) continue;
      cuenta++;
      if (clave in enHoja) {
        duplicadas.push(clave + ' (' + enHoja[clave] + ' y ' + nombres[i] + ')');
      } else {
        enHoja[clave] = nombres[i];
      }
      if (texto_(datos[f][1]) === '') vacias.push(clave);
    }
    porPestana.push('  · ' + nombres[i] + ': ' + cuenta + ' claves');
  }

  if (!hayPestanas) {
    aviso_('No hay ninguna pestaña (' + HOJAS.join(', ') + '). Ejecuta crearHojaTextos().');
    return;
  }

  var faltantes = Object.keys(POR_DEFECTO).filter(function (k) { return !(k in enHoja); });
  var sobrantes = Object.keys(enHoja).filter(function (k) { return !(k in POR_DEFECTO); });

  var lineas = [
    'REVISIÓN DE LAS PESTAÑAS',
    porPestana.join('\n'),
    '',
    'Claves en el HTML: ' + Object.keys(POR_DEFECTO).length,
    'Claves en las hojas: ' + Object.keys(enHoja).length,
    '',
    'Faltan (' + faltantes.length + '): ' + (faltantes.join(', ') || 'ninguna'),
    'Sobran (' + sobrantes.length + '): ' + (sobrantes.join(', ') || 'ninguna'),
    'Duplicadas entre pestañas (' + duplicadas.length + '): ' + (duplicadas.join(', ') || 'ninguna'),
    'Vacías, se usará el del HTML (' + vacias.length + '): ' + (vacias.join(', ') || 'ninguna')
  ];
  Logger.log(lineas.join('\n'));
  aviso_(porPestana.join('\n') +
    '\n\nFaltan: ' + faltantes.length +
    '\nSobran: ' + sobrantes.length +
    '\nDuplicadas: ' + duplicadas.length +
    '\nVacías: ' + vacias.length +
    '\n\nDetalle completo en Ver ▸ Registro (Logger).');
}

/** Menú dentro del Google Sheet. */
function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('📰 Infografía')
      .addItem('Crear / actualizar las 3 pestañas', 'crearHojaTextos')
      .addItem('Revisar claves', 'revisarClaves')
      .addToUi();
  } catch (err) {
    // Sin interfaz (ejecución automática): se omite el menú.
  }
}

/* ------------------------------- utilidades ------------------------ */

function texto_(valor) {
  if (valor === null || valor === undefined) return '';
  return String(valor).replace(/^\s+|\s+$/g, '');
}

/**
 * Nota sugerida para la columna C, según el tipo de clave:
 *   .tel    → teléfono marcable
 *   .email  → correo con enlace mailto
 *   decor.* → carácter decorativo
 *   con <   → admite etiquetas HTML
 */
function nota_(clave, valor) {
  if (/\.tel$/.test(clave)) return 'Solo dígitos: al guardar, el enlace marca este número';
  if (/\.email$/.test(clave)) return 'Correo: el enlace usa la dirección (se ignora el emoji)';
  if (/^decor\./.test(clave)) return 'Carácter decorativo de la página';
  if (String(valor).indexOf('<') > -1) return 'Admite etiquetas: <strong> <em> <br>';
  return '';
}

function formatear_(hoja) {
  var ultima = hoja.getLastRow();
  hoja.setColumnWidth(1, 240);
  hoja.setColumnWidth(2, 640);
  hoja.setColumnWidth(3, 240);
  if (ultima > 1) {
    hoja.getRange(2, 1, ultima - 1, 3).setVerticalAlignment('top');
    hoja.getRange(2, 2, ultima - 1, 1).setWrap(true);
    hoja.getRange(2, 1, ultima - 1, 1).setFontFamily('Consolas');
    hoja.getRange(2, 3, ultima - 1, 1).setFontColor('#999999');
  }
}

/**
 * Fuerza las columnas a formato TEXTO para que Google Sheets no convierta
 * en número lo que empieza por cero ("01", "018000919748"…).
 * Se aplica a más filas de las usadas, así las ediciones futuras también.
 */
function darFormatoTexto_(hoja) {
  var filas = Math.max(hoja.getLastRow(), 200);
  hoja.getRange(1, 1, filas, ENCABEZADOS.length).setNumberFormat('@');
}

/**
 * Restaura los ceros a la izquierda que Sheets convirtió en número
 * ("018000919748" → 18000919748). Solo reescribe celdas cuyo contenido
 * coincide con el texto por defecto sin sus ceros iniciales, así que no
 * pisa las ediciones que hayas hecho.
 * Devuelve cuántas celdas reparó.
 */
function repararCeros_(hoja) {
  var datos = hoja.getDataRange().getValues();
  var filas = [];

  for (var f = 1; f < datos.length; f++) {
    var clave = texto_(datos[f][0]);
    if (!clave || !(clave in POR_DEFECTO)) continue;

    var defecto = String(POR_DEFECTO[clave]);
    if (!/^[0-9\s+()-]+$/.test(defecto)) continue;   // solo números y teléfonos

    var actual = texto_(datos[f][1]);
    if (actual === defecto) continue;
    if (sinCerosIzquierda_(defecto) === actual) filas.push([f + 1, defecto]);
  }

  for (var i = 0; i < filas.length; i++) {
    hoja.getRange(filas[i][0], 2).setValue(filas[i][1]);
  }
  return filas.length;
}

function sinCerosIzquierda_(texto) {
  return String(texto).replace(/^0+(?=\d)/, '');
}

function aviso_(mensaje) {
  try {
    SpreadsheetApp.getUi().alert(mensaje);
  } catch (err) {
    // Sin interfaz: el mensaje queda en el Logger.
  }
}

/* ---------------------- textos originales del HTML ----------------- */
/* Regenerar con:  node scripts/sincronizar-defaults.js               */

var POR_DEFECTO = {
                // --- INICIO POR_DEFECTO (no editar a mano) ---
  "pagina.titulo": "Violencia de Género — Infografías de Ayuda, Protección y Denuncia",
  "decor.vineta": "✦",
  "decor.aviso": "⛔",
  "hero.insignia": "🎀 Campaña de Sensibilización",
  "hero.titulo": "Alto a la Violencia<br>de Género",
  "hero.divisor": "✦",
  "hero.texto": "Información de ayuda, autoprotección y rutas de denuncia en Colombia, con directorio de comisarías de familia de Villavicencio. Comparte estas infografías: <strong>la información también salva vidas.</strong>",
  "c1.icono": "📞",
  "c1.titulo": "Líneas de Atención",
  "c1.sub": "¿Necesitas ayuda? Números nacionales y locales de Villavicencio",
  "c1.nac.titulo": "🌐 Nacionales",
  "c1.nac.1.tel": "155",
  "c1.nac.1.badge": "155",
  "c1.nac.1.nombre": "Violencia basada en género",
  "c1.nac.1.detalle": "Orientación a mujeres víctimas · 24 h, todos los días",
  "c1.nac.2.tel": "122",
  "c1.nac.2.badge": "122",
  "c1.nac.2.nombre": "Fiscalía General",
  "c1.nac.2.detalle": "Denuncias VBG y violencia sexual · 24/7",
  "c1.nac.3.tel": "123",
  "c1.nac.3.badge": "123",
  "c1.nac.3.nombre": "Emergencias",
  "c1.nac.3.detalle": "Línea única · Policía Nacional",
  "c1.nac.4.tel": "141",
  "c1.nac.4.badge": "141",
  "c1.nac.4.nombre": "ICBF",
  "c1.nac.4.detalle": "Protección de niños, niñas y adolescentes",
  "c1.nac.5.tel": "018000919748",
  "c1.nac.5.badge": "01 8000<br>919 748",
  "c1.nac.5.nombre": "Fiscalía",
  "c1.nac.5.detalle": "Línea gratuita nacional",
  "c1.nac.6.tel": "018000918080",
  "c1.nac.6.badge": "01 8000<br>918 080",
  "c1.nac.6.nombre": "ICBF",
  "c1.nac.6.detalle": "Línea gratuita nacional",
  "c1.nac.aviso": "💻 <strong>Denuncia en línea:</strong> www.fiscalia.gov.co<br>📱 WhatsApp ICBF: 320 239 1685 · 320 865 5450 · 320 239 1320",
  "c1.loc.titulo": "📍 Locales · Villavicencio",
  "c1.loc.1.tel": "018000931089",
  "c1.loc.1.badge": "01 8000<br>931 089",
  "c1.loc.1.nombre": "Línea Yo Te Escucho",
  "c1.loc.1.detalle": "Línea gratuita · Apoyo emocional",
  "c1.loc.2.tel": "+573163907010",
  "c1.loc.2.badge": "316 390<br>7010",
  "c1.loc.2.nombre": "Línea Yo Te Escucho",
  "c1.loc.2.detalle": "WhatsApp · Apoyo emocional",
  "c1.loc.3.tel": "106",
  "c1.loc.3.badge": "106",
  "c1.loc.3.nombre": "Línea 106",
  "c1.loc.3.detalle": "Apoyo emocional · Villavicencio",
  "c2.icono": "🛡️",
  "c2.titulo": "¿Cómo Protegerte?",
  "c2.sub": "Si vives violencia, protégete así. Conocer la ruta es el primer paso.",
  "c2.li1": "<strong>Identifica la violencia:</strong> física, psicológica, sexual o económica (control de dinero, retención de documentos). <em>Todas son punibles.</em>",
  "c2.li2": "<strong>Acude a salud sin costo:</strong> tu EPS debe atenderte de forma integral y gratuita: exámenes de ITS, prueba de embarazo, anticoncepción de emergencia.",
  "c2.li3": "<strong>Busca un lugar seguro:</strong> Casas de Justicia, Comisarías de Familia, Estaciones de Policía o la Patrulla Púrpura.",
  "c2.li4": "<strong>Documenta las agresiones:</strong> mensajes, fotos, testigos y fechas serán clave en tu denuncia.",
  "c2.li5": "<strong>Activa tu red de apoyo:</strong> familiares, amistades y orientación psicosocial (Línea 155).",
  "c2.li6": "<strong>Conoce tus derechos:</strong> no ser revictimizada, no ser confrontada con el agresor, recibir orientación jurídica gratuita.",
  "c2.aviso": "⚠️ <strong>Si sobreviviste violencia sexual:</strong> evita bañarte, conserva la ropa que usabas y acude de inmediato al servicio de salud más cercano.",
  "c3.icono": "⚖️",
  "c3.titulo": "¿Cómo Denunciar?",
  "c3.sub": "Denunciar es tu derecho. Paso a paso para hacer efectiva la justicia.",
  "c3.li1": "<strong>¿Quién puede denunciar?</strong> La víctima o <em>cualquier persona</em> que conozca el caso. Las denuncias pueden ser anónimas.",
  "c3.li2": "<strong>¿Qué debe contener?</strong> Hechos, fechas, lugares, posibles testigos y evidencias.",
  "c3.li3": "<strong>Fiscalía:</strong> línea 122, botón 122, denuncia virtual ¡ADenunciar! o presencial en las URI (atención 24 horas).",
  "c3.li4": "<strong>Policía / CTI:</strong> reciben la denuncia, remiten a la Fiscalía y trasladan a la víctima a Medicina Legal.",
  "c3.li5": "<strong>Comisarías de Familia:</strong> reciben denuncias y adoptan medidas de protección de inmediato.",
  "c3.li6": "<strong>Medicina Legal:</strong> realiza la valoración de lesiones y recolecta evidencia forense.",
  "c3.li7": "<strong>Personas migrantes:</strong> también pueden denunciar con PPT, salvoconducto, cédula de extranjería o pasaporte.",
  "c3.aviso": "🚔 <strong>¿Emergencia en curso?</strong> Llama de inmediato al <strong>123</strong>. Tu vida es lo primero.",
  "com.kicker": "Villavicencio · Meta",
  "com.titulo": "🏛 Comisarías de Familia",
  "com.texto": "Identifica tu comisaría según tu comuna o corregimiento. Allí puedes denunciar y solicitar medidas de protección.",
  "com.1.indice": "01",
  "com.1.nombre": "Comisaría Primera de Familia",
  "com.1.icono_barrio": "📍",
  "com.1.barrio": "Barrio Camoa",
  "com.1.icono_comunas": "👥",
  "com.1.comunas": "Comunas 5 y 6 · Corregimiento 2",
  "com.1.email": "📧 comisariadefamilia1@villavicencio.gov.co",
  "com.2.indice": "02",
  "com.2.nombre": "Comisaría Segunda de Familia",
  "com.2.icono_barrio": "📍",
  "com.2.barrio": "Casa de Justicia de Ciudad Porfía",
  "com.2.icono_comunas": "👥",
  "com.2.comunas": "Comunas 8 y 9 · Corregimiento 1",
  "com.2.email": "📧 comisariadefamilia2@villavicencio.gov.co",
  "com.3.indice": "03",
  "com.3.nombre": "Comisaría Tercera de Familia",
  "com.3.icono_barrio": "📍",
  "com.3.barrio": "Barzal",
  "com.3.icono_comunas": "👥",
  "com.3.comunas": "Comunas 1, 2 y 3 · Corregimiento 3",
  "com.3.email": "📧 comisariadefamilia3@villavicencio.gov.co",
  "com.4.indice": "04",
  "com.4.nombre": "Comisaría Cuarta Permanente de Familia",
  "com.4.icono_barrio": "📍",
  "com.4.barrio": "Centro Integrado de la Mujer – Fundadores",
  "com.4.icono_comunas": "👥",
  "com.4.comunas": "Comunas 4 y 10 · Corregimientos 5, 6 y 7",
  "com.4.email": "📧 comisariadefamilia4@villavicencio.gov.co",
  "com.5.indice": "05",
  "com.5.nombre": "Comisaría Quinta de Familia",
  "com.5.icono_barrio": "📍",
  "com.5.barrio": "Barzal",
  "com.5.icono_comunas": "👥",
  "com.5.comunas": "Comuna 7 · Corregimiento 4",
  "com.5.email": "📧 comisariadefamilia5@villavicencio.gov.co",
  "linea.kicker": "Apoyo emocional",
  "linea.titulo": "💬 Línea Yo Te Escucho",
  "linea.texto": "Si necesitas hablar con alguien, estas líneas están disponibles para escucharte y orientarte. Las encuentras en la tarjeta <a class=\"inline-link\" href=\"#lineas-atencion\" target=\"_self\">Líneas de Atención ↑</a>, dentro del grupo <em>Locales · Villavicencio</em>.",
  "banner.titulo": "💜 No estás sola · No estás solo",
  "banner.texto": "Si vives violencia o conoces a alguien que la vive, hablar es el primer paso. Hay personas y líneas que te escuchan, creen en ti y pueden ayudarte.",
  "banner.telefonos": "📞 155 · 122 · 123",
  "alerta.tab": "DA CLICK AQUÍ EN CASO DE VIOLENCIA SEXUAL",
  "alerta.kicker": "🚨 Actúa de inmediato",
  "alerta.titulo": "Violencia sexual",
  "alerta.cerrar": "✕",
  "alerta.salud.titulo": "🏥 Salud",
  "alerta.salud.texto": "Ante un caso de violencia sexual, acude a urgencias de los siguientes centros de salud:",
  "alerta.salud.c1": "Porfía",
  "alerta.salud.c2": "Esperanza",
  "alerta.salud.c3": "Recreo",
  "alerta.salud.c4": "HDV <small>(Hospital de Villavicencio)</small>",
  "alerta.salud.c5": "Nueva Clínica del Barzal",
  "alerta.salud.c6": "Clínica Meta",
  "alerta.salud.c7": "Clínica Centauros",
  "alerta.salud.recom": "Recomendaciones:",
  "alerta.salud.r1": "No bañarse.",
  "alerta.salud.r2": "No cambiarse de ropa.",
  "alerta.salud.r3": "Acudir inmediatamente.",
  "alerta.just.titulo": "⚖️ Justicia — Rutas de atención y contacto",
  "alerta.just.1.tel": "112",
  "alerta.just.1.num": "112",
  "alerta.just.1.label": "Policía Nacional · Emergencias",
  "alerta.just.2.tel": "155",
  "alerta.just.2.num": "155",
  "alerta.just.2.label": "Línea Púrpura · Policía Nacional · 24 h",
  "alerta.just.3.tel": "+573167426939",
  "alerta.just.3.num": "316 742 6939",
  "alerta.just.3.label": "Línea Púrpura · Celular",
  "alerta.just.4.tel": "+57318986582",
  "alerta.just.4.num": "318 986 582",
  "alerta.just.4.label": "Infancia y adolescencia",
  "alerta.just.5.tel": "122",
  "alerta.just.5.num": "122",
  "alerta.just.5.label": "Fiscalía",
  "alerta.prot.titulo": "🛡️ Protección",
  "alerta.prot.1.tel": "141",
  "alerta.prot.1.num": "141",
  "alerta.prot.1.label": "ICBF",
  "alerta.prot.2.tel": "018000918080",
  "alerta.prot.2.num": "01 8000 918 080",
  "alerta.prot.2.label": "Línea nacional ICBF · Gratuita",
  "alerta.pie": "Si hay peligro inminente, llama también al <strong>123</strong>.",
  "pie.texto": "Infografía educativa con fines informativos <span class=\"heart\">♥</span><br> Fuentes: Fiscalía General de la Nación · Policía Nacional · ICBF · Consejería Presidencial para la Equidad de la Mujer · Alcaldía de Villavicencio (Colombia)"
  // --- FIN POR_DEFECTO ---
};
