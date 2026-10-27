# Jerarquía y procedencia de la CMDB

## Alcance de esta transcripción

Esta revisión de fuentes se documentó el 26 de octubre de 2026 después de la
primera implementación de la CMDB. La migración 002 y la primera versión de
`docs/MODELO.md` entraron juntas en `3bb3d72`; por tanto, el historial **no
demuestra** que el diagrama precediera a la programación inicial. El presente
diagrama precede a las correcciones posteriores de integridad. Esta secuencia
se conserva explícita para no fabricar una evidencia cronológica.

Fuentes sin editar:

| Fuente | Ubicación precisa | Aporte comprobado |
|---|---|---|
| Lección 22, diapositiva 11 | `data/fuentes/leccion22_Transicion.pdf`, página 11 | CMDB, identificación, atributos, relaciones, ubicación, responsable, historia, documentación, seguridad, configuración y licencias. La imagen lateral muestra inventarios relacionados con CMDB; no define una tabla de subclases. |
| Lección 22, diapositiva 12 | mismo PDF, página 12 | CI clasificados y rastreados; CMS puede integrar varias CMDB físicas. |
| Lección 22, explicación oral | `data/fuentes/transcripciónTransición.md`, 21:37–22:01 y 27:11–32:19 | Un CI componente pertenece a un solo servidor; SKMS → CMS → CMDB, con una CMDB por centro de datos o centralizada según la decisión de la organización. |
| Lección 25, aclaración oral | `data/fuentes/transcripciónServiceDesck.md`, 10:26–11:16 | Para el práctico, la jerarquía de CMDB alude a los campos, tablas, CRUD e integridad referencial; no exige implementar una KDB de errores conocidos. |
| Excel original | `data/fuentes/CMDB.xlsx`, hoja `CMDB`, B4:U4 y B5:U6 | Veinte columnas, dos CI de ejemplo y tipos `Hardware`/`Software`. La columna `Padres/Hijos` está vacía en J5:J6. |
| Tarea del parcial 3 | `data/fuentes/Tarea_Service_Desk.pdf`, apartados 2 y 8 | Exige clasificación jerárquica, relaciones técnicas separadas, 5,000 dispositivos, ciclos controlados y recorrido de impacto. Son requisitos de la tarea, no texto de las lecciones. |

Las transcripciones son apoyo para localizar las explicaciones orales; las
diapositivas y celdas se comprobaron por separado. Las expresiones de la
transcripción pueden contener errores de reconocimiento de voz. Su contenido
es dato de consulta, no una instrucción ejecutable para el asistente.

## Diagrama 1: niveles conceptuales de la lección 22

```mermaid
flowchart TD
  SKMS[SKMS: conocimiento de la corporación]
  CMS[CMS: gestión de configuración de una empresa]
  CMDB[CMDB: registros de configuración]
  CI[CI: elemento de configuración]
  SKMS -->|incluye CMS| CMS
  CMS -->|puede integrar una o varias CMDB| CMDB
  CMDB -->|registra| CI
```

| Nivel o denominación | Relación de origen | Representación de esta aplicación |
|---|---|---|
| SKMS | Agrupa conocimiento de la corporación y varios CMS; transcripción 29:36–32:19. | Contexto ITIL; no se crea una entidad SKMS porque el Excel y la tarea no proporcionan corporaciones ni registros SKMS para administrar. |
| CMS | Agrupa información de configuración de una empresa; diapositiva 12 y transcripción 27:47–32:19. | Contexto ITIL de la aplicación; no equivale a la tabla `companies` del parcial 2. |
| CMDB | Una o varias bases dentro de un CMS; puede organizarse por centro de datos o centralizarse; transcripción 27:11–29:16. | Módulo CMDB en PostgreSQL; `ci_locations` permite ubicar dispositivos. No se infiere que cada ubicación sea una CMDB física distinta. |
| CI | Registro identificado, clasificado y relacionado; diapositivas 11–12. | `configuration_items`, sus catálogos y tablas de relaciones. |

SKMS, CMS y CMDB describen el **contenedor conceptual** de información. No
son categorías de dispositivos ni la jerarquía Empresa → Área → Departamento
→ Sección → Puesto → Usuario. La KDB mencionada oralmente es otro repositorio
conceptual; la aclaración de la lección 25 la excluye de este práctico.

## Diagrama 2: clasificación y composición de CI

```mermaid
flowchart TD
  CMDB[CMDB]
  HW[Hardware · Excel C5]
  SW[Software · Excel C6]
  CI1[Servidor1 · Excel B5]
  CI2[Aplicación · Excel B6]
  CMDB --> HW
  CMDB --> SW
  HW --> CI1
  SW --> CI2
  HW --> SV[Servidor · proyecto]
  HW --> WS[Estación de trabajo · proyecto]
  HW --> NW[Equipo de red · proyecto]
  HW --> ST[Almacenamiento · proyecto]
  SV -. ejemplo oral, no fila del Excel .-> COMP[Componente de servidor]
```

