# PENDIENTES — Mente Consciente

Este archivo vive en la raíz del repo (junto al `index.html`) y es la única fuente de verdad sobre bugs, features y decisiones **abiertas**. Lo ya hecho está en `HISTORIAL.md`. Se actualiza a mano o pidiéndole a cualquier chat que proponga la edición — pero el archivo en sí se guarda con Git, no en la memoria de ningún chat puntual.

---

## Bugs activos

- [ ] IDs de Google (`CLIENT_ID`/`SHEET_ID`/`CALENDAR_ID`) hardcodeados sin forma de rotar sin redeploy — auditoría del 09/07 (SEGURIDAD/MEDIO, riesgo aceptado por ahora) — no requiere backend propio hoy; se resuelve solo si/cuando se migre a uno (ver nota en "Login de alumno por email", Features planificadas)
- [ ] Estado global disperso sin encapsulamiento (variables `let` a nivel de script) — auditoría del 09/07 (MANTENIBILIDAD, refactor grande) — decisión de Luca: no tocar. Arreglarlo de verdad implica modificar casi todas las funciones del archivo sin ningún test automático que confirme que no se rompió nada; el beneficio es solo prolijidad interna, sin bug real asociado. Reconsiderar solo si se suma otro programador al proyecto o se migra a backend.
- [ ] Patrón de `onclick` inline pervasivo en vez de `addEventListener` — auditoría del 09/07 (MANTENIBILIDAD, refactor grande) — decisión de Luca: no tocar. Mismo riesgo que el estado global (cientos de puntos a cambiar sin tests), sin bug real detrás. Reconsiderar solo si en algún momento hace falta una política CSP estricta.
- [ ] Re-render completo vía `innerHTML` en cada actualización de estado (`renderCobros`, `renderNutri`, `renderFinanzas`) — auditoría del 09/07 (RENDIMIENTO/BAJO, refactor grande) — decisión de Luca: no tocar. La propia auditoría ya marcaba esto como imperceptible hoy, solo preocupación de escala futura.

- [ ] **Caché de 5 min del proxy** — auditoría del 24/11 (BAJO) — tras cambiar el token o pasar a inactivo, la respuesta vieja puede servirse hasta 5 min.
- [ ] **Fuerza sin `#gid`** — auditoría del 24/11 (BAJO) — el proxy muestra la primera pestaña que no se llame "Notas"; conviene pegar los links de Fuerza con el `#gid`.
- [ ] **Dispositivo del entrenador** — auditoría del 24/11 (BAJO, riesgo aceptado) — `mc_cache` (todos los datos) y el permiso de Google (todas las planillas y el calendario, 1 h) quedan en el dispositivo hasta "Cerrar sesión". Mitigación: bloqueo de pantalla.

- [ ] **Limpieza de la planilla (la hace Luca)** — revisión del 24/11: borrar las pestañas **Config**, **Biblioteca**, **Progresion_Historial** y **Progresion_Actual** (la app ya no las lee; bajar copia de Biblioteca si quiere la lista de ejercicios); borrar las 6 filas de Asistencias del alumno eliminado `1782763380670`; revisar los 2 cobros "pendiente" (jul y sep); opcional: títulos (Alumnos I "Estado", V "Email"; Asistencias C "Tipo", D "Día del plan"; Ahorros "Saldo inicial"/"Fecha"; Gastos B "Mes"). **No achicar filas/columnas vacías.**
- [ ] **Eliminar alumno deja datos sueltos** — revisión del 24/11 (BAJO) — borra la fila de Alumnos pero no sus Asistencias/Seguimiento/Listos, y reescribe todo el rango de Alumnos (`guardarEnSheets`). Recomendación a Luca: usar "inactivo". Si se mantiene el borrado, limpiar sus filas en las otras pestañas.

---

## Features planificadas

- [ ] **Resistencia** (cronómetro con récord personal y últimos 3 registros) — mockup: `mockup_resistencia_real.html` — estado: mockup construido, todavía no integrado al `index.html`
- [ ] **Bienestar** (Movimiento, Alimentación, Descanso, Estrés) — mockup: `mockup_bienestar.html` — estado: mockup construido, todavía no integrado al `index.html`

---

## Decisiones pendientes

- **Reinicio de los tildes de Fuerza entre ciclos** — hoy el ciclo se reconoce por el "Mes N" de la planilla + qué planilla es: si Luca renueva el plan duplicando la planilla y cambiando "Mes N", o usando una planilla nueva, los tildes arrancan de cero solos. Caso que NO cubre: reutilizar la MISMA planilla sin cambiar el "Mes N" (los tildes del ciclo anterior seguirían visibles). Si eso pasa en la práctica, sumar un botón "Empezar ciclo nuevo" en la Fuerza o reconocer el ciclo por la fecha.

