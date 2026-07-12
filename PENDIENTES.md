# PENDIENTES — Mente Consciente

Este archivo vive en la raíz del repo (junto al `index.html`) y es la única fuente de verdad sobre bugs, features y decisiones abiertas. Se actualiza a mano o pidiéndole a cualquier chat que proponga la edición — pero el archivo en sí se guarda con Git, no en la memoria de ningún chat puntual.

---

## Bugs activos

*(vacío por ahora — la última tanda de 7 bugs detectados en auditoría ya fue corregida, ver Completado)*

---

## Features planificadas

- [ ] **Progresión por ejercicio** — handoff: `handoff-progresion-ejercicios.md` — estado: handoff listo, pendiente pasar a chat de Programación
- [ ] **Biblioteca de ejercicios** (tabs `Biblioteca`, `Progresion_Historial`, `Progresion_Actual`) — plan de 4 pasos ya entregado a Claude Code — estado: diseño de arquitectura completo, pendiente que apruebes la hoja de revisión de normalización antes de crear la tab `Biblioteca`
- [ ] **Resistencia** (cronómetro con récord personal y últimos 3 registros) — mockup: `mockup_resistencia_real.html` — estado: mockup construido, todavía no integrado al `index.html`
- [ ] **Bienestar** (Movimiento, Alimentación, Descanso, Estrés) — mockup: `mockup_bienestar.html` — estado: mockup construido, todavía no integrado al `index.html`

---

## Decisiones pendientes

- **Progresión — matching de ejercicio**: ¿arrancar ya con matching por nombre de texto, o esperar la migración de Biblioteca para usar ID estable? — a resolver en chat de Programación antes de implementar la Progresión.
- **Resistencia — UX del cronómetro**: ¿el campo de carga manual de tiempo se autocompleta al frenar el cronómetro, o el alumno/entrenador lo tipea siempre a mano? — a resolver en chat de Diseño o Programación.
- **Bienestar — fuente del contenido**: ¿el contenido de los 4 pilares queda hardcodeado en el HTML, o se carga desde una Google Sheet editable? — a resolver en chat de Programación.
- **Verificación de seguridad del proxy** (`portal-proxy.gs`): confirmar que está seguro antes de sumarle más responsabilidades (recordatorios automáticos, lectura de Progresión desde el portal, etc.) — a resolver antes de tocar el proxy de nuevo.

---

## Completado (changelog corto)

- *(fecha no registrada)* — Fondo atmosférico de perfil (`fondo-perfil.webp`) — checklist de contraste, performance y descarga en mobile confirmado, sin cambios de código necesarios.
- *(fecha no registrada)* — 7 fixes de auditoría: scoping de selectores `.dia-check-label`/`.dia-horario-row`, sync de Calendar en `drop()`, zero-padding de fechas, conteo de bonos alineado entre Cobros/Finanzas/Perfil, `escaparHTML()` en `dias.join`, reset de estado en `cerrarSesion` completo, limpieza de mutaciones residuales de `cobrosNutri`.

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
