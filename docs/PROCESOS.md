# Procesos y política de Service Desk

## Fuentes y términos

Los tipos de la diapositiva 14 de `data/fuentes/Service Desk.pdf` son acceso, evento, incidente, cambio, requisición de servicio y problema. La tarea exige siete procesos: `NEW_SERVICE` y `TECH_SERVICE` comparten el tipo `SERVICE_REQUEST`, pero mantienen flujos y campos diferentes. Los otros cinco procesos corresponden uno a uno con su tipo. La máquina de estados está en `apps/api/src/desk/process-rules.ts` y se ejecuta en `DeskService.transition`; el formulario muestra campos específicos, sin sustituir la validación del servidor.

El mapeo explícito entre los seis tipos docentes y los siete procesos implementados es:

| Tipo de ticket de la diapositiva 14 | Proceso implementado | Regla del mapeo |
|---|---|---|
| Solicitud de acceso (`ACCESS`) | Gestión de accesos (`ACCESS`) | Correspondencia directa. |
| Evento (`EVENT`) | Gestión de eventos (`EVENT`) | Correspondencia directa; conserva la categoría E0–E3. |
| Incidente (`INCIDENT`) | Gestión de incidentes (`INCIDENT`) | Correspondencia directa; conserva la categoría I0–I6. |
| Solicitud de cambio (`CHANGE`) | Gestión de cambios (`CHANGE`) | Correspondencia directa; incluye aprobación, ejecución y reversión. |
| Requisición de servicio (`SERVICE_REQUEST`) | Gestión de nuevos servicios (`NEW_SERVICE`) | Subtipo para proponer un servicio nuevo, con análisis y aprobación. |
| Requisición de servicio (`SERVICE_REQUEST`) | Gestión de servicios de tecnología (`TECH_SERVICE`) | Subtipo para pedir una prestación de un servicio ya existente. |
| Problema (`PROBLEM`) | Gestión de problemas (`PROBLEM`) | Correspondencia directa. |

La separación de los dos subtipos de requisición es una regla de implementación de esta tarea: evita confundir la creación de un servicio con pedir una prestación del catálogo actual. El campo `tickets.type` guarda uno de los seis tipos; `tickets.process` conserva cuál de los siete flujos aplica.

| Proceso / cola de muestra | Secuencia principal | Evidencia y condiciones de salida |
|---|---|---|
| Nuevos servicios / `Q-NEW` | SUBMITTED → ANALYSIS → PENDING_APPROVAL → APPROVED → IMPLEMENTING → RESOLVED → CLOSED | Necesidad y viabilidad; la aprobación exige vincular servicio existente o crear uno sin duplicarlo. REJECTED cierra la ruta de aprobación. |
| Cambios / `Q-CHANGE` | SUBMITTED → RISK_ASSESSMENT → PENDING_APPROVAL → APPROVED → PLANNED → EXECUTING → VALIDATING → RESOLVED → CLOSED | CI afectados, riesgo, plan de prueba y reversión; ejecutar requiere aprobación previa. |
| Incidentes / `Q-INCIDENT` | SUBMITTED → CLASSIFIED → DIAGNOSING → IN_PROGRESS (o ESCALATED) → RESOLVED → CLOSED | Categoría I0–I6, interrupción o degradación, duración, redundancia y solución documentada. |
| Eventos / `Q-EVENT` | E0: SUBMITTED → CLOSED. E1–E3: SUBMITTED → CLASSIFIED → EVALUATED; E2/E3 continúan por RESPONDED → CLOSED. | E0 se cierra tras el registro; E1 se cierra tras evaluación; E2/E3 generan o vinculan incidente, notificación y respuesta. |
| Problemas / `Q-PROBLEM` | SUBMITTED → INVESTIGATING → WORKAROUND o KNOWN_ERROR → DEFINITIVE_SOLUTION → RESOLVED → CLOSED | Causa raíz, solución temporal/definitiva y vínculos a incidentes y cambio. |
| Accesos / `Q-ACCESS` | SUBMITTED → PENDING_APPROVAL → APPROVED → PROVISIONING → VALIDATING → RESOLVED → CLOSED | Beneficiario, recurso, permiso, provisión o revocación; solicitante no se autoaprueba. |
| Servicios de tecnología / `Q-TECH` | SUBMITTED → VALIDATING → ASSIGNED → FULFILLING → CONFIRMING → RESOLVED → CLOSED | Requisición sobre un servicio ya existente y confirmación; no crea un nuevo servicio. |

