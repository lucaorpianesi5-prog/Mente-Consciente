# PENDIENTES — Mente Consciente

Este archivo vive en la raíz del repo (junto al `index.html`) y es la única fuente de verdad sobre bugs, features y decisiones abiertas. Se actualiza a mano o pidiéndole a cualquier chat que proponga la edición — pero el archivo en sí se guarda con Git, no en la memoria de ningún chat puntual.

---

## Bugs activos

- [ ] IDs de Google (`CLIENT_ID`/`SHEET_ID`/`CALENDAR_ID`) hardcodeados sin forma de rotar sin redeploy — auditoría del 09/07 (SEGURIDAD/MEDIO, riesgo aceptado por ahora) — no requiere backend propio hoy; se resuelve solo si/cuando se migre a uno (ver nota en "Login de alumno por email", Features planificadas)
- [ ] `cargarDatos()` sin caché ni carga incremental — 10 lecturas completas por login/sync — auditoría del 09/07 (RENDIMIENTO/ALTO, refactor grande)
- [ ] Estado global disperso sin encapsulamiento (variables `let` a nivel de script) — auditoría del 09/07 (MANTENIBILIDAD, refactor grande)
- [ ] Patrón de `onclick` inline pervasivo en vez de `addEventListener` — auditoría del 09/07 (MANTENIBILIDAD, refactor grande)
- [ ] Re-render completo vía `innerHTML` en cada actualización de estado (`renderCobros`, `renderNutri`, `renderFinanzas`) — auditoría del 09/07 (RENDIMIENTO/BAJO, refactor grande)
- [ ] Lógica de fechas y horarios duplicada entre app y portal (`portalCalcEdad`/`calcularEdad`, `stringToHorariosPorDia`/`portalStringToHorarios`) — auditoría del 09/07 (MANTENIBILIDAD, refactor grande)

---

## Features planificadas

- [ ] **Resistencia** (cronómetro con récord personal y últimos 3 registros) — mockup: `mockup_resistencia_real.html` — estado: mockup construido, todavía no integrado al `index.html`
- [ ] **Bienestar** (Movimiento, Alimentación, Descanso, Estrés) — mockup: `mockup_bienestar.html` — estado: mockup construido, todavía no integrado al `index.html`
- [ ] **Login de alumno por email en el portal** — reemplazar (o complementar) el acceso actual por link con token por un login real donde cada alumno entra con su propio mail — estado: idea a futuro, no priorizada todavía. Explícitamente **no** se implementa hasta terminar las funciones principales de la app. No confundir con el allowlist del entrenador (ya resuelto, son sistemas separados). **Nota de arquitectura:** validar la identidad real de cada alumno de forma segura no se puede hacer solo con código client-side — cuando se implemente esta feature, evaluar migrar a un backend propio (hoy la app es un archivo estático sin servidor). El otro disparador para esa migración sería que el volumen de datos crezca lo suficiente como para que los bugs de performance ya conocidos (reescritura completa de rangos, `cargarDatos()` sin caché) empiecen a doler de verdad.

---

## Decisiones pendientes

- **Resistencia — UX del cronómetro**: ¿el campo de carga manual de tiempo se autocompleta al frenar el cronómetro, o el alumno/entrenador lo tipea siempre a mano? — a resolver en chat de Diseño o Programación.
- **Bienestar — fuente del contenido**: ¿el contenido de los 4 pilares queda hardcodeado en el HTML, o se carga desde una Google Sheet editable? — a resolver en chat de Programación.
- **Verificación de seguridad del proxy** (`portal-proxy.gs`): confirmar que está seguro antes de sumarle más responsabilidades (recordatorios automáticos, lectura de Progresión desde el portal, etc.) — a resolver antes de tocar el proxy de nuevo.

---

## Completado (changelog corto)

