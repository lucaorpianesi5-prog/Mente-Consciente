# Protocolo de trabajo — Mente Consciente

**Rol de Luca:** único desarrollador, decisor de producto.
**Herramientas involucradas:** Chat de Diseño/Producto, Chat de Programación, Claude Code (local), Chat de Auditoría (Opus 4.8), Git/GitHub, GitHub Pages.

Este protocolo no asume un equipo de varias personas — asume un solo desarrollador apoyado en varios roles de Claude especializados. El orden existe para que cada rol reciba lo que necesita sin reprocesar trabajo ya hecho en otro chat.

---

## 0. Roles fijos (no mezclar)

| Rol | Herramienta | Qué hace | Qué NO hace |
|---|---|---|---|
| **Diseño/Producto** | Este chat | Evalúa necesidades, investiga referencias, define alcance, señala riesgos, produce documentos de handoff | No escribe código |
| **Programación** | Chat de programación | Recibe handoff, propone approach técnico, implementa cambios de lógica/datos | No decide producto sin consultar |
| **Visual/UX** | Chat visual | Estructura HTML y CSS dentro de `<style>` | No toca JS de negocio |
| **Implementación local** | Claude Code | Ejecuta el código, corre servidor local, hace commits | No decide alcance de feature |
| **Auditoría** | Chat con Opus 4.8 | Investiga y reporta bugs con archivo/función/línea exacta | No corrige nada — solo reporta |

Regla general: si estás en el rol equivocado para lo que necesitás, cerrá esa conversación y abrí la correcta con el handoff correspondiente. No fuerces a un chat a salirse de su rol.

---

## 1. Flujo completo, paso a paso

### Paso 1 — Surge la necesidad
Una idea, un pedido de alumno, un hallazgo de auditoría, o una comparación con otra herramienta (como hicimos con Harbiz/Traineeks/Trainer Studio).

### Paso 2 — Diseño/Producto define el alcance
En este chat:
- Se evalúa si encaja con la arquitectura actual (single-file, Sheets, sin backend propio).
- Se identifican riesgos técnicos y decisiones abiertas (como el matching por nombre vs. ID en la feature de progresión).
- Se marca explícitamente qué queda **fuera de alcance** de esta iteración.
- Se cierra con un **documento de handoff** (`.md`), igual al de progresión de ejercicios.

**Salida de este paso:** un `.md` con objetivo, modelo de datos si aplica, flujos de UI, riesgos, decisiones pendientes y fuera de alcance.

### Paso 3 — Handoff pasa a Programación (o directo a Claude Code)
- Si el cambio es solo de lógica/datos ya bien definido → directo a Claude Code con el handoff.
- Si hay decisiones de arquitectura o integración a resolver primero → chat de Programación, que propone el approach antes de tocar código, siguiendo la regla ya establecida ("siempre proponer antes de implementar").
- Si el handoff incluye cambios de estructura visual → coordinar con el chat Visual/UX primero, para que la lógica no dependa de un layout que todavía no existe.

### Paso 4 — Implementación en Claude Code
- Trabajar sobre una copia local del `index.html` actualizado desde Git.
- Cambios acotados exactamente al alcance del handoff — nada de scope creep.
- Levantar el servidor local y probar el cambio ahí, nunca directo en producción.

### Paso 5 — Testing local (checklist mínimo antes de commitear)
- [ ] La feature funciona en el flujo pensado (mobile en gimnasio / desktop en casa, según corresponda).
- [ ] No rompió nada del breakpoint 768px.
- [ ] Si toca el proxy (`portal-proxy.gs`), se probó también el lado del portal del alumno, no solo el lado entrenador.
- [ ] Si toca Sheets, se verificó que escribe en el rango correcto y no pisa datos de otra sección.
- [ ] `escaparHTML()` aplicado a cualquier dato nuevo que se renderice.
- [ ] IDs nuevos generados con `generarId()`, no con timestamps sueltos.

### Paso 6 — Commit y control de versiones
- Commit con mensaje descriptivo que referencie la feature/handoff (ej: `feat: progresión por ejercicio - carga y lectura Actual/Historial`).
- Recomendado: trabajar cambios grandes o riesgosos en una rama separada (`dev` o `feature/nombre`) y mergear a `main` solo después del testing local del Paso 5. Si el cambio es chico y ya viene probado, commitear directo a `main` es aceptable — no hace falta burocracia para todo.

### Paso 7 — Deploy
- Push a `main` → GitHub Pages actualiza el sitio automáticamente.
- Verificación rápida post-deploy: abrir el sitio en producción (no local) y confirmar que el cambio se ve, tanto en mobile como desktop.

### Paso 8 — Registro (el paso que hoy falta)
Esto es lo nuevo respecto a cómo laburás ahora. En vez de que lo hecho quede solo como resumen disperso en el chat de auditoría, se registra en un archivo versionado por Git:

**`PENDIENTES.md`** en la raíz del repo, con cuatro secciones fijas:

```markdown
## Bugs activos
- [ ] Descripción — archivo/función/línea — origen (auditoría del DD/MM)

## Features planificadas
- [ ] Nombre — handoff asociado (link o nombre de archivo) — estado (diseño/programación/implementado)

## Decisiones pendientes
- Pregunta abierta — contexto — a resolver en (qué chat)

## Completado (changelog corto)
- DD/MM — feature/fix — commit asociado
```

Este archivo se actualiza en dos momentos: cuando Diseño/Producto cierra un handoff (se agrega a "Features planificadas"), y cuando Claude Code termina un deploy (se mueve de planificada a completado, o se agrega un bug nuevo si la auditoría encontró algo). Vos lo editás a mano o le pedís a cualquiera de los chats que te proponga la edición — pero vive en el repo, no en la memoria de un chat puntual.

### Paso 9 — Auditorías periódicas
El chat de Opus 4.8 sigue funcionando igual que hasta ahora (investigar y reportar, nunca corregir), pero sus hallazgos van directo a la sección "Bugs activos" de `PENDIENTES.md` en vez de quedar solo como resumen de chat. Así cualquier chat futuro (incluso uno nuevo, sin memoria previa) puede ver el estado real leyendo un archivo, no reconstruyendo de memoria.

---

## 2. Resumen visual del ciclo

```
Necesidad → Diseño/Producto (handoff .md) → Programación/Claude Code
    → Testing local → Commit → Deploy → PENDIENTES.md actualizado
    → (paralelo, periódico) Auditoría Opus 4.8 → PENDIENTES.md
```

---

## 3. Qué cambia respecto a cómo laburás hoy

- **Nada** en Git, testing local con Claude Code o el rol de cada chat — eso ya funciona bien y se mantiene igual.
- **Se agrega `PENDIENTES.md`** como fuente única de verdad para bugs, features y decisiones abiertas, versionado junto con el código en vez de vivir en resúmenes de chat que se pierden entre sesiones.
- **Se formaliza el checklist de testing** (Paso 5) para que no dependa de acordarte de revisar cada cosa cada vez.

Si querés, puedo armarte ahora mismo el `PENDIENTES.md` inicial con lo que ya sé de tu backlog (Biblioteca/Progresión, mockups de Resistencia y Bienestar, verificación de seguridad del proxy pendiente) para que arranques con el archivo ya poblado en vez de vacío.
