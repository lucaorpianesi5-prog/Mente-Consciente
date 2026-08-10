// config.example.js — plantilla de configuración por entorno.
//
// USO: copiá este archivo a `config.js` y completá con TUS valores. `config.js`
// está en .gitignore (no se commitea), así cada entorno (dev / prod) tiene el
// suyo y nunca pisás la config de otro ni la mandás en un PR.
//
// NOTA de seguridad: en una app 100% client-side (sin backend, como esta) estos
// valores NO son credenciales secretas:
//   • CLIENT_ID viaja siempre al browser en el login → es público por diseño
//     (este flujo OAuth ni siquiera usa client_secret).
//   • SHEET_ID / CALENDAR_ID son identificadores, no llaves: saberlos no da
//     acceso. El acceso lo protegen el compartido privado de Google, los
//     "Authorized JavaScript origins" del cliente OAuth, y ALLOWED_EMAILS.
// Lo único realmente secreto (el token del portal) vive server-side en el .gs.
// Externalizar acá es por prolijidad/DX (config separada del código), no porque
// esto "esconda" las IDs de un repo público.

window.APP_CONFIG = {
  CLIENT_ID:   'TU_CLIENT_ID.apps.googleusercontent.com',
  SHEET_ID:    'TU_SHEET_ID',
  // ID del calendario destino. Para dev podés usar 'primary' (tu calendario
  // principal) o el ID de uno dedicado (Calendar → Configuración → Integrar
  // calendario → "ID de calendario", termina en @group.calendar.google.com).
  CALENDAR_ID: 'primary',
  SCOPES:      'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/userinfo.email',
  ALLOWED_EMAILS: ['tu-email@gmail.com'],
  // Solo hace falta si vas a probar el PORTAL del alumno (deploy propio del .gs).
  // Para probar el panel del entrenador podés dejarlo vacío.
  PORTAL_API_URL: '',
};
