# Ficha · Crear empresa con módulos, editarla y ajustar su cantidad de usuarios (consola del operador)

**Versión 1 · 2026-11-16 · Estado: DISEÑO, sin construir.** Pedido del usuario: poder **editar la cantidad de personas de una empresa**; que **crear una empresa** abra un **formulario completo** (datos + módulos); y luego poder **modificarla y agregar módulos**. Es la ronda 3 (A4, A5, A6) junto con `FICHA-ESTADO-DE-CUENTA.md`. Reparto: servidor e integración = modules-5a; pantallas de `apps/web/src/plataforma/**` = modules-ed.

## 1. Qué hay hoy (verificado)

- **Crear empresa:** solo `nombre` y `correoDelDueno` (`plataforma/hoja-empresa-nueva.tsx`, herramienta `plataforma_empresas_crear`). Después hay que activar cada módulo uno por uno.
- **Límite de usuarios:** existe **por módulo** (`core.empresa_modulos.max_usuarios`, campo «Máximo de usuarios» en la hoja de contrato). No hay un límite **de la empresa entera**.
- **Datos de la empresa:** razón social, RUC, dirección, teléfono, correo, logo y pie están en `core.empresa_config` (migración 0021), los edita la propia empresa; el operador no los ve ni los edita.
- **Editar el nombre** desde la consola: no existe.

## 2. Decisiones de producto propuestas

1. **Límite de personas por empresa** (total de usuarios con acceso, sin contar al operador) además del límite por módulo. Vacío = sin límite. Si se baja por debajo de los usuarios actuales, **no se expulsa a nadie**: se bloquean nuevas invitaciones y se avisa.
2. **Alta en un formulario de tres pasos:** (1) empresa y dueño; (2) plan y módulos (con estado inicial: activo o prueba con días; precio y vigencia opcionales); (3) límites (personas) y resumen. Se crea todo **en una sola operación**; si algo falla, no queda nada a medias.
3. **Plan = plantilla:** elegir un plan marca sus módulos y precios, que se pueden ajustar antes de crear («sin plan» permite elegir a mano).
4. **Edición posterior** desde la ficha: nombre, datos de contacto/comercial (A4), límite de personas, plan, y **agregar o quitar módulos** (reusa activar/suspender/dar de baja/reactivar). Cada cambio con motivo e historial.
5. Solo operadores; la empresa no puede cambiar sus propios límites ni módulos.

## 3. Servidor (modules-5a)

| Pieza | Detalle |
|---|---|
| Migración | `core.empresa_cuenta` (o columnas en `empresa_config`): `max_usuarios` (nullable, `> 0`), `contacto_nombre`, `contacto_correo`, `contacto_telefono`, `nota_comercial`; revisar si 0022 ya trae algo de esto para no duplicar |
| `plataforma_empresas_crear` | Ampliar: `modulos[]` (`modulo`, `estado` inicial, `pruebaDias`, `precioAcordadoCentimos`, `vigenteHasta`, `maxUsuarios`), `plan?`, `maxUsuariosEmpresa?`; atómica (una transacción); respeta dependencias de módulos |
| `plataforma_empresa_editar` | Nombre, contacto, nota, `maxUsuariosEmpresa`; con motivo; historial |
| Aplicación del límite | Al **invitar o aceptar** un miembro (módulo `miembros`/invitaciones): rechazar con código claro si se supera el límite de la empresa; el del módulo ya existe |
| `plataforma_empresas_ver` | Devolver límite, usuarios actuales y contacto |
| Pruebas de integración | Alta atómica con tres módulos; rechazo por dependencia; límite bloquea invitación N+1 pero no expulsa; bajar el límite bajo el actual no borra nada; solo operador; historial registrado |

## 4. Pantallas (modules-ed, tras integrar el servidor)

- **Asistente «Nueva empresa»** de tres pasos (hoja ancha en escritorio, pantalla completa en móvil): tarjetas de módulo con nombre + código, interruptor y estado inicial; barra de «usuarios: X de N»; resumen con precio mensual acordado.
- **Ficha de empresa:** botón «Editar» (nombre, contacto, límite de personas), medidor «Personas: 7 de 10», botón «Agregar módulo» y acciones por módulo ya existentes.
- Todo con confirmación y motivo en cambios críticos, estados vacíos y errores claros; claro y oscuro; 390 y 1280 px.

## 5. Fuera de alcance

Cobro automático, edición de datos fiscales de la empresa por el operador (los gestiona la empresa), borrado de empresas, suspensión automática por mora.

## 6. Decisiones que necesita el usuario

1. ¿El límite de personas es **por empresa**, **por módulo** o **ambos**? (Recomendación: ambos; el de empresa es el que se ve y se factura.)
2. ¿Qué datos de contacto quiere guardar de cada cliente además del correo del dueño?
