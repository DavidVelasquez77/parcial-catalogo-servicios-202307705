# API y reglas de autorización

## Base de la API

- Prefijo: /api
- Puerto interno: 3000
- Swagger: /api/docs
- Sesión: cookie HTTP-only
- Formato: JSON
- CORS: limitado al origen configurado en WEB_ORIGIN

La API está protegida en el servidor. Las condiciones de la interfaz React no sustituyen los guards de NestJS.

## Autenticación

### POST /api/auth/login

Entrada:

~~~json
{
  "identifier": "admin.demo",
  "password": "Admin123!"
}
~~~

identifier acepta username o email.

Respuestas relevantes:

- 201: sesión creada y usuario resumido;
- 401: credenciales inválidas;
- 401: usuario inactivo o inexistente.

### GET /api/auth/me

Devuelve el usuario de la sesión actual sin password_hash.

- 200: sesión válida;
- 401: no existe sesión válida.

### POST /api/auth/logout

Destruye la sesión actual.

- 201: sesión invalidada;
- 401: si la ruta no tiene sesión.

## Servicios

### GET /api/services

Parámetros soportados:

| Parámetro | Uso |
|---|---|
| search | Busca en códigos y nombres de nivel 1 y nivel 2 |
| level1Id | Filtra por nivel 1 |
| status | ACTIVE, INACTIVE o REVIEW |
| classId | Filtra por clase |
| criticalityId | Filtra por criticidad |
| typeId | Filtra por tipo |
| page | Página |
| pageSize | Tamaño, limitado por el backend |

Ejemplo:

~~~text
/api/services?search=SE.12&status=REVIEW&pageSize=100
~~~

Respuesta conceptual:

~~~json
{
  "data": [],
  "page": 1,
  "pageSize": 100,
  "total": 3,
  "pages": 1
}
~~~

### GET /api/services/:id

Devuelve la ficha completa del servicio, sus catálogos, su nivel 1, sección y responsable.

### POST /api/services

Requiere ADMIN.

Campos principales:

~~~json
{
  "code": "SE.TEST.01",
  "name": "Servicio de prueba",
  "level1Id": 1,
  "status": "ACTIVE",
  "classId": 1,
  "criticalityId": 3,
  "typeId": 4,
  "description": "Descripción",
  "metric": "Disponibilidad",
  "minimum": 95,
  "maximum": 100,
  "responsibleSectionId": 1,
  "responsibleUserId": 1
}
~~~

Validaciones:

- code y name son obligatorios;
- level1Id debe existir;
- mínimo y máximo deben ser numéricos;
- mínimo no puede superar máximo;
- un responsable debe pertenecer a la sección seleccionada;
- las referencias inactivas o inexistentes se rechazan.

### PATCH /api/services/:id

Requiere ADMIN. Aplica las mismas validaciones de creación.

### DELETE /api/services/:id

Requiere ADMIN. No elimina físicamente: cambia el estado del servicio a INACTIVE.

### Servicios de nivel 1

Los niveles 1 representan las familias o agrupadores del catálogo. También tienen mantenimiento administrativo para que el catálogo no dependa únicamente de la importación del Excel.

| Método | Ruta | Requisito | Uso |
|---|---|---|---|
| GET | /api/services/level1 | Sesión | Listar niveles 1 activos y en revisión |
| POST | /api/services/level1 | ADMIN | Crear un nivel 1 |
| PATCH | /api/services/level1/:id | ADMIN | Editar código, nombre o estado |
| DELETE | /api/services/level1/:id | ADMIN | Bajar lógicamente un nivel 1 |

Reglas adicionales:

- el código de nivel 1 es único;
- no se permite duplicar códigos y la API responde HTTP 409;
- no se puede desactivar un nivel 1 que todavía tenga servicios nivel 2 activos o en revisión;
- la baja es lógica para conservar referencias y trazabilidad.

### Respuestas de conflicto

Las operaciones de creación y edición validan duplicados antes de insertar o actualizar. Cuando el código, username, correo o etiqueta de catálogo ya existe, la API responde HTTP 409 con un mensaje comprensible. Esto evita que la interfaz tenga que interpretar un error SQL genérico.

