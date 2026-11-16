import { exito, rechazo, type CuentaDto } from '@capaz/shared';
import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';
import { normalizarNombre } from '../domain/catalogos.js';
import { saldoDeCuenta } from '../domain/movimiento.js';
import { asegurarCatalogos } from '../repositories/catalogos.repository.js';
import {
  archivarCuenta,
  crearCuenta,
  editarCuenta,
  existeSucursal,
  flujosPorCuenta,
  listarCuentas,
  marcarCuentaPrincipal,
  SIN_FLUJO,
  type CambiosDeCuenta,
  type Cuenta,
} from '../repositories/cuentas.repository.js';
import { ID_DE_EJEMPLO, MODULO } from './comun.js';
import { aCuentaDto } from './mapeo.js';

// Catálogo de cuentas (caja, banco, billetera) y arranque del módulo. Las cuentas no tienen alcance «propios».

const NO_EXISTE = 'No existe esa cuenta.';
const ID = { nombre: 'id', queSeAnota: 'Identificador de la cuenta.', ejemplo: ID_DE_EJEMPLO };
const AUDITAR = (_a: unknown, d: { id: string } | null) => ({ entidadTipo: 'cuenta', entidadId: d?.id });

/** La cuenta con su saldo: saldo inicial + ingresos activos − egresos activos. */
async function conSaldo(tx: Transaccion, ctx: ContextoDeEmpresa, cuenta: Cuenta): Promise<CuentaDto> {
  const f = (await flujosPorCuenta(tx, ctx, { cuentaId: cuenta.id })).get(cuenta.id) ?? SIN_FLUJO;
  return aCuentaDto(cuenta, saldoDeCuenta(cuenta.saldoInicialCentimos, f.ingresos, f.egresos));
}

const candidata = (c: Cuenta) => ({ id: c.id, nombre: c.nombre, detalle: c.tipo });
const repetida = (c: Cuenta) => rechazo('conflicto', `Ya existe una cuenta llamada «${c.nombre}».`, [candidata(c)]);

export const registroIniciar = definirHerramienta('registro_iniciar', {
  modulo: MODULO,
  permiso: 'registro:editar',
  criticidad: 'normal',
  idempotente: true,
  ayuda: {
    titulo: 'Preparar el registro de dinero',
    paraQueSirve: 'Deja lista la cuenta «Caja» y las categorías iniciales de ingresos y egresos. Si ya existen, no cambia nada.',
    cuandoUsarla: 'La primera vez que se entra al módulo. Registrar un movimiento también lo hace solo.',
    campos: [],
    ejemploTecleado: 'preparar mi caja',
    ejemploHablado: 'deja lista la caja para empezar a anotar',
    erroresComunes: ['El módulo está en solo lectura: no se puede preparar hasta reactivarlo.'],
    relacionadas: ['cuentas_listar', 'categorias_listar', 'movimiento_registrar'],
  },
  auditar: (_a, d) => ({ entidadTipo: 'registro', resumen: { cuentasCreadas: d?.cuentasCreadas ?? 0, categoriasCreadas: d?.categoriasCreadas ?? 0 } }),
  async ejecutar(_args, ctx, tx) {
    return exito(await asegurarCatalogos(tx, ctx));
  },
});

export const cuentasListar = definirHerramienta('cuentas_listar', {
  modulo: MODULO,
  permiso: 'registro:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Listar cuentas',
    paraQueSirve: 'Muestra las cuentas donde está el dinero (caja, banco, billetera) con su saldo actual.',
    cuandoUsarla: 'Para saber cuánto hay en cada cuenta o elegir en cuál anotar un movimiento.',
    campos: [{ nombre: 'incluirArchivadas', queSeAnota: 'true para ver también las archivadas.', ejemplo: 'false' }],
    ejemploTecleado: 'ver mis cuentas',
    ejemploHablado: 'cuánto hay en cada cuenta',
    erroresComunes: ['Si la lista sale vacía, el módulo todavía no se preparó: usa «registro_iniciar».'],
    relacionadas: ['cuenta_crear', 'registro_iniciar'],
  },
  async ejecutar(args, ctx, tx) {
    const cuentas = await listarCuentas(tx, ctx, args);
    const flujos = await flujosPorCuenta(tx, ctx);
    const items = cuentas.map((c) => {
      const f = flujos.get(c.id) ?? SIN_FLUJO;
      return aCuentaDto(c, saldoDeCuenta(c.saldoInicialCentimos, f.ingresos, f.egresos));
    });
    return exito({ items, siguiente: null });
  },
});

