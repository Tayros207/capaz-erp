import { randomUUID } from 'node:crypto';
import { exito, rechazo } from '@capaz/shared';
import { hoyDeLaEmpresa } from '../../../core/empresas/hoy.js';
import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import { fechaDeMovimiento } from '../domain/movimiento.js';
import { descripcionDePata, referenciaDeTransferencia, transferenciaPermitida } from '../domain/transferencia.js';
import { categoriasDeTransferencia } from '../repositories/categorias.repository.js';
import { bloquearCuentas } from '../repositories/cuentas.repository.js';
import { ID_DE_EJEMPLO, MODULO, rechazoDe } from './comun.js';
import { guardarMovimiento } from './guardar-movimiento.js';
import { aMovimientoDto } from './mapeo.js';

// Transferencia entre cuentas (caja → banco, Yape → banco): DOS movimientos en la misma transacción, un egreso en
// la cuenta de origen y un ingreso en la de destino, enlazados por `origen_ref = transferencia:<id>`. No cuentan
// como ingreso ni egreso del negocio (los reportes las excluyen); cada cuenta sí refleja su saldo.

export const cuentasTransferir = definirHerramienta('cuentas_transferir', {
  modulo: MODULO,
  permiso: 'registro:editar',
  criticidad: 'normal',
  idempotente: true,
  mueveDinero: true,
  ayuda: {
    titulo: 'Transferir dinero entre cuentas',
    paraQueSirve: 'Pasa dinero de una cuenta a otra (por ejemplo, de la caja al banco) sin que cuente como ingreso ni como gasto. Si no indicas fecha, es hoy.',
    cuandoUsarla: 'Cuando depositas la caja en el banco, retiras dinero del banco o mueves saldo de una billetera a otra.',
    campos: [
      { nombre: 'origenId', queSeAnota: 'Cuenta de la que sale el dinero.', ejemplo: ID_DE_EJEMPLO },
      { nombre: 'destinoId', queSeAnota: 'Cuenta a la que llega el dinero; distinta de la de origen.', ejemplo: ID_DE_EJEMPLO },
      { nombre: 'montoCentimos', queSeAnota: 'Monto en céntimos, mayor que cero.', ejemplo: '20000' },
      { nombre: 'fecha', queSeAnota: 'Día de la transferencia (AAAA-MM-DD); no puede ser futuro.', ejemplo: '2026-03-10' },
      { nombre: 'nota', queSeAnota: 'Nota breve (opcional).', ejemplo: 'Depósito del día' },
    ],
    ejemploTecleado: 'transferir 200.00 de Caja a Banco',
    ejemploHablado: 'deposité doscientos soles de la caja en el banco',
    erroresComunes: ['El origen y el destino deben ser cuentas distintas.', 'La cuenta está archivada.', 'La fecha no puede ser futura.'],
    relacionadas: ['cuentas_listar', 'movimientos_listar', 'movimiento_anular'],
  },
  auditar: (_a, d) => ({ entidadTipo: 'transferencia', entidadId: d?.transferenciaId, resumen: d ? { montoCentimos: d.egreso.montoCentimos } : undefined }),
  async ejecutar(args, ctx, tx) {
    const hoy = await hoyDeLaEmpresa(tx);
    const fecha = fechaDeMovimiento(args.fecha, hoy.dia);
    if (!fecha.ok) return rechazoDe(fecha);
    // Las dos cuentas se toman juntas y en orden de id: dos transferencias a la vez se turnan sin interbloqueo.
    const tomadas = await bloquearCuentas(tx, ctx, [args.origenId, args.destinoId]);
    const origen = tomadas.find((c) => c.id === args.origenId);
    const destino = tomadas.find((c) => c.id === args.destinoId);
    if (!origen) return rechazo('no_encontrado', 'No existe la cuenta de origen.');
    if (!destino) return rechazo('no_encontrado', 'No existe la cuenta de destino.');
    const regla = transferenciaPermitida(origen, destino);
    if (!regla.ok) return rechazoDe(regla);

    const categorias = await categoriasDeTransferencia(tx, ctx);
    const transferenciaId = randomUUID();
    const comun = { fecha: fecha.fecha, montoCentimos: args.montoCentimos, contactoId: null, medioDePago: 'transferencia', deudaId: null, sucursalId: null, origen: 'teclado', origenRef: referenciaDeTransferencia(transferenciaId) } as const;
    const salida = await guardarMovimiento(tx, ctx, hoy.anio, origen, { ...comun, tipo: 'egreso', categoriaId: categorias.egreso, descripcion: descripcionDePata('salida', destino.nombre, args.nota) });
    const entrada = await guardarMovimiento(tx, ctx, hoy.anio, destino, { ...comun, tipo: 'ingreso', categoriaId: categorias.ingreso, descripcion: descripcionDePata('entrada', origen.nombre, args.nota) });
    return exito({ transferenciaId, egreso: aMovimientoDto(salida.movimiento), ingreso: aMovimientoDto(entrada.movimiento) }, { avisos: salida.avisos });
  },
});