## Organización

Los valores de kind son:

- companies;
- areas;
- departments;
- sections;
- positions.

| Método | Ruta | Requisito |
|---|---|---|
| GET | /api/organization/:kind | Sesión |
| POST | /api/organization/:kind | ADMIN |
| PATCH | /api/organization/:kind/:id | ADMIN |
| DELETE | /api/organization/:kind/:id | ADMIN |

Una entidad subordinada recibe el padre correspondiente:

- areaId para departments;
- departmentId para sections;
- sectionId para positions.

Las altas y cambios de padre recorren la jerarquía completa y rechazan empresas,
áreas, departamentos o secciones inactivas, aunque el padre directo permanezca
activo. La desactivación es lógica. Tanto `DELETE` como `PATCH` con `active: false`
verifican que no existan dependientes activos; esto evita que una modificación
parcial de la interfaz deje registros huérfanos o una jerarquía inconsistente.

En creación, el padre debe existir y estar activo.

## Usuarios

| Método | Ruta | Requisito |
|---|---|---|
| GET | /api/users | ADMIN |
| POST | /api/users | ADMIN |
| PATCH | /api/users/:id | ADMIN |

La creación exige nombre, username, contraseña de mínimo ocho caracteres, rol y
un puesto cuya cadena Empresa → Área → Departamento → Sección → Puesto esté
activa. La edición permite actualizar nombre, correo, rol, puesto y estado; el
correo se valida como único y un cambio de puesto vuelve a validar toda la
jerarquía. El usuario puede tener el mismo puesto que otros usuarios, pero nunca
se guarda una asociación nueva contra un antecesor inactivo.

El password nunca se devuelve. El usuario se relaciona con un puesto, y la empresa se obtiene transitivamente mediante la jerarquía.

## Catálogos

Los valores de kind son:

- classes;
- criticalities;
- types.

| Método | Ruta | Requisito |
|---|---|---|
| GET | /api/catalogs/:kind | Sesión |
| POST | /api/catalogs/:kind | ADMIN |
| PATCH | /api/catalogs/:kind/:id | ADMIN |

Los catálogos se usan en los formularios para evitar texto libre en las clasificaciones.

## Importaciones

| Método | Ruta | Requisito |
|---|---|---|
| GET | /api/imports | ADMIN |
| POST | /api/imports/validate | ADMIN |
| POST | /api/imports/run | ADMIN |

La ruta de ejecución utiliza IMPORT_FILE, que dentro de Docker apunta a /app/data/CatalogoServicios.xlsx.

POST /api/imports/validate inspecciona el archivo configurado sin insertar, actualizar ni crear un import_run. Comprueba que el archivo sea legible, que exista la hoja Servicios Externos, que la fila 4 tenga las columnas A:L esperadas, que haya códigos de servicio y que los campos numéricos y umbrales sean válidos.

La importación es una sincronización incremental por código:

- un código que no existe se inserta;
- un código existente con cambios se actualiza;
- un código existente sin cambios se cuenta como skipped y no recibe un UPDATE innecesario;
- un código que desapareció del Excel no se elimina ni se desactiva automáticamente, para evitar pérdida silenciosa de trazabilidad;
- las asignaciones de responsable no se reemplazan por valores vacíos del Excel.

## Matriz de autorización

| Operación | Público | CONSULTA | ADMIN |
|---|---:|---:|---:|
| Ver login | Sí | Sí | Sí |
| Consultar servicios | No | Sí | Sí |
| Consultar organización | No | Sí | Sí |
| Consultar catálogos | No | Sí | Sí |
| Crear o editar servicio | No | No | Sí |
| Crear o editar organización | No | No | Sí |
| Crear o editar usuario | No | No | Sí |
| Ejecutar importación | No | No | Sí |

## Ejemplo de prueba de autorización

El smoke test inicia sesión con consulta.demo e intenta:

~~~text
POST /api/services
~~~

El resultado esperado es HTTP 403. Esto verifica que la autorización está en el backend y no solo en los botones del navegador.