export const cuentaCrear = definirHerramienta('cuenta_crear', {
  modulo: MODULO,
  permiso: 'registro:configurar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Crear una cuenta',
    paraQueSirve: 'Agrega una cuenta donde entra y sale dinero: una caja, una cuenta de banco o una billetera digital.',
    cuandoUsarla: 'Cuando abres una cuenta bancaria, usas una billetera nueva o separas otra caja.',
    campos: [
      { nombre: 'nombre', queSeAnota: 'Nombre corto de la cuenta.', ejemplo: 'BCP Soles' },
      { nombre: 'tipo', queSeAnota: 'caja, banco o billetera.', ejemplo: 'banco' },
      { nombre: 'saldoInicialCentimos', queSeAnota: 'Con cuánto empieza, en céntimos (opcional).', ejemplo: '150000' },
      { nombre: 'sucursalId', queSeAnota: 'Sucursal a la que pertenece (opcional).', ejemplo: ID_DE_EJEMPLO },
    ],
    ejemploTecleado: 'crear cuenta BCP Soles de banco con saldo inicial 1500',
    ejemploHablado: 'agrega una cuenta de banco llamada BCP Soles que empieza con mil quinientos soles',
    erroresComunes: ['Ya existe una cuenta con ese nombre.', 'La sucursal no existe o está archivada.'],
    relacionadas: ['cuentas_listar', 'cuenta_marcar_principal'],
  },
  auditar: AUDITAR,
  async ejecutar(args, ctx, tx) {
    await asegurarCatalogos(tx, ctx);
    if (args.sucursalId && !(await existeSucursal(tx, ctx, args.sucursalId))) return rechazo('no_encontrado', 'No existe esa sucursal.');
    const r = await crearCuenta(tx, ctx, {
      nombre: args.nombre,
      nombreNormalizado: normalizarNombre(args.nombre),
      tipo: args.tipo,
      sucursalId: args.sucursalId ?? null,
      saldoInicialCentimos: args.saldoInicialCentimos,
    });
    return r.creada ? exito(await conSaldo(tx, ctx, r.cuenta)) : repetida(r.existente);
  },
});

export const cuentaEditar = definirHerramienta('cuenta_editar', {
  modulo: MODULO,
  permiso: 'registro:configurar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Editar una cuenta',
    paraQueSirve: 'Cambia el nombre, el tipo o la sucursal de una cuenta. El saldo inicial y los movimientos no se tocan.',
    cuandoUsarla: 'Para corregir el nombre de una cuenta o moverla de sucursal.',
    campos: [ID, { nombre: 'nombre', queSeAnota: 'Nombre nuevo.', ejemplo: 'BCP Ahorros' }],
    ejemploTecleado: 'renombrar la cuenta BCP Soles a BCP Ahorros',
    ejemploHablado: 'la cuenta BCP Soles ahora se llama BCP Ahorros',
    erroresComunes: ['Hay que indicar al menos un dato.', 'Otra cuenta ya usa ese nombre.'],
    relacionadas: ['cuentas_listar', 'cuenta_archivar'],
  },
  auditar: (a) => ({ entidadTipo: 'cuenta', entidadId: a.id }),
  async ejecutar(args, ctx, tx) {
    if (args.sucursalId && !(await existeSucursal(tx, ctx, args.sucursalId))) return rechazo('no_encontrado', 'No existe esa sucursal.');
    const cambios: CambiosDeCuenta = {};
    if (args.nombre !== undefined) Object.assign(cambios, { nombre: args.nombre, nombreNormalizado: normalizarNombre(args.nombre) });
    if (args.tipo !== undefined) cambios.tipo = args.tipo;
    if (args.sucursalId !== undefined) cambios.sucursalId = args.sucursalId;
    const r = await editarCuenta(tx, ctx, args.id, cambios);
    if (!r) return rechazo('no_encontrado', NO_EXISTE);
    return 'existente' in r ? repetida(r.existente) : exito(await conSaldo(tx, ctx, r.cuenta));
  },
});

export const cuentaArchivar = definirHerramienta('cuenta_archivar', {
  modulo: MODULO,
  permiso: 'registro:configurar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Archivar una cuenta',
    paraQueSirve: 'Oculta una cuenta que ya no se usa. Sus movimientos se conservan; ya no recibe nuevos.',
    cuandoUsarla: 'Cuando cierras una cuenta bancaria o dejas de usar una billetera.',
    campos: [ID],
    ejemploTecleado: 'archivar la cuenta BCP Ahorros',
    ejemploHablado: 'ya no uso la cuenta BCP Ahorros',
    erroresComunes: ['La cuenta principal no se archiva: marca otra como principal primero.'],
    relacionadas: ['cuenta_marcar_principal', 'cuentas_listar'],
  },
  auditar: AUDITAR,
  async ejecutar(args, ctx, tx) {
    const r = await archivarCuenta(tx, ctx, args.id);
    if (r === null) return rechazo('no_encontrado', NO_EXISTE);
    if (r === 'es_principal') return rechazo('conflicto', 'La cuenta principal no se archiva: marca otra como principal primero.');
    return exito(await conSaldo(tx, ctx, r));
  },
});

export const cuentaMarcarPrincipal = definirHerramienta('cuenta_marcar_principal', {
  modulo: MODULO,
  permiso: 'registro:configurar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Marcar la cuenta principal',
    paraQueSirve: 'Elige la cuenta que se usa cuando un movimiento no indica ninguna.',
    cuandoUsarla: 'Cuando la mayor parte del dinero pasa a moverse por otra cuenta.',
    campos: [ID],
    ejemploTecleado: 'usar BCP Soles como cuenta principal',
    ejemploHablado: 'que la cuenta principal sea BCP Soles',
    erroresComunes: ['No se puede marcar como principal una cuenta archivada.'],
    relacionadas: ['cuentas_listar', 'cuenta_archivar'],
  },
  auditar: AUDITAR,
  async ejecutar(args, ctx, tx) {
    const r = await marcarCuentaPrincipal(tx, ctx, args.id);
    if (r === null) return rechazo('no_encontrado', NO_EXISTE);
    if (r === 'archivada') return rechazo('conflicto', 'No se puede marcar como principal una cuenta archivada.');
    return exito(await conSaldo(tx, ctx, r));
  },
});
