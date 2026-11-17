import { rechazo, type DeudaDto } from '@capaz/shared';
import { siguienteNumero } from '../../../core/correlativos/siguiente-numero.js';
import { emitir } from '../../../core/eventos/emisor.js';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';
import { categoriaDeAbono, normalizarNombre } from '../domain/catalogos.js';
import { claveDeDeuda, type TipoDeDeuda } from '../domain/codigos.js';
import { tipoDeMovimientoDeAbono, type DespuesDeAbonar } from '../domain/deuda.js';
import type { Cuenta } from '../repositories/cuentas.repository.js';
import { categoriaConNombre } from '../repositories/categorias.repository.js';
import { guardarAbonado, insertarDeuda, verDeuda, type DatosDeDeuda, type Deuda } from '../repositories/deudas.repository.js';
import { guardarMovimiento } from './guardar-movimiento.js';
import { aDeudaDto, codigoDeLaDeuda } from './mapeo.js';

// Lo que comparten `deuda_crear`, `deuda_abonar` y `deuda_crear_con_adelanto`, sin cambiar lo que cada una hace.

/**
 * Numera, guarda la deuda y emite `deuda.creada`. `null` si otra transacción creó la deuda de ese origen entre la
 * consulta y el alta (el índice único la frenó).
 */
export async function crearDeudaYEmitir(
  tx: Transaccion,
  ctx: ContextoDeEmpresa,
  hoy: { dia: string; anio: number },
  datos: Omit<DatosDeDeuda, 'numero' | 'anio'>,
): Promise<{ id: string; dto: DeudaDto } | null> {
  const numero = await siguienteNumero(tx, claveDeDeuda(datos.tipo), { anio: hoy.anio });
  const id = await insertarDeuda(tx, ctx, { ...datos, numero, anio: hoy.anio });
  if (!id) return null;
  const f = await verDeuda(tx, ctx, id, null);
  if (!f) throw new Error('La deuda recién guardada no se pudo leer.');
  const dto = aDeudaDto(f, hoy.dia);
  await emitir(tx, 'deuda.creada', {
    id,
    codigo: dto.codigo,
    tipo: dto.tipo,
    contactoId: dto.contactoId,
    totalCentimos: dto.totalCentimos,
    venceEn: dto.venceEn,
    origenTipo: dto.origenTipo,
    origenId: dto.origenId,
  });
  return { id, dto };
}

export const conflictoDeOrigen = () => rechazo('conflicto', 'Ese documento ya tiene una deuda: vuelve a intentarlo.');

export type DatosDelAbono = {
  anio: number;
  deuda: Pick<Deuda, 'id' | 'tipo' | 'contactoId' | 'sucursalId' | 'totalCentimos'> & Pick<Deuda, 'numero' | 'anio'>;
  abono: { ok: true } & DespuesDeAbonar;
  montoCentimos: number;
  fecha: string;
  cuenta: Cuenta;
  medioDePago: string;
  descripcion: string;
  origen: string;
};

/** Crea el movimiento del abono, guarda lo abonado y emite `deuda.abonada` (y `deuda.pagada` si salda). */
export async function registrarAbono(tx: Transaccion, ctx: ContextoDeEmpresa, d: DatosDelAbono) {
  const tipo = tipoDeMovimientoDeAbono(d.deuda.tipo as TipoDeDeuda);
  const categoria = await categoriaConNombre(tx, ctx, tipo, normalizarNombre(categoriaDeAbono(tipo)));
  const codigo = codigoDeLaDeuda(d.deuda);
  const r = await guardarMovimiento(tx, ctx, d.anio, d.cuenta, {
    tipo,
    fecha: d.fecha,
    montoCentimos: d.montoCentimos,
    categoriaId: categoria?.id ?? null,
    contactoId: d.deuda.contactoId,
    medioDePago: d.medioDePago,
    descripcion: d.descripcion,
    deudaId: d.deuda.id,
    sucursalId: d.deuda.sucursalId,
    origen: d.origen,
    origenRef: null,
  });
  await guardarAbonado(tx, ctx, d.deuda.id, d.abono.abonadoCentimos, d.abono.estado);
  await emitir(tx, 'deuda.abonada', { id: d.deuda.id, codigo, movimientoId: r.movimiento.id, montoCentimos: d.montoCentimos, saldoCentimos: d.abono.saldoCentimos });
  if (d.abono.quedaPagada) {
    await emitir(tx, 'deuda.pagada', { id: d.deuda.id, codigo, tipo: d.deuda.tipo as TipoDeDeuda, contactoId: d.deuda.contactoId, totalCentimos: d.deuda.totalCentimos });
  }
  return r;
}
