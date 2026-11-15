# Cómo crear un módulo (o una entidad) en Capaz ERP

Receta seguida en la fase 7 (clientes, productos y sucursales). Úsala para los carriles de las olas 2 y 3. Los ejemplos salen de `apps/api/src/core/clientes/`; cambia `clientes` por el código de tu módulo (en `modules/<codigo>/` el árbol es el mismo).

Reglas que mandan en todo el recorrido (AGENTS.md): una sola puerta a la base (`conEmpresa`), una sola puerta a las operaciones (`ejecutar()`), empresa, usuario y permisos salen de la sesión, dinero en enteros, un módulo no importa a otro.

## 1. Orden de trabajo

1. Datos (carril de datos): tabla con `tenant_id`, aislamiento, llaves compuestas, índices por `tenant_id`, migración a mano.
2. `domain/`: reglas puras.
3. `repositories/`: acceso a la tabla.
4. Contrato en `@capaz/shared`.
5. `herramientas/` y su proveedor.
6. Eventos.
7. Pruebas por HTTP.
8. Pantalla.

## 2. Capas

```
core/clientes/
  domain/          reglas puras, sin base ni framework: normalizar, validar, cursor
  repositories/    funciones que reciben (tx, ctx, ...) y hablan con Drizzle
  herramientas/    una herramienta por operación + el proveedor de Nest
  clientes.module.ts
```

