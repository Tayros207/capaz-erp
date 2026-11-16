import { exito, rechazo, type ArgsDe } from '@capaz/shared';
import { textoOpcional } from '../../../core/clientes/domain/normalizacion.js';
import { siguienteNumero } from '../../../core/correlativos/siguiente-numero.js';
import { hoyDeLaEmpresa } from '../../../core/empresas/hoy.js';
import { emitir } from '../../../core/eventos/emisor.js';
import { definirHerramienta, type ContextoDeHerramienta } from '../../../core/herramientas/tipos.js';
import type { Transaccion } from '../../../infra/database/con-empresa.js';
import { primeraAbierta } from '../domain/etapas.js';
import { CLAVE_DE_OPORTUNIDAD, codigoDeOportunidad, problemaDeEtapaDestino, problemaParaMover, type EstadoDeOportunidad } from '../domain/oportunidad.js';
import { asegurarCatalogos, comoViva, listarEtapas, verEtapa } from '../repositories/etapas.repository.js';
import {
  actualizarOportunidad,
  bloquearOportunidad,
  insertarOportunidad,
  type CambiosDeOportunidad,
} from '../repositories/oportunidades.repository.js';
import { auditarOportunidad, desdeProblema, MODULO, NO_EXISTE_ETAPA, NO_EXISTE_OPORTUNIDAD, oportunidadDto, problemaDeReferencias, propios } from './comunes.js';

type Rechazo = ReturnType<typeof rechazo>;
const ID_DE_EJEMPLO = '0192f0c4-7b1e-7000-8000-000000000001';

/** Etapa donde entra una oportunidad nueva: la pedida (abierta y viva) o la primera abierta. */
async function etapaDeEntrada(tx: Transaccion, ctx: ContextoDeHerramienta, etapaId: string | undefined): Promise<{ id: string } | { rechazo: Rechazo }> {
  if (etapaId) {
    const etapa = await verEtapa(tx, ctx, etapaId);
    if (!etapa) return { rechazo: NO_EXISTE_ETAPA() };
    const p = problemaDeEtapaDestino(comoViva(etapa));
    return p ? { rechazo: desdeProblema(p) } : { id: etapa.id };
  }
  const primera = primeraAbierta((await listarEtapas(tx, ctx)).map(comoViva));
  return primera ? { id: primera.id } : { rechazo: rechazo('conflicto', 'No hay etapas abiertas en el embudo.') };
}

export const oportunidadCrear = definirHerramienta('oportunidad_crear', {
  modulo: MODULO,
  permiso: 'crm:editar',
  criticidad: 'normal',
  idempotente: true,
  ayuda: {
    titulo: 'Crear una oportunidad',
    paraQueSirve: 'Anota una posible venta para un cliente. Entra en la primera etapa del embudo, salvo que indiques otra abierta.',
    cuandoUsarla: 'Cuando un cliente pide precio o muestra interés en un trabajo.',
    campos: [
      { nombre: 'titulo', queSeAnota: 'Qué se quiere vender, en pocas palabras.', ejemplo: 'Banners para feria de diciembre' },
      { nombre: 'clienteId', queSeAnota: 'El cliente (debe existir en tu lista).', ejemplo: ID_DE_EJEMPLO },
      { nombre: 'montoEstimadoCentimos', queSeAnota: 'Monto estimado en céntimos (opcional).', ejemplo: '150000' },
      { nombre: 'fechaEsperada', queSeAnota: 'Cuándo esperas cerrar (opcional).', ejemplo: '2026-12-10' },
    ],
    ejemploTecleado: 'nueva oportunidad para Imprenta Sol: banners para feria, 1500 soles',
    ejemploHablado: 'anota una oportunidad con Imprenta Sol por banners para la feria, unos mil quinientos soles',
    erroresComunes: ['El cliente no existe: créalo primero.', 'Solo se entra en una etapa abierta.', 'El responsable debe ser una persona de tu empresa.'],
    relacionadas: ['clientes_buscar', 'oportunidad_mover', 'oportunidades_listar'],
  },
  auditar: auditarOportunidad,
  async ejecutar(args, ctx, tx) {
    const ref = await problemaDeReferencias(tx, ctx, args);
    if (ref) return ref;
    await asegurarCatalogos(tx, ctx);
    const etapa = await etapaDeEntrada(tx, ctx, args.etapaId);
    if ('rechazo' in etapa) return etapa.rechazo;
    const { anio } = await hoyDeLaEmpresa(tx);
    const numero = await siguienteNumero(tx, CLAVE_DE_OPORTUNIDAD, { anio });
    const fila = await insertarOportunidad(tx, ctx, {
      numero,
      anio,
      titulo: args.titulo,
      clienteId: args.clienteId,
      etapaId: etapa.id,
      montoEstimadoCentimos: args.montoEstimadoCentimos ?? null,
      fechaEsperada: args.fechaEsperada ?? null,
      responsableId: textoOpcional(args.responsableId),
      notas: textoOpcional(args.notas),
      sucursalId: args.sucursalId ?? null,
    });
    const codigo = codigoDeOportunidad(anio, numero);
    await emitir(tx, 'oportunidad.creada', { id: fila.id, codigo, clienteId: fila.clienteId, etapaId: fila.etapaId, montoEstimadoCentimos: fila.montoEstimadoCentimos });
    return exito(await oportunidadDto(tx, ctx, fila.id));
  },
});

