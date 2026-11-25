# Mente Consciente — contexto para Claude

App de gestión para **Luca**, entrenador personal (único desarrollador y quien decide producto). La usa él (alumnos, agenda, cobros, finanzas, planes de fuerza) y sus alumnos (portal propio). Publicada en GitHub Pages desde `main`.

**Leé al empezar:** este archivo y `PENDIENTES.md` (lo abierto: bugs, features, decisiones). **No leas `HISTORIAL.md` entero** (85 KB de changelog): buscá ahí con grep solo cuando necesites el porqué de algo ya hecho.

## Cómo trabajar con Luca
- Escribile en **español rioplatense**, claro y sin jerga técnica; decile qué cambia para él y qué tiene que hacer.
- Usa mucho el **celu** y a veces no tiene compu: las instrucciones (Apps Script, Sheets, instalar) tienen que servir en el teléfono, o avisale que conviene la compu.
- Cuando dice **"mostrame cómo quedaría"**: maqueta (HTML suelto → captura con Playwright) **antes** de tocar `index.html`. Aplicá cuando lo confirma.
- Ante una ambigüedad que cambia datos o el formato de sus planillas, preguntá antes (p. ej. "RER" resultó ser RPE).
- Al terminar un cambio: commit, push a la rama de la sesión **y a `main`** (así se publica; Luca lo pidió así en esta etapa), y anotá en `HISTORIAL.md` (y en `PENDIENTES.md` lo que quede abierto).
- No inventes funciones que los datos no soportan (p. ej. "actualizado hace X" en el Mapeo: no hay historial).
- Protocolo de roles (Diseño, Programación, Auditoría…): `protocolo-trabajo-mente-consciente.md`. Si Auditoría no está disponible, Luca puede pedirte que hagas ese rol: informe con hallazgos por severidad, archivo/función, y corregí.

## Arquitectura
- **Un solo archivo**: `index.html` (~7.400 líneas: CSS, HTML y JS juntos). Sin build, sin dependencias, sin backend propio. `sw.js` + `manifest.webmanifest` = app instalable (PWA).
- **Datos**: un Google Sheet (`SHEET_ID`) leído/escrito con la API de Sheets usando el **OAuth del entrenador** (solo `ALLOWED_EMAILS`). Google Calendar para los turnos.
- **Portal del alumno**: misma `index.html` en modo portal. Los datos vienen de un **Apps Script** (`apps-script/portal-proxy.gs`, `PORTAL_API_URL`) que corre con la cuenta de Luca y filtra por el token del alumno. Ese archivo **no se despliega solo**: Luca lo pega en Planilla → Extensiones → Apps Script y publica con *Implementar → Administrar implementaciones → lápiz → Nueva versión* (**nunca** "Nueva implementación": cambia la URL). Si lo modificás, mandale el archivo completo.
- El portal detecta lo que soporta el proxy publicado: `perfilEditable` (entrevista inicial) y `planPortal` (Fuerza/Mapeo en la app). Si no vienen, cae al comportamiento anterior.
- Las planillas de **Fuerza** y **Mapeo** de cada alumno son archivos aparte de Luca (links en Alumnos Q y U).

## Mapa de `index.html` (buscá los marcadores con grep)
CSS: temas `NOCTURNO`/`CALMA` (variables `--…`; la ficha, el portal y el visor usan `--pd-…`), luego bloques por pantalla (`FICHA REDISEÑADA`, `ALUMNOS`, `MI PERFIL`, `FINANZAS (rediseño)`, `PORTAL PÚBLICO`, `Bloques del portal`, `Entrevista`, `Fuerza v2`, `Mapeo v2`, `MOBILE`).
JS (marcadores `// ──` y `// ══`): `CONFIG` · `PORTAL PÚBLICO` · `Instalar como app` · `BLOQUES COMPARTIDOS` (portal + Mi perfil) · `ENTREVISTA INICIAL` · `SESIÓN PERSISTENTE + CACHÉ` · `SHEETS API` · `CARGAR DATOS` · `GUARDAR ALUMNO` · `NAVEGACIÓN` · `DASHBOARD` · `ALUMNOS` · `OBJETIVOS`/`MOLESTIAS` · `FINANZAS` · `NUTRICIÓN` · `GOOGLE CALENDAR` · `AGENDA` · `COBROS`/`VENCIMIENTOS` · `MI PERFIL` · `PLAN DEL ALUMNO` (visor Fuerza/Mapeo) · `FUERZA (v2)` · `MAPEO (v2)` · `Eventos de la vista`.

Navegación: `showPage(id)`; barra inferior Resumen · Agenda · **Yo** (brote, centro) · Finanzas (Cobros + Inversión) · Alumnos (Alumnos + Nutrición). `_navDe()` decide qué ítem se resalta.

