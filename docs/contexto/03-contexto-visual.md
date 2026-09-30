# Contexto 03: actualización visual

## 1. Propósito

Este documento convierte la referencia visual proporcionada por el proyecto en decisiones de interfaz propias. Freshservice se utiliza únicamente como inspiración de estilo; no se copian logos, textos, imágenes, marca ni componentes propietarios.

La prioridad del parcial sigue siendo funcionalidad, importación, pruebas y Docker. El diseño debe ayudar a comprender el catálogo, no ocultar sus reglas.

## 2. Personalidad visual

La aplicación debe comunicar:

- profesionalismo sin verse pesada;
- orden y facilidad de uso;
- jerarquía clara entre navegación, contenido y acciones;
- estados visibles sin depender únicamente del color;
- espacio en blanco suficiente para leer tablas y formularios.

## 3. Tokens de diseño

Los colores se concentran en variables CSS para permitir ajustes sin buscar valores aislados:

| Token conceptual | Uso |
|---|---|
| `--color-primary` | navegación activa, enlaces y acción principal |
| `--color-primary-dark` | hover y foco de controles principales |
| `--color-bg` | fondo general gris muy claro |
| `--color-surface` | tarjetas, tablas y paneles |
| `--color-text` | texto principal |
| `--color-muted` | descripciones y metadatos |
| `--color-success` | activo, correcto o confirmado |
| `--color-danger` | error, inactivo o acción destructiva |
| `--color-warning` | revisión o advertencia |
| `--color-neutral` | desconocido o no disponible |
| `--radius-sm` / `--radius-md` | radios suaves de controles y tarjetas |
| `--shadow-subtle` | separación visual mínima |

La paleta aproximada parte de blanco, gris claro, azul corporativo sobrio, gris oscuro y semánticos verde, rojo, ámbar y gris.

## 4. Tipografía y espaciado

- Se utiliza una sans-serif moderna, preferentemente Inter si está disponible, con respaldo del sistema.
- Los títulos usan peso semibold.
- El cuerpo se mantiene alrededor de 14–16 px.
- El interlineado permite leer descripciones largas.
- Los espacios y tamaños se repiten mediante una escala consistente.
- El contraste debe ser suficiente en texto, botones, badges y estados.

## 5. Estructura de pantalla

~~~text
┌──────────────────────────────────────────────────────────┐
│ Barra superior: nombre, usuario, cerrar sesión            │
├───────────────┬──────────────────────────────────────────┤
│ Menú lateral  │ Área de contenido                        │
│               │ título + acciones + filtros + contenido  │
└───────────────┴──────────────────────────────────────────┘
~~~

Secciones principales:

- Servicios;
- Organización: Empresa, Área, Departamento, Sección y Puesto;
- Usuarios;
- Catálogos: clase, criticidad y tipo.

La pantalla de login utiliza una tarjeta centrada, campos etiquetados y mensajes de error comprensibles.

## 6. Componentes de servicio

### Tabla

La lista debe mostrar código, nombre, nivel 1, estado, clase, criticidad y tipo. Incluye búsqueda por código o nombre, filtros, paginación y estado visible.

### Ficha

La ficha muestra:

- código y nombre;
- badges de estado, criticidad, clase y tipo;
- servicio nivel 1 padre;
- descripción y métrica;
- mínimo y máximo;
- sección responsable;
- usuario responsable;
- datos de origen cuando corresponda.

### Badges

- `Activo` y éxito usan verde.
- `Inactivo` o error usan rojo.
- `En revisión` usa ámbar y texto explícito.
- `Desconocido` usa gris.
- La criticidad mantiene una escala visual de Very Low a Very High.

El color no es la única señal: cada badge tiene texto y, cuando aplica, ayuda contextual.

## 7. Roles en la interfaz

`ADMIN` ve acciones de crear, editar y desactivar. `CONSULTA` puede navegar y consultar la misma información, pero no ve acciones administrativas. Esta reducción visual mejora la experiencia, pero la protección real continúa en `AuthGuard` y `RolesGuard`.

## 8. Formularios y estados

- Las etiquetas se ubican sobre los campos.
- Los errores aparecen cerca del campo que debe corregirse.
- Los mensajes están en español comprensible.
- Los controles muestran estados de carga y error.
- Los campos obligatorios se identifican sin depender únicamente de color.
- El mínimo no puede superar el máximo.
- La selección de usuario responsable debe respetar su sección.

## 9. Accesibilidad y responsive

- Foco visible en enlaces, botones y campos.
- Navegación posible con teclado.
- Contraste suficiente.
- Botones con nombres claros.
- Tablas legibles en pantallas pequeñas mediante desplazamiento controlado o adaptación.
- El menú lateral y la barra superior no deben impedir el acceso al contenido.

## 10. Decisiones que no deben romperse

- No introducir CDNs obligatorios para que Docker funcione.
- No copiar identidad visual de Freshservice.
- No esconder errores de validación para que la pantalla “se vea limpia”.
- No presentar un servicio incompleto como completamente activo.
- No convertir la interfaz en una sustitución de la autorización del servidor.

## 11. Criterios de aceptación visual

La interfaz cumple este contexto cuando:

1. el login comunica claramente éxito y error;
2. la navegación diferencia las secciones del sistema;
3. la tabla permite localizar servicios por código y nombre;
4. los filtros muestran estados y catálogos;
5. SE.12 aparece con `En revisión` cuando corresponde;
6. el rol Consulta puede leer pero no modificar;
7. los formularios muestran errores comprensibles;
8. el layout conserva contraste, foco y legibilidad en pantallas pequeñas.
