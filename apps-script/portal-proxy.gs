// ═══════════════════════════════════════════════════════════════════════
// portal-proxy.gs — versión con "Entrar con Google" para alumnos (22/11)
// Basado en la versión del 28/09 (caché 5 min + pagos).
// Cambios del 24/11 (marcados con [24/11]):
//   1. doGet() devuelve también mapeoUrl (botón Mapeo del portal) y
//      perfilEditable:true (así el portal activa la entrevista inicial solo).
//   2. doPost() acepta la acción "perfil": el alumno guarda SU fecha de
//      nacimiento, altura, peso, objetivo y molestia (entrevista inicial).
//      Es la única escritura del portal; ver guardarPerfilAlumno_() al final.
//   3. doGet(?alumno=TOKEN&plan=fuerza|mapeo) devuelve, SOLO PARA LEER, la
//      planilla de Fuerza o de Mapeo de ESE alumno (ver planPortal_()).
//      Asistencias suma la columna D (día del plan terminado).
//   El login con Google queda exactamente igual.
// Cambios de la auditoría del 24/11 (marcados con [aud 24/11]):
//   4. Un alumno "inactivo" ya no ve NADA del portal: doGet responde not_found
//      (el portal borra la sesión y vuelve al login) y el login con Google
//      responde 'inactivo' en vez de entregar el token.
//   5. [25/11] doGet devuelve también la modalidad (columna W): el portal de un
//      alumno online dice "Entrenás online, a tu ritmo" en vez de "Sin días asignados".
//   6. [26/11] Entrevista ampliada: doGet devuelve la entrevista guardada (columna X) y
//      entrevista2:true; la acción "perfil" acepta datos.entrevista, que se valida campo
//      por campo contra las opciones permitidas y se guarda como JSON en la columna X de
//      la fila del alumno (no toca nada más).
//   7. [26/11] "Terminé el día" desde el portal, SOLO alumnos online (columna W):
//      acciones "terminarDia" y "deshacerDia" (ver terminarDia_()). Escriben solo en
//      Asistencias, solo filas de ese alumno, y marcan la columna E con "portal" para
//      que el alumno pueda deshacer únicamente lo suyo y únicamente el mismo día.
//   8. [27/11] Nutrición desde el portal (ver nutriPortal_() y guardarComida_() al final):
//      doGet(?alumno=TOKEN&plan=nutri) devuelve, SOLO PARA LEER, las pestañas Track y Datos
//      de la planilla de Nutri de ESE alumno (columna R). La acción "comida" escribe SOLO la
//      columna "Comida" (y "Alcohol") de UNA fila de su Track: la de esa fecha y esa comida del
//      día, hasta hoy, y solo mientras Luca no le cargó los macros. doGet avisa con nutri:true.
//   9. [27/11, v1.4] Favoritas: pestaña "Favoritas" en la planilla de Nutri (la crea el proxy). El alumno
//      marca ⭐ una comida que Luca ya revisó (acción "favorita": nombre y macros salen de la planilla) y la
//      saca ("quitarFavorita"). Al cargar una comida puede elegir favoritas: el proxy suma los macros (el
//      alumno nunca manda números) y la comida queda "⭐ …" completa; puede corregirla mientras tenga la ⭐
//      (Luca la saca al revisarla desde la app). doGet avisa con favoritas:true.
// ═══════════════════════════════════════════════════════════════════════

