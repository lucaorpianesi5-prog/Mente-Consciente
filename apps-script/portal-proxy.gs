// ═══════════════════════════════════════════════════════════════════════
// portal-proxy.gs — versión con "Entrar con Google" para alumnos (22/11)
// Basado en la versión del 28/09 (caché 5 min + pagos).
// Cambios del 24/11 (marcados con [24/11]):
//   1. doGet() devuelve también mapeoUrl (botón Mapeo del portal) y
//      perfilEditable:true (así el portal activa la entrevista inicial solo).
//   2. doPost() acepta la acción "perfil": el alumno guarda SU fecha de
//      nacimiento, altura, peso, objetivo y molestia (entrevista inicial).
//      Es la única escritura del portal; ver guardarPerfilAlumno_() al final.
//   El login con Google queda exactamente igual.
// ═══════════════════════════════════════════════════════════════════════

const SHEET_ID_PORTAL = '1mHE-llV4vVZqwS-_mKjOmse_sOGJJaeO81jT6wOsUSY';

// Cuánto tiempo (segundos) se sirve una respuesta ya calculada para un mismo
// alumno sin volver a abrir el Sheet (handoff optimizacion-carga-portal,
// continuación 2026-09-28). El costo grande de este proxy es abrir la
// planilla entera con SpreadsheetApp.openById() — pasa igual sin importar
// cuánto se lea después — así que reabrir el MISMO portal dentro de esta
// ventana sale casi instantáneo. Decisión de Luca: 5 minutos, porque la
// fuente de verdad para él sigue siendo el Sheet, no el portal — un dato
// desactualizado por hasta 5 min ahí no le genera problema.
const CACHE_TTL_SEGUNDOS = 300;

