import { exito, rechazo } from '@capaz/shared';
import { normalizarNombre } from '../../../core/clientes/domain/normalizacion.js';
import { hoyDeLaEmpresa } from '../../../core/empresas/hoy.js';
import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import { decodificarCursor } from '../domain/cursor.js';
import { actividadesDe } from '../repositories/actividades.repository.js';
import { listarEtapas } from '../repositories/etapas.repository.js';
import { listarOportunidades, verOportunidad } from '../repositories/oportunidades.repository.js';
import { MODULO, NO_EXISTE_OPORTUNIDAD, propios } from './comunes.js';
import { aActividadDto, aEtapaDto, aOportunidadDto } from './mapeo.js';

// Lecturas de `crm`: no siembran nada (R10), así funcionan con el módulo en baja.

const ID_DE_EJEMPLO = '0192f0c4-7b1e-7000-8000-000000000001';

export const etapasListar = definirHerramienta('etapas_listar', {
  modulo: MODULO,
  permiso: 'crm:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Ver las etapas',
    paraQueSirve: 'Muestra las etapas del embudo en su orden: primero las abiertas y al final las de cierre.',
    cuandoUsarla: 'Para saber a qué etapa mover una oportunidad o cómo está armado tu embudo.',
    campos: [{ nombre: 'incluirArchivadas', queSeAnota: 'Si también se ven las archivadas (por defecto, no).', ejemplo: 'false' }],
    ejemploTecleado: 'ver etapas del crm',
    ejemploHablado: 'qué etapas tiene mi embudo',
    erroresComunes: ['Si la lista sale vacía, prepara el CRM primero.'],
    relacionadas: ['crm_iniciar', 'etapa_crear'],
  },
  async ejecutar(args, ctx, tx) {
    return exito({ items: (await listarEtapas(tx, ctx, args.incluirArchivadas)).map(aEtapaDto), siguiente: null });
  },
});

export const oportunidadVer = definirHerramienta('oportunidad_ver', {
  modulo: MODULO,
  permiso: 'crm:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Ver una oportunidad',
    paraQueSirve: 'Muestra una oportunidad con su cliente, su etapa, el monto estimado y sus actividades.',
    cuandoUsarla: 'Antes de llamar al cliente o para revisar qué se hizo.',
    campos: [{ nombre: 'id', queSeAnota: 'Identificador de la oportunidad.', ejemplo: ID_DE_EJEMPLO }],
    ejemploTecleado: 'ver la oportunidad OPO-2026-0001',
    ejemploHablado: 'abre la oportunidad uno',
    erroresComunes: ['La oportunidad no existe, es de otra empresa o no está a tu cargo.'],
    relacionadas: ['oportunidades_listar', 'oportunidad_editar'],
  },
  async ejecutar(args, ctx, tx) {
    const soloMias = propios(ctx);
    const fila = await verOportunidad(tx, ctx, args.id, soloMias);
    if (!fila) return NO_EXISTE_OPORTUNIDAD();
    const { dia } = await hoyDeLaEmpresa(tx);
    const actividades = (await actividadesDe(tx, ctx, args.id, soloMias)).map((a) => aActividadDto(a, dia));
    return exito({ ...aOportunidadDto(fila), actividades });
  },
});

export const oportunidadesListar = definirHerramienta('oportunidades_listar', {
  modulo: MODULO,
  permiso: 'crm:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Listar oportunidades',
    paraQueSirve: 'Muestra las oportunidades, las que se movieron hace menos primero. Filtra por estado, etapa, cliente, responsable o parte del título.',
    cuandoUsarla: 'Para revisar el embudo o encontrar una oportunidad.',
    campos: [
      { nombre: 'estado', queSeAnota: 'abiertas, ganadas, perdidas o todas (por defecto, abiertas).', ejemplo: 'abiertas' },
      { nombre: 'buscar', queSeAnota: 'Parte del título, sin importar tildes ni mayúsculas.', ejemplo: 'banner' },
    ],
    ejemploTecleado: 'ver oportunidades abiertas',
    ejemploHablado: 'qué oportunidades tengo abiertas',
    erroresComunes: ['El cursor de la página no es válido: vuelve a empezar desde la primera.'],
    relacionadas: ['oportunidad_ver', 'oportunidad_crear'],
  },
  async ejecutar(args, ctx, tx) {
    const cursor = args.cursor ? decodificarCursor(args.cursor) : null;
    if (args.cursor && !cursor) return rechazo('argumentos_invalidos', 'El cursor no es válido.');
    const buscar = args.buscar ? normalizarNombre(args.buscar) : undefined;
    const r = await listarOportunidades(tx, ctx, { ...args, buscar: buscar || undefined }, cursor, propios(ctx));
    return exito({ items: r.items.map(aOportunidadDto), siguiente: r.siguiente });
  },
});
