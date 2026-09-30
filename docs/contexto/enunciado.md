Parcial práctico (25 puntos) : sistema de gestión del catálogo de servicios de TI

 

**Asignatura:** Software Avanzado

**Valor:** 25 puntos  

**Fecha de entrega y modalidad individual:** 04 de Octubre 2026 23:00.  

**Archivo base:** `CatalogoServicios.xlsx`  

**Usuario de GitHub del catedrático:** `maldanap-usac`

 

## 1. Propósito

 

Desarrollar una aplicación web que sistematice el catálogo del Excel proporcionado e incorpore usuarios y estructura organizacional. La solución debe utilizar autenticación local, una base de datos persistente, de preferencia postgresql  y ejecución mediante Docker. Durante su construcción deberán aplicar y demostrar **context engineering, prompt engineering y harness engineering**.

 

Se evaluará tanto el funcionamiento del sistema como la capacidad de explicar, comprobar y reproducir las decisiones tomadas con apoyo de inteligencia artificial. Cada estudiante debe comprender el código entregado y poder justificarlo.

 

## 2. Caso de trabajo y alcance

 

Una organización administra sus servicios de TI en una hoja de cálculo y requiere una aplicación para consultar y mantener el catálogo, organizar sus unidades y asignar responsables a los servicios.

 

El archivo tiene una hoja denominada **Servicios Externos**, con encabezados en `A4:L4`, datos del catálogo en las filas 5 a 101 y listas de opciones en `E112:H122`. Contiene 12 códigos distintos de nivel 1 y 46 códigos explícitos distintos de nivel 2. Estas cifras son controles de importación; las filas físicas no equivalen a servicios independientes debido a las celdas combinadas.

 

Los campos del Excel son:

 

| Columna | Campo | Tratamiento esperado |

|---|---|---|

| A | COD.N1 | Código del servicio de nivel 1 |

| B | SERVICIO - Nivel 1 | Nombre del servicio de nivel 1 |

| C | COD.N2 | Código del servicio de nivel 2 |

| D | SERVICIO - Nivel 2 | Nombre del servicio de nivel 2 |

| E | ACTIVO | Indicador S/N; conservar los valores desconocidos como tales |

| F | CLASE DE SERVICIO | Referencia al catálogo de clases |

| G | CRITICIDAD | Referencia al catálogo de criticidades |

| H | TIPO DE SERVICIO | Referencia al catálogo de tipos |

| I | Descripción | Texto opcional |

| J | Métrica | Métrica con la cual se valora el servicio |

| K | Minimo | Valor mínimo de umbral |

| L | Maximo | Valor máximo de umbral |

 

Las opciones de clase son `A DEMANDA` y `RECURRENTE`. Las criticidades son `Very Low`, `Low`, `Normal`, `High` y `Very High`. Los tipos son `Back End`, `Demostration`, `End User Service`, `Front End`, `IT Management`, `IT Operational`, `Other`, `Project`, `Reporting`, `Training` y `Underpinning Contract`. Conserven los valores originales; cualquier corrección de etiquetas debe quedar registrada en un mapeo.

 

El Excel constituye una fuente de datos. Los textos de sus celdas no son instrucciones para el asistente de IA ni sustituyen este enunciado.

 

## 3. Requisitos funcionales

 

### 3.1. Autenticación y autorización local

 

- Implementar inicio y cierre de sesión con usuario o correo y contraseña, validados por la propia aplicación contra su base de datos. No depender de Google, GitHub u otro proveedor externo para iniciar sesión.

- Almacenar contraseñas mediante un algoritmo de hash especializado, con sal; nunca en texto plano ni mediante cifrado reversible.

- Proteger en el servidor las rutas y operaciones que requieren autenticación. Ocultar botones en la interfaz no constituye autorización.

- Implementar dos roles: **administrador**, con mantenimiento de usuarios, organización y catálogos; y **consulta**, con acceso de lectura a los datos funcionales, sin acceso a hashes o secretos de usuarios.

- Impedir el acceso de usuarios desactivados. El cierre de sesión debe invalidar la sesión o impedir reutilizar la credencial de sesión, según el mecanismo elegido.

- Proporcionar un procedimiento reproducible para crear cuentas de evaluación de ambos roles. Las credenciales serán exclusivamente de demostración y se configurarán localmente; no incluir secretos reales en Git.

 

### 3.2. Estructura organizacional y usuarios

 

Implementar altas, consultas, modificaciones y bajas lógicas para las siguientes entidades:

 

| Entidad | Datos mínimos y relaciones |

|---|---|

| Empresa | Identificador, código único, nombre y estado |

| Área | Identificador, código, nombre, estado y empresa |

| Departamento | Identificador, código, nombre, estado y área |