function doGet(e) {
  try {
    // B-5: el parámetro 'alumno' ahora es el token no adivinable
    // (columna S = portalToken), no el ID real de la fila.
    const token = e.parameter.alumno;
    if (!token) {
      return _jsonOut({ error: 'missing_id' });
    }

    // Cache por token: solo se usa para respuestas ya exitosas (ver más abajo)
    // — un token inválido o un error transitorio no queda pegado en caché.
    const cache = CacheService.getScriptCache();
    const cacheKey = 'portal_' + token;
    const cached = cache.get(cacheKey);
    if (cached) {
      return ContentService.createTextOutput(cached).setMimeType(ContentService.MimeType.JSON);
    }

    const ss = SpreadsheetApp.openById(SHEET_ID_PORTAL);

    // ── Alumnos: buscar la fila que tenga este token ──
    const alumnosSheet = ss.getSheetByName('Alumnos');
    const alumnosData = alumnosSheet.getDataRange().getValues();
    let fila = null;
    for (let i = 1; i < alumnosData.length; i++) {
      // Columna S = índice 18 = portalToken
      if (alumnosData[i][18] && String(alumnosData[i][18]) === token) { fila = alumnosData[i]; break; }
    }
    if (!fila) {
      return _jsonOut({ error: 'not_found' });
    }
    const id = fila[0]; // ID real — solo se usa puertas adentro, nunca se devuelve al cliente

    // Solo los campos que el portal muestra — nada de teléfono, notas
    // internas, ID real, ni datos de otros alumnos. El monto sí se expone
    // (handoff vencimiento-cuota-portal-y-ficha, decisión de Luca 28/09: el
    // alumno ve su propia cuota a propósito, el token sigue siendo el
    // control de acceso).
    const alumno = {
      nombre:       fila[1] || '',
      horario:      fila[2] || '',
      dias:         fila[3] || '',
      frecuencia:   fila[4] || '',
      monto:        fila[5] || '',
      objetivos:    fila[6] || '',
      estado:       fila[8] || 'activo',
      fechaNac:     fila[10] || '',
      estatura:     fila[11] || '',
      pesoInicial:  fila[12] || '',
      pesoActual:   fila[13] || '',
      carpetaDrive: fila[16] || '',
      nutriDrive:   fila[17] || '',
      diaPago:      fila[19] || '',
      mapeoUrl:     fila[20] || '',   // [24/11] columna U: botón Mapeo del portal
    };

    // ── Asistencias: solo registros de este alumno ──
    const asSheet = ss.getSheetByName('Asistencias');
    const asData = asSheet ? asSheet.getDataRange().getValues() : [];
    const asistencias = [];
    for (let i = 1; i < asData.length; i++) {
      if (String(asData[i][0]) === id && asData[i][1]) {
        asistencias.push([asData[i][1], asData[i][2] || '']);
      }
    }

    // ── Frases: todas las frases cargadas (columna A, sin encabezado) ──
    // El portal elige una al azar del lado del cliente. Pestaña opcional:
    // si no existe o está vacía, el portal usa una frase fija de respaldo.
    const frasesSheet = ss.getSheetByName('Frases');
    const frasesData = frasesSheet ? frasesSheet.getDataRange().getValues() : [];
    const frases = frasesData.map(r => r[0]).filter(f => f && String(f).trim());

    // ── Cobros: solo las FECHAS de pago de este alumno (para calcular su
    // vencimiento del lado del cliente con la misma función que la app) ──
    // getDisplayValues() y no getValues(): la app escribe las fechas como
    // strings 'd/m/yyyy' (RAW), pero si alguien tipea una fecha a mano en el
    // Sheet, getValues() la devuelve como objeto Date, que en JSON queda como
    // ISO y el parseo 'd/m/yyyy' del cliente la descarta sin avisar.
    const cobSheet = ss.getSheetByName('Cobros');
    const cobData  = cobSheet ? cobSheet.getDataRange().getDisplayValues() : [];
    const pagos = [];
    for (let i = 1; i < cobData.length; i++) {
      if (String(cobData[i][1]) === String(id) && cobData[i][2] === 'pagado' && cobData[i][3]) {
        pagos.push(cobData[i][3]); // 'd/m/yyyy', mismo formato que ve la app
      }
    }

    // [24/11] perfilEditable: avisa al portal que este proxy ya acepta la
    // entrevista inicial (acción "perfil" de doPost).
    const resultado = { alumno, asistencias, frases, pagos, perfilEditable: true };
    const resultadoStr = JSON.stringify(resultado);
    try {
      cache.put(cacheKey, resultadoStr, CACHE_TTL_SEGUNDOS);
    } catch (cacheErr) {
      // Caché llena o falla al guardar: no debe romper la respuesta al alumno.
      Logger.log('No se pudo cachear la respuesta del portal: ' + cacheErr);
    }
    return ContentService.createTextOutput(resultadoStr).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    Logger.log(err);
    return _jsonOut({ error: 'server_error' });
  }
}

function _jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Entrar con Google (alumnos) ───────────────────────────────────────────
// Mismo CLIENT_ID que index.html: el ID token tiene que haber sido emitido
// PARA esta app (si no, cualquier sitio con login de Google podría usarlo).
const CLIENT_ID = '349654954450-p8rua8o64semm4nd934dbl5mq29hcu3l.apps.googleusercontent.com';