/** Solo lo que llegó (`null` borra un dato opcional). */
function cambiosDe(a: ArgsDe<'oportunidad_editar'>): CambiosDeOportunidad {
  const c: CambiosDeOportunidad = {};
  if (a.titulo !== undefined) c.titulo = a.titulo;
  if (a.clienteId !== undefined) c.clienteId = a.clienteId;
  if (a.montoEstimadoCentimos !== undefined) c.montoEstimadoCentimos = a.montoEstimadoCentimos;
  if (a.fechaEsperada !== undefined) c.fechaEsperada = a.fechaEsperada;
  if (a.responsableId !== undefined) c.responsableId = textoOpcional(a.responsableId);
  if (a.notas !== undefined) c.notas = textoOpcional(a.notas);
  if (a.sucursalId !== undefined) c.sucursalId = a.sucursalId;
  return c;
}

export const oportunidadEditar = definirHerramienta('oportunidad_editar', {
  modulo: MODULO,
  permiso: 'crm:editar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Editar una oportunidad',
    paraQueSirve: 'Cambia el título, el cliente, el monto, la fecha esperada, el responsable o las notas. Envías solo lo que cambia.',
    cuandoUsarla: 'Cuando el cliente ajusta lo que pide o cambia el monto.',
    campos: [
      { nombre: 'id', queSeAnota: 'Identificador de la oportunidad.', ejemplo: ID_DE_EJEMPLO },
      { nombre: 'montoEstimadoCentimos', queSeAnota: 'Monto nuevo en céntimos.', ejemplo: '180000' },
    ],
    ejemploTecleado: 'cambiar el monto de OPO-2026-0001 a 1800 soles',
    ejemploHablado: 'la oportunidad uno ahora es por mil ochocientos soles',
    erroresComunes: ['Hay que indicar al menos un dato.', 'La oportunidad no existe o no está a tu cargo.'],
    relacionadas: ['oportunidad_ver'],
  },
  auditar: (a) => ({
    entidadTipo: 'oportunidad',
    entidadId: a.id,
    resumen: { campos: Object.keys(a).filter((k) => k !== 'id' && a[k as keyof typeof a] !== undefined).sort().join(',') },
  }),
  async ejecutar(args, ctx, tx) {
    const actual = await bloquearOportunidad(tx, ctx, args.id, propios(ctx));
    if (!actual) return NO_EXISTE_OPORTUNIDAD();
    const ref = await problemaDeReferencias(tx, ctx, args);
    if (ref) return ref;
    await actualizarOportunidad(tx, ctx, args.id, cambiosDe(args));
    return exito(await oportunidadDto(tx, ctx, args.id));
  },
});

export const oportunidadMover = definirHerramienta('oportunidad_mover', {
  modulo: MODULO,
  permiso: 'crm:editar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Mover una oportunidad de etapa',
    paraQueSirve: 'Pasa una oportunidad abierta a otra etapa abierta del embudo.',
    cuandoUsarla: 'Cuando la venta avanza o retrocede un paso.',
    campos: [
      { nombre: 'id', queSeAnota: 'Identificador de la oportunidad.', ejemplo: ID_DE_EJEMPLO },
      { nombre: 'etapaId', queSeAnota: 'La etapa de destino.', ejemplo: ID_DE_EJEMPLO },
    ],
    ejemploTecleado: 'mover OPO-2026-0001 a Negociación',
    ejemploHablado: 'pasa la oportunidad uno a negociación',
    erroresComunes: ['Una oportunidad cerrada no se mueve: reábrela primero.', 'Para cerrar no se mueve: se marca ganada o perdida.'],
    relacionadas: ['etapas_listar', 'oportunidad_ganar', 'oportunidad_perder'],
  },
  auditar: auditarOportunidad,
  async ejecutar(args, ctx, tx) {
    const actual = await bloquearOportunidad(tx, ctx, args.id, propios(ctx));
    if (!actual) return NO_EXISTE_OPORTUNIDAD();
    const destino = await verEtapa(tx, ctx, args.etapaId);
    if (!destino) return NO_EXISTE_ETAPA();
    const p = problemaParaMover(actual.estado as EstadoDeOportunidad, comoViva(destino));
    if (p) return desdeProblema(p);
    if (destino.id === actual.etapaId) return exito(await oportunidadDto(tx, ctx, actual.id));
    await actualizarOportunidad(tx, ctx, actual.id, { etapaId: destino.id });
    await emitir(tx, 'oportunidad.movida', { id: actual.id, codigo: codigoDeOportunidad(actual.anio, actual.numero), etapaId: destino.id, etapaAnteriorId: actual.etapaId });
    return exito(await oportunidadDto(tx, ctx, actual.id));
  },
});