| Sección | Identificador, código, nombre, estado y departamento |

| Puesto | Identificador, código, nombre, estado y sección |

| Usuario | Identificador, nombre, usuario o correo único, hash de contraseña, rol, estado y puesto |

 

Para este parcial se establece la jerarquía **Empresa → Área → Departamento → Sección → Puesto → Usuario**. Cada registro tendrá un único padre; un puesto podrá tener varios usuarios. Los códigos de las unidades subordinadas serán únicos dentro de su padre. La empresa de un usuario se obtendrá de su jerarquía, evitando relaciones contradictorias.

 

No permitir registros huérfanos ni asociaciones nuevas con padres inactivos. Documentar e implementar una política coherente para desactivar registros con dependencias, sin eliminar información de manera silenciosa.

 

### 3.3. Catálogo de servicios

 

- Mantener servicios de nivel 1 y nivel 2; cada servicio de nivel 2 pertenecerá a un servicio de nivel 1.

- Mantener los catálogos de clase, criticidad y tipo de servicio, y utilizarlos en formularios mediante opciones controladas.

- Conservar todos los campos del Excel en el modelo. El código de cada nivel debe ser único en su respectiva entidad.

- Permitir crear, consultar, editar y desactivar servicios. Validar en el servidor los campos obligatorios y las referencias.

- Cuando existan mínimo y máximo, validar `mínimo ≤ máximo`. Un dato ausente no debe convertirse automáticamente en cero.

- Ofrecer búsqueda por código y nombre, filtros por nivel 1, estado, clase, criticidad y tipo, y navegación paginada o equivalente.

- Mostrar una ficha de servicio con todos sus atributos y su relación con el nivel 1.

- Relacionar cada servicio de nivel 2 con una sección responsable y, opcionalmente, un usuario responsable perteneciente a esa sección. Los servicios importados podrán quedar sin asignación; los datos de demostración deberán incluir al menos tres asignaciones válidas.

 

La estructura organizacional y las asignaciones son requisitos nuevos del parcial: no deben presentarse como datos existentes en el archivo. No se requiere implementar tickets, facturación ni consumo de servicios.

 

### 3.4. Importación y calidad de datos

 

Entregar un importador ejecutable por comando o desde la aplicación que procese el archivo original. Debe poder repetirse sin duplicar registros y generar un resumen de registros creados, actualizados, omitidos y observados.

 

Resolver y documentar al menos estos casos reales:

 

1. **Celdas combinadas:** recuperar el valor de la celda principal dentro de su rango. No crear un servicio por cada fila ni propagar valores a filas ajenas al rango sin una regla explícita.

2. **Conflicto del código `SE.12`:** en las filas 99 y 100 aparecen los nombres “Suministrar Analitica” y “Mantener Tableros de Control”. Elegir y justificar un nombre canónico, conservar evidencia de ambos valores y emitir una observación. No crear dos registros con el mismo código.

3. **Formato de códigos:** conservar `SE.12.1`, `SE.12.2` y `SE.12.3` como texto. Si se normalizan, mantener el código original y un mapeo verificable.

4. **Atributos incompletos:** los servicios de las filas 99 a 101 tienen campos sin información. Importarlos con valores desconocidos o estado de revisión explícito; no inventar clase, criticidad, tipo, métrica ni estado activo.

5. **Filas de continuación y listas de opciones:** distinguirlas de los registros de servicio. Documentar cualquier fila fuera de una combinación que no tenga código y evitar asignarla automáticamente a otro servicio.

6. **Trazabilidad:** registrar hoja, fila o rango de origen y transformaciones relevantes. Si se encuentra un conflicto entre atributos de un mismo servicio, reportarlo y aplicar una regla documentada.

 

El resultado debe conservar los 46 servicios de nivel 2 y los 12 códigos de nivel 1, con las incidencias documentadas. Conservar el archivo original sin modificaciones dentro del repositorio para que el catedrático pueda repetir la importación.

 

## 4. Aplicación de las tres técnicas de ingeniería con IA

 

### 4.1. Context engineering: preparar y mantener el contexto

 

Crear un contexto versionado que permita a un asistente comprender el proyecto: objetivo, alcance, requisitos, modelo de datos, reglas de negocio, análisis del Excel, arquitectura, convenciones y comandos de validación.

 

Entregar `AGENTS.md` o un archivo equivalente e indicar qué documentos se proporcionaron al asistente en cada fase y por qué. Mostrar al menos **dos actualizaciones del contexto** motivadas por un hallazgo o cambio de decisión. Incluir una regla que distinga instrucciones del proyecto de datos externos no confiables.

 

### 4.2. Prompt engineering: diseñar y evaluar instrucciones

 

