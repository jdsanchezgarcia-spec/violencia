# Violencia de Género — infografía editable desde Google Sheets

La página es 100 % estática (se puede abrir con doble clic o publicar en
cualquier hosting), pero **todos sus textos se leen desde una hoja de Google
Sheets** mediante un `Code.gs`. Cambias una celda, recargas la página y el
texto nuevo aparece.

---

## 1. Archivos

| Archivo | Qué hace |
|---|---|
| `index.html` | La página. Cada texto editable está marcado con `data-key="clave"`. |
| `styles.css` | Estilos. Las viñetas `✦` y `⛔` usan variables CSS editables. |
| `contenido.js` | Descarga los textos de la hoja y los coloca en la página. |
| `config.js` | **Aquí pegas la URL** de la aplicación web publicada. |
| `script.js` | Interacciones originales (panel de violencia sexual). No se tocó. |
| `Code.gs` | Se pega en Apps Script: lee la hoja y la sirve en JSON. |
| `scripts/sincronizar-defaults.js` | Regenera los textos por defecto si cambias el HTML. |
| `scripts/probar-code-gs.js` | Comprueba la lógica de `Code.gs` (requiere Node.js). |
| `scripts/probar-contenido.js` | Comprueba que la página aplica bien los textos. |

---

## 2. Instalación (una sola vez)

### Paso 1 — Abrir el editor de Apps Script

Abre tu hoja de cálculo
<https://docs.google.com/spreadsheets/d/18c-g3MrhNmbZVVHiGXDBPkXjAIwbyFC1HCLy2ZuhBEY/edit>
y ve a **Extensiones ▸ Apps Script**.

### Paso 2 — Pegar el código

Borra lo que haya en el editor y pega **todo** el contenido de `Code.gs`.

### Paso 3 — Crear las pestañas de textos

En el selector de funciones elige **`crearHojaTextos`** y pulsa **Ejecutar**.
Google te pedirá permisos (tu propio script sobre tu propia hoja).

Se crean **3 pestañas** con las 156 filas ya cargadas con el contenido actual
de la página, una por zona:

| Pestaña | Contenido |
|---|---|
| **General** | Título, encabezado, las 3 tarjetas, Línea Yo Te Escucho, franja final, pie |
| **Comisarías** | Las 5 comisarías de familia de Villavicencio |
| **Violencia sexual** | Todo el panel de violencia sexual |

> Si tenías la pestaña antigua `Textos`, la migración es automática: sus filas
> pasan a **General** y la pestaña vieja desaparece.

### Paso 4 — Publicar como aplicación web

**Implementar ▸ Nueva implementación ▸ Tipo: Aplicación web**

* Ejecutar como: **Yo**
* Quién tiene acceso: **Cualquier usuario**

Pulsa **Implementar** y **copia la URL** que termina en `/exec`.

### Paso 5 — Conectar la página

Abre `config.js` y pega la URL:

```js
window.CONFIG_CONTENIDO = {
  apiUrl: 'https://script.google.com/macros/s/AKfycb…/exec'
};
```

Listo. Recarga la página: en la consola del navegador verás
`[contenido] 156 textos aplicados desde la hoja de Google.`

> Mientras `apiUrl` esté vacío, la página se ve exactamente igual pero con sus
> textos originales: nunca se rompe.

---

## 3. Cómo editar los textos

Abre la pestaña que corresponda a la zona que quieras cambiar:

| Pestaña | Claves |
|---|---|
| **General** | `pagina.*`, `hero.*`, `c1.*`, `c2.*`, `c3.*`, `linea.*`, `banner.*`, `pie.*`, `decor.*` |
| **Comisarías** | `com.*` |
| **Violencia sexual** | `alerta.*` |

En todas ellas:

| Columna | Contenido |
|---|---|
| **A · clave** | Identificador técnico (`hero.titulo`, `c1.nac.1.tel`…). **No lo edites.** |
| **B · texto** | El texto que verá la gente. Aquí es donde editas. |
| **C · nota** | Aviso sobre cómo se comporta esa fila. Opcional. |

Reglas:

* **Celda vacía** → la página conserva su texto original. Si dudas, vacía la
  celda y queda como estaba.
* **Guardas el Sheet y recargas la página** (`Ctrl+F5`) y ya está.
* **Etiquetas HTML**: las filas con la nota *«Admite etiquetas»* aceptan
  `<strong>`, `<em>`, `<br>`, `<span>` y `<a>`. El resto es texto plano (si
  escribes `<algo>` se verá literal).
