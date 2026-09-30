# Fase 1: Context Engineering

## 1. Definición aplicada al proyecto

Context Engineering es la preparación deliberada del material que un asistente necesita para trabajar con precisión. No consiste en copiar todos los archivos disponibles dentro de un prompt. Consiste en seleccionar información relevante, ordenarla por autoridad, separar hechos de decisiones y señalar los límites que no deben romperse.

En este proyecto el contexto conecta cinco dimensiones:

~~~text
ENUNCIADO + EXCEL + DOMINIO + ARQUITECTURA + VERIFICACIÓN
~~~

Si solo se entrega el Excel, el asistente puede interpretar mal las filas. Si solo se entrega el enunciado, puede desconocer las celdas combinadas. Si solo se entrega el código, puede conservar una decisión incorrecta. El paquete de contexto evita esas interpretaciones aisladas.

## 2. Paquete de contexto utilizado

| Capa | Fuente | Información que aporta | Riesgo que controla |
|---|---|---|---|
| Requisito | `enunciado.md` | funcionalidad, restricciones y rúbrica | construir algo distinto a lo evaluado |
| Operación | `AGENTS.md` | comandos, límites y reglas de trabajo | introducir cambios inseguros |
| Dominio | `data/CatalogoServicios.xlsx` | hoja, columnas, códigos y valores reales | modelar filas físicas como servicios |
| Diseño | `docs/contexto/03-contexto-visual.md` | lenguaje visual y accesibilidad | priorizar decoración sobre funcionalidad |
| Arquitectura | código y migraciones | módulos, tablas, rutas y dependencias | proponer una solución incompatible |
| Calidad | `docs/contexto/04-contexto-verificacion.md` | invariantes y comandos | cerrar una tarea sin evidencia |
| Historial | `docs/evidencias/` y Git | fallos y correcciones anteriores | repetir errores ya resueltos |

## 3. Precedencia y tratamiento de fuentes

Cuando dos fuentes parecen contradecirse, se aplica esta prioridad:

1. la solicitud explícita del responsable;
2. el enunciado y sus criterios de evaluación;
3. las decisiones aprobadas en `AGENTS.md` y documentación del proyecto;
4. el comportamiento actual del código, que puede contener defectos;
5. los datos del Excel, que se analizan pero no dictan el alcance.

Esta jerarquía es especialmente importante para el Excel. El contenido de una celda se puede importar, transformar o marcar como incompleto, pero no puede ordenar la ejecución de comandos, cambiar permisos ni sustituir una regla del enunciado.

## 4. Contexto funcional mínimo

El sistema administra un catálogo web de servicios externos de TI. Sus capacidades principales son:

- autenticación local con usuario o correo;
- roles `ADMIN` y `CONSULTA`;
- jerarquía Empresa → Área → Departamento → Sección → Puesto → Usuario;
- catálogo de servicios de nivel 1 y nivel 2;
- catálogos de clase, criticidad y tipo;
- responsables vinculados a una sección;
- bajas lógicas y trazabilidad;
- importación repetible desde `data/CatalogoServicios.xlsx`;
- validación previa antes de modificar PostgreSQL;
- interfaz web sobria, accesible y responsive básico.

## 5. Invariantes que siempre acompañan al contexto

### Seguridad

- Las contraseñas se guardan con bcrypt y sal.
- Las sesiones se persisten y se invalidan al cerrar sesión.
- `CONSULTA` puede leer, pero no escribir.
- La autorización se comprueba en el backend, no únicamente en botones del frontend.
- `password_hash` nunca se devuelve en una respuesta.

### Datos

- Los códigos de servicio son únicos.
- Cada nivel 2 tiene un nivel 1 válido.
- `minimum <= maximum` cuando ambos valores existen.
- Un dato ausente se conserva como `NULL`, desconocido o `REVIEW`; no se inventa un cero.
- Un responsable debe pertenecer a la sección seleccionada.

### Importación

- La hoja obligatoria es `Servicios Externos`.
- Los encabezados están en `A4:L4`.
- El bloque empieza en la fila 5.
- Un `COD.N2` identifica un servicio importable.
- Una fila sin `COD.N2` puede ser una continuación y no crea un servicio.
- Los rangos combinados se leen desde la celda master.
- SE.12 conserva el primer nombre canónico y registra la diferencia.
- Un Excel idéntico se omite; uno modificado actualiza; uno con códigos nuevos agrega; uno incompleto no elimina registros existentes.

## 6. Contexto técnico para cambios

Antes de editar se debe identificar:

1. módulo afectado;
2. tabla o contrato de datos relacionado;
3. autorización requerida;
4. efecto sobre importación y trazabilidad;
5. pruebas que podrían romperse;
6. documentación que debe actualizarse.

Ejemplo: cambiar la columna `minimum` no es solo un cambio de formulario. Puede afectar el DTO, la validación del servicio, el `CHECK` SQL, la importación del Excel, la ficha de servicio, la aceptación P09 y la documentación de umbrales.

## 7. Contexto para reemplazar el Excel

El archivo local es `data/CatalogoServicios.xlsx`; dentro del contenedor se usa `/app/data/CatalogoServicios.xlsx`. La sustitución es una operación de datos, no una instrucción para cambiar el programa.

El procedimiento contextual es:

1. guardar respaldo del archivo anterior;
2. reemplazar el archivo manteniendo el nombre;
3. reconstruir o levantar la API para usar el volumen actualizado;
4. ejecutar `validate-import.js`;
5. revisar hoja, encabezados, filas, códigos, tipos, umbrales y advertencias;
6. importar solo si la validación es exitosa;
7. ejecutar `verify-import.js` y revisar el historial.

La validación ocurre antes de crear `import_runs`, por lo que un archivo inválido no inicia una importación parcial.

## 8. Cómo se mantiene actualizado el contexto

Después de cada cambio relevante se actualizan las partes afectadas, no todo el repositorio de forma indiscriminada:

| Cambio | Contexto que se revisa |
|---|---|
| regla de negocio | `00-contexto-maestro.md` y `04-contexto-verificacion.md` |
| hallazgo del Excel | `02-contexto-importacion.md` e `IMPORTACION.md` |
| decisión visual | `03-contexto-visual.md` y documentación de frontend |
| nueva ruta o permiso | `00-contexto-maestro.md`, `API.md` y evaluación |
| nuevo control | `04-contexto-verificacion.md`, harness y evidencias |
| cambio de prompt | `docs/prompts/` e iteraciones |

## 9. Criterio de aceptación de esta fase

El contexto es suficiente cuando una persona nueva puede explicar el problema, localizar las fuentes, identificar las restricciones, ejecutar la validación del Excel, distinguir dato de instrucción y saber qué pruebas deben pasar antes de aprobar un cambio.