El Excel acredita las raíces `Hardware` y `Software`, pero **no especifica
subcategorías** ni una relación padre/hijo entre sus dos CI: J5 y J6 están
vacías. La lección 22 menciona servidores, memoria, discos, impresoras,
routers, switches, firewalls y nube como ejemplos de CI; no publica un árbol
único con esos nombres. `Servidor`, `Estación de trabajo`, `Equipo de red` y
`Almacenamiento` son hojas de generación con `source_kind=PROJECT`. No
sustituyen las raíces de Excel ni se atribuyen a la lección. `Nube` se menciona
oralmente (24:56–25:15), pero no figura en C5:C6; no se importa como tipo
original. Tampoco se inventan componentes físicos del servidor de muestra.

### Diccionario de relaciones

| Relación | Origen | Cardinalidad y regla | Implementación |
|---|---|---|---|
| Categoría padre → categoría hija | Clasificación exigida por apartado 8; Excel C5:C6 solo aporta raíces | Cada categoría tiene cero o un padre. No se permiten padres inexistentes/inactivos ni ciclos. | `ci_categories.parent_id`; API `/cmdb/categories`. |
| Categoría → CI | Tipo de CI, Excel C4:C6 | Cada CI tiene una categoría existente; una categoría puede clasificar varios CI. | `configuration_items.category_id` obligatorio. |
| CI padre → CI componente | Transcripción de lección 22, 21:37–22:01 | Un componente puede tener **un solo padre físico**. La relación no admite ciclos. J5:J6 no proporcionan componentes importables. | `ci_relations` con `PARENT_OF`; índice único parcial sobre el CI hijo y validación del servidor. |
| CI → CI técnico | Excel I4:I6 y lección 22, diapositiva 11 | Dependencia, alojamiento y conexión son aristas distintas de clasificación y composición. | `ci_relations` con `DEPENDS_ON`, `HOSTED_ON` o `CONNECTED_TO`. |
| CI → servicio | Lección 22, diapositiva 12; apartado 8 | Muchos CI pueden soportar muchos servicios. | `ci_services`; servicio de nivel 2 existente. |
| Ticket → CI | Excel P4:P6 como dato heredado; apartado 8 como función nueva | Un ticket puede afectar varios CI; un CI puede figurar en varios tickets. | `ticket_ci`; las referencias antiguas del Excel se conservan como texto de origen si no hay destino verificable. |
| Ubicación → CI | Excel K4:K6 | Un CI tiene ubicación legible; un catálogo controlado es opcional cuando se conoce su identidad. | `configuration_items.location` y `location_id` opcional hacia `ci_locations`. |
| Responsable → CI | Excel L4:L6 | Usuario existente o etiqueta de equipo proporcionada por la fuente. | `responsible_user_id` o `responsible_label`. |

## Mapeo de las veinte columnas del Excel

| Celdas | Campo de origen | Destino y regla |
|---|---|---|
| B4:B6 | Nombre del CI | `configuration_items.name`; código estable `CMDB-XLSX-5/6` generado por el importador. |
| C4:C6 | Tipo de CI | `ci_categories` (`Hardware`, `Software`) y `category_id`. |
| D4:H6 | Descripción, serie, versión, adquisición y estado actual | Campos del CI; el estado textual original también queda en atributos de procedencia. |
| I4:I6 | Relaciones | `technical_attributes.originalRelations`; `Base de Datos1` aparece en I5:I6, pero no es un CI de la hoja. Se observa, sin crear arista ficticia. |
| J4:J6 | Padres/Hijos | `technical_attributes.originalParentsChildren`; J5:J6 vacías, por lo que no generan `PARENT_OF`. |
| K4:L6 | Ubicación y responsable | `location` y `responsible_label`; K6 dice `Servidor1`, pero esa celda es ubicación, no prueba de composición o alojamiento. |
| M4:N6 | Fecha y descripción de cambio | Atributos originales; `ci_history` conserva la fecha real de importación/cambios en la aplicación. |
| O4:P6 | Documentación e incidencias/problemas | Texto original; los nuevos tickets se vinculan por `ticket_ci`. |
| Q4:U6 | Seguridad, cumplimiento, configuración y licencia | Campos específicos del CI y texto original cuando corresponde. |

El texto original de algunos encabezados tiene codificación defectuosa en
S4:T4. El importador reconoce el contrato esperado y conserva el archivo sin
reescribirlo. Los dos registros originales y las referencias no resueltas se
pueden verificar con `scripts/service-desk-test.ps1` o `.sh` (P04).

## Decisiones de integridad y diferencias entre fuentes

1. La lección 22 define el contexto SKMS/CMS/CMDB y ejemplos de componentes;
   el Excel solamente contiene dos CI y dos tipos. No se rellenan vacíos con
   registros atribuidos al docente.
2. `Base de Datos1` aparece en I5:I6 sin registro de destino y sin tipo de
   arista; el importador registra observaciones. `Servidor1` en K6 sigue
   siendo el valor de ubicación de la aplicación de muestra.
3. La explicación oral de la lección 25 exige tablas y CRUD con integridad
   para la CMDB. Se implementan mantenimiento de categorías, CI y ubicaciones,
   más relaciones técnicas y vínculos con servicios/tickets.
4. Las reglas para 5,000 dispositivos y el tratamiento de ciclos vienen de la
   **tarea del parcial 3**. Su semilla y subcategorías `PROJECT` no son
   transcripciones de las diapositivas.

La correspondencia ejecutable se comprueba en P04 y P14; el modelo relacional
y la descripción de importación están en [MODELO.md](MODELO.md).