Las rutas alternativas y rechazos son los definidos en `process-rules.ts`. Además de comprobar que el destino sea una transición permitida, la API valida las condiciones de entrada y salida que se detallan abajo. Los datos de proceso se guardan en `tickets.process_data`; cada edición deja valores anteriores y nuevos en `ticket_history`. Las transiciones conservan actor, fecha, estado anterior y nuevo, y motivo cuando corresponde.

### Evidencia obligatoria y puertas de transición

| Proceso | Entrada y evidencia exigida por la API | Condiciones para avanzar y completar |
|---|---|---|
| Nuevo servicio | Necesidad, evaluación de viabilidad y una opción: servicio existente activo o código/nombre propuestos. | Antes de aprobación se vuelve a comprobar la evidencia. La aprobación enlaza el servicio o lo crea en `REVIEW`; una colisión de código se rechaza. El ID aprobado lo asigna la API; después se bloquean los campos que determinaron la aprobación. No se implementa hasta que el servicio aprobado esté ligado al ticket. Resolver requiere el resultado de implementación. |
| Cambio | Al menos un CI afectado, evaluación de impacto/riesgo, plan de pruebas y reversión. | La solicitud de aprobación requiere los cuatro elementos. Ejecutar requiere estado `PLANNED` y transición de aprobación registrada en la bitácora. La base aprobada y el conjunto de CI quedan bloqueados; un alcance distinto requiere una solicitud nueva. Entrar a validación requiere resultado de ejecución; resolver requiere resultado de ejecución y de validación. |
| Incidente | Categoría I0–I6 e indicador explícito de interrupción/degradación. I0 exige ausencia; I1–I5 exigen presencia, duración estimada entera mayor que cero y coherencia con la regla de clasificación. I6 identifica un caso de seguridad. | Antes de clasificar se vuelven a validar esos datos. Resolver requiere solución aplicada; si hubo interrupción/degradación también exige duración real positiva. La categoría I6 no inventa una interrupción cuando no se ha observado. |
| Evento | Categoría E0–E3 al registrar. E0 no requiere evaluación; E1–E3 requieren evaluación escrita antes de `EVALUATED`. | E0 solo puede pasar directamente de `SUBMITTED` a `CLOSED`; el servidor rechaza clasificarlo, evaluarlo o responderlo. E1 se evalúa y se cierra sin respuesta operativa. E2/E3 generan un único incidente vinculado y una notificación; requieren respuesta escrita antes de `RESPONDED` y no pueden cerrarse desde `EVALUATED`. La categoría queda fijada al registrar para impedir cambiar E2/E3 a E1/E0 y omitir las acciones requeridas. El incidente generado conserva la referencia al evento y queda pendiente de clasificación completa si su duración aún se desconoce. |
| Problema | Ticket relacionado con al menos un incidente antes de investigar. | `WORKAROUND` requiere solución temporal; `KNOWN_ERROR` requiere descripción del error conocido; `DEFINITIVE_SOLUTION` y la resolución requieren causa raíz y solución definitiva. `IMPLEMENTS` solo admite la relación entre un problema y un cambio. |
| Acceso | Beneficiario activo, recurso, permiso y operación explícita `GRANT` o `REVOKE`. | La secuencia exige aprobación y prohíbe autoaprobación del solicitante. Tras aprobar, recurso, permiso y operación quedan bloqueados. La provisión/revocación debe dejar resultado antes de validar; la validación debe quedar registrada antes de resolver. |
| Servicio de tecnología | Servicio existente activo y prestación solicitada. | La validación de la solicitud y un agente asignado son necesarios antes de `ASSIGNED`; la entrega se registra antes de `CONFIRMING` y la confirmación antes de resolver. |

