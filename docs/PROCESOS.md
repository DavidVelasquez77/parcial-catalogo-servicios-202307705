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

Las rutas alternativas y rechazos son los definidos en `process-rules.ts`. Además de comprobar que el destino sea una transición permitida, la API valida las condiciones de entrada y salida que se detallan abajo. Los datos de proceso se guardan en `tickets.process_data`; cada edición deja valores anteriores y nuevos en `ticket_history`. Las transiciones conservan actor, fecha, estado anterior y nuevo, y motivo cuando corresponde.

### Evidencia obligatoria y puertas de transición

| Proceso | Entrada y evidencia exigida por la API | Condiciones para avanzar y completar |
|---|---|---|
| Nuevo servicio | Necesidad, evaluación de viabilidad y una opción: servicio existente activo o código/nombre propuestos. | Antes de aprobación se vuelve a comprobar la evidencia. La aprobación enlaza el servicio o lo crea en `REVIEW`; una colisión de código se rechaza. No se implementa hasta que el servicio aprobado esté ligado al ticket. Resolver requiere el resultado de implementación. |
| Cambio | Al menos un CI afectado, evaluación de impacto/riesgo, plan de pruebas y reversión. | La solicitud de aprobación requiere los cuatro elementos. Ejecutar requiere estado `PLANNED` y transición de aprobación registrada en la bitácora. Entrar a validación requiere resultado de ejecución; resolver requiere resultado de ejecución y de validación. |
| Incidente | Categoría I0–I6 e indicador explícito de interrupción/degradación. I0 exige ausencia; I1–I5 exigen presencia y una duración estimada coherente con la regla de clasificación. I6 identifica un caso de seguridad. | Antes de clasificar se vuelven a validar esos datos. Resolver requiere solución aplicada; si hubo interrupción/degradación también exige duración real positiva. La categoría I6 no inventa una interrupción cuando no se ha observado. |
| Evento | Categoría E0–E3 al registrar y evaluación escrita antes de `EVALUATED`. | E0/E1 pueden cerrarse tras evaluación. E2/E3 generan un único incidente vinculado y una notificación; requieren respuesta escrita antes de `RESPONDED` y no pueden cerrarse desde `EVALUATED`. El incidente generado conserva la referencia al evento y queda pendiente de clasificación completa si su duración aún se desconoce. |
| Problema | Ticket relacionado con al menos un incidente antes de investigar. | `WORKAROUND` requiere solución temporal; `KNOWN_ERROR` requiere descripción del error conocido; `DEFINITIVE_SOLUTION` y la resolución requieren causa raíz y solución definitiva. `IMPLEMENTS` solo admite la relación entre un problema y un cambio. |
| Acceso | Beneficiario activo, recurso, permiso y operación explícita `GRANT` o `REVOKE`. | La secuencia exige aprobación y prohíbe autoaprobación del solicitante. La provisión/revocación debe dejar resultado antes de validar; la validación debe quedar registrada antes de resolver. |
| Servicio de tecnología | Servicio existente activo y prestación solicitada. | La validación de la solicitud y un agente asignado son necesarios antes de `ASSIGNED`; la entrega se registra antes de `CONFIRMING` y la confirmación antes de resolver. |

Las comprobaciones se ejecutan en el servidor y no dependen de que la interfaz presente los campos como obligatorios. El formulario de ficha permite completar evidencias durante la atención; rechazar una etapa devuelve un mensaje que indica qué dato falta o es inconsistente. P09 recorre los siete flujos y comprueba las puertas por etapa; P10 verifica ejecución sin aprobación registrada y autoaprobación de acceso; P11 cubre E0–E3, respuesta y generación idempotente de incidentes; P12 verifica categorías y coherencia de duraciones; P13 valida vínculos problema-incidente-cambio y rechaza `IMPLEMENTS` entre procesos no compatibles.

Una reapertura controlada desde CLOSED vuelve a SUBMITTED y aumenta `reopen_count`; P15 verifica el historial. Las cuentas y 37 tickets de ejemplo se preparan con `seed-service-desk.ts` y usan identificadores `DEMO-*` para repetir la carga sin duplicarlos. Sus estados son muestras insertadas directamente y la bitácora las etiqueta `DEMO_SEED`; no fingen una transición manual. Los datos sintéticos de los ejemplos incluyen el contexto del proceso, pero las transiciones nuevas deben cumplir las validaciones vigentes.

## Colas, autorización y asignación

Una cola tiene código único, nombre, descripción, estado, un único proceso de los siete, responsable designado, nivel de soporte y objetivos configurables de primera respuesta y resolución. El responsable debe ser un `ADMIN` o `AGENTE` activo; la migración 006 asigna una cuenta activa de esos roles a las colas anteriores y exige responsable en las nuevas. Al crear o cambiar el responsable de una cola activa se le garantiza permiso individual de consulta y atención; para retirarlo hay que designar antes a otra persona. Un proceso puede tener varias colas. La regla de orden es configurable entre `PRIORITY_AGE` y `AGE_PRIORITY`. Al filtrar por una cola, la lista aplica su regla; al consultar varias colas juntas, usa prioridad descendente y antigüedad ascendente como orden global. Los empates usan el identificador del ticket, por lo que el resultado es estable.