* **Teléfonos** (claves terminadas en `.tel`): escribe solo dígitos, p. ej.
  `3001234567`. El enlace `tel:` se actualiza solo. El texto grande que se
  muestra es la clave `…badge` y sí admite `<br>` para partirlo en dos líneas.
* **Correos** (claves `com.*.email`): la celda muestra `📧 correo@…`; el
  enlace `mailto:` usa únicamente la dirección, sin el emoji.
* **`decor.vineta` / `decor.aviso`**: los caracteres `✦` y `⛔` que marcan
  las listas.

### Grupos de claves

| Prefijo | Zona de la página | Pestaña |
|---|---|---|
| `pagina.titulo` | Título de la pestaña del navegador | General |
| `hero.*` | Encabezado principal | General |
| `c1.*` | Tarjeta «Líneas de Atención» (nacionales y locales) | General |
| `c2.*` | Tarjeta «¿Cómo Protegerte?» | General |
| `c3.*` | Tarjeta «¿Cómo Denunciar?» | General |
| `com.*` | Las 5 comisarías de familia | Comisarías |
| `linea.*` | Sección «Línea Yo Te Escucho» | General |
| `banner.*` | Franja final morada | General |
| `alerta.*` | Panel de violencia sexual | Violencia sexual |
| `pie.*` | Pie de página | General |
| `decor.*` | Viñetas decorativas | General |

---

## 4. Mantenimiento

### Si cambias el HTML de la página

```bash
node scripts/sincronizar-defaults.js
```

Regenera el bloque `POR_DEFECTO` de `Code.gs` y valida que:

* no haya claves duplicadas ni textos sin clave,
* todas las etiquetas estén cerradas,
* ningún valor con `<…>` se quede sin `data-html` (se vería literal en pantalla).

Después vuelve a ejecutar `crearHojaTextos()` en Apps Script: **solo añade las
claves nuevas**, nunca pisa lo que ya hayas editado.

### Revisar la hoja

En el Sheet aparece el menú **📰 Infografía ▸ Revisar claves**, o ejecuta
`revisarClaves()` desde el editor. Te dice qué claves faltan, cuáles sobran y
cuáles están vacías (el detalle va al **Ver ▸ Registro**).

### Comprobar que todo sigue bien (opcional, requiere Node.js)

```bash
node scripts/probar-code-gs.js      # lógica de Code.gs con un Apps Script simulado
node scripts/probar-contenido.js    # la página aplicando los 156 textos
```

---

## 5. Solución de problemas

| Síntoma | Solución |
|---|---|
| La página no cambia nada | Revisa que `config.js` tenga la URL y que termine en `/exec`. Recarga con `Ctrl+F5`. |
| «No hay ninguna pestaña (…)» | Pegaste el `Code.gs` nuevo pero la app web sigue con el código anterior: **Implementar ▸ Administrar implementaciones** ▸ lápiz ▸ **Versión: Código más reciente** ▸ Guardar. |
| `Failed to fetch` en la consola | El script ya reintenta solo por JSONP. Si persiste, publica de nuevo la app web con acceso **«Cualquier usuario»**. |
| `La hoja respondió con un error` | Abre Apps Script y ejecuta `crearHojaTextos()`; mira el mensaje exacto. |
| Se ven los textos originales | O no hay conexión, o la URL está vacía: es el comportamiento previsto, la página nunca se queda en blanco. |
| Cambié el HTML y no aparece | Ejecuta `node scripts/sincronizar-defaults.js` y luego `crearHojaTextos()` en Apps Script. |

**Nota:** los textos alternativos de accesibilidad (`alt` de la imagen y
`aria-label` de los botones/enlaces) no son editables desde la hoja; siguen
siendo los del HTML.

---

## 6. Cómo funciona por dentro

```
Google Sheets  ──(pestaña "Textos")──►  Code.gs (doGet)  ──JSON──►  contenido.js  ──►  index.html
     ▲                                                                        │
     └───────────────────── editas una celda ─────────────────────────────────┘
```

1. `index.html` muestra sus textos originales al cargar (así nunca hay pantalla
   en blanco).
2. `contenido.js` pide el JSON a la app web (`fetch`); si el navegador lo
   bloquea por CORS, repite la petición en JSONP.
3. Recorre los elementos con `data-key`, `data-tel`, `data-mailto` y
   `data-css-var` y sustituye el valor solo si la celda trae contenido.