// Recibe { id_token } (el "credential" de Sign in with Google), verifica con
// Google que sea válido y que el mail esté verificado, busca ese mail en la
// columna V de Alumnos y devuelve SOLO el portalToken de ese alumno. Los datos
// del portal se siguen pidiendo por doGet() con ese token, como siempre.
// [24/11] Si en vez de id_token llega { accion: 'perfil' }, va a
// guardarPerfilAlumno_() (entrevista inicial). El login no cambia.
function doPost(e) {
  try {
    const body = JSON.parse((e.postData && e.postData.contents) || '{}');
    if (body.accion === 'perfil') return guardarPerfilAlumno_(body);   // [24/11]

    const idToken = body.id_token;
    if (!idToken) return _jsonOut({ error: 'missing_token' });

    // Google verifica firma y vencimiento; acá se chequea para quién se emitió,
    // quién lo emitió y que el mail esté verificado.
    const r = UrlFetchApp.fetch(
      'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken),
      { muteHttpExceptions: true }
    );
    if (r.getResponseCode() !== 200) return _jsonOut({ error: 'invalid_token' });
    const info = JSON.parse(r.getContentText());
    const issOk = info.iss === 'accounts.google.com' || info.iss === 'https://accounts.google.com';
    if (info.aud !== CLIENT_ID || !issOk || String(info.email_verified) !== 'true') {
      return _jsonOut({ error: 'invalid_token' });
    }

    const email = String(info.email || '').trim().toLowerCase();
    if (!email) return _jsonOut({ error: 'invalid_token' });

    const filas = SpreadsheetApp.openById(SHEET_ID_PORTAL)
      .getSheetByName('Alumnos').getRange('A2:V1000').getValues();
    // Columna V (índice 21) = email, columna S (índice 18) = portalToken.
    // Sin token no hay a dónde mandarlo: la app lo genera al guardar el mail.
    const fila = filas.find(f => String(f[21] || '').trim().toLowerCase() === email && f[18]);
    if (!fila) return _jsonOut({ error: 'no_habilitado' });

    return _jsonOut({ token: String(fila[18]) });
  } catch (err) {
    Logger.log(err);
    return _jsonOut({ error: 'server_error' });
  }
}

function probarConexionGoogle() {
  const r = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=prueba', { muteHttpExceptions: true });
  Logger.log('Respuesta de Google: ' + r.getResponseCode());
}

// ── [24/11] Entrevista inicial del alumno ─────────────────────────────────
// El alumno completa o edita su fecha de nacimiento, altura, peso, objetivo y
// molestia. Se escribe SOLO en la fila del alumno dueño del token y SOLO en:
//   K fechaNac · L estatura · M pesoInicial (solo si estaba vacío) · N pesoActual
//   G objetivos y H molestias: ítems con origen "entrevista" (hasta 7 y 8; al
//   editar se reemplazan esos ítems; los que cargó Luca no se tocan).
// Nunca toca monto, estado, horario, días, token, email ni datos de otros.
// Los valores se validan y recortan; un alumno "inactivo" no puede escribir.
// LockService evita que dos guardados simultáneos se pisen.
const COL_PERFIL = { objetivos: 7, notas: 8, estado: 9, fechaNac: 11, estatura: 12, pesoInicial: 13, pesoActual: 14, token: 19 };

