// Service worker de Mente Consciente (modo entrenador). Existe para que Chrome
// ofrezca "Instalar app" y para abrir la última copia sin conexión.
// Regla de oro: NUNCA servir una versión vieja de la app. La navegación va
// siempre a la red primero; la copia guardada solo se usa si no hay conexión.
const CACHE='mc-shell-v1';

self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));

self.addEventListener('fetch',e=>{
  if(e.request.mode!=='navigate') return;                       // Sheets, Google, fuentes, etc. pasan directo
  if(new URL(e.request.url).searchParams.has('alumno')) return; // el portal del alumno no usa el service worker
  e.respondWith(
    fetch(e.request).then(r=>{
      if(r.ok){ const copia=r.clone(); caches.open(CACHE).then(c=>c.put('./',copia)); }
      return r;
    }).catch(()=>caches.match('./'))
  );
});
