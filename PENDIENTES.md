# PENDIENTES — Mente Consciente

Este archivo vive en la raíz del repo (junto al `index.html`) y es la única fuente de verdad sobre bugs, features y decisiones abiertas. Se actualiza a mano o pidiéndole a cualquier chat que proponga la edición — pero el archivo en sí se guarda con Git, no en la memoria de ningún chat puntual.

---

## Bugs activos

- [ ] Sin allowlist de emails post-login — cualquier cuenta Google logueada se trata como "el entrenador", la seguridad depende 100% de permisos de Drive — `iniciarSesion()` (index.html:1536) — auditoría del 09/07 (SEGURIDAD/CRÍTICO)
- [ ] `bono`/`monto` interpolados sin `escaparHTML()` en `onclick` — `editarPagoNutri`/`editarPagoNutriPerfil`/`editarBono` (index.html:2977, 3212, 3573) — auditoría del 09/07 (SEGURIDAD/MEDIO)
- [ ] Reescritura completa del rango en cada micro-edición en vez de solo la fila afectada — `guardarCobrosEnSheets` (1853), `guardarSeguimientoCompleto` (2391) y análogas de Nutrición/Gastos/Ahorros — auditoría del 09/07 (RENDIMIENTO/ALTO)
- [ ] `cargarDatos()` sin caché ni carga incremental — ahora son 10 lecturas completas por login/sync (se sumaron Biblioteca y Progresion_Actual hoy) — auditoría del 09/07 (RENDIMIENTO/ALTO)
- [ ] Paginación no manejada al eliminar eventos de Calendar (`maxResults=20` sin seguir `nextPageToken`) — `eliminarEventosAlumno` (index.html:3129) — auditoría del 09/07 (BUG/MODERADO)
- [ ] Pausar/desactivar un alumno no detiene sus eventos recurrentes de Calendar — `sincronizarAlumnoCalendar` (index.html:3144) — auditoría del 09/07 (BUG/MODERADO)
- [ ] Historial de cobros del alumno mezcla meses de otros alumnos — `renderCobrosAlumno` (index.html:3252) toma `Object.keys(cobros)` global en vez de filtrar por alumno — auditoría del 09/07 (BUG/MODERADO)
- [ ] Inconsistencia de parseo de fechas: `calcularEdad` (3157) hace zero-padding del día/mes, `portalCalcEdad` (1520) no — auditoría del 09/07 (BUG/MODERADO)
- [ ] Hint de edad obsoleto al reabrir el modal de alumno — no se limpia en el reset de campos de `abrirModalAlumno` (index.html:2011) — auditoría del 09/07 (BUG/MENOR)
- [ ] Porcentaje de cobro sin clamp, puede superar 100% con montos congelados — `renderDashboard` (index.html:1913) y análoga en `renderCobros` — auditoría del 09/07 (BUG/MENOR)
- [ ] IDs de Google (`CLIENT_ID`/`SHEET_ID`/`CALENDAR_ID`) hardcodeados sin forma de rotar sin redeploy — auditoría del 09/07 (SEGURIDAD/MEDIO, riesgo aceptado por ahora)
- [ ] Lógica de fechas y horarios duplicada entre app y portal (`portalCalcEdad`/`calcularEdad`, `stringToHorariosPorDia`/`portalStringToHorarios`) — auditoría del 09/07 (MANTENIBILIDAD)
- [ ] Estado global disperso sin encapsulamiento (variables `let` a nivel de script, crecieron con Biblioteca/Progresión) — auditoría del 09/07 (MANTENIBILIDAD)
- [ ] Patrón de `onclick` inline pervasivo en vez de `addEventListener` (creció con el modal de Biblioteca) — auditoría del 09/07 (MANTENIBILIDAD)
- [ ] Re-render completo vía `innerHTML` en cada actualización de estado (`renderCobros`, `renderNutri`, `renderFinanzas`) — auditoría del 09/07 (RENDIMIENTO/BAJO)

---

## Features planificadas

- [ ] **Resistencia** (cronómetro con récord personal y últimos 3 registros) — mockup: `mockup_resistencia_real.html` — estado: mockup construido, todavía no integrado al `index.html`
- [ ] **Bienestar** (Movimiento, Alimentación, Descanso, Estrés) — mockup: `mockup_bienestar.html` — estado: mockup construido, todavía no integrado al `index.html`

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
