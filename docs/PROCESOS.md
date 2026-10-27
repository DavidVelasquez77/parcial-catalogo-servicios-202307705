# Procesos y política de Service Desk

## Fuentes y términos

Los tipos de la diapositiva 14 de `data/fuentes/Service Desk.pdf` son acceso, evento, incidente, cambio, requisición de servicio y problema. La tarea exige siete procesos: `NEW_SERVICE` y `TECH_SERVICE` comparten el tipo `SERVICE_REQUEST`, pero mantienen flujos y campos diferentes. Los otros cinco procesos corresponden uno a uno con su tipo. La máquina de estados está en `apps/api/src/desk/process-rules.ts` y se ejecuta en `DeskService.transition`; el formulario muestra campos específicos, sin sustituir la validación del servidor.

| Proceso / cola de muestra | Secuencia principal | Evidencia y condiciones de salida |
|---|---|---|
| Nuevos servicios / `Q-NEW` | SUBMITTED → ANALYSIS → PENDING_APPROVAL → APPROVED → IMPLEMENTING → RESOLVED → CLOSED | Necesidad y viabilidad; la aprobación exige vincular servicio existente o crear uno sin duplicarlo. REJECTED cierra la ruta de aprobación. |
| Cambios / `Q-CHANGE` | SUBMITTED → RISK_ASSESSMENT → PENDING_APPROVAL → APPROVED → PLANNED → EXECUTING → VALIDATING → RESOLVED → CLOSED | CI afectados, riesgo, plan de prueba y reversión; ejecutar requiere aprobación previa. |
| Incidentes / `Q-INCIDENT` | SUBMITTED → CLASSIFIED → DIAGNOSING → IN_PROGRESS (o ESCALATED) → RESOLVED → CLOSED | Categoría I0–I6, interrupción o degradación, duración, redundancia y solución documentada. |
| Eventos / `Q-EVENT` | SUBMITTED → CLASSIFIED → EVALUATED → RESPONDED → CLOSED | E0/E1 pueden cerrar tras evaluación; E2/E3 generan o vinculan incidente, notificación interna y respuesta. |
| Problemas / `Q-PROBLEM` | SUBMITTED → INVESTIGATING → WORKAROUND o KNOWN_ERROR → DEFINITIVE_SOLUTION → RESOLVED → CLOSED | Causa raíz, solución temporal/definitiva y vínculos a incidentes y cambio. |
| Accesos / `Q-ACCESS` | SUBMITTED → PENDING_APPROVAL → APPROVED → PROVISIONING → VALIDATING → RESOLVED → CLOSED | Beneficiario, recurso, permiso, provisión o revocación; solicitante no se autoaprueba. |
| Servicios de tecnología / `Q-TECH` | SUBMITTED → VALIDATING → ASSIGNED → FULFILLING → CONFIRMING → RESOLVED → CLOSED | Requisición sobre un servicio ya existente y confirmación; no crea un nuevo servicio. |

Las rutas alternativas y rechazos son los definidos en `process-rules.ts`. Los siete recorridos completos y las transiciones inválidas se ejecutan en P09. Una reapertura controlada desde CLOSED vuelve a SUBMITTED y aumenta `reopen_count`; P15 verifica el historial. Las cuentas y 37 tickets de ejemplo se preparan con `seed-service-desk.ts` y usan identificadores `DEMO-*` para repetir la carga sin duplicarlos. Sus estados son muestras insertadas directamente y la bitácora las etiqueta `DEMO_SEED`; no fingen una transición manual.

## Colas, autorización y asignación

Una cola tiene código, nombre, descripción, estado, proceso único, nivel de soporte y objetivos configurables de primera respuesta y resolución. Se puede asignar acceso por usuario o por rol con cinco permisos independientes: `can_view`, `can_handle`, `can_transfer`, `can_approve`, `can_admin`. Las consultas al servidor comprueban la sesión, usuario activo y permiso de la cola. `CONSULTA` siempre es de solo lectura, incluso si aparece en otro rol. El administrador puede gestionar configuración; una aprobación exige permiso de aprobar y rechaza autoaprobación del solicitante. P01, P06 y P10 lo comprueban.