- **Agenda con solicitudes de horario (portal del alumno)** — maqueta del 24/11: el alumno ve las franjas de 1 h con cupos (máx. 3, solo cantidad, nunca nombres), pide un horario o cambio ("desde ahora" / "solo esta semana"), y Luca confirma o rechaza desde la app (al confirmar se actualizan horario, Agenda y Calendar). En pausa por decisión de Luca. Requiere: escritura acotada en el proxy (hoja nueva "Solicitudes", pasar por Auditoría), configurar las franjas de trabajo, y normalizar horarios escritos como texto libre.
- **Renovar accesos del portal** — el proxy nuevo ya está publicado (Luca, 24/11). Falta confirmar que Luca tocó una vez **Mi perfil → Gestión → Renovar accesos del portal** (después de cargar el mail de quienes entraban solo con link) para invalidar los links viejos.

- **Constancia en 5 etapas (árboles)** — maqueta aprobada visualmente el 24/11 (brote → tallo y hojas → árbol joven → árbol grande → ancestral; el botón "Yo" de la barra y la tarjeta de constancia de Mi perfil cambian según la etapa). Queda en pausa por decisión de Luca. Falta definir: (1) umbrales (propuesta 1–6 · 7–20 · 21–49 · 50–99 · 100+), (2) si el árbol sigue a la racha (vuelve a brote si se corta) o crece con el total de entrenamientos y nunca retrocede (recomendado), (3) si el portal del alumno pasa de 3 a estas 5 etapas.

- **Resistencia — UX del cronómetro**: ¿el campo de carga manual de tiempo se autocompleta al frenar el cronómetro, o el alumno/entrenador lo tipea siempre a mano? — a resolver en chat de Diseño o Programación.
- **Bienestar — fuente del contenido**: ¿el contenido de los 4 pilares queda hardcodeado en el HTML, o se carga desde una Google Sheet editable? — a resolver en chat de Programación.
- **Seguimiento — visibilidad privado/compartido**: el handoff `handoff-ficha-alumno-optimizada.md` pedía un campo `visibilidad` por entrada (para que el alumno vea ciertas notas en una pestaña "Notas" del portal), diseñado en `mockup_vinculo_seguimiento_notas.html` — ese archivo no llegó a este chat, así que la parte de visibilidad quedó sin implementar (los chips/origen de la entrada sí están). Retomar cuando el mockup esté disponible.
- **Accesos circulares "Recuperación" y "Resistencia" en la ficha**: el mockup los pedía como link a un Excel/Sheet, pero no existe ningún campo de datos para eso hoy, y Resistencia ya tiene planeado un cronómetro *adentro* de la app (no un link externo) — ver `mockup_resistencia_real.html`. Se implementaron solo los 2 accesos que sí tienen datos reales (Fuerza→`carpetaDrive`, Nutri→página de Nutrición). Wirear estos dos cuando cada uno tenga su función real definida.

---

## Cómo usarlo

**Cuándo agregar algo:**
- Cerrás un handoff en el chat de Diseño → se agrega una línea a *Features planificadas*, con el nombre del handoff.
- El chat de Auditoría (Opus 4.8) encuentra un bug → se agrega a *Bugs activos*, con archivo/función/línea exacta que te haya dado la auditoría y la fecha.
- Surge una pregunta que no se puede responder sola en el momento (por ejemplo, "¿cómo debería comportarse esto?") → va a *Decisiones pendientes*, con una nota de en qué chat se va a resolver.

**Cuándo mover algo:**
- Cuando Claude Code termina un deploy real (no solo la prueba local), esa feature o bug se saca de donde estaba y pasa a `HISTORIAL.md` (al final), con la fecha real y, si querés, el mensaje del commit.
- Una decisión pendiente se borra de esa sección en cuanto se resuelve — no hace falta un historial de decisiones ya tomadas, solo las abiertas.

**Regla simple:** si estás por empezar a trabajar en algo y no está en este archivo, primero anotalo acá (aunque sea una línea) y después seguís. Así el archivo siempre refleja la realidad, en vez de reconstruirse de memoria cada vez que abrís un chat nuevo.

**Para vos en el día a día:** no hace falta que lo edites vos mismo si no querés — le podés pedir a cualquiera de los chats "actualizame el PENDIENTES.md con esto" y te propone la edición lista para pegar o para que Claude Code la aplique directo al archivo del repo.