## Modelo de datos (pestañas del Sheet)
| Pestaña | Columnas |
|---|---|
| **Alumnos** A:W | A id · B nombre · C horario (`Día:hora\|…`) · D días (`Lunes\|…`) · E frecuencia · F monto · G objetivos (una línea JSON por ítem `{texto,categoria,estado,fecha[,origen]}`) · H molestias (`{texto,zona,estado,fecha[,origen]}`) · I estado (activo/pausado/inactivo) · J teléfono · K fechaNac `dd/mm/aaaa` · L estatura · M pesoInicial · N pesoActual · O historialFis · P tieneNutri · Q **Fuerza** (link) · R nutriDrive · S **portalToken** · T diaPago · U **Mapeo** (link, con `#gid`) · V email · W modalidad (`online` o vacío = presencial; online = sin días ni horario, fuera de Agenda/Calendar) |
| Cobros A:G | mes `yyyy-mm` · alumnoId · estado · fecha · bono · fechaBono · monto |
| Seguimiento A:F | alumnoId · fecha · texto · id · chips (`\|`) · origen |
| Nutricion / NutricionCobros | clientes · pagos por mes |
| Gastos A:D | id · mes `yyyy-mm` · descripción · monto |
| Ahorros A2:B2 | saldo inicial (config de Inversión) |
| Asistencias A:D | alumnoId · fecha `dd/mm/aaaa` · tipo (`asistencia`/`recuperacion`/`dia`) · D día del plan terminado (`Mes 2 · Día 1 · Semana 3`) |
| Perfil | clave/valor de Mi perfil (se crea sola) |
| Listos A:D | **una fila por alumno**: id · ciclo (`mes n\|id planilla`) · marcas JSON `{"día-semana":[índices]}` · fecha. Cambia el ciclo → se reemplaza (se crea sola) |
| Frases | frases del portal |
| Biblioteca / Progresion_* / Config | ya no se leen (desde 24/11); Luca las puede borrar |

Ids especiales en el visor: `MI_ID='__yo'` (mi propio plan), `PORTAL_ID='__portal'` (plan del alumno, solo lectura).

**Planilla de Fuerza** (formato estricto, ver `planParseFuerza`): A1 "Mes N"; fila 1 desde E "Semana 1/2/…" cada 3 columnas; por día una fila "Día N | Ejercicios | R x 3S | RIR | KG…"; ejercicios con B bloque, C letra, D nombre. Los valores de una semana pueden venir **cargados de antemano** (planificación): "listo" = solo lo que se marca, nunca lo cargado. Luca carga cada semana el fin de semana anterior: la **semana activa** es la última con algún "R x 3S" cargado (`planSemanaActiva`) y no se puede ir a las siguientes. Filas **fijas** (no se tildan): las de los bloques Activación y Movilidad, por nombre (Core sí se tilda).
**Planilla de Mapeo**: títulos (Ejercicio, Reps, KG; opcionales Enfoque, Patrón) en cualquiera de las primeras 10 filas; varias pestañas; las que no tienen esos títulos se ven como tabla de solo lectura.

## Reglas de código (no negociables)
- Todo dato que se pinta pasa por `escaparHTML()`. Íconos con `ic('nombre')` (sprite `<symbol id="i-…">`).
- Fechas: strings `dd/mm/aaaa`; "hoy" con `_hoyISOLocal()`/`toLocaleDateString('es-AR')`, **nunca** `toISOString()` (UTC). IDs con `crypto.randomUUID()`.
- No escribir si los datos no están frescos: `_escrituraPermitida()` (lo chequean `sheetsUpdate/Append`).
- Lecturas en `RANGO` sin fila final (`'Asistencias!A2:D'`), así no hay tope. Los `_WRITE` de `sheetsReplaceRange` sí la llevan: no achicar la grilla de esas pestañas.
- Escribir **por fila**, no reescribir rangos enteros. `guardarFilaAlumno()` hace fusión de 3 vías contra `_alumnoBase` (el alumno también escribe su fila desde el portal).
- Pestañas nuevas del Sheet: crearlas solas con `_crearPestana()` y tolerar que no existan al leer (no marcar fallo de sincronización).
- Proxy: `doGet` solo lee y filtra por token; la única escritura es `accion:'perfil'` (campos K/L/M/N + ítems `origen:"entrevista"` de G/H). Nunca devolver datos de otro alumno ni pestañas ajenas.
- Cambios de esquema retrocompatibles (líneas viejas en texto plano, columnas que faltan, proxy viejo).
- Lo que Luca decidió no tocar (estado global, `onclick` inline, re-render por `innerHTML`): ver `PENDIENTES.md`.

## Cómo probar (entorno de Claude en la nube)
- **Arnés**: `node herramientas/arnes.js` → chequea sintaxis de `index.html` y del proxy y recorre las pantallas del entrenador buscando errores de JS. En otros scripts: `require('./herramientas/arnes.js')` → `simularSheets`, `abrirEntrenador`, `abrirPortal` (ver comentarios del archivo).
- Abrí la app por `file://` (levantar un servidor local está bloqueado en este entorno). No hay login real: se inyectan datos y se simulan Sheets y el proxy con `page.route`.
- Scripts largos (Python/JS) escribilos con la herramienta de archivos en el scratchpad y ejecutalos; los heredocs complejos en bash los frena el chequeo de seguridad.
- Capturas para Luca: viewport 390×844 (celu), `deviceScaleFactor: 2`; probá los dos temas cuando toques colores.
- Verificá también en 1366 px (compu) si tocás layout.
