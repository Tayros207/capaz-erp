# Consola de plataforma, planes y accesos

**Fecha:** 2026-11-11 · **Estado:** decisiones de alcance cerradas (sección 8); falta aprobar el detalle · Nuevo requisito del usuario: controlar desde la interfaz qué empresa, usuario o cliente accede a qué módulo (por ejemplo Cotizador sí, Registro no), poder subir y bajar de nivel, dar precios mejores y administrar a los clientes con un CRM.

## 1. Tres niveles de control

| Nivel | Quién lo opera | Qué decide | Dónde |
|---|---|---|---|
| **Plataforma** | Tú (y Keny) como dueños de Capaz | Qué empresas existen, qué módulos tiene cada una, plan, precio, vigencia, límites | Consola `/plataforma` |
| **Empresa** | El administrador de cada empresa cliente | Qué usuarios suyos entran a qué módulo y con qué rol | Pantalla «Usuarios y accesos» |
| **Usuario** | El propio sistema | Qué acciones puede hacer dentro de un módulo | Permisos de cada herramienta |

Regla: **la empresa no puede activarse un módulo sola.** Si un usuario ve un módulo no contratado, solo puede pulsar «Solicitar».

## 2. Lo que ya está diseñado (en Cotizín, para reaprovechar)

- `modulos`: catálogo (código, nombre, esquema, `dependeDe`, `porDefecto`).
- `empresa_modulos`: estado `prueba` (con vencimiento), `activo` o `baja` (solo lectura); fechas de alta y baja y motivo.
- `empresa_modulos_eventos`: historial de solo inserción con evento, estado anterior y nuevo, motivo y actor.
- `modulo_activo(tenant, modulo)`: la base bloquea la escritura si el módulo está en baja o con la prueba vencida.
- `activar_modulo` y `dar_baja_modulo`: solo para el rol propietario (la plataforma).

## 3. Lo que falta agregar

| Falta | Para qué |
|---|---|
| `core.planes` y `core.plan_modulos` | Catálogo de planes: qué módulos incluye cada uno, precio mensual en céntimos de sol y usuarios incluidos |
| Precio por empresa | Precio acordado y descuento por módulo, con vigencia, para dar mejores precios a un cliente concreto |
| Estado `suspendido` | Pausar sin dar de baja (por ejemplo, mora): lectura sí, escritura no |
| `core.usuario_modulos` | Qué módulo y rol tiene cada usuario de la empresa (ya aceptado: sin módulos hasta que el administrador los asigne) |
| `core.solicitudes_modulo` | Cuando un usuario pulsa «Solicitar»; llega a la consola y se convierte en una oportunidad del CRM |
| Límites | Usuarios máximos por módulo (para subir y bajar de nivel) |
| `core.plataforma_admins` | Quién puede entrar a la consola |

## 4. Subir y bajar de nivel

```
No contratado ──► Prueba (con días) ──► Activo ──► Suspendido
                       │                   │            │
                       └──────► Baja ◄─────┴────────────┘
                              (solo lectura)
                                  │
                                  └──► Reactivación
```

- **Subir:** activar un módulo o cambiar a un plan con más módulos, usuarios o mejor precio; vale al instante.
- **Bajar:** el módulo pasa a baja y queda en **solo lectura**; los datos **nunca se borran**.
- Todo cambio queda en el historial: quién, cuándo, de qué estado a cuál y por qué.
- Sin pasarela de pago al inicio: registras el precio acordado y el vencimiento, y cobras por fuera. El cobro automático queda para después.

## 5. Pantallas de la consola (solo plataforma)

1. **Empresas:** lista con estado, módulos contratados y vencimientos próximos.
2. **Ficha de la empresa:** interruptor por módulo (prueba, activo, suspendido, baja), plan, precio y descuento, vigencia, límites, historial y notas.
3. **Planes y precios:** catálogo editable, con historial de precios.
4. **Solicitudes y vencimientos:** pruebas por vencer, solicitudes pendientes y suspensiones.
5. **Resumen:** empresas activas, módulos más contratados, ingresos mensuales acordados.

Pantalla de cada empresa: **Usuarios y accesos**, para asignar módulo y rol a sus usuarios.

## 6. El CRM

Hay dos usos de la misma pieza, y hay que confirmarlo (sección 8):
- **CRM del operador (tú):** tus clientes son las imprentas que contratan Capaz. Datayros usa el módulo CRM como una empresa más; cada cliente suyo se vincula a la empresa de Capaz que contrató. Así las solicitudes de módulo caen como oportunidades.
- **CRM de cada empresa:** lo que verán tus clientes para administrar los suyos; en la V1 son los clientes del núcleo con su historial.

## 7. Seguridad

1. La consola es un área aparte, con su propia guarda y su propia ruta de API (`/api/v1/plataforma`). Solo entran los usuarios de `core.plataforma_admins`.
2. Las operaciones de plataforma cruzan empresas, así que **no usan el rol de aplicación con RLS**. Pasan por funciones controladas (como `activar_modulo`), ejecutadas por un rol propio, **todas auditadas**.
3. **La plataforma ve contratos y uso, no los datos del negocio de cada empresa.** Solo cifras agregadas: usuarios activos, módulos y última actividad. Ver movimientos, deudas o cotizaciones de un cliente no forma parte de la consola.
4. Si algún día se agrega «entrar como la empresa» para dar soporte, exige consentimiento y auditoría propia. No se incluye hoy.
5. Recomendación: segundo factor de autenticación para los administradores de plataforma.

## 8. Decisiones (2026-11-11)

1. **CRM:** ambos usos con la misma pieza. Datayros usa el módulo CRM para sus clientes y cada empresa lo usa para los suyos.
2. **Precios:** por módulo y por paquetes (planes), con precio especial por empresa y vigencia.
3. **Momento:** la consola se construye **antes del segundo cliente**. Para el piloto de una empresa, los módulos se activan con la función de base de datos.

## 9. Dónde encaja en el plan

- Las tablas de planes, precios, suspensión, `usuario_modulos` y solicitudes entran en la **fase 4** (módulos, contratación y permisos).
- La consola es la **fase 9**, que depende de las fases 4 y 7.
- Hasta que la fase 9 exista, para el piloto (una sola empresa) los módulos se activan por función de base de datos, sin pantalla.