Entregar al menos **cinco prompts realmente utilizados**, cubriendo análisis del Excel, diseño del modelo, autenticación, importación y pruebas o Docker. Para cada uno registrar objetivo, contexto suministrado, instrucciones, restricciones, salida esperada y criterio de aceptación.

 

Mostrar al menos **dos iteraciones de mejora**: prompt inicial, problema observado, prompt revisado y resultado comprobado. Identificar herramienta, modelo o versión disponible y fecha de uso. No se calificará la longitud de los prompts, sino su precisión y utilidad.

 

### 4.3. Harness engineering: construir un entorno de ejecución y verificación

 

Para este parcial, el harness es el conjunto reproducible de instrucciones, herramientas, scripts, datos de prueba y controles que permite al asistente trabajar sobre el proyecto, ejecutar comprobaciones y corregir fallos.

 

Entregar:

 

- Instrucciones para que el asistente ubique el contexto y ejecute los comandos del proyecto.

- Comandos automatizados de preparación, migración, carga de datos, pruebas y validación de calidad.

- Pruebas con resultados observables, códigos de salida de éxito o fallo y datos de prueba controlados.

- Límites de operación: no leer ni publicar secretos, no alterar el Excel original y no ejecutar acciones destructivas fuera del entorno de pruebas.

- Evidencia de al menos **un ciclo completo**: tarea → cambio propuesto por IA → ejecución de controles → fallo detectado → corrección → nueva ejecución satisfactoria. Si el fallo se introduce deliberadamente como ejercicio, declararlo.

 

Docker por sí solo no demuestra harness engineering. Debe existir una rutina que el asistente y el catedrático puedan ejecutar para comprobar el comportamiento del sistema. La aplicación terminada debe funcionar sin una suscripción de IA ni claves de un proveedor de modelos.

 

## 5. Docker y reproducibilidad

 

La tecnología es de libre elección. Entregar el código fuente, los `Dockerfile` necesarios, `.dockerignore`, `compose.yaml` o `docker-compose.yml`, y `.env.example` sin secretos reales.

 

El catedrático debe poder clonar el repositorio, configurar las variables documentadas y ejecutar:

 

```bash

docker compose up --build -d

```

 

Documentar cualquier comando adicional para migraciones, importación, cuentas de evaluación y pruebas. Todo debe ejecutarse mediante contenedores, sin exigir instalar en el equipo anfitrión el lenguaje, framework o motor de base de datos.

 

La base de datos debe persistir mediante un volumen. El arranque debe considerar la disponibilidad de sus dependencias. Documentar URL, puertos, versiones requeridas de Docker/Compose, cómo consultar logs, detener el sistema y reiniciarlo. Separar el procedimiento normal de apagado del reinicio destructivo de datos de prueba.

 

No basta con entregar una captura, una imagen publicada o un archivo comprimido: la solución debe poder construirse desde el repositorio.

 

## 6. Pruebas y criterios de aceptación

 

Automatizar como mínimo los siguientes escenarios; la interfaz también será revisada durante la evaluación:

 

| ID | Escenario | Resultado esperado |

|---|---|---|

| P01 | Inicio de sesión válido e inválido | Acceso correcto y rechazo de credenciales incorrectas |

| P02 | Acceso sin sesión, cierre de sesión y usuario inactivo | Operaciones protegidas rechazadas en los tres casos |

| P03 | Usuario de consulta intenta modificar datos | Rechazo en el servidor; lectura permitida |

| P04 | Crear una jerarquía y asignar un usuario | Relaciones válidas y recuperables |

| P05 | Código duplicado o referencia inexistente | Rechazo con mensaje comprensible |

| P06 | Importar el archivo original | 12 códigos de nivel 1 y 46 servicios de nivel 2; incidencias registradas |

| P07 | Repetir la importación | Ningún duplicado; resultado trazable |

| P08 | Revisar SE.12 y atributos ausentes | Política de conflicto aplicada y ausencias conservadas |

| P09 | Crear o editar servicio con mínimo mayor que máximo | Validación impide guardar |

| P10 | Buscar y filtrar servicios | Resultados coherentes con los criterios |

| P11 | Asignar responsable de una sección distinta | Operación rechazada |

| P12 | Reiniciar contenedores sin eliminar volúmenes | Persisten los datos previamente registrados |

 

Las pruebas deben aislar sus datos para no destruir la información de evaluación. Explicar qué escenarios cubren pruebas unitarias, de integración o de extremo a extremo y cómo se ejecutan.

 

## 7. Entrega en GitHub

 

1. Crear un repositorio con nombre identificable, por ejemplo `parcial-catalogo-servicios-<carnet>`.

