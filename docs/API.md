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

En creación, el padre debe existir y estar activo.

## Usuarios

| Método | Ruta | Requisito |
|---|---|---|
| GET | /api/users | ADMIN |
| POST | /api/users | ADMIN |
| PATCH | /api/users/:id | ADMIN |

La creación exige nombre, username, contraseña de mínimo ocho caracteres, rol y puesto activo.

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
| POST | /api/imports/run | ADMIN |

La ruta de ejecución utiliza IMPORT_FILE, que dentro de Docker apunta a /app/data/CatalogoServicios.xlsx.

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
