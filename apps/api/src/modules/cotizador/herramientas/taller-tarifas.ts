import { exito, rechazo, type ArgsDe } from '@capaz/shared';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';
import { hashCanonico } from '../../../core/herramientas/confirmacion.js';
import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import { decodificarCursorDeLista } from '../domain/cursor.js';
import { normalizarNombre } from '../domain/lista.js';
import { resumenDeCambioDeTarifa, validarTarifa, limpiarDecimal, type DatosDeTarifa } from '../domain/taller.js';
import { archivarTarifa, bloquearTarifa, crearTarifa, editarTarifa, formatoVivo, listarTarifas, tarifaActivaConNombre, verTarifa, type Tarifa } from '../repositories/taller.repository.js';
import { ID_DE_EJEMPLO, MODULO } from './comun.js';
import { aTarifaDto, archivadaNoSeEdita, noExiste, nombreRepetido, rechazoSiMalo } from './taller-mapeo.js';

// Tarifas: lo que cuesta un material, una hora de máquina, una plancha… Costos como texto (`'0.45'`), nunca `number`.

const QUE = 'esa tarifa';
const auditar = (_a: unknown, d: { id: string; costoUnitario: string } | null) => ({ entidadTipo: 'tarifa', entidadId: d?.id, resumen: d ? { costoUnitario: d.costoUnitario } : undefined });
const ID = { nombre: 'id', queSeAnota: 'Identificador de la tarifa.', ejemplo: ID_DE_EJEMPLO };
const CAMPOS = [
  { nombre: 'factor', queSeAnota: 'material, planchas, impresion, diseno, acabado o indirectos.', ejemplo: 'material' },
  { nombre: 'nombre', queSeAnota: 'Cómo llamas a la tarifa.', ejemplo: 'Papel couché 150 g, pliego madre 70 × 100' },
  { nombre: 'unidad', queSeAnota: 'En qué se cobra.', ejemplo: 'pliego' },
  { nombre: 'costoUnitario', queSeAnota: 'Costo por unidad, como texto con punto (hasta 4 decimales).', ejemplo: '0.45' },
  { nombre: 'escalaPorDefecto', queSeAnota: 'fija, por_pliego o por_unidad: cómo cambia al correr el cuadro a otra cantidad.', ejemplo: 'por_pliego' },
  { nombre: 'formatoId', queSeAnota: 'Formato de pliego al que se refiere (opcional).', ejemplo: ID_DE_EJEMPLO },
];
const repetida = (o: { id: string; nombre: string }) => nombreRepetido('una tarifa', o, 'tarifa');
const datosDe = (t: Tarifa): DatosDeTarifa => ({ factor: t.factor as DatosDeTarifa['factor'], nombre: t.nombre, unidad: t.unidad, costoUnitario: t.costoUnitario, escalaPorDefecto: t.escalaPorDefecto as DatosDeTarifa['escalaPorDefecto'] });
/** Lo que se confirma al editar: si cualquiera de estos datos cambia, la confirmación deja de valer. */
const huellaDe = (t: Tarifa) => hashCanonico({ costo: limpiarDecimal(t.costoUnitario), factor: t.factor, unidad: t.unidad, escala: t.escalaPorDefecto, archivadoEn: t.archivadoEn?.toISOString() ?? null });

export const tarifasListar = definirHerramienta('tarifas_listar', {
  modulo: MODULO,
  permiso: 'cotizador:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Listar las tarifas',
    paraQueSirve: 'Muestra las tarifas del taller (material, impresión, planchas, diseño, acabado, indirectos) con su costo por unidad.',
    cuandoUsarla: 'Para elegir una tarifa al armar un cuadro o revisar costos.',
    campos: [
      { nombre: 'buscar', queSeAnota: 'Parte del nombre (opcional).', ejemplo: 'couché' },
      { nombre: 'factor', queSeAnota: 'Solo las de ese factor (opcional).', ejemplo: 'material' },
      { nombre: 'estado', queSeAnota: 'activas, archivadas o todas (por defecto, activas).', ejemplo: 'activas' },
    ],
    ejemploTecleado: 'ver las tarifas de material',
    ejemploHablado: 'cuánto cuestan mis papeles',
    erroresComunes: ['El cursor de la página no es válido: vuelve a empezar desde la primera.'],
    relacionadas: ['tarifa_crear', 'tarifa_editar', 'taller_sembrar'],
  },
  async ejecutar(args, ctx, tx) {
    const cursor = args.cursor ? decodificarCursorDeLista(args.cursor) : null;
    if (args.cursor && !cursor) return rechazo('argumentos_invalidos', 'El cursor no es válido.');
    const buscar = args.buscar ? normalizarNombre(args.buscar) : '';
    const r = await listarTarifas(tx, ctx, { ...(buscar && { buscar }), estado: args.estado, ...(args.factor && { factor: args.factor }), cursor, limite: args.limite });
    return exito({ items: r.items.map(aTarifaDto), siguiente: r.siguiente });
  },
});