Una cola puede conceder permisos a usuarios, roles o ambos: `can_view`, `can_handle`, `can_transfer`, `can_approve` y `can_admin`. Los permisos se comprueban en el servidor. `can_admin` permite editar/desactivar esa cola, gestionar sus permisos y asignar un ticket a otro usuario autorizado; no concede automáticamente `can_handle` ni `can_view`. Solo `ADMIN` global crea colas nuevas. El rol `CONSULTA` permanece en lectura: no se le pueden conceder permisos de cola por rol o usuario y una concesión accidental tampoco supera la comprobación de servidor. Una aprobación exige `can_approve` y rechaza la autoaprobación del solicitante. P01, P06 y P10 lo comprueban.

La política de asignación es **manual**: al crear el ticket se selecciona la cola y después un usuario con `can_handle` puede tomarlo mediante `claim`; un administrador global o de esa cola puede asignarlo o reasignarlo a un usuario activo con permiso de atención mediante `POST /api/desk/tickets/:id/assign`. No hay distribución automática a un agente. Ambas operaciones bloquean el ticket con `FOR UPDATE`, registran actor y valores anteriores/nuevos y conservan la primera fecha de atención. Dos agentes que intentan reclamarlo simultáneamente obtienen un éxito y un conflicto. P07 comprueba la carrera, la asignación dirigida y el orden de ambas reglas.

Transferir exige motivo, conserva historial, quita el responsable anterior y requiere una cola activa del mismo proceso. Escalar un incidente es una operación distinta: exige permiso de transferencia, motivo, estado DIAGNOSING/IN_PROGRESS/ESCALATED y una cola activa del mismo proceso con nivel de soporte estrictamente superior; actualiza cola y estado en una transacción. La transición directa a ESCALATED se rechaza para impedir un escalamiento sin destino. La desactivación de una cola con tickets abiertos se rechaza; desactivar o retirar roles de un usuario responsable de una cola activa o con tickets abiertos asignados exige reasignar antes. También se rechaza retirar o reducir un permiso de atención que dejaría tickets abiertos asignados sin ese acceso. P06–P08 ejecutan estas reglas.

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

La diapositiva 11 incluye nivel 0 Autoservicio, 1 Help Desk, 2 Soporte Técnico, 3 Ingenieros y 4 Externo; las diapositivas 12–13 describen 0–3 y sitúan proveedores en 3. La aplicación adopta el esquema 0–4 configurable en cada cola. El nivel 0 es el portal y FAQ; las colas de muestra parten en 1. Escalar exige trasladar el incidente a una cola de nivel superior y registra estado, actor, fecha, motivo y valores anteriores/nuevos. La transferencia ordinaria puede moverlo entre colas del mismo proceso sin cambiar el estado. Los porcentajes docentes 20/70/5/5 se presentan como referencia, no como cuotas forzadas.

## Indicadores

`GET /api/desk/metrics` agrupa por cola, proceso, prioridad y estado. Antigüedad abierta = ahora menos creación para tickets que no están CLOSED ni REJECTED. Primera atención = primer `first_attended_at` menos creación. Resolución = `resolved_at` menos creación menos segundos pausados. Se usan **minutos calendario**. Los tickets sin primera atención o resolución quedan fuera de sus respectivos promedios y denominadores de cumplimiento; sí cuentan como abiertos. Los objetivos configurados en la cola se evalúan al ocurrir el hito. Al reabrir se conserva la bitácora y el conteo; una nueva resolución actualiza la fecha de resolución según la transición. P17 usa fechas y pausas controladas para comprobar 30 y 80 minutos, y un ticket abierto sin promedio de resolución.

## Trazabilidad, archivos y grafos

Cada cambio relevante escribe actor, instante y valores previos/nuevos en `ticket_history`. Comentarios PUBLIC son visibles al solicitante; INTERNAL exigen atención de cola. Adjuntos tienen límite de 5 MiB, lista de tipos permitidos y se descargan mediante ruta autenticada que reevalúa autorización. No se exponen por una carpeta pública.

El grafo de clasificación (`ci_categories.parent_id`) prohíbe ciclos. En el grafo técnico, `CONNECTED_TO` admite ciclos; `DEPENDS_ON` y `HOSTED_ON` forman juntos un grafo acíclico. `PARENT_OF` prohíbe sus propios ciclos y tiene un índice único parcial sobre el CI hijo: un componente no puede pertenecer a dos padres físicos, según la aclaración oral de la lección 22. Desde un CI se recorren dependencias y enlaces `ci_services` para listar servicios **potencialmente afectados**, sin afirmar interrupción efectiva. La consulta usa `UNION` por ID para terminar incluso ante datos heredados anómalos. P04 y P14 cubren ambos grafos; [CMDB_JERARQUIA.md](CMDB_JERARQUIA.md) separa niveles conceptuales, clasificación, composición y relaciones técnicas.
