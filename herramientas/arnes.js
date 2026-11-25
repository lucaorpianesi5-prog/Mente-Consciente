// ═══ Arnés de pruebas de Mente Consciente (Playwright, sin servidor) ═══
// No hay tests automáticos ni login real posible desde el entorno de Claude:
// se abre index.html por file:// y se simulan Google Sheets y el proxy del portal.
//
//   node herramientas/arnes.js            → chequea sintaxis y abre las pantallas
//                                            principales con datos de prueba
//   const A = require('./herramientas/arnes.js')   → usar los helpers en otro script
//
// Requiere Playwright (en el entorno de Claude ya está instalado: require('playwright')).
const path = require('path');
const fs = require('fs');
const RAIZ = path.resolve(__dirname, '..');
const URL_APP = 'file://' + path.join(RAIZ, 'index.html');

// 1) Sintaxis: extrae los <script> inline de index.html y los pasa por `node --check`
function chequearSintaxis() {
  const { execFileSync } = require('child_process');
  const os = require('os');
  const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
  const js = [...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n;\n');
  const tmp = path.join(os.tmpdir(), 'mc-scripts.js');
  fs.writeFileSync(tmp, js);
  execFileSync(process.execPath, ['--check', tmp]);
  const gs = path.join(RAIZ, 'apps-script', 'portal-proxy.gs');
  if (fs.existsSync(gs)) { const t2 = path.join(os.tmpdir(), 'mc-proxy.js'); fs.copyFileSync(gs, t2); execFileSync(process.execPath, ['--check', t2]); }
  return true;
}

// 2) Simula la API de Sheets. `planillas` = { 'ID_DE_PLANILLA': [ {id, title, filas:[[...strings]]} ] }
//    `valores` = { 'Rango!A2:B': [[...]] } para lecturas de values; las escrituras quedan en `escrituras`.
async function simularSheets(page, { planillas = {}, valores = {} } = {}) {
  const escrituras = [];
  const cel = t => ({ formattedValue: String(t), userEnteredValue: { stringValue: String(t) } });
  await page.route(/accounts\.google|gstatic/, r => r.abort());
  await page.route(/sheets\.googleapis\.com/, async r => {
    const u = decodeURIComponent(r.request().url()), m = r.request().method();
    const json = b => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
    if (m !== 'GET') { escrituras.push({ metodo: m, url: u, cuerpo: r.request().postData() }); return json({}); }
    const id = (u.match(/spreadsheets\/([^/?:]+)/) || [])[1];
    const tabs = planillas[id];
    if (tabs && u.includes('includeGridData')) return json({ sheets: tabs.map(t => ({ properties: { sheetId: t.id, title: t.title }, data: [{ rowData: t.filas.map(f => ({ values: f.map(cel) })) }] })) });
    if (tabs && u.includes('sheets.properties')) return json({ sheets: tabs.map(t => ({ properties: { sheetId: t.id, title: t.title } })) });
    const rango = Object.keys(valores).find(k => u.includes('/values/' + k.split('!')[0] + '!'));   // con el '!': 'Nutricion' no confunde a 'NutricionCobros'
    if (!rango) return json({ values: [] });
    // Como el Sheets real: si se pide una fila puntual ('Alumnos!A7:W7'), devolver solo esas filas
    const pedido = (u.split('/values/')[1] || '').split('?')[0].match(/![A-Z]+(\d+)(?::[A-Z]+(\d+))?/);
    const base = +((rango.match(/![A-Z]+(\d+)/) || [])[1] || 1);
    if (pedido && +pedido[1] > base) return json({ values: valores[rango].slice(+pedido[1] - base, pedido[2] ? +pedido[2] - base + 1 : undefined) });
    return json({ values: valores[rango] });
  });
  return escrituras;
}

// 3) Abre la app del entrenador ya "logueada", con datos en memoria
async function abrirEntrenador(page, datos = {}) {
  await page.goto(URL_APP);
  await page.waitForTimeout(300);
  await page.evaluate(d => {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    accessToken = 'x'; tokenExp = Date.now() + 3600e3; datosFrescos = true;
    alumnos = (d.alumnos || []).map(a => ({ dias: [], horario: '', frecuencia: '2', monto: '0', estado: 'activo', objetivos: '', notas: '', ...a }));
    _alumnoBaseTomar();
    cobros = d.cobros || {}; asistencias = d.asistencias || []; gastos = d.gastos || [];
    clientesNutri = d.clientesNutri || []; cobrosNutri = d.cobrosNutri || {};
    miPerfil = d.miPerfil || { nombre: 'Luca' };
    try { initFinAnios(); initMeses(); initNutriMeses(); } catch (e) {}
    _renderPaginaActual();
  }, datos);
}

// 4) Abre el portal de un alumno con el proxy simulado. `respuesta` = lo que devuelve doGet
//    (alumno, asistencias, pagos, frases, perfilEditable, planPortal); `planes` = {fuerza:{...}, mapeo:{...}}
async function abrirPortal(page, respuesta, planes = {}) {
  const posts = [];
  await page.route(/accounts\.google|gstatic|googleapis/, r => r.abort());
  await page.route(/script\.google\.com/, r => {
    const u = r.request().url();
    const json = b => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
    if (r.request().method() === 'POST') { posts.push(r.request().postData()); return json({ ok: true }); }
    if (u.includes('plan=fuerza')) return json(planes.fuerza || { error: 'sin_planilla' });
    if (u.includes('plan=mapeo')) return json(planes.mapeo || { error: 'sin_planilla' });
    return json(respuesta);
  });
  await page.goto(URL_APP);
  await page.waitForTimeout(300);
  await page.evaluate(() => { localStorage.clear(); _modoPortalCSS(); cargarPortalAlumno('tok-prueba-1234567890abcdef'); });
  await page.waitForTimeout(1000);
  return posts;
}

module.exports = { RAIZ, URL_APP, chequearSintaxis, simularSheets, abrirEntrenador, abrirPortal };

// ── Uso directo: chequeo rápido de humo ──
if (require.main === module) {
  (async () => {
    chequearSintaxis(); console.log('✓ Sintaxis OK (index.html y apps-script/portal-proxy.gs)');
    const { chromium } = require('playwright');
    const b = await chromium.launch();
    const page = await b.newPage({ viewport: { width: 390, height: 844 } });
    const errores = []; page.on('pageerror', e => errores.push(e.message));
    await simularSheets(page);
    await abrirEntrenador(page, { alumnos: [{ id: 'a1', nombre: 'Alumna Prueba', dias: ['Lunes'], horario: 'Lunes:18:00', diaPago: '5' }] });
    for (const p of ['dashboard', 'agenda', 'alumnos', 'nutricion', 'cobros', 'finanzas', 'yo']) {
      await page.evaluate(p => showPage(p), p); await page.waitForTimeout(150);
    }
    await page.evaluate(() => verAlumno('a1')); await page.waitForTimeout(150);
    await b.close();
    if (errores.length) { console.log('✗ Errores de JS:', errores); process.exit(1); }
    console.log('✓ Pantallas del entrenador sin errores de JS');
  })().catch(e => { console.error(e); process.exit(1); });
}