export const tarifaCrear = definirHerramienta('tarifa_crear', {
  modulo: MODULO,
  permiso: 'cotizador:configurar',
  criticidad: 'normal',
  idempotente: true,
  ayuda: {
    titulo: 'Crear una tarifa',
    paraQueSirve: 'Guarda lo que te cuesta un material o un servicio, para agregarlo a un cuadro sin teclear el costo cada vez.',
    cuandoUsarla: 'Cuando compras un papel nuevo o cambias de proveedor.',
    campos: CAMPOS,
    ejemploTecleado: 'crear tarifa papel couché 150 a 0.45 el pliego',
    ejemploHablado: 'agrega papel couché ciento cincuenta a cuarenta y cinco céntimos el pliego',
    erroresComunes: ['Ya existe una tarifa con ese nombre.', 'El costo debe ser un número con punto.', 'El formato indicado no existe o está archivado.'],
    relacionadas: ['tarifas_listar', 'tarifa_editar', 'tarifa_archivar'],
  },
  auditar,
  async ejecutar(args, ctx, tx) {
    const malo = rechazoSiMalo(validarTarifa(args));
    if (malo) return malo;
    if (args.formatoId && !(await formatoVivo(tx, ctx, args.formatoId))) return rechazo('no_encontrado', 'No existe ese formato de pliego o está archivado.');
    const normalizado = normalizarNombre(args.nombre);
    const otra = await tarifaActivaConNombre(tx, ctx, normalizado);
    if (otra) return repetida(otra);
    const r = await crearTarifa(tx, ctx, { ...args, nombreNormalizado: normalizado });
    return r.creada ? exito(aTarifaDto(r.fila)) : repetida(r.existente);
  },
});

type CambioDeTarifa = Awaited<ReturnType<typeof prepararCambio>>;
/** Lo comparten `resumir` y `ejecutar`: lo que se confirma es lo que se guarda. Solo lee. */
async function prepararCambio(tx: Transaccion, ctx: ContextoDeEmpresa, actual: Tarifa, args: ArgsDe<'tarifa_editar'>) {
  if (actual.archivadoEn) return archivadaNoSeEdita('Una tarifa');
  const nuevo: DatosDeTarifa = {
    factor: args.factor ?? (actual.factor as DatosDeTarifa['factor']),
    nombre: args.nombre ?? actual.nombre,
    unidad: args.unidad ?? actual.unidad,
    costoUnitario: args.costoUnitario ?? actual.costoUnitario,
    escalaPorDefecto: args.escalaPorDefecto ?? (actual.escalaPorDefecto as DatosDeTarifa['escalaPorDefecto']),
  };
  const malo = rechazoSiMalo(validarTarifa(nuevo));
  if (malo) return malo;
  if (args.formatoId && !(await formatoVivo(tx, ctx, args.formatoId))) return rechazo('no_encontrado', 'No existe ese formato de pliego o está archivado.');
  const normalizado = normalizarNombre(nuevo.nombre);
  const otra = await tarifaActivaConNombre(tx, ctx, normalizado, actual.id);
  if (otra) return repetida(otra);
  const cambios = { ...nuevo, nombreNormalizado: normalizado, ...(args.formatoId !== undefined && { formatoId: args.formatoId }), ...(args.articuloId !== undefined && { articuloId: args.articuloId }) };
  return { ok: true as const, cambios, nuevo };
}

export const tarifaEditar = definirHerramienta('tarifa_editar', {
  modulo: MODULO,
  permiso: 'cotizador:configurar',
  criticidad: 'critica',
  ayuda: {
    titulo: 'Cambiar una tarifa',
    paraQueSirve: 'Cambia el nombre, la unidad, el costo o la escala de una tarifa. Si cambia el costo, se pide confirmar: «Cambiarás el costo de «X»: 0.45 → 0.52». Los cuadros ya armados no cambian.',
    cuandoUsarla: 'Cuando sube o baja el costo de un material o un servicio.',
    campos: [ID, ...CAMPOS],
    ejemploTecleado: 'subir el papel couché 150 a 0.52',
    ejemploHablado: 'el couché ciento cincuenta ahora cuesta cincuenta y dos céntimos',
    erroresComunes: ['Hay que indicar al menos un dato.', 'Una tarifa archivada no se edita.', 'La confirmación venció o la tarifa cambió: vuelve a pedirla.'],
    relacionadas: ['tarifas_listar', 'tarifa_archivar'],
  },
  auditar,
  async resumir(args, ctx, tx) {
    const actual = await verTarifa(tx, ctx, args.id);
    if (!actual) return noExiste(QUE);
    const p: CambioDeTarifa = await prepararCambio(tx, ctx, actual, args);
    if (!p.ok) return p;
    return { ok: true, resumen: { resumen: resumenDeCambioDeTarifa(actual.nombre, actual.costoUnitario, p.nuevo.costoUnitario), huella: huellaDe(actual) } };
  },
  async ejecutar(args, ctx, tx) {
    const actual = await bloquearTarifa(tx, ctx, args.id);
    if (!actual) return noExiste(QUE);
    const p: CambioDeTarifa = await prepararCambio(tx, ctx, actual, args);
    if (!p.ok) return p;
    return exito(aTarifaDto(await editarTarifa(tx, ctx, actual.id, p.cambios)));
  },
});

export const tarifaArchivar = definirHerramienta('tarifa_archivar', {
  modulo: MODULO,
  permiso: 'cotizador:configurar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Archivar una tarifa',
    paraQueSirve: 'Oculta una tarifa que ya no usas. Los cuadros que la usaron se conservan.',
    cuandoUsarla: 'Cuando dejas de comprar ese material o servicio.',
    campos: [ID],
    ejemploTecleado: 'archivar la tarifa papel bond 80',
    ejemploHablado: 'ya no uso el bond ochenta',
    erroresComunes: ['La tarifa no existe o es de otra empresa.'],
    relacionadas: ['tarifas_listar', 'tarifa_crear'],
  },
  auditar,
  async ejecutar(args, ctx, tx) {
    const t = await archivarTarifa(tx, ctx, args.id);
    return t ? exito(aTarifaDto(t)) : noExiste(QUE);
  },
});