Las comprobaciones se ejecutan en el servidor y no dependen de que la interfaz presente los campos como obligatorios. El formulario de ficha permite completar evidencias durante la atención; rechazar una etapa devuelve un mensaje que indica qué dato falta o es inconsistente. P09 recorre los siete flujos y comprueba las puertas por etapa; P10 verifica ejecución sin aprobación registrada y autoaprobación de acceso; P11 cubre E0–E3, respuesta y generación idempotente de incidentes; P12 verifica categorías y coherencia de duraciones; P13 valida vínculos problema-incidente-cambio y rechaza `IMPLEMENTS` entre procesos no compatibles.

Una reapertura controlada desde CLOSED vuelve a SUBMITTED y aumenta `reopen_count`; P15 verifica el historial. Las cuentas y 37 tickets de ejemplo se preparan con `seed-service-desk.ts` y usan identificadores `DEMO-*` para repetir la carga sin duplicarlos. Sus estados son muestras insertadas directamente y la bitácora las etiqueta `DEMO_SEED`; no fingen una transición manual. Los datos sintéticos de los ejemplos incluyen el contexto del proceso, pero las transiciones nuevas deben cumplir las validaciones vigentes.

## Colas, autorización y asignación

Una cola tiene código único, nombre, descripción, estado, un único proceso de los siete, responsable designado, nivel de soporte y objetivos configurables de primera respuesta y resolución. El responsable debe ser un `ADMIN` o `AGENTE` activo; la migración 006 asigna una cuenta activa de esos roles a las colas anteriores y exige responsable en las nuevas. Al crear o cambiar el responsable de una cola activa se le garantiza permiso individual de consulta y atención; para retirarlo hay que designar antes a otra persona. Un proceso puede tener varias colas. La regla de orden es configurable entre `PRIORITY_AGE` y `AGE_PRIORITY`. Al filtrar por una cola, la lista aplica su regla; al consultar varias colas juntas, usa prioridad descendente y antigüedad ascendente como orden global. Los empates usan el identificador del ticket, por lo que el resultado es estable.

Una cola puede conceder permisos a usuarios, roles o ambos: `can_view`, `can_handle`, `can_transfer`, `can_approve` y `can_admin`. Los permisos se comprueban en el servidor. `can_admin` permite editar/desactivar esa cola, gestionar sus permisos y asignar un ticket a otro usuario autorizado; no concede automáticamente `can_handle` ni `can_view`. Solo `ADMIN` global crea colas nuevas. El rol `CONSULTA` permanece en lectura: no se le pueden conceder permisos de cola por rol o usuario y una concesión accidental tampoco supera la comprobación de servidor. Una aprobación exige `can_approve` y rechaza la autoaprobación del solicitante. P01, P06 y P10 lo comprueban.

La política de asignación es **manual**: al crear el ticket se selecciona la cola y después un usuario con `can_handle` puede tomarlo mediante `claim`; un administrador global o de esa cola puede asignarlo o reasignarlo a un usuario activo con permiso de atención mediante `POST /api/desk/tickets/:id/assign`. No hay distribución automática a un agente. Ambas operaciones bloquean el ticket con `FOR UPDATE`, registran actor y valores anteriores/nuevos y conservan la primera fecha de atención. Dos agentes que intentan reclamarlo simultáneamente obtienen un éxito y un conflicto. P07 comprueba la carrera, la asignación dirigida y el orden de ambas reglas.

Transferir exige motivo, conserva historial, quita el responsable anterior y requiere una cola activa del mismo proceso. Escalar un incidente es una operación distinta: exige permiso de transferencia, motivo, estado DIAGNOSING/IN_PROGRESS/ESCALATED y una cola activa del mismo proceso con nivel de soporte estrictamente superior; actualiza cola y estado en una transacción. La transición directa a ESCALATED se rechaza para impedir un escalamiento sin destino. La desactivación de una cola con tickets abiertos se rechaza; desactivar o retirar roles de un usuario responsable de una cola activa o con tickets abiertos asignados exige reasignar antes. También se rechaza retirar o reducir un permiso de atención que dejaría tickets abiertos asignados sin ese acceso. P06–P08 ejecutan estas reglas.

