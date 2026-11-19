import { exito, rechazo } from '@capaz/shared';
import { hoyDeLaEmpresa } from '../../../core/empresas/hoy.js';
import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import { decodificarCursorPorInstante } from '../domain/cursor.js';
import { listarDeudas, verDeuda } from '../repositories/deudas.repository.js';
import { abonosDeDeuda } from '../repositories/movimientos.repository.js';
import { ID_DE_EJEMPLO, MODULO, propietarioDe } from './comun.js';
import { aDeudaDto, aMovimientoDto } from './mapeo.js';

// Lecturas de cuentas por cobrar y por pagar. Con alcance «propios» solo se ven las deudas que creó la propia persona (R4).

export const deudaVer = definirHerramienta('deuda_ver', {
  modulo: MODULO,
  permiso: 'registro:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Ver una deuda',
    paraQueSirve: 'Muestra una cuenta por cobrar o por pagar con su saldo y todos sus abonos.',
    cuandoUsarla: 'Para saber cuánto falta cobrar o pagar y qué abonos se hicieron.',
    campos: [{ nombre: 'id', queSeAnota: 'Identificador de la deuda.', ejemplo: ID_DE_EJEMPLO }],
    ejemploTecleado: 'ver la deuda CXC-2026-0007',
    ejemploHablado: 'cuánto me debe todavía la cuenta por cobrar siete',
    erroresComunes: ['La deuda no existe, es de otra empresa o no la creaste tú.'],
    relacionadas: ['deudas_listar', 'deuda_abonar'],
  },
  async ejecutar(args, ctx, tx) {
    const f = await verDeuda(tx, ctx, args.id, propietarioDe(ctx));
    if (!f) return rechazo('no_encontrado', 'No existe esa deuda.');
    const hoy = await hoyDeLaEmpresa(tx);
    // Los abonos son parte de la deuda: quien puede verla ve todos, también los que anotó otra persona.
    const abonos = await abonosDeDeuda(tx, ctx, f.id);
    return exito({ ...aDeudaDto(f, hoy.dia), abonos: abonos.map(aMovimientoDto) });
  },
});

export const deudasListar = definirHerramienta('deudas_listar', {
  modulo: MODULO,
  permiso: 'registro:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Listar deudas',
    paraQueSirve: 'Muestra las cuentas por cobrar o por pagar, de la más reciente a la más antigua, por páginas.',
    cuandoUsarla: 'Para ver quién te debe, a quién le debes y qué está vencido.',
    campos: [
      { nombre: 'tipo', queSeAnota: 'por_cobrar o por_pagar.', ejemplo: 'por_cobrar' },
      { nombre: 'estado', queSeAnota: 'abiertas, vencidas, pagadas, anuladas o todas (por defecto, abiertas).', ejemplo: 'vencidas' },
      { nombre: 'contactoId', queSeAnota: 'Solo las de un cliente o proveedor (opcional).', ejemplo: ID_DE_EJEMPLO },
      { nombre: 'origenTipo', queSeAnota: 'Junto con origenId: solo la deuda que nació de ese documento (pedido, produccion, compra…) (opcional).', ejemplo: 'pedido' },
      { nombre: 'origenId', queSeAnota: 'Identificador del documento de origen; va con origenTipo (opcional).', ejemplo: ID_DE_EJEMPLO },
    ],
    ejemploTecleado: 'ver las cuentas por cobrar vencidas',
    ejemploHablado: 'quién me debe y ya se le venció el plazo',
    erroresComunes: ['Falta el tipo: por_cobrar o por_pagar.', 'El cursor de la página no es válido: vuelve a empezar desde la primera.'],
    relacionadas: ['deuda_ver', 'deuda_crear'],
  },
  async ejecutar(args, ctx, tx) {
    const cursor = args.cursor ? decodificarCursorPorInstante(args.cursor) : null;
    if (args.cursor && !cursor) return rechazo('argumentos_invalidos', 'El cursor no es válido.');
    const hoy = await hoyDeLaEmpresa(tx);
    const r = await listarDeudas(
      tx,
      ctx,
      { limite: args.limite, cursor, tipo: args.tipo, estado: args.estado, contactoId: args.contactoId, origenTipo: args.origenTipo, origenId: args.origenId, hoy: hoy.dia },
      propietarioDe(ctx),
    );
    return exito({ items: r.items.map((f) => aDeudaDto(f, hoy.dia)), siguiente: r.siguiente });
  },
});