function guardarPerfilAlumno_(cuerpo) {
  try {
    const token = String((cuerpo && cuerpo.token) || '').trim();
    const datos = (cuerpo && cuerpo.datos) || {};
    if (token.length < 20 || token.length > 100) return _jsonOut({ ok: false, error: 'token' });

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const hoja = SpreadsheetApp.openById(SHEET_ID_PORTAL).getSheetByName('Alumnos');
      const ultima = hoja.getLastRow();
      if (ultima < 2) return _jsonOut({ ok: false, error: 'not_found' });
      const tokens = hoja.getRange(2, COL_PERFIL.token, ultima - 1, 1).getValues();
      let fila = -1;
      for (let i = 0; i < tokens.length; i++) {
        if (String(tokens[i][0]).trim() === token) { fila = i + 2; break; }
      }
      if (fila === -1) return _jsonOut({ ok: false, error: 'not_found' });

      const actual = hoja.getRange(fila, 1, 1, 22).getValues()[0];
      if (String(actual[COL_PERFIL.estado - 1]).trim() === 'inactivo') return _jsonOut({ ok: false, error: 'inactivo' });

      // ── Datos simples (validados) ──
      if (datos.fechaNac !== undefined) {
        const m = String(datos.fechaNac).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        const anio = new Date().getFullYear();
        const f = m ? new Date(+m[3], +m[2] - 1, +m[1]) : null;   // fecha real (rechaza 31/02)
        if (f && f.getDate() === +m[1] && f.getMonth() === +m[2] - 1 && +m[3] > anio - 100 && +m[3] <= anio - 8) {
          hoja.getRange(fila, COL_PERFIL.fechaNac).setNumberFormat('@')
            .setValue(('0' + m[1]).slice(-2) + '/' + ('0' + m[2]).slice(-2) + '/' + m[3]);
        }
      }
      if (datos.estatura !== undefined) {
        const h = parseFloat(String(datos.estatura).replace(',', '.'));
        if (h >= 100 && h <= 230) hoja.getRange(fila, COL_PERFIL.estatura).setNumberFormat('@').setValue(String(Math.round(h)));
      }
      if (datos.pesoActual !== undefined) {
        const p = parseFloat(String(datos.pesoActual).replace(',', '.'));
        if (p >= 30 && p <= 250) {
          const pTxt = String(Math.round(p * 10) / 10);
          // Como texto con punto, igual que lo guarda la app (un número quedaría "64,5" y la app lee 64)
          hoja.getRange(fila, COL_PERFIL.pesoActual).setNumberFormat('@').setValue(pTxt);
          if (!String(actual[COL_PERFIL.pesoInicial - 1]).trim()) hoja.getRange(fila, COL_PERFIL.pesoInicial).setNumberFormat('@').setValue(pTxt);
        }
      }

      // ── Objetivo y molestia: un ítem "de la entrevista" que se reemplaza al editar ──
      const hoy = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy');   // mismo formato que la ficha
      const recortar = (s, n) => String(s || '').replace(/[\r\n]+/g, ' ').trim().slice(0, n);
      // Reemplaza TODOS los ítems "de la entrevista" de la celda por los nuevos (los de Luca quedan)
      const ponerItems = (col, items) => {
        const lineas = String(actual[col - 1] || '').split('\n').filter(l => l.trim());
        const otras = lineas.filter(l => {
          try { const o = JSON.parse(l); return !(o && o.origen === 'entrevista'); } catch (e) { return true; }
        });
        items.forEach(it => otras.push(JSON.stringify(it)));
        hoja.getRange(fila, col).setValue(otras.join('\n'));
      };
      // Varios objetivos (máx. 7) — o un solo ítem, el formato anterior
      const objs = Array.isArray(datos.objetivos) ? datos.objetivos.slice(0, 7) : (datos.objetivo ? [datos.objetivo] : null);
      if (objs) {
        const items = objs.filter(o => o && o.texto).map(o => ({ texto: recortar(o.texto, 140), categoria: recortar(o.categoria, 40), estado: 'activo', fecha: hoy, origen: 'entrevista' }));
        if (items.length) ponerItems(COL_PERFIL.objetivos, items);
      }
      // Varias molestias (máx. 8); una lista vacía ("No tengo") borra las de una entrevista anterior
      const mols = Array.isArray(datos.molestias) ? datos.molestias.slice(0, 8) : (datos.molestia ? [datos.molestia] : null);
      if (mols) {
        const items = mols.filter(m => m && m.texto).map(m => ({ texto: recortar(m.texto, 140), zona: recortar(m.zona, 30), estado: 'activa', fecha: hoy, origen: 'entrevista' }));
        ponerItems(COL_PERFIL.notas, items);
      }
    } finally {
      lock.releaseLock();
    }

    // El portal tiene que ver los datos nuevos ya, no dentro de 5 minutos
    try { CacheService.getScriptCache().remove('portal_' + token); } catch (e) {}
    return _jsonOut({ ok: true });
  } catch (err) {
    Logger.log(err);
    return _jsonOut({ ok: false, error: 'server_error' });
  }
}