## Eventos, incidentes y soporte

De la diapositiva 15: E0 es programado y solo requiere registro; E1 es no programado sin impacto y conserva la evaluación, sin respuesta operativa; E2 es no programado con impacto al servicio; E3 es no programado con impacto de seguridad y posible impacto al servicio. E2/E3 crean un incidente relacionado y una notificación dirigida al solicitante. La relación `GENERATED_INCIDENT` y la evaluación dentro de una transacción impiden crear dos incidentes para un mismo evento. El solicitante puede verificar la notificación autenticándose y consultando `GET /api/desk/notifications`; P11 valida que incluya el número del evento y su ticket. No se envía correo real. P11 recorre E0–E3, comprueba que E0 no puede clasificarse ni recibir evaluación, que E1 no admite respuesta, y que E2/E3 exigen evaluación, incidente, respuesta y notificación.

La diapositiva 16 rotula I0 sin interrupción; I1 tres horas o menos, incluidas degradaciones; I2 ocho horas o menos, incluidas degradaciones; I3 dos días o menos; I4 una semana o menos; I5 un mes o más; I6 seguridad de recursos e información. Esos rótulos se conservan en la interfaz. I1–I4 se solapan: como **decisión del proyecto**, `incident-rules.ts` escoge el intervalo más corto que contiene la duración (`PROJECT_SHORTEST_MATCH`). La diapositiva no define qué hacer con el intervalo mayor de una semana y menor de un mes; el proyecto lo asigna a I4 (`PROJECT_GAP_RULE_7_TO_30_DAYS`). Para automatizar el rótulo “un mes”, esta implementación define un mes como 30 días calendario o 43,200 minutos (`PROJECT_30_DAY_MONTH_THRESHOLD`). Duraciones ausentes, cero, fraccionarias o fuera de rango quedan para revisión manual; no se atribuyen esas reglas complementarias a la lección. P12 comprueba los límites 180/181, 480/481, 2880/2881, 10080/10081 y 43199/43200 minutos. La categoría no es un SLA de resolución.

La agrupación visual de la **diapositiva 16** se transcribe así; se verificó en la página renderizada, porque la extracción de texto no conserva las celdas fusionadas:

| Categoría | Prioridad mostrada en la lección | Redundancia mostrada |
|---|---|---|
| I0 | Baja | Existe redundancia en recursos y servicios |
| I1–I2 | Media | No existe redundancia en recursos y servicios |
| I3–I6 | Alta | No existe redundancia en recursos y servicios |

La prioridad operativa del ticket se registra aparte en una escala configurable 1–5; la tabla anterior es una **equivalencia docente de referencia**, no una asignación automática rígida. La disponibilidad de redundancia se registra explícitamente por caso y puede diferir de la ilustración. No se sobrescribe un dato observado para hacerlo coincidir con la diapositiva.

La diferencia de niveles se resuelve manteniendo configurable la escala 0–4 de la diapositiva 11 y registrando que las diapositivas 12–13 muestran 0–3 y sitúan proveedores en 3. La equivalencia y el uso en esta aplicación son:

| Nivel configurable | Nombre de la diapositiva 11 | Equivalencia operativa en el sistema | Diferencia que se conserva |
|---:|---|---|---|
| 0 | Autoservicio | Portal del solicitante y base de conocimientos/FAQ; evita o prepara solicitudes antes de una cola humana. | No se fuerza una cola de agentes de nivel 0. |
| 1 | Help Desk | Recepción, clasificación y atención inicial; valor predeterminado de las colas de muestra. | Primera línea de contacto. |
| 2 | Soporte Técnico | Diagnóstico técnico y recuperación de segundo nivel. | Recibe escalamiento desde nivel 1 u otro nivel inferior. |
| 3 | Ingenieros | Especialistas de ingeniería. También puede configurarse aquí una cola de proveedores para seguir las diapositivas 12–13. | En la diapositiva 11 los proveedores se separan en nivel 4. |
| 4 | Externo | Proveedor externo cuando se sigue la separación de la diapositiva 11. | Nivel adicional respecto del esquema 0–3 de las diapositivas 12–13. |