- *(fecha no registrada)* — Fondo atmosférico de perfil (`fondo-perfil.webp`) — checklist de contraste, performance y descarga en mobile confirmado, sin cambios de código necesarios.
- *(fecha no registrada)* — 7 fixes de auditoría: scoping de selectores `.dia-check-label`/`.dia-horario-row`, sync de Calendar en `drop()`, zero-padding de fechas, conteo de bonos alineado entre Cobros/Finanzas/Perfil, `escaparHTML()` en `dias.join`, reset de estado en `cerrarSesion` completo, limpieza de mutaciones residuales de `cobrosNutri`.
- 2026-07-09 — XSS vía `onclick`/`escaparHTML` insuficiente en links de Drive/Nutrición — cambiado a `data-*` + listener — commit `54dce8b`.
- 2026-07-12 — al revisar la auditoría del 09/07 contra el código actual, 2 hallazgos ya estaban corregidos (no se sabe en qué commit, no están en este changelog por separado): race condition en `guardarFilaAlumno` (ya hace lookup server-side por ID en vez de índice local) y `getDiaHorarios()` sin scope (ya está acotado a `#dia-horario-lista`).
- 2026-07-12 — 6 fixes directos de la auditoría del 09/07: `bono`/`monto` ya no se interpolan como string JS en `onclick` (se leen de `data-*` en runtime); `renderCobrosAlumno` ya no mezcla meses de otros alumnos; `portalCalcEdad` con zero-padding igual que `calcularEdad`; hint de edad se limpia al abrir el modal de alumno; porcentaje de cobros clampeado a 100%; `eliminarEventosAlumno` sigue `nextPageToken` completo — commit `6ebab50`.
- 2026-07-12 — Allowlist de email para el login del entrenador — `iniciarSesion()` rechaza cualquier cuenta Google que no esté en `ALLOWED_EMAILS` — commit `0a650ef`, con fix de scope faltante (`userinfo.email`) en `4010654`. Decisión de Luca: no bloquea ni se relaciona con la idea futura de login de alumno por email (sistemas separados, ver Features planificadas).
- 2026-07-12 — Pausar/desactivar un alumno ahora elimina sus eventos recurrentes de Calendar en vez de dejarlos corriendo — centralizado en `sincronizarAlumnoCalendar()` — commit `a442061`. Decisión de Luca: sí, deben eliminarse automáticamente.
- 2026-07-12 — Reescritura completa de rangos reemplazada por actualización de solo la fila afectada en Cobros, Nutrición, Gastos y Ahorros (lookup server-side por mes+id) — commit `54f6425`. En Seguimiento (sin ID por entrada) se agregó columna `Id` con migración lazy: entradas viejas se sellan con un ID recién la primera vez que se editan/eliminan, sin necesidad de migrar datos a mano — commit `b7d0ebb`. Decisión de Luca: agregar la columna Id (opción 1, no matching por contenido).
- 2026-07-12 — **Biblioteca de ejercicios + Progresión por ejercicio** — implementado como modal en la ficha de alumno (no como tabs separadas, a diferencia del plan original) con búsqueda, filtros por patrón/enfoque y carga de reps/series/kg/RIR; lee/escribe contra `Biblioteca`, `Progresion_Actual` y `Progresion_Historial` en el Sheet; el alumno ve su progresión en el portal — commit `01a579f`. La decisión de matching quedó resuelta por la implementación: usa el ID estable de `Biblioteca` (no texto libre) una vez seleccionado del buscador.

---

## Cómo usarlo

**Cuándo agregar algo:**
- Cerrás un handoff en el chat de Diseño → se agrega una línea a *Features planificadas*, con el nombre del handoff.
- El chat de Auditoría (Opus 4.8) encuentra un bug → se agrega a *Bugs activos*, con archivo/función/línea exacta que te haya dado la auditoría y la fecha.
- Surge una pregunta que no se puede responder sola en el momento (por ejemplo, "¿cómo debería comportarse esto?") → va a *Decisiones pendientes*, con una nota de en qué chat se va a resolver.

**Cuándo mover algo:**
- Cuando Claude Code termina un deploy real (no solo la prueba local), esa feature o bug se saca de donde estaba y pasa a *Completado*, con la fecha real y, si querés, el mensaje del commit.
- Una decisión pendiente se borra de esa sección en cuanto se resuelve — no hace falta un historial de decisiones ya tomadas, solo las abiertas.

**Regla simple:** si estás por empezar a trabajar en algo y no está en este archivo, primero anotalo acá (aunque sea una línea) y después seguís. Así el archivo siempre refleja la realidad, en vez de reconstruirse de memoria cada vez que abrís un chat nuevo.

**Para vos en el día a día:** no hace falta que lo edites vos mismo si no querés — le podés pedir a cualquiera de los chats "actualizame el PENDIENTES.md con esto" y te propone la edición lista para pegar o para que Claude Code la aplique directo al archivo del repo.
