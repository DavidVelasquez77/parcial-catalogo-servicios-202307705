# Fase 4: Loop Engineering y ciclos de corrección

## Alcance y trazabilidad

Este registro selecciona ciclos observados durante el trabajo de Service Desk. Cada uno se vincula con el defecto o hallazgo, la corrección, los controles y el commit que contiene el cambio. No se reconstruyen conversaciones completas ni se tratan propuestas como evidencia de éxito. Codex (familia GPT-6; versión exacta de la sesión no expuesta) se utilizó el 26–27 de octubre de 2026. La intervención y aceptación finales corresponden al estudiante.

El ciclo aplicado fue:

```text
objetivo y contexto → propuesta/cambio → ejecución → evaluación → corrección → nueva verificación
```

## Ciclo 1: defecto funcional en las transiciones de proceso

- **Objetivo y entrada:** comprobar en P09 los siete flujos, con sus puertas de entrada/salida y persistencia en PostgreSQL.
- **Propuesta/cambio inicial:** ejecutar las transiciones reales del API y validar los estados posteriores y las evidencias de cada proceso.
- **Fallo observado:** PostgreSQL rechazó la actualización con `inconsistent types deduced for parameter $1`; el mismo parámetro participaba como texto y en una expresión `CASE`.
- **Evaluación y corrección:** se inspeccionó el `UPDATE` y se tipó explícitamente el parámetro como `text`. Se mantuvieron las validaciones de negocio; no se relajaron transiciones para hacer pasar la prueba.
- **Nueva verificación:** P09 recorrió los siete procesos y pasó. La aceptación completa P01–P18 también pasó en ejecuciones posteriores.
- **Intervención humana:** el estudiante mantuvo como criterio que los siete procesos completaran su flujo sin quitar las restricciones del enunciado.
- **Criterio de salida:** P09 pasa y los rechazos de transiciones inválidas siguen vigentes.
- **Commit relacionado:** [`fe4ea55`](https://github.com/DavidVelasquez77/parcial-catalogo-servicios-202307705/commit/fe4ea55), implementación inicial de flujos y aceptación; reglas posteriores quedaron refinadas en `e024bc6` y `d91a886`.

## Ciclo 2: filtro funcional de categoría CMDB

- **Objetivo y entrada:** al filtrar por Hardware, mostrar también los dispositivos clasificados en sus categorías hijas.
- **Propuesta/cambio inicial:** se encontró que la consulta comparaba únicamente `category_id` directo; el filtro de la raíz no alcanzaba las subcategorías del proyecto.
- **Fallo observado:** los dispositivos estaban presentes bajo las categorías hijas, pero la consulta por la raíz no los incluía. El hallazgo se reprodujo revisando la consulta y los datos de la suite aislada.
- **Evaluación y corrección:** `CmdbService.items` se cambió para obtener recursivamente el subárbol de clasificación; la UI conserva la categoría seleccionada y permite combinarla con estado, ubicación y tipo de CI.
- **Nueva verificación:** P16 pasó con paginación, filtro de Hardware, tipo dispositivo, búsqueda por código y ubicación. El filtro raíz incluye las cuatro clases hijas; con `isDevice=true` devuelve los 5,000 dispositivos esperados. Playwright también ejecutó el recorrido de CMDB.
- **Intervención humana:** se conservó la jerarquía existente y se exigió que las subcategorías siguieran marcadas como decisión `PROJECT`, sin atribuirlas a CMDB.xlsx.
- **Criterio de salida:** el recuento de dispositivos filtrados es 5,000, la búsqueda puntual devuelve un resultado y cada página respeta el límite configurado.
- **Commit relacionado:** [`f16e6d3`](https://github.com/DavidVelasquez77/parcial-catalogo-servicios-202307705/commit/f16e6d39aa25ca45ed698ddd469023718fc11780).

## Ciclo 3: integridad de datos sintéticos y responsables

- **Objetivo y entrada:** generar 5,000 CI reproducibles con referencias válidas y sin asignar personas reales por accidente.
- **Propuesta/cambio inicial:** revisar el generador y verificar las cuentas responsables existentes en el volumen de prueba.
- **Fallo de datos observado:** 2,500 CI de la semilla ya persistida tenían responsables distintos de la cuenta demo designada, porque la selección anterior aceptaba cualquier usuario activo.
- **Evaluación y corrección:** el generador ahora requiere `admin.demo`, normaliza los registros existentes de esa misma semilla y registra cada cambio como `SYNTHETIC_OWNER_NORMALIZE` en el historial del CI. No borra otros datos ni cambia el Excel.
- **Nueva verificación:** P03 comprobó 5,000 códigos únicos, 1,250 equipos por clase, referencias a usuario/ubicación/servicio, atributos técnicos por clase y ausencia de IP obligatoria. La repetición final informó `created=0`, `updated=0`, `skipped=5000`.
- **Intervención humana:** se eligió una cuenta de evaluación local fija y se rechazó usar nombres de usuarios encontrados en la base como responsables sintéticos.
- **Criterio de salida:** todos los CI del conjunto pertenecen a `admin.demo`, conservan sus referencias, y repetir la semilla no crea duplicados.
- **Commit relacionado:** [`f16e6d3`](https://github.com/DavidVelasquez77/parcial-catalogo-servicios-202307705/commit/f16e6d39aa25ca45ed698ddd469023718fc11780).

## Ciclo 4: permisos de tickets vistos desde la ficha de CI

- **Objetivo y entrada:** mostrar desde un CI los tickets relacionados sin dar a una persona acceso indirecto a una cola que no puede consultar.
- **Propuesta/cambio inicial:** agregar tickets, última actividad e historial legible a la ficha del CI.
- **Defecto de autorización observado:** la consulta de detalle del CI no recibía la identidad autenticada y podía devolver todos los tickets ligados al CI, aunque el usuario no tuviera permiso para la cola.
- **Evaluación y corrección:** el controlador pasa la identidad al servicio; el detalle limita tickets a administradores/consulta, al solicitante dueño o a usuarios con permiso `can_view` de la cola. La autorización se ejecuta en el servidor.
- **Nueva verificación:** P14 confirma que el administrador ve el ticket y que el solicitante no ve el ticket ajeno de una cola no autorizada. El flujo de navegador abre un ticket desde el CI con una sesión autorizada.
- **Intervención humana:** se mantuvo el requisito de autorización del lado servidor; se rechazó como solución ocultar el enlace en React.
- **Criterio de salida:** no se filtra ningún ticket fuera del alcance autorizado y la navegación funciona para una persona autorizada.
- **Commit relacionado:** [`f16e6d3`](https://github.com/DavidVelasquez77/parcial-catalogo-servicios-202307705/commit/f16e6d39aa25ca45ed698ddd469023718fc11780).

## Límite de iteraciones y cierre humano

Las ejecuciones históricas no tuvieron un contador automatizado de intentos por defecto. Para las siguientes correcciones queda fijado este límite operativo: máximo **tres ciclos enfocados por el mismo defecto**, modificando una causa por ciclo y repitiendo primero el control que lo detectó. Si sigue fallando al tercer ciclo, se detiene la automatización, se conserva el log y el estudiante decide si cambia el requisito, reduce el alcance con justificación o solicita una revisión. No se cambian los criterios de aceptación para obtener un resultado verde.

En los ciclos anteriores, la salida se aceptó solo después del control repetido y de comparar el resultado con el requisito. El estudiante decidió el alcance, preservación de Excel, uso de SQL sin Prisma, separación entre datos `EXCEL` y decisiones `PROJECT`, política de acceso y qué evidencia se podía presentar. Las métricas de tiempo puntuales se describen como observaciones, no como garantías de rendimiento.

## Fallos deliberados

No se introdujeron fallos deliberadamente. Los defectos de SQL, filtro, asociación de responsables y visibilidad surgieron durante pruebas o revisión del código. Los archivos de evidencia registran los fallos y las correcciones para que el evaluador pueda distinguirlos de una prueba intencional.

## Evidencias relacionadas

- [Salida y ciclos resumidos de pruebas](../PRUEBAS.md).
- [Ocho prompts operativos y dos iteraciones de prompt](../prompts/service-desk.md).
- [Reglas de grafos y recorrido de impacto](../IA.md#5-grafos-y-evidencia).
- [Suite de aceptación y pirámide de pruebas](../PRUEBAS.md#apartado-8-cmdb-y-5000-dispositivos-27-de-octubre-de-2026).