Por tanto, el valor 3 admite dos equivalencias documentadas según el esquema docente que se configure: ingenieros según la diapositiva 11 o proveedores según las diapositivas 12–13. La aplicación no cambia silenciosamente la numeración ni atribuye una única equivalencia a todas las diapositivas. La ruta de referencia es 0 autoservicio → 1 Help Desk → 2 Soporte Técnico → 3 Ingenieros/proveedores → 4 Externo; una escalada real se configura entre colas activas del mismo proceso y solo puede subir a un nivel mayor, aunque puede saltar niveles si la organización lo decide. Se guarda cola destino, actor, fecha, motivo y estados anterior/nuevo. Los porcentajes docentes 20/70/5/5 son referencias de distribución, no cuotas forzadas.

## Indicadores

`GET /api/desk/metrics` y el tablero agregan los tickets visibles para la cuenta por cola, proceso, prioridad y estado. El tablero muestra total, cantidad no cerrada/rechazada, antigüedad abierta promedio, primera atención promedio, resolución promedio y cumplimiento de cada objetivo.

- **Antigüedad abierta:** promedio de `ahora - created_at` de tickets cuyo estado no es `CLOSED` ni `REJECTED`. Incluye `RESOLVED` a la espera de cierre y cuenta todo el tiempo calendario, también durante una pausa.
- **Primera atención:** promedio de `first_attended_at - created_at`, usando el primer reclamo o asignación atendible. Se conserva al reabrir y no descuenta pausas.
- **Resolución:** promedio de `resolved_at - created_at - paused_seconds`. Usa la fecha de la última resolución vigente y descuenta los segundos pausados acumulados.
- **Cumplimiento:** para cada objetivo configurado en la cola, `tickets dentro del límite / tickets evaluables × 100`. Primera respuesta solo evalúa tickets con `first_attended_at`; resolución solo evalúa tickets con `resolved_at`. Tickets sin el hito aún no entran en el promedio correspondiente ni en su denominador. Las colas sin objetivo también quedan fuera del denominador de cumplimiento, aunque sus hitos sí pueden aportar a los promedios.

Todos estos tiempos y objetivos usan **minutos calendario**, no horario hábil. Al reabrir, se conserva la primera atención, se limpia la resolución vigente y se cuenta una nueva resolución desde la creación original; por eso el tiempo entre un cierre anterior y la reapertura forma parte del tiempo calendario de resolución. Las pausas acumuladas se descuentan solo de resolución. P17 fija un ticket creado hace 120 minutos, atendido a los 30, resuelto a los 90 y con 10 minutos de pausa: comprueba 120 minutos de antigüedad abierta, 30 de primera atención, 80 de resolución y el numerador/denominador de ambos objetivos. También comprueba que un ticket sin resolución no se use para promediarla.

## Trazabilidad, archivos y grafos

Cada cambio relevante escribe actor, instante y valores previos/nuevos en `ticket_history`. Comentarios PUBLIC son visibles al solicitante; INTERNAL exigen atención de cola. Adjuntos tienen límite de 5 MiB, lista de tipos permitidos y se descargan mediante ruta autenticada que reevalúa autorización. No se exponen por una carpeta pública.

El grafo de clasificación (`ci_categories.parent_id`) prohíbe ciclos. En el grafo técnico, `CONNECTED_TO` admite ciclos; `DEPENDS_ON` y `HOSTED_ON` forman juntos un grafo acíclico. `PARENT_OF` prohíbe sus propios ciclos y tiene un índice único parcial sobre el CI hijo: un componente no puede pertenecer a dos padres físicos, según la aclaración oral de la lección 22. Desde un CI se recorren dependencias y enlaces `ci_services` para listar servicios **potencialmente afectados**, sin afirmar interrupción efectiva. La consulta usa `UNION` por ID para terminar incluso ante datos heredados anómalos. P04 y P14 cubren ambos grafos; [CMDB_JERARQUIA.md](CMDB_JERARQUIA.md) separa niveles conceptuales, clasificación, composición y relaciones técnicas.
