/**
 * Mente Consciente — Entrevista inicial del alumno (acción "perfil" del proxy del portal)
 *
 * QUÉ HACE
 *   El alumno, desde su portal, completa (o edita) su fecha de nacimiento, altura,
 *   peso, objetivo principal y molestias. Esta función guarda SOLO esos campos y
 *   SOLO en la fila del alumno dueño del token. No lee ni devuelve datos de nadie.
 *
 * CÓMO INSTALARLO (una sola vez, ~5 minutos)
 *   1. Abrí la planilla de Mente Consciente → Extensiones → Apps Script
 *      (el mismo proyecto donde está el proxy del portal: doGet / doPost).
 *   2. Archivo nuevo (+ → Secuencia de comandos), llamalo "portal-perfil",
 *      y pegá TODO este archivo.
 *   3. En el archivo donde está la función doPost(e), agregá estas 3 líneas
 *      como PRIMERAS líneas dentro de doPost, antes de todo lo demás:
 *
 *        var cuerpoPerfil = {};
 *        try { cuerpoPerfil = JSON.parse(e.postData.contents); } catch (err) {}
 *        if (cuerpoPerfil.accion === 'perfil') return guardarPerfilAlumno_(cuerpoPerfil);
 *
 *      (No cambia nada del login con Google: si la acción no es "perfil", doPost
 *      sigue exactamente igual que hoy.)
 *   4. Implementar → Administrar implementaciones → editar (lápiz) la implementación
 *      actual → Versión: "Nueva versión" → Implementar. Es importante editar la
 *      existente para que la URL del portal NO cambie.
 *   5. Avisarle a Claude: con eso se activa la entrevista en la app
 *      (PORTAL_PERFIL_EDITABLE = true en index.html).
 *
 * SEGURIDAD (para revisar en el chat de Auditoría antes de publicar)
 *   - doGet sigue siendo solo lectura; esta es la única escritura del portal.
 *   - El token es el mismo del link/portal (crypto.randomUUID, 122 bits).
 *   - Se escribe únicamente en: K fechaNac, L estatura, M pesoInicial (solo si estaba
 *     vacío), N pesoActual, G objetivos (1 ítem con origen "entrevista") y H molestias
 *     (1 ítem con origen "entrevista"). Nunca en monto, estado, horario, token, email, etc.
 *   - Valores validados y recortados; alumnos "inactivo" no pueden escribir.
 *   - LockService evita que dos guardados simultáneos se pisen.
 */

var PERFIL_SHEET_ID = '1mHE-llV4vVZqwS-_mKjOmse_sOGJJaeO81jT6wOsUSY';
var PERFIL_HOJA = 'Alumnos';
// Columnas (1 = A) de la hoja Alumnos
var COL = { objetivos: 7, notas: 8, estado: 9, fechaNac: 11, estatura: 12, pesoInicial: 13, pesoActual: 14, token: 19 };

function guardarPerfilAlumno_(cuerpo) {
  var responder = function (obj) {
    return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
  };
  try {
    var token = String((cuerpo && cuerpo.token) || '').trim();
    var datos = (cuerpo && cuerpo.datos) || {};
    if (token.length < 20 || token.length > 100) return responder({ ok: false, error: 'token' });

    var lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      var hoja = SpreadsheetApp.openById(PERFIL_SHEET_ID).getSheetByName(PERFIL_HOJA);
      var ultima = hoja.getLastRow();
      if (ultima < 2) return responder({ ok: false, error: 'not_found' });
      var tokens = hoja.getRange(2, COL.token, ultima - 1, 1).getValues();
      var fila = -1;
      for (var i = 0; i < tokens.length; i++) {
        if (String(tokens[i][0]).trim() === token) { fila = i + 2; break; }
      }
      if (fila === -1) return responder({ ok: false, error: 'not_found' });

      var actual = hoja.getRange(fila, 1, 1, 22).getValues()[0];
      if (String(actual[COL.estado - 1]).trim() === 'inactivo') return responder({ ok: false, error: 'inactivo' });

      // ── Datos simples (validados) ──
      if (datos.fechaNac !== undefined) {
        var f = String(datos.fechaNac).trim();
        var m = f.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        var anio = new Date().getFullYear();
        if (m && +m[1] >= 1 && +m[1] <= 31 && +m[2] >= 1 && +m[2] <= 12 && +m[3] > anio - 100 && +m[3] <= anio - 8) {
          hoja.getRange(fila, COL.fechaNac).setNumberFormat('@').setValue(('0' + m[1]).slice(-2) + '/' + ('0' + m[2]).slice(-2) + '/' + m[3]);
        }
      }
      if (datos.estatura !== undefined) {
        var h = parseFloat(String(datos.estatura).replace(',', '.'));
        if (h >= 100 && h <= 230) hoja.getRange(fila, COL.estatura).setValue(String(Math.round(h)));
      }
      if (datos.pesoActual !== undefined) {
        var p = parseFloat(String(datos.pesoActual).replace(',', '.'));
        if (p >= 30 && p <= 250) {
          var pTxt = String(Math.round(p * 10) / 10);
          hoja.getRange(fila, COL.pesoActual).setValue(pTxt);
          if (!String(actual[COL.pesoInicial - 1]).trim()) hoja.getRange(fila, COL.pesoInicial).setValue(pTxt);
        }
      }

      // ── Objetivo y molestia: un ítem "de la entrevista" que se reemplaza al editar ──
      var hoy = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
      var recortar = function (s, n) { return String(s || '').replace(/[\r\n]+/g, ' ').trim().slice(0, n); };
      var ponerItem = function (col, item) {
        var lineas = String(actual[col - 1] || '').split('\n').filter(function (l) { return l.trim(); });
        var otras = lineas.filter(function (l) {
          try { var o = JSON.parse(l); return !(o && o.origen === 'entrevista'); } catch (e) { return true; }
        });
        otras.push(JSON.stringify(item));
        hoja.getRange(fila, col).setValue(otras.join('\n'));
      };
      if (datos.objetivo && datos.objetivo.texto) {
        ponerItem(COL.objetivos, { texto: recortar(datos.objetivo.texto, 140), categoria: recortar(datos.objetivo.categoria, 40), estado: 'activo', fecha: hoy, origen: 'entrevista' });
      }
      if (datos.molestia && datos.molestia.texto) {
        ponerItem(COL.notas, { texto: recortar(datos.molestia.texto, 140), zona: recortar(datos.molestia.zona, 30), estado: 'activa', fecha: hoy, origen: 'entrevista' });
      }
    } finally {
      lock.releaseLock();
    }
    return responder({ ok: true });
  } catch (err) {
    Logger.log(err);
    return responder({ ok: false, error: 'interno' });
  }
}
