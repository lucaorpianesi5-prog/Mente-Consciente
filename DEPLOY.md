# DEPLOY — Mente Consciente

Guía para publicar la app en un host gratuito con URL propia y validar los
cambios de performance de esta rama. Es una **propuesta** (fork de Santiago);
nada acá cambia la producción de Luca hasta que se haga un PR y él lo aplique.

---

## 1. Qué cambió en esta rama (performance)

| Cambio | Antes | Después |
|---|---|---|
| `Logo_App.png` (redimensionado 1254→256px) | 990.6 KB | **61.9 KB** |
| `Referencia fondo.png` (archivo muerto, 0 refs) | 1.2 MB en el repo | **borrado** |
| Lecturas a Sheets por sync (`cargarDatos`) | 10 requests HTTP | **2** (`values:batchGet` + 1 unformatted) |
| Lecturas muertas (Biblioteca/Progresión, feature deshabilitada) | 2 requests | **0** |
| Resource hints (`preconnect`/`preload`) | ninguno | preconnect a Google + preload de la fuente |
| Cache headers | tope ~10 min (GitHub Pages) | `_headers`: assets 7d/1año, HTML siempre fresco |

Verificado local (server `serve.ps1`): el JS parsea sin errores, la pantalla de
login renderiza con el logo nuevo, y los assets se sirven 200 OK. **Falta
confirmar con login real** (corre post-OAuth) — ver §4.

Follow-up opcional pendiente: recomprimir `assets/fondo-perfil.webp` (49 KB →
~15-20 KB) — requiere `cwebp`/ImageMagick (no estaban instalados acá).

---

## 2. Deploy a un host gratuito (URL de subdominio)

Es 100% estático → cualquier host de estáticos sirve. Recomendado **Cloudflare
Pages** (Brotli + control de cache vía `_headers`, ya incluido). Netlify es
equivalente.

**Cloudflare Pages:**
1. dash.cloudflare.com → Workers & Pages → Create → Pages → Connect to Git.
2. Elegí el fork (`santidelacolina/Mente-Consciente`) y la rama.
3. Build settings: **framework preset = None**, build command = *(vacío)*,
   output directory = `/` (raíz). No hay build.
4. Deploy → queda en `https://<proyecto>.pages.dev` (ej. `mente-consciente.pages.dev`).
5. Cada push a la rama redeploya solo. El `_headers` de la raíz se aplica automático.

**Netlify:** New site from Git → mismo repo/rama → build command vacío, publish
dir = `.`. Queda en `https://<proyecto>.netlify.app`. Lee el mismo `_headers`.

---

## 3. ⚠️ OAuth: el login del entrenador necesita registrar la URL nueva

El login con Google (GSI) **solo funciona en orígenes autorizados** en el cliente
OAuth (Google Cloud Console → Credentials → OAuth 2.0 Client → *Authorized
JavaScript origins*). En una URL nueva, el login falla con `origin_mismatch`
hasta agregar ese origen. Es un cambio de 2 minutos, pero **lo tiene que hacer el
dueño del proyecto de Google** (Luca) sobre el cliente de producción.

- El **portal del alumno NO usa OAuth** (va por el proxy de Apps Script) → funciona
  en la URL nueva tal cual, siempre que `PORTAL_API_URL` apunte a un proxy vivo.
- Para probar el login vos mismo sin depender de Luca → usá tu propio proyecto (§4).

---

## 4. Entorno de prueba propio (end-to-end, sin tocar los datos de Luca)

Para demostrar el flujo completo (login + datos + calendar + portal) con datos
propios:

1. **Google Cloud**: proyecto nuevo → OAuth Client (tipo Web) con estos *Authorized
   JavaScript origins*: `https://<tu-proyecto>.pages.dev` y `http://127.0.0.1:8843`
   (para local). Habilitá **Google Sheets API** y **Google Calendar API**.
2. **Sheet propia**: copiá la estructura de tabs/columnas que espera la app
   (`Alumnos`, `Cobros`, `Seguimiento`, `Nutricion`, `NutricionCobros`, `Gastos`,
   `Ahorros`, `Asistencias` — ver los rangos en `RANGO`, `index.html` ~línea 1335).
   Anotá el nuevo `SHEET_ID`.
3. **Calendar propio** → su `CALENDAR_ID`.
4. **Proxy del portal**: la fuente del Apps Script (`portal-proxy.gs`) **no está en
   el repo** (vive en Apps Script). Pedísela a Luca, deployala como web app en tu
   cuenta y usá esa `PORTAL_API_URL`. (Si solo querés probar el panel del
   entrenador, este paso podés saltarlo.)
5. **Config**: cambiá las 5 constantes del bloque CONFIG (`index.html` ~línea 1323):
   `CLIENT_ID`, `SHEET_ID`, `CALENDAR_ID`, `PORTAL_API_URL`, y `ALLOWED_EMAILS`
   (tu mail). **Mantené estos edits solo en tu rama de prueba — no los incluyas en
   el PR a Luca** (pisarían su producción).
   - *(Opcional, para no editar a mano)*: externalizar el bloque a un `config.js`
     gitignored con `window.APP_CONFIG = {...}` y leerlo con fallback a los valores
     actuales. Queda como mejora aparte para no cambiar el modelo single-file sin
     que Luca lo decida.

---

## 5. Medición antes/después

Lighthouse (DevTools → Lighthouse → Mobile) sobre la pantalla de login, en la
versión vieja vs esta rama. Esperado: el payload inicial baja de **~1.07 MB a
~95 KB** (lo domina el logo). En DevTools → Network confirmá también que el sync
hace **2 requests `:batchGet`** en vez de 10 `values/...`.

---

## 6. Cómo proponérselo a Luca (según su protocolo)

- **PR de bajo riesgo primero**: Track A (assets) + Track C (`batchGet`) — no
  reabren ninguna decisión suya. Adjuntar el Lighthouse antes/después.
- **Hosting/URL (Track B)** + el `_headers`: presentarlo como demo en vivo (tu
  `pages.dev`) + una nota para `PENDIENTES.md`, porque implica acciones de Luca
  (agregar el origen OAuth, elegir el host, y opcionalmente un dominio propio más
  adelante para una URL 100% profesional).