La asignación es **mixta**: una cola se selecciona al crear el ticket y un agente autorizado lo toma manualmente. La lista ordena por prioridad descendente y antigüedad ascendente. `claim` bloquea la fila del ticket en una transacción (`FOR UPDATE`) y solo un agente puede tomarlo. Transferir exige motivo, conserva historial, quita el responsable anterior y requiere una cola activa del mismo proceso. La desactivación de una cola con tickets abiertos y la revocación de un permiso que dejaría sin autorización a un responsable se rechazan. P07 y P08 ejecutan estas reglas.

## Eventos, incidentes y soporte

De la diapositiva 15: E0 es programado, E1 es no programado sin impacto, E2 impacta el servicio y E3 impacta seguridad. E0 solo requiere registro; E1 conserva evaluación; E2/E3 crean o reutilizan un incidente y una notificación interna verificable. Una restricción de vínculo evita duplicarlo al repetir procesamiento. P11 recorre los cuatro.

La diapositiva 16 rotula I0 sin interrupción; I1 hasta 3 horas; I2 hasta 8 horas; I3 hasta 2 días; I4 hasta 1 semana; I5 un mes o más; I6 seguridad. `incident-rules.ts` da prioridad a I6 e I0; para duraciones solapadas elige el intervalo más corto que encaja. Para el hueco entre una semana y un mes aplica I4 como **regla complementaria del proyecto** (`PROJECT_GAP_RULE_7_TO_30_DAYS`), sin atribuirla a la diapositiva. Sin duración suficiente solicita revisión manual. La categoría no es un SLA de resolución. P12 verifica el hueco y las siete categorías de muestra.

La agrupación visual de la **diapositiva 16** se transcribe así; se verificó en la página renderizada, porque la extracción de texto no conserva las celdas fusionadas:

| Categoría | Prioridad mostrada en la lección | Redundancia mostrada |
|---|---|---|
| I0 | Baja | Existe redundancia en recursos y servicios |
| I1–I2 | Media | No existe redundancia en recursos y servicios |
| I3–I6 | Alta | No existe redundancia en recursos y servicios |

La prioridad operativa del ticket se registra aparte en una escala configurable 1–5; la tabla anterior es una **equivalencia docente de referencia**, no una asignación automática rígida. La disponibilidad de redundancia se registra explícitamente por caso y puede diferir de la ilustración. No se sobrescribe un dato observado para hacerlo coincidir con la diapositiva.

La diapositiva 11 incluye nivel 0 Autoservicio, 1 Help Desk, 2 Soporte Técnico, 3 Ingenieros y 4 Externo; las diapositivas 12–13 describen 0–3 y sitúan proveedores en 3. La aplicación adopta el esquema 0–4 configurable en cada cola. El nivel 0 es el portal y FAQ; las colas de muestra parten en 1. Escalar se refleja en estado e historial y puede transferirse a otra cola del mismo proceso con nivel apropiado. Los porcentajes docentes 20/70/5/5 se presentan como referencia, no como cuotas forzadas.

## Indicadores

`GET /api/desk/metrics` agrupa por cola, proceso, prioridad y estado. Antigüedad abierta = ahora menos creación para tickets que no están CLOSED ni REJECTED. Primera atención = primer `first_attended_at` menos creación. Resolución = `resolved_at` menos creación menos segundos pausados. Se usan **minutos calendario**. Los tickets sin primera atención o resolución quedan fuera de sus respectivos promedios y denominadores de cumplimiento; sí cuentan como abiertos. Los objetivos configurados en la cola se evalúan al ocurrir el hito. Al reabrir se conserva la bitácora y el conteo; una nueva resolución actualiza la fecha de resolución según la transición. P17 usa fechas y pausas controladas para comprobar 30 y 80 minutos, y un ticket abierto sin promedio de resolución.

## Trazabilidad, archivos y grafos

Cada cambio relevante escribe actor, instante y valores previos/nuevos en `ticket_history`. Comentarios PUBLIC son visibles al solicitante; INTERNAL exigen atención de cola. Adjuntos tienen límite de 5 MiB, lista de tipos permitidos y se descargan mediante ruta autenticada que reevalúa autorización. No se exponen por una carpeta pública.

El grafo de clasificación (`ci_categories.parent_id`) prohíbe ciclos. El grafo técnico de CI admite `CONNECTED_TO` cíclico y prohíbe ciclos para `DEPENDS_ON`, `HOSTED_ON` y `PARENT_OF`. Desde un CI se recorren dependencias y enlaces `ci_services` para listar servicios **potencialmente afectados**, sin afirmar interrupción efectiva. P04 y P14 cubren ambos grafos.