- **domain/**: funciones puras con prueba unitaria. Ejemplo: `prepararCliente(entrada)` normaliza el nombre (sin tildes, minúsculas, espacios simples), valida el documento por tipo y devuelve `{ ok: true, datos }` o `{ ok: false, campo, motivo }`.
- **repositories/**: reciben la transacción de `conEmpresa` y el contexto `{ empresaId, usuarioId }`. El `where` por empresa va siempre (defensa en profundidad; la base ya aísla por RLS). Nunca abren conexión. Un choque de unicidad se resuelve con `onConflictDoNothing()` y una consulta que explica el choque, no con una excepción. Pruébalos contra la base real con dos empresas.
- Listados con cursor: ordena por `(nombre_normalizado, id)` y devuelve `{ items, siguiente }`; el cursor es opaco.

## 3. Contrato

Un archivo por área: `packages/shared/src/contratos/<area>.ts`. Solo ese carril lo edita; `index.ts` ya lo reexporta.

```ts
export const contratosDeClientes = {
  clientes_listar: contrato(listarClientesSchema, listadoSchema(clienteSchema)),
  clientes_crear: contrato(crearClienteSchema, clienteSchema),
  ...
} as const;
export const eventosDeClientes = { 'cliente.creado': z.strictObject({ ... }) } as const;
```

- Nombre de herramienta: `entidad_accion` (`clientes_buscar`, `sucursal_crear`).
- Todo con `z.strictObject`: un campo desconocido es `argumentos_invalidos`.
- Listados: `paginaSchema.shape` en la entrada (`limite`, `cursor`) y `listadoSchema(item)` en la salida.
- Nunca pidas `empresaId`, `usuarioId` ni permisos como argumento (el ejecutor los rechaza con `argumento_prohibido`).
- Editar recibe `id` más solo lo que cambia, al menos un campo; un dato opcional con `null` se borra.
- Dinero: céntimos o milésimas enteras (`z.number().int().safe().min(0)`), nunca decimales.
- Fechas en la salida: `z.iso.datetime()`; el repositorio devuelve `Date` y el mapeo llama `toISOString()`.
- Eventos: `entidad.hecho`, carga con `id` y campos no sensibles (nunca documento, teléfono ni correo).

Tras editar el contrato: `pnpm --filter @capaz/shared build`.

## 4. Herramienta

Cada operación es un `definirHerramienta(nombre, {...})` en `herramientas/`:

```ts
export const clientesCrear = definirHerramienta('clientes_crear', {
  modulo: 'core',                 // código del manifiesto
  permiso: 'clientes:editar',     // debe estar en el manifiesto de ese módulo
  criticidad: 'normal',           // lectura | normal | critica
  idempotente: true,              // acepta Idempotency-Key
  ayuda: { ... },                 // obligatoria: alimenta «qué puedo decir» y al asistente
  auditar: (args, datos) => ({ entidadTipo: 'cliente', entidadId: datos?.id }),
  async ejecutar(args, ctx, tx) { ... return exito(dto) / rechazo(codigo, mensaje, candidatas?) },
});
```

- `ejecutar` recibe la transacción del ejecutor: todo acceso a la base va por `tx`; nunca abras otra. Si devuelves `rechazo`, el ejecutor revierte toda la transacción (también el evento).
- Códigos de rechazo del catálogo (`packages/shared/src/codigos.ts`): `no_encontrado` (también para lo de otra empresa), `conflicto`, `argumentos_invalidos`. El estado HTTP sale del catálogo.
- Un duplicado devuelve `conflicto` con `candidatas` (`{ id, nombre, detalle }`): el existente y los más parecidos. La pantalla y la voz ofrecen «usar este».
- Críticas (`criticidad: 'critica'`): obligan a definir `resumir(args, ctx, tx)`, que devuelve el texto para el usuario y una `huella` (`hashCanonico`) del estado sobre el que se confirma. El ejecutor responde `requiereConfirmacion` con un token; la segunda llamada lleva `confirmacion`.
- `auditar` solo con campos seguros (ids, nombres de campos, banderas), nunca datos personales.
- Mapeo fila a DTO en un archivo aparte (`cliente-mapeo.ts`).
- Una función no pasa de 50 líneas ni un archivo de 500: divide en lectura y escritura.

## 5. Proveedor y registro

```ts
@Injectable()
export class HerramientasDeClientes implements OnModuleInit {
  constructor(@Inject(RegistroDeHerramientas) private readonly registro: RegistroDeHerramientas) {}
  onModuleInit() { this.registro.agregar([clientesListar, clientesVer, ...]) }
}
```

Y en el módulo de Nest: `@Module({ providers: [HerramientasDeClientes] })`. El módulo ya está importado en `app.module.ts` (lo hace el integrador). Al terminar el arranque el registro valida: cada herramienta tiene contrato y cada contrato herramienta, el permiso está en el manifiesto, las críticas tienen `resumir` y la ayuda es válida. Si falla, el servidor no arranca.

Para un módulo de `modules/<codigo>/`, `modulo` es su código y el permiso debe existir en su `<codigo>.manifest.ts`. Un permiso nuevo del núcleo es solicitud de cambio a `manifiesto-core.ts`.

Permisos: el del manifiesto decide. Un `member` con nivel `lectura` solo recibe los permisos de `permisosPorNivel.lectura`; pruébalo siempre.

## 6. Eventos

```ts
await emitir(tx, 'cliente.creado', { id, nombre, tipo, clase });
```

`emitir` va **dentro** de `ejecutar`, con la misma `tx`: si la operación se revierte, el evento no existe. La carga se valida contra el esquema de `EVENTOS`. Emite después de que el cambio ya se hizo y solo si de verdad cambió algo.

## 7. Pruebas

- Unitarias del dominio (`*.spec.ts`).
- Repositorios contra la base real con dos empresas (`*.int.spec.ts`).
- Por HTTP (`*.int.spec.ts`), con `levantarApp`, `abrirSesion` y `crearEmpresa` (`core/herramientas/http-de-pruebas.ts`); ejemplo completo: `core/clientes/herramientas/datos-maestros.int.spec.ts`. Cubre como mínimo:
  - alta correcta y su evento en `core.eventos_salida`;
  - validación (campo inválido, campo de más) y duplicado con `candidatas`, sin evento;
  - un `member` con nivel `lectura` lee pero recibe `sin_permiso` al escribir;
  - otra empresa no ve nada: por id, listado y búsqueda (`no_encontrado`);
  - idempotencia con `Idempotency-Key`;
  - archivar y restaurar; paginación con cursor;
  - una crítica pide confirmación y no cambia nada hasta confirmar.
- Comando: `npx vitest run -c vitest.int.config.ts <ruta>` dentro de `apps/api`; al final `pnpm check`.

## 8. Pantalla

En `apps/web/src/app/<area>/`: lista con el componente `Lista` (búsqueda y estado vacío), alta en hoja inferior (móvil) o diálogo (escritorio), y `Ficha` con edición, archivar y restaurar. Todo con el kit (`shared/ui`), sin estilos sueltos, móvil primero y revisado a 390 y 1280 px en claro y oscuro. La pantalla llama a las herramientas por `POST /api/v1/herramientas/:nombre`; nunca a un servicio propio.

## 9. Lista de comprobación

- [ ] La tabla cumple las reglas 5 y 18 de AGENTS.md.
- [ ] Contrato `strictObject`, sin argumentos de contexto.
- [ ] Toda herramienta con `ayuda` y `permiso` del manifiesto.
- [ ] Todo acceso a la base dentro de `tx`.
- [ ] Eventos con `emitir(tx, ...)` y sin datos personales.
- [ ] Pruebas por HTTP con dos empresas y un `member` de lectura.
- [ ] `pnpm check` en verde.
