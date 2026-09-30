# Prompt 03: autenticación y autorización

## Propósito

Implementar acceso local con seguridad real en el servidor.

## Contexto suministrado

- El enunciado exige usuario o correo y contraseña.
- Se requiere bcrypt con sal.
- Existen ADMIN y CONSULTA.
- Ocultar botones no es autorización.
- La sesión debe invalidarse en logout.
- Se necesitan cuentas demo reproducibles.

## Prompt inicial representativo

~~~text
Implementa autenticación local con usuario o correo, bcrypt, sesión HTTP-only persistida en PostgreSQL y roles ADMIN/CONSULTA. Verifica la cuenta activa en cada solicitud. Ocultar botones no es autorización: protege también los endpoints. No devuelvas password_hash. Documenta logout, cuentas demo, pruebas 401/403 y ausencia de secretos reales.
~~~

## Restricciones

- No usar proveedor externo de identidad.
- No guardar contraseñas en texto plano.
- No exponer password_hash.
- Rechazar usuarios inactivos.
- Aplicar RolesGuard en operaciones de administración.

## Salida esperada

- endpoints de login, logout y sesión actual;
- guard de autenticación;
- guard de roles;
- seed reproducible;
- smoke test.

## Criterio de aceptación

- credencial inválida → 401;
- credencial válida → sesión;
- CONSULTA leyendo → 200;
- CONSULTA escribiendo → 403;
- después de logout → 401.

## Resultado aplicado

Se implementaron AuthGuard, RolesGuard, sesión PostgreSQL y smoke.js con los escenarios P01, P02 y P03.

## Prompt final

~~~xml
<prompt id="03-autenticacion" version="final">
  <role>
    <name>Ingeniero backend especializado en autenticación de aplicaciones web</name>
    <responsibility>
      Implementar sesión local y autorización por rol con protección real en servidor.
    </responsibility>
  </role>
  <objective>
    Permitir login por usuario o correo, mantener una sesión segura y distinguir
    claramente entre lectura de CONSULTA y operaciones administrativas de ADMIN.
  </objective>
  <project_context>
    <api>NestJS con controladores, guards y servicios</api>
    <database>PostgreSQL con tabla de sesiones</database>
    <password_hash>bcrypt con sal</password_hash>
    <roles>
      <role name="ADMIN">puede crear, editar y desactivar según el módulo</role>
      <role name="CONSULTA">solo lectura</role>
    </roles>
    <client>React con controles visuales condicionados por sesión</client>
    <demo_accounts>seed-demo.js repetible y local</demo_accounts>
  </project_context>
  <implementation_tasks>
    <task order="1">Crear login que acepte username o email.</task>
    <task order="2">Comparar la contraseña contra bcrypt sin exponer el hash.</task>
    <task order="3">Crear cookie de sesión HTTP-only respaldada por PostgreSQL.</task>
    <task order="4">Validar existencia y estado activo de la cuenta en cada solicitud.</task>
    <task order="5">Aplicar AuthGuard a rutas protegidas.</task>
    <task order="6">Aplicar RolesGuard a rutas administrativas.</task>
    <task order="7">Invalidar la sesión en logout y comprobar /auth/me.</task>
    <task order="8">Preparar seed de cuentas demo sin duplicarlas.</task>
    <task order="9">Agregar pruebas 401, 200, 201 y 403.</task>
  </implementation_tasks>
  <security_constraints>
    <constraint>No guardar contraseñas en texto plano.</constraint>
    <constraint>No devolver password_hash en ningún DTO o endpoint.</constraint>
    <constraint>No confundir ocultar botones con autorización.</constraint>
    <constraint>Un usuario inactivo no puede iniciar sesión.</constraint>
    <constraint>CONSULTA recibe 403 al intentar escribir aunque construya la petición manualmente.</constraint>
    <constraint>No depender de un proveedor externo de identidad.</constraint>
    <constraint>No versionar secretos reales.</constraint>
  </security_constraints>
  <deliverables>
    <deliverable>AuthController y AuthService.</deliverable>
    <deliverable>AuthGuard y RolesGuard.</deliverable>
    <deliverable>Configuración de sesión persistida.</deliverable>
    <deliverable>Seed demo repetible.</deliverable>
    <deliverable>Prueba smoke y escenarios de aceptación.</deliverable>
    <deliverable>Documentación de credenciales locales y límites de producción.</deliverable>
  </deliverables>
  <acceptance_criteria>
    <criterion>Credencial inválida devuelve 401.</criterion>
    <criterion>Credencial válida crea sesión y permite /auth/me.</criterion>
    <criterion>Cuenta inactiva no puede autenticarse.</criterion>
    <criterion>CONSULTA puede leer y recibe 403 al escribir.</criterion>
    <criterion>ADMIN puede ejecutar operaciones autorizadas.</criterion>
    <criterion>Después de logout, la sesión deja de funcionar.</criterion>
  </acceptance_criteria>
  <validation>
    <command>npm run typecheck</command>
    <command>docker compose exec api node apps/api/dist/scripts/smoke.js</command>
    <command>npm test</command>
  </validation>
  <response_format>
    Reportar flujo de login, almacenamiento de sesión, protección por ruta,
    respuestas esperadas, archivos cambiados y pruebas ejecutadas.
  </response_format>
</prompt>
~~~

## Verificación y artefactos

- Guards: `apps/api/src/auth/`.
- Sesiones y usuarios: `database/migrations/001_init.sql` y módulos de usuarios.
- Prueba rápida: `apps/api/src/scripts/smoke.ts`.
- Aceptación: P01, P02 y P03, además de autorización en módulos administrativos.