// Versión del proxy: el portal la muestra al pie ("Proxy 1.0 · 25/11/2026") para saber si ya se publicó.
// SUBIRLA CADA VEZ QUE SE CAMBIA ESTE ARCHIVO.
const VERSION_PROXY = '1.4 · 27/11/2026';

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
    if (e.parameter.plan === 'nutri') return nutriPortal_(token);   // [27/11]
    if (e.parameter.plan) return planPortal_(token, String(e.parameter.plan));   // [24/11]

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
    // [aud 24/11] Inactivo: como si no existiera (no se cachea)
    if (String(fila[8]).trim() === 'inactivo') return _jsonOut({ error: 'not_found' });
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
      modalidad:    fila[22] || '',   // [25/11] columna W: 'online' o vacío (presencial)
      entrevista:   fila[23] || '',   // [26/11] columna X: su entrevista (JSON), para editarla
    };

    // ── Asistencias: solo registros de este alumno ──
    const asSheet = ss.getSheetByName('Asistencias');
    const asData = asSheet ? asSheet.getDataRange().getValues() : [];
    const asistencias = [];
    for (let i = 1; i < asData.length; i++) {
      if (String(asData[i][0]) === id && asData[i][1]) {
        asistencias.push([asData[i][1], asData[i][2] || '', asData[i][3] || '', asData[i][4] || '']);   // [24/11] D = día del plan · [26/11] E = 'portal' si lo marcó el alumno
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
    const resultado = { alumno, asistencias, frases, pagos, perfilEditable: true, planPortal: true, entrevista2: true, terminarDia: true, nutri: true, favoritas: true, version: VERSION_PROXY };
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
    if (body.accion === 'terminarDia' || body.accion === 'deshacerDia') return terminarDia_(body);   // [26/11]
    if (body.accion === 'comida') return guardarComida_(body);   // [27/11]
    if (body.accion === 'favorita') return favorita_(body);   // [favoritas 27/11]
    if (body.accion === 'quitarFavorita') return quitarFavorita_(body);

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
    if (String(fila[8]).trim() === 'inactivo') return _jsonOut({ error: 'inactivo' });   // [aud 24/11]

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
const COL_PERFIL = { objetivos: 7, notas: 8, estado: 9, fechaNac: 11, estatura: 12, pesoInicial: 13, pesoActual: 14, token: 19, entrevista: 24 };

// [26/11] Opciones válidas de la entrevista ampliada (las mismas que ENT_OP en index.html).
// Todo lo que no esté en estas listas se descarta: el alumno no puede escribir texto libre acá.
const ENT_VALIDAS = {
  modalidad: ['presencial', 'online'],
  sexo: ['Mujer', 'Hombre', 'Prefiero no decir'],
  actPrev: ['Fútbol', 'Running', 'Natación', 'Artes marciales', 'Danza', 'Yoga', 'Ciclismo', 'Crossfit', 'Tenis / pádel', 'Gimnasio', 'Otro', 'Ninguna'],
  pesas: ['Nunca', 'Menos de 6 meses', '6 meses a 2 años', 'Más de 2 años'],
  ahora: ['Sí, entreno ahora', 'Paré hace menos de un año', 'Paré hace más de un año'],
  actividad: ['Sedentario', 'Algo activo', 'Muy activo'],
  trabajo: ['Sentado casi todo el día', 'De pie', 'En movimiento', 'Físico pesado'],
  principal: ['Ganar fuerza', 'Ganar músculo', 'Bajar de peso', 'Salud y bienestar', 'Rendimiento deportivo', 'Movilidad y menos dolor'],
  dias: ['2 días', '3 días', '4 días', '5 días'],
  duracion: ['30 min', '45 min', '60 min', '90 min'],
  lugares: ['Casa', 'Gimnasio', 'Plaza o parque'],
  elementos: ['Mancuernas', 'Barra y discos', 'Bandas elásticas', 'Kettlebell', 'Barra de dominadas', 'Banco', 'Colchoneta', 'Nada'],
  salud: ['Una lesión actual', 'Dolor al moverme', 'Una condición médica diagnosticada', 'Medicación que afecte el ejercicio', 'Embarazo', 'Una cirugía reciente']
};
function limpiarEntrevista_(e, hoy) {
  if (!e || typeof e !== 'object') return null;
  const out = { v: 1, fecha: hoy };
  ['modalidad', 'sexo', 'pesas', 'ahora', 'actividad', 'trabajo', 'principal', 'dias', 'duracion'].forEach(k => {
    if (ENT_VALIDAS[k].indexOf(String(e[k])) >= 0) out[k] = String(e[k]);
  });
  ['actPrev', 'lugares', 'elementos', 'salud'].forEach(k => {
    if (!Array.isArray(e[k])) return;
    const v = e[k].map(String).filter((x, i, a) => ENT_VALIDAS[k].indexOf(x) >= 0 && a.indexOf(x) === i);
    if (v.length || k === 'salud') out[k] = v;
  });
  ['sueno', 'estres'].forEach(k => { const n = parseInt(e[k], 10); if (n >= 1 && n <= 5) out[k] = n; });
  out.apto = e.apto === true;
  return out;
}

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
      // [26/11] Entrevista ampliada: validada y guardada como JSON en la columna X
      if (cuerpo && cuerpo.datos && cuerpo.datos.entrevista) {
        const ent = limpiarEntrevista_(cuerpo.datos.entrevista, hoy);
        if (ent) hoja.getRange(fila, COL_PERFIL.entrevista).setNumberFormat('@').setValue(JSON.stringify(ent));
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

// ── [24/11] Fuerza y Mapeo del alumno, SOLO PARA LEER ─────────────────────
// El alumno no tiene permiso de Google sobre las planillas; este proxy corre con
// la cuenta de Luca y las lee por él. Reglas:
//   - Solo la planilla de SU fila: Q (carpetaDrive) para Fuerza, U (mapeoUrl) para Mapeo.
//   - Solo UNA pestaña: la del #gid del link. Sin #gid: en Fuerza la primera que no
//     se llame "Notas"; en Mapeo, solo si el archivo tiene una única pestaña (un
//     Mapeo con una pestaña por alumno nunca expone las de los demás).
//   - Solo valores (lo que se ve en la celda), nunca fórmulas. No escribe nada.
//   - Alumnos "inactivo": no.
function planPortal_(token, tipo) {
  try {
    if (tipo !== 'fuerza' && tipo !== 'mapeo') return _jsonOut({ error: 'tipo' });
    const cache = CacheService.getScriptCache();
    const cacheKey = 'plan_' + tipo + '_' + token;
    const cached = cache.get(cacheKey);
    if (cached) return ContentService.createTextOutput(cached).setMimeType(ContentService.MimeType.JSON);

    const ss = SpreadsheetApp.openById(SHEET_ID_PORTAL);
    const alumnosData = ss.getSheetByName('Alumnos').getDataRange().getValues();
    let fila = null;
    for (let i = 1; i < alumnosData.length; i++) {
      if (alumnosData[i][18] && String(alumnosData[i][18]) === token) { fila = alumnosData[i]; break; }
    }
    if (!fila) return _jsonOut({ error: 'not_found' });
    if (String(fila[8]).trim() === 'inactivo') return _jsonOut({ error: 'not_found' });

    const url = String((tipo === 'fuerza' ? fila[16] : fila[20]) || '').trim();
    const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]{20,})/);
    if (!m) return _jsonOut({ error: 'sin_planilla' });
    const g = url.match(/[#?&]gid=(\d+)/);
    const gid = g ? g[1] : null;

    let plan;
    try { plan = SpreadsheetApp.openById(m[1]); } catch (err) { return _jsonOut({ error: 'acceso' }); }
    const hojas = plan.getSheets().filter(h => !h.isSheetHidden());
    const norm = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const leer = (h, maxF, maxC) => {
      const nf = Math.min(h.getLastRow(), maxF), nc = Math.min(h.getLastColumn(), maxC);
      if (nf < 1 || nc < 1) return [];
      return h.getRange(1, 1, nf, nc).getDisplayValues();
    };

    let res;
    if (tipo === 'fuerza') {
      const h = (gid != null && hojas.find(x => String(x.getSheetId()) === gid && norm(x.getName()) !== 'notas'))
        || hojas.find(x => norm(x.getName()) !== 'notas');
      if (!h) return _jsonOut({ error: 'formato' });
      res = { hoja: h.getName(), filas: leer(h, 120, 22) };
      // Ejercicios que el entrenador marcó como listos (pestaña Listos, fila de este alumno)
      res.listos = null;
      const ls = ss.getSheetByName('Listos');
      if (ls) {
        const v = ls.getDataRange().getValues();
        for (let i = 1; i < v.length; i++) {
          if (String(v[i][0]) === String(fila[0])) {
            let marcas = {}; try { marcas = JSON.parse(v[i][2] || '{}') || {}; } catch (e) {}
            res.listos = { ciclo: String(v[i][1] || ''), marcas: marcas };
            break;
          }
        }
      }
    } else {
      const h = gid != null ? hojas.find(x => String(x.getSheetId()) === gid) : (hojas.length === 1 ? hojas[0] : null);
      if (!h) return _jsonOut({ error: 'pestana' });
      res = { tabs: [{ id: String(h.getSheetId()), title: h.getName(), filas: leer(h, 400, 26) }] };
    }

    const str = JSON.stringify(res);
    if (str.length < 95000) { try { cache.put(cacheKey, str, CACHE_TTL_SEGUNDOS); } catch (e) {} }
    return ContentService.createTextOutput(str).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    Logger.log(err);
    return _jsonOut({ error: 'server_error' });
  }
}

// ── [26/11] "Terminé el día" desde el portal (solo alumnos online) ─────────
// Reglas: token válido · alumno no inactivo · modalidad (columna W) = online · el "Mes N",
// el día y la semana tienen que existir en SU planilla de Fuerza y la semana tiene que estar
// cargada (no se puede marcar una semana futura). Escribe solo en Asistencias:
//   - si ya hay una asistencia de hoy sin día del plan (p. ej. la marcó Luca) → le suma el día (D) y E='portal-dia'
//   - si no → agrega [id, hoy, asistencia|dia, "Mes N · Día d · Semana s", 'portal']
// Deshacer: solo filas de ese alumno, de HOY, con E 'portal'/'portal-dia' (nunca lo que marcó Luca).
function _hojaFuerza_(fila) {
  const url = String(fila[16] || '').trim();
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]{20,})/);
  if (!m) return null;
  const g = url.match(/[#?&]gid=(\d+)/), gid = g ? g[1] : null;
  const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const hojas = SpreadsheetApp.openById(m[1]).getSheets().filter(h => !h.isSheetHidden());
  return (gid != null && hojas.find(x => String(x.getSheetId()) === gid && norm(x.getName()) !== 'notas'))
    || hojas.find(x => norm(x.getName()) !== 'notas') || null;
}
function terminarDia_(cuerpo) {
  try {
    const token = String((cuerpo && cuerpo.token) || '').trim();
    if (token.length < 20 || token.length > 100) return _jsonOut({ ok: false, error: 'token' });
    const dia = parseInt(cuerpo.dia, 10), sem = parseInt(cuerpo.sem, 10);
    const mesN = (String(cuerpo.mes || '').match(/^\s*mes\s*(\d{1,3})\s*$/i) || [])[1];
    if (!(dia >= 1 && dia <= 7) || !(sem >= 1 && sem <= 12) || !mesN) return _jsonOut({ ok: false, error: 'datos' });
    const det = 'Mes ' + (+mesN) + ' · Día ' + dia + ' · Semana ' + sem;

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const ss = SpreadsheetApp.openById(SHEET_ID_PORTAL);
      const al = ss.getSheetByName('Alumnos').getDataRange().getValues();
      let fila = null;
      for (let i = 1; i < al.length; i++) { if (al[i][18] && String(al[i][18]) === token) { fila = al[i]; break; } }
      if (!fila) return _jsonOut({ ok: false, error: 'not_found' });
      if (String(fila[8]).trim() === 'inactivo') return _jsonOut({ ok: false, error: 'not_found' });
      if (!/online/i.test(String(fila[22] || ''))) return _jsonOut({ ok: false, error: 'no_online' });
      const id = String(fila[0]);
      const hoy = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy');
      const as = ss.getSheetByName('Asistencias');
      const v = as.getDataRange().getDisplayValues();

      if (cuerpo.accion === 'deshacerDia') {
        for (let i = v.length - 1; i >= 1; i--) {
          const r = v[i];
          if (String(r[0]) === id && r[3] === det && r[1] === hoy && /^portal/.test(String(r[4] || ''))) {
            if (r[4] === 'portal') as.getRange(i + 1, 1, 1, 5).clearContent();
            else as.getRange(i + 1, 4, 1, 2).clearContent();   // 'portal-dia': la asistencia era de Luca, queda
            try { CacheService.getScriptCache().remove('portal_' + token); } catch (e) {}
            return _jsonOut({ ok: true });
          }
        }
        return _jsonOut({ ok: false, error: 'no_encontrado' });
      }

      // Validar contra SU planilla de Fuerza: mismo Mes, el día existe, la semana está cargada
      const h = _hojaFuerza_(fila);
      if (!h) return _jsonOut({ ok: false, error: 'sin_planilla' });
      const nf = Math.min(h.getLastRow(), 120), nc = Math.min(h.getLastColumn(), 40);
      const g = h.getRange(1, 1, nf, nc).getDisplayValues();
      const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
      const mesPl = (String(g[0][0]).match(/(\d+)/) || [])[1];
      if (!/^mes/.test(norm(g[0][0])) || +mesPl !== +mesN) return _jsonOut({ ok: false, error: 'plan' });
      let nDias = 0, activa = 0, bloque = '';
      const semanas = [];
      for (let c = 4; c < g[0].length; c++) { const mm = norm(g[0][c]).match(/^semana (\d+)$/); if (mm) semanas.push({ n: +mm[1], col: c }); }
      for (let r = 1; r < g.length; r++) {
        if (norm(g[r][1]) === 'ejercicios' && /^dia \d+$/.test(norm(g[r][0]))) { nDias++; bloque = ''; continue; }
        if (g[r][1]) bloque = norm(g[r][1]);
        if (!g[r][3] || /activacion|movilidad/.test(bloque)) continue;
        semanas.forEach(s => { if (String(g[r][s.col] || '').trim() && s.n > activa) activa = s.n; });
      }
      if (dia > nDias || !semanas.some(s => s.n === sem) || sem > activa) return _jsonOut({ ok: false, error: 'semana' });

      for (let i = 1; i < v.length; i++) { if (String(v[i][0]) === id && v[i][3] === det) return _jsonOut({ ok: true, ya: true }); }
      let k = -1, asistioHoy = false;
      for (let i = 1; i < v.length; i++) {
        const r = v[i];
        if (String(r[0]) !== id || r[1] !== hoy || (r[2] && r[2] !== 'asistencia')) continue;
        asistioHoy = true;
        if (!r[3]) { k = i; break; }
      }
      if (k >= 0) {
        as.getRange(k + 1, 4, 1, 2).setNumberFormat('@').setValues([[det, 'portal-dia']]);
      } else {
        const n = as.getLastRow() + 1;
        as.getRange(n, 1, 1, 5).setNumberFormat('@').setValues([[id, hoy, asistioHoy ? 'dia' : 'asistencia', det, 'portal']]);
      }
      try { CacheService.getScriptCache().remove('portal_' + token); } catch (e) {}
      return _jsonOut({ ok: true, fecha: hoy, det: det, tipo: k >= 0 ? 'asistencia' : (asistioHoy ? 'dia' : 'asistencia'), origen: k >= 0 ? 'portal-dia' : 'portal' });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    Logger.log(err);
    return _jsonOut({ ok: false, error: 'server_error' });
  }
}

// ── [27/11] Nutrición del alumno (planilla de la columna R) ─────────────────
// Formato (el de "Template - Nutri"): una pestaña Track con títulos en una de las primeras
// 5 filas (Fecha · Etapa del día · Comida · Kcal · Proteína · Carbohidratos · Grasas · Fibra ·
// Alcohol, en cualquier orden: las columnas se reconocen POR EL TÍTULO, nunca por la posición,
// así un macro no puede caer en la columna de otro) y una pestaña Datos con los objetivos.
// La fecha va en la primera fila de cada día; las filas siguientes son de ese mismo día.
// Mismas reglas que index.html (nutriParse): si se cambia una, cambiar la otra.
const _nNorm_ = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const NUTRI_COLS_ = { fecha: /^fecha/, etapa: /^etapa|^momento/, comida: /^comidas?$/, kcal: /^kcal|^calorias/, prot: /^proteina/, carb: /^carbohidrato/, grasa: /^grasa/, fibra: /^fibra/, alcohol: /^alcohol/ };
function _nutriCols_(filas) {
  for (let r = 0; r < Math.min(filas.length, 5); r++) {
    const cols = {};
    filas[r].forEach((v, c) => { const t = _nNorm_(v); Object.keys(NUTRI_COLS_).forEach(k => { if (cols[k] == null && NUTRI_COLS_[k].test(t)) cols[k] = c; }); });
    if (['fecha', 'etapa', 'comida', 'kcal', 'prot', 'carb', 'grasa'].every(k => cols[k] != null)) { cols.fila = r; return cols; }
  }
  return null;
}
// '25/11/2026', '25/11/26', '25-11' (sin año: el año actual) → 'dd/mm/aaaa'
function _nutriFecha_(v) {
  const m = String(v || '').trim().match(/^(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?$/);
  if (!m) return '';
  let a = m[3] ? +m[3] : new Date().getFullYear(); if (a < 100) a += 2000;
  const d = +m[1], mes = +m[2];
  if (d < 1 || d > 31 || mes < 1 || mes > 12) return '';
  return ('0' + d).slice(-2) + '/' + ('0' + mes).slice(-2) + '/' + a;
}
const _nutriNum_ = f => { const p = f.split('/'); return +(p[2] + p[1] + p[0]); };
// "1.691" (miles) · "4,6" · "35" → número; vacío o texto → null (igual que _nutriValor de index.html)
function _nutriValor_(v) {
  let s = String(v == null ? '' : v).trim().replace(/\s/g, '');
  if (!s) return null;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '');
  const n = parseFloat(s.replace(',', '.'));
  return isFinite(n) ? n : null;
}
const NUTRI_MAC_ = ['kcal', 'prot', 'carb', 'grasa', 'fibra'];
const _esFavHoja_ = h => _nNorm_(h.getName()) === 'favoritas';
// Pestañas de la planilla de Nutri del alumno: { ss, track:{hoja, filas, cols}, datos:filas|null, favs:hoja|null } o { error }
function _nutriHojas_(fila) {
  const url = String(fila[17] || '').trim();
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]{20,})/);
  if (!m) return { error: 'sin_planilla' };
  const g = url.match(/[#?&]gid=(\d+)/), gid = g ? g[1] : null;
  let ss;
  try { ss = SpreadsheetApp.openById(m[1]); } catch (err) { return { error: 'acceso' }; }
  const tracks = [], datos = [];
  let favs = null;
  ss.getSheets().filter(h => !h.isSheetHidden()).slice(0, 15).forEach(h => {
    if (_esFavHoja_(h)) { favs = h; return; }   // [favoritas] nunca es el Track (también tiene Comida/Kcal…)
    const nf = Math.min(h.getLastRow(), 200), nc = Math.min(h.getLastColumn(), 14);
    if (nf < 1 || nc < 1) return;
    const filas = h.getRange(1, 1, nf, nc).getDisplayValues();
    const cols = _nutriCols_(filas);
    if (cols) tracks.push({ hoja: h, filas: filas, cols: cols });
    else if (filas.slice(0, 10).some(f => f.some(v => /optim/.test(_nNorm_(v))))) datos.push(filas);
  });
  // Nunca adivinar entre varias pestañas: podrían ser de otros alumnos
  const track = (gid != null && tracks.find(t => String(t.hoja.getSheetId()) === gid)) || (tracks.length === 1 ? tracks[0] : null);
  if (!track) return { error: tracks.length ? 'pestana' : 'formato' };
  return { ss: ss, track: track, datos: datos.length === 1 ? datos[0] : null, favs: favs };
}
function _alumnoPorToken_(ss, token) {
  const al = ss.getSheetByName('Alumnos').getDataRange().getValues();
  for (let i = 1; i < al.length; i++) { if (al[i][18] && String(al[i][18]) === token) return al[i]; }
  return null;
}
// ── [favoritas] Pestaña "Favoritas" de la planilla de Nutri: Comida · Etapas (Desayuno|Merienda) ·
// Kcal · Proteína · Carbohidratos · Grasas · Fibra · Fecha. Solo salen de comidas que Luca revisó.
const FAV_TITULOS_ = ['Comida', 'Etapas', 'Kcal', 'Proteína', 'Carbohidratos', 'Grasas', 'Fibra', 'Fecha'];
function _favFilas_(h) {
  if (!h) return [];
  const nf = Math.min(h.getLastRow(), 201);
  return nf < 1 ? [] : h.getRange(1, 1, nf, 8).getDisplayValues();
}
function _favItems_(filas) {
  return filas.slice(1).map((f, i) => {
    const it = { fila: i + 2, nombre: String(f[0] || '').trim(), etapas: String(f[1] || '').split('|').map(s => s.trim()).filter(Boolean) };
    NUTRI_MAC_.forEach((k, j) => { it[k] = _nutriValor_(f[2 + j]); });
    return it;
  }).filter(it => it.nombre && it.kcal != null);
}
function _favHoja_(n) {
  if (n.favs) return n.favs;
  const h = n.ss.insertSheet('Favoritas');
  h.getRange(1, 1, 1, 8).setValues([FAV_TITULOS_]).setFontWeight('bold');
  n.favs = h;
  return h;
}
// Fila del Track de esa fecha + etapa (índice en t.filas) o -1
function _nutriFila_(t, fecha, etapa) {
  const c = t.cols;
  let actual = '';
  for (let i = c.fila + 1; i < t.filas.length; i++) {
    const f = _nutriFecha_(t.filas[i][c.fecha]);
    if (f) actual = f;
    if (actual === fecha && _nNorm_(t.filas[i][c.etapa]) === etapa) return i;
  }
  return -1;
}

// Lectura (solo valores visibles, solo Track, Datos y Favoritas). Caché corta: Luca carga macros desde la app
// y el alumno tiene que verlos pronto.
function nutriPortal_(token) {
  try {
    const cache = CacheService.getScriptCache(), cacheKey = 'nutri_' + token;
    const cached = cache.get(cacheKey);
    if (cached) return ContentService.createTextOutput(cached).setMimeType(ContentService.MimeType.JSON);
    const fila = _alumnoPorToken_(SpreadsheetApp.openById(SHEET_ID_PORTAL), token);
    if (!fila || String(fila[8]).trim() === 'inactivo') return _jsonOut({ error: 'not_found' });
    const n = _nutriHojas_(fila);
    if (n.error) return _jsonOut({ error: n.error });
    const res = { track: { hoja: n.track.hoja.getName(), filas: n.track.filas }, datos: n.datos, favoritas: _favFilas_(n.favs), hoy: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy') };
    const str = JSON.stringify(res);
    if (str.length < 95000) { try { cache.put(cacheKey, str, 60); } catch (e) {} }
    return ContentService.createTextOutput(str).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    Logger.log(err);
    return _jsonOut({ error: 'server_error' });
  }
}

// Escrituras de Nutrición: valida token, alumno activo y su planilla; corre con lock; limpia la caché.
function _nutriEscribir_(cuerpo, hacer) {
  try {
    const token = String((cuerpo && cuerpo.token) || '').trim();
    if (token.length < 20 || token.length > 100) return _jsonOut({ ok: false, error: 'token' });
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    let res;
    try {
      const fila = _alumnoPorToken_(SpreadsheetApp.openById(SHEET_ID_PORTAL), token);
      if (!fila || String(fila[8]).trim() === 'inactivo') return _jsonOut({ ok: false, error: 'not_found' });
      const n = _nutriHojas_(fila);
      if (n.error) return _jsonOut({ ok: false, error: n.error });
      res = hacer(n);
    } finally {
      lock.releaseLock();
    }
    try { CacheService.getScriptCache().remove('nutri_' + token); } catch (e) {}
    return _jsonOut(res);
  } catch (err) {
    Logger.log(err);
    return _jsonOut({ ok: false, error: 'server_error' });
  }
}

// { accion:'comida', token, fecha:'dd/mm/aaaa', etapa:'Almuerzo', texto, alcohol:true|false, favoritas:['nombre', …] }
// Solo la fila de esa fecha + etapa en SU Track; la fecha no puede ser futura. Se puede escribir si la comida
// no tiene kcal o si la cargó el alumno con favoritas ("⭐ …", todavía sin revisar por Luca); si Luca ya la
// revisó, no se toca (error 'revisada').
//   · Sin favoritas: Comida = texto (sin ⭐) y, si tenía macros de favoritas, se borran (queda para Luca).
//   · Con favoritas, sin texto: Comida = "⭐ A + B" y los macros = la suma de esas favoritas (los calcula
//     ESTE proxy desde la pestaña Favoritas: el alumno nunca manda números) → queda completa.
//   · Con favoritas y texto: Comida = "⭐ A + B (N kcal) + texto", sin macros → queda para Luca.
function guardarComida_(cuerpo) {
  const fecha = _nutriFecha_(cuerpo && cuerpo.fecha), etapa = _nNorm_(cuerpo && cuerpo.etapa);
  if (!fecha || !etapa || etapa.length > 30) return _jsonOut({ ok: false, error: 'datos' });
  const texto = String(cuerpo.texto == null ? '' : cuerpo.texto).replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/^⭐\s*/, '').slice(0, 300);
  const pedidas = Array.isArray(cuerpo.favoritas) ? cuerpo.favoritas.slice(0, 10).map(x => String(x).slice(0, 300)) : [];
  const hoy = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy');
  if (_nutriNum_(fecha) > _nutriNum_(hoy)) return _jsonOut({ ok: false, error: 'futuro' });
  return _nutriEscribir_(cuerpo, n => {
    const t = n.track, c = t.cols, r = _nutriFila_(t, fecha, etapa);
    if (r < 0) return { ok: false, error: 'sin_fila' };
    const conEstrella = /^⭐/.test(String(t.filas[r][c.comida] || '').trim());
    if (String(t.filas[r][c.kcal] || '').trim() && !conEstrella) return { ok: false, error: 'revisada' };
    let comida = texto, macros = null;
    if (pedidas.length) {
      const lista = _favItems_(_favFilas_(n.favs));
      const elegidas = pedidas.map(x => lista.find(f => _nNorm_(f.nombre) === _nNorm_(x)));
      if (elegidas.some(x => !x)) return { ok: false, error: 'favoritas' };
      const suma = {};
      NUTRI_MAC_.forEach(k => { suma[k] = elegidas.every(f => f[k] == null) ? null : Math.round(elegidas.reduce((s, f) => s + (f[k] || 0), 0) * 10) / 10; });
      const base = '⭐ ' + elegidas.map(f => f.nombre).join(' + ');
      const extra = texto.replace(/^\+\s*/, '').trim();
      if (extra) comida = base + ' (' + Math.round(suma.kcal) + ' kcal) + ' + extra;
      else { comida = base; macros = suma; }
    }
    // Como texto ('@'): algo que empiece con "=" queda escrito tal cual, nunca como fórmula
    t.hoja.getRange(r + 1, c.comida + 1).setNumberFormat('@').setValue(comida.slice(0, 700));
    if (macros || conEstrella) NUTRI_MAC_.forEach(k => { if (c[k] != null) t.hoja.getRange(r + 1, c[k] + 1).setValue(macros && macros[k] != null ? macros[k] : ''); });
    if (c.alcohol != null && typeof cuerpo.alcohol === 'boolean') t.hoja.getRange(r + 1, c.alcohol + 1).setValue(cuerpo.alcohol);
    return { ok: true, comida: comida, macros: macros };
  });
}

// { accion:'favorita', token, fecha, etapa } — marca/desmarca como favorita UNA comida revisada por Luca
// (con kcal y sin ⭐): nombre y macros salen de la planilla, nunca del alumno. Si ya es favorita de esa
// etapa, la desmarca; si es favorita de otra etapa, le suma esta.
function favorita_(cuerpo) {
  const fecha = _nutriFecha_(cuerpo && cuerpo.fecha), etapa = _nNorm_(cuerpo && cuerpo.etapa);
  if (!fecha || !etapa || etapa.length > 30) return _jsonOut({ ok: false, error: 'datos' });
  return _nutriEscribir_(cuerpo, n => {
    const t = n.track, c = t.cols, r = _nutriFila_(t, fecha, etapa);
    if (r < 0) return { ok: false, error: 'sin_fila' };
    const nombre = String(t.filas[r][c.comida] || '').trim().slice(0, 300);
    if (!nombre || /^⭐/.test(nombre) || _nutriValor_(t.filas[r][c.kcal]) == null) return { ok: false, error: 'sin_revisar' };
    const etapaTxt = String(t.filas[r][c.etapa]).trim();
    const h = _favHoja_(n), items = _favItems_(_favFilas_(h));
    const ya = items.find(f => _nNorm_(f.nombre) === _nNorm_(nombre));
    const macros = NUTRI_MAC_.map(k => { const v = c[k] != null ? _nutriValor_(t.filas[r][c[k]]) : null; return v == null ? '' : v; });
    if (ya) {
      const tiene = ya.etapas.some(e => _nNorm_(e) === etapa);
      const etapas = tiene ? ya.etapas.filter(e => _nNorm_(e) !== etapa) : ya.etapas.concat([etapaTxt]);
      if (!etapas.length) { h.deleteRow(ya.fila); return { ok: true, favorita: false }; }
      h.getRange(ya.fila, 2).setNumberFormat('@').setValue(etapas.join('|'));
      if (!tiene) h.getRange(ya.fila, 3, 1, 5).setValues([macros]);
      return { ok: true, favorita: !tiene };
    }
    if (items.length >= 150) return { ok: false, error: 'muchas' };
    const nf = h.getLastRow() + 1;
    h.getRange(nf, 1, 1, 2).setNumberFormat('@').setValues([[nombre, etapaTxt]]);
    h.getRange(nf, 3, 1, 5).setValues([macros]);
    h.getRange(nf, 8).setNumberFormat('@').setValue(Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy'));
    return { ok: true, favorita: true };
  });
}

// { accion:'quitarFavorita', token, nombre, etapa } — la saca de esa etapa (si no le queda ninguna, borra la fila)
function quitarFavorita_(cuerpo) {
  const nombre = _nNorm_(cuerpo && cuerpo.nombre), etapa = _nNorm_(cuerpo && cuerpo.etapa);
  if (!nombre || !etapa || etapa.length > 30) return _jsonOut({ ok: false, error: 'datos' });
  return _nutriEscribir_(cuerpo, n => {
    if (!n.favs) return { ok: false, error: 'no_encontrada' };
    const ya = _favItems_(_favFilas_(n.favs)).find(f => _nNorm_(f.nombre) === nombre);
    if (!ya || !ya.etapas.some(e => _nNorm_(e) === etapa)) return { ok: false, error: 'no_encontrada' };
    const etapas = ya.etapas.filter(e => _nNorm_(e) !== etapa);
    if (etapas.length) n.favs.getRange(ya.fila, 2).setNumberFormat('@').setValue(etapas.join('|'));
    else n.favs.deleteRow(ya.fila);
    return { ok: true };
  });
}