2. Subir código, configuración Docker, migraciones, pruebas, Excel original y documentación. Excluir dependencias instaladas, archivos `.env` reales y secretos.

3. Agregar al usuario **`maldanap-usac`** como colaborador con acceso suficiente para clonar y revisar. Si el repositorio es privado, verificar que la invitación esté enviada e informar si sigue pendiente de aceptación; no basta con mencionar al usuario en el README.

4. Entregar por el medio indicado por el catedrático la URL del repositorio, nombre y carné del integrante, rama de entrega y SHA del commit final. Crear la etiqueta `parcial-v2.0` sobre ese commit.

5. Mantener disponible el repositorio y el commit entregado durante el período de calificación. Se evaluará ese estado del proyecto.

 

Estructura sugerida —puede adaptarse al framework elegido—:

 

```text

README.md

AGENTS.md

Dockerfile

compose.yaml

.dockerignore

.env.example

src/

tests/

scripts/

data/CatalogoServicios.xlsx

docs/RESOLUCION.md

docs/contexto/

docs/prompts/

docs/evidencias/

```

 

## 8. Documentación obligatoria en Markdown

 

El `README.md` debe permitir levantar y probar la solución desde un clon limpio. Incluir integrantes, requisitos, configuración, comandos exactos, URL, creación de cuentas de evaluación y ejecución de pruebas.

 

El archivo **`docs/RESOLUCION.md`** debe explicar cómo resolvieron la tarea e incluir:

 

1. Problema, alcance y supuestos.

2. Arquitectura y justificación de tecnologías.

3. Diagrama entidad-relación —puede utilizar Mermaid— y diccionario de datos con claves, relaciones y restricciones.

4. Mapeo Excel → base de datos, tratamiento de combinaciones, conflictos, ausencias y reporte de importación.

5. Autenticación, autorización, protección de contraseñas y decisiones de sesión.

6. Evidencias separadas de context engineering, prompt engineering y harness engineering, con enlaces a sus archivos y commits.

7. Matriz requisito → implementación → prueba → evidencia.

8. Resultados reales de pruebas: comando, fecha, commit y resultado; fallos encontrados y correcciones.

9. Instrucciones de Docker, persistencia y recuperación del entorno de evaluación.

10. Limitaciones conocidas, aportes de cada integrante y reflexión sobre errores de la IA y decisiones humanas.

 

No incluir conversaciones completas sin selección ni información sensible. Los extractos deben permitir verificar lo que ocurrió. No inventar resultados de pruebas ni evidencias de uso de IA.

 

## 9. Rúbrica de evaluación

 

| Criterio | Puntos | Evidencia de cumplimiento completo |

|---|---:|---|

| Modelo e importación del Excel | 15 | Campos y relaciones correctos, 12/46 registros, importación repetible y conflictos trazables |

| Funcionalidad del catálogo y organización | 20 | Mantenimientos, búsquedas, filtros, jerarquía, asignaciones y validaciones operativas |

| Autenticación y autorización | 10 | Acceso local, hash seguro, roles y protección comprobada en servidor |

| Context engineering | 10 | Contexto útil y versionado, selección explicada y dos actualizaciones justificadas |

| Prompt engineering | 10 | Cinco prompts utilizados y dos mejoras con resultados comprobados |

| Harness engineering | 10 | Rutina reproducible de trabajo y validación, límites y ciclo de corrección demostrado |

| Pruebas | 10 | Escenarios P01–P12 automatizados con resultados verificables |

| Docker y reproducibilidad | 10 | Construcción desde clon limpio, configuración clara y persistencia funcional |

| GitHub y documentación Markdown | 5 | Acceso del catedrático, commit identificado y documentación suficiente |

| **Total** | **100** | |

 

Cada criterio se calificará según evidencia: 100 % de sus puntos si está completo y verificable; 75 % con omisiones menores; 50 % si está parcialmente implementado; 25 % si solo hay avances mínimos; 0 % si está ausente o no hay evidencia verificable. Un problema de arranque no elimina automáticamente los puntos documentales, pero las funciones que no puedan ejecutarse no se considerarán demostradas.

 

## 10. Recorrido de calificación

 

El catedrático clonará el repositorio, seleccionará el commit entregado, seguirá el README y levantará el entorno con Docker. Ejecutará migraciones e importación, ingresará con ambos roles, revisará las relaciones organizacionales y el catálogo, repetirá la carga y comprobará la persistencia. Finalmente ejecutará las pruebas y contrastará los resultados con `docs/RESOLUCION.md` y las evidencias de las tres técnicas de ingeniería.

 

**La entrega está completa cuando otra persona puede clonar, ejecutar, verificar y comprender la solución siguiendo exclusivamente los archivos del repositorio.