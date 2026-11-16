import { exito, rechazo } from '@capaz/shared';
import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import { abiertasVivas, numerar, problemaDeOrden, problemaParaArchivar } from '../domain/etapas.js';
import {
  abiertasEnEtapa,
  archivarEtapa,
  asegurarCatalogos,
  bloquearEtapas,
  comoViva,
  crearEtapa,
  guardarOrden,
  listarEtapas,
  renombrarEtapa,
  verEtapa,
} from '../repositories/etapas.repository.js';
import { auditarEtapa, MODULO, NO_EXISTE_ETAPA } from './comunes.js';
import { aEtapaDto } from './mapeo.js';

const ID_DE_EJEMPLO = '0192f0c4-7b1e-7000-8000-000000000001';
const yaExiste = (nombre: string) => rechazo('conflicto', `Ya existe una etapa llamada «${nombre}».`);

export const crmIniciar = definirHerramienta('crm_iniciar', {
  modulo: MODULO,
  permiso: 'crm:editar',
  criticidad: 'normal',
  idempotente: true,
  ayuda: {
    titulo: 'Preparar el CRM',
    paraQueSirve: 'Crea las etapas con las que empieza el embudo si tu empresa todavía no tiene ninguna. Si ya las tiene, no cambia nada.',
    cuandoUsarla: 'La primera vez que entras al CRM.',
    campos: [],
    ejemploTecleado: 'preparar el crm',
    ejemploHablado: 'deja listo el crm',
    erroresComunes: ['Tu acceso al CRM es de solo lectura.'],
    relacionadas: ['etapas_listar'],
  },
  async ejecutar(_args, ctx, tx) {
    await bloquearEtapas(tx, ctx);
    return exito({ etapasCreadas: await asegurarCatalogos(tx, ctx) });
  },
});

export const etapaCrear = definirHerramienta('etapa_crear', {
  modulo: MODULO,
  permiso: 'crm:configurar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Crear una etapa',
    paraQueSirve: 'Agrega una etapa abierta al embudo. Queda última de las abiertas, antes de las de cierre.',
    cuandoUsarla: 'Cuando tu forma de vender tiene un paso que no está en la lista.',
    campos: [{ nombre: 'nombre', queSeAnota: 'Nombre de la etapa, hasta 60 letras.', ejemplo: 'Muestra entregada' }],
    ejemploTecleado: 'crear etapa Muestra entregada',
    ejemploHablado: 'agrega la etapa muestra entregada',
    erroresComunes: ['Ya existe una etapa con ese nombre.'],
    relacionadas: ['etapas_ordenar', 'etapa_editar'],
  },
  auditar: auditarEtapa,
  async ejecutar(args, ctx, tx) {
    await bloquearEtapas(tx, ctx);
    await asegurarCatalogos(tx, ctx);
    const etapas = (await listarEtapas(tx, ctx)).map(comoViva);
    const r = await crearEtapa(tx, ctx, args.nombre, etapas.length);
    if ('conflicto' in r) return yaExiste(r.conflicto.nombre);
    const orden = [...abiertasVivas(etapas).map((e) => e.id), r.etapa.id];
    await guardarOrden(tx, ctx, numerar(orden, [...etapas, comoViva(r.etapa)]));
    return exito(aEtapaDto((await verEtapa(tx, ctx, r.etapa.id))!));
  },
});

export const etapaEditar = definirHerramienta('etapa_editar', {
  modulo: MODULO,
  permiso: 'crm:configurar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Renombrar una etapa',
    paraQueSirve: 'Cambia el nombre de una etapa, también de las de cierre. Las oportunidades no se mueven.',
    cuandoUsarla: 'Cuando el nombre de una etapa no dice lo que pasa en tu negocio.',
    campos: [
      { nombre: 'id', queSeAnota: 'Identificador de la etapa.', ejemplo: ID_DE_EJEMPLO },
      { nombre: 'nombre', queSeAnota: 'Nombre nuevo.', ejemplo: 'Cotización enviada' },
    ],
    ejemploTecleado: 'renombrar la etapa Propuesta enviada a Cotización enviada',
    ejemploHablado: 'cambia el nombre de propuesta enviada por cotización enviada',
    erroresComunes: ['Ya existe una etapa con ese nombre.'],
    relacionadas: ['etapas_listar'],
  },
  auditar: auditarEtapa,
  async ejecutar(args, ctx, tx) {
    const r = await renombrarEtapa(tx, ctx, args.id, args.nombre);
    if (!r) return NO_EXISTE_ETAPA();
    if ('conflicto' in r) return yaExiste(r.conflicto.nombre);
    return exito(aEtapaDto(r.etapa));
  },
});

export const etapasOrdenar = definirHerramienta('etapas_ordenar', {
  modulo: MODULO,
  permiso: 'crm:configurar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Ordenar las etapas',
    paraQueSirve: 'Fija el orden de las etapas abiertas. Las de cierre («ganada» y «perdida») quedan siempre al final.',
    cuandoUsarla: 'Cuando quieres que el tablero muestre las etapas en otro orden.',
    campos: [{ nombre: 'ids', queSeAnota: 'Todas las etapas abiertas, en el orden nuevo.', ejemplo: `["${ID_DE_EJEMPLO}"]` }],
    ejemploTecleado: 'poner la etapa Contactado antes que Nuevo',
    ejemploHablado: 'sube contactado al primer lugar',
    erroresComunes: ['Hay que enviar todas las etapas abiertas, cada una una vez.'],
    relacionadas: ['etapas_listar'],
  },
  auditar: (a) => ({ entidadTipo: 'etapa', resumen: { etapas: a.ids.length } }),
  async ejecutar(args, ctx, tx) {
    await bloquearEtapas(tx, ctx);
    const etapas = (await listarEtapas(tx, ctx)).map(comoViva);
    const problema = problemaDeOrden(args.ids, etapas);
    if (problema) return rechazo('argumentos_invalidos', problema);
    await guardarOrden(tx, ctx, numerar(args.ids, etapas));
    return exito({ items: (await listarEtapas(tx, ctx)).map(aEtapaDto), siguiente: null });
  },
});

export const etapaArchivar = definirHerramienta('etapa_archivar', {
  modulo: MODULO,
  permiso: 'crm:configurar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Archivar una etapa',
    paraQueSirve: 'Quita una etapa abierta del tablero. Antes hay que mover sus oportunidades abiertas.',
    cuandoUsarla: 'Cuando un paso del embudo ya no se usa.',
    campos: [{ nombre: 'id', queSeAnota: 'Identificador de la etapa.', ejemplo: ID_DE_EJEMPLO }],
    ejemploTecleado: 'archivar la etapa Negociación',
    ejemploHablado: 'quita la etapa negociación',
    erroresComunes: ['Quedan oportunidades abiertas en esa etapa.', 'Las etapas de cierre no se archivan.', 'Es la única etapa abierta.'],
    relacionadas: ['etapas_listar', 'oportunidad_mover'],
  },
  auditar: auditarEtapa,
  async ejecutar(args, ctx, tx) {
    await bloquearEtapas(tx, ctx);
    const etapa = await verEtapa(tx, ctx, args.id);
    if (!etapa) return NO_EXISTE_ETAPA();
    if (etapa.archivadoEn) return exito(aEtapaDto(etapa));
    const etapas = (await listarEtapas(tx, ctx)).map(comoViva);
    const problema = problemaParaArchivar(comoViva(etapa), etapas, await abiertasEnEtapa(tx, ctx, etapa.id));
    if (problema) return rechazo('conflicto', problema);
    return exito(aEtapaDto(await archivarEtapa(tx, ctx, etapa.id)));
  },
});
