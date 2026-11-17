import { exito, rechazo } from '@capaz/shared';
import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import { decodificarCursorDeLista } from '../domain/cursor.js';
import { normalizarNombre } from '../domain/lista.js';
import { validarFormato } from '../domain/taller.js';
import { archivarFormato, bloquearFormato, crearFormato, editarFormato, formatoActivoConNombre, listarFormatos } from '../repositories/taller.repository.js';
import { ID_DE_EJEMPLO, MODULO } from './comun.js';
import { aFormatoDto, archivadaNoSeEdita, noExiste, nombreRepetido, rechazoSiMalo } from './taller-mapeo.js';

// Formatos de pliego: el pliego madre que se compra y el tamaño de máquina al que se corta. Medidas en cm, como texto.

const QUE = 'ese formato de pliego';
const auditar = (_a: unknown, d: { id: string } | null) => ({ entidadTipo: 'formato_pliego', entidadId: d?.id });
const ID = { nombre: 'id', queSeAnota: 'Identificador del formato.', ejemplo: ID_DE_EJEMPLO };
const MEDIDAS = [
  { nombre: 'anchoCm', queSeAnota: 'Ancho en centímetros, como texto con punto.', ejemplo: '70' },
  { nombre: 'altoCm', queSeAnota: 'Alto en centímetros, como texto con punto.', ejemplo: '100' },
];

export const formatosPliegoListar = definirHerramienta('formatos_pliego_listar', {
  modulo: MODULO,
  permiso: 'cotizador:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Listar los formatos de pliego',
    paraQueSirve: 'Muestra los tamaños de pliego del taller: los madre (los que se compran) y los de máquina (a los que se cortan).',
    cuandoUsarla: 'Para elegir el pliego de una cotización por partes o revisar qué medidas tiene el taller.',
    campos: [
      { nombre: 'buscar', queSeAnota: 'Parte del nombre (opcional).', ejemplo: '70' },
      { nombre: 'estado', queSeAnota: 'activas, archivadas o todas (por defecto, activas).', ejemplo: 'activas' },
      { nombre: 'tipo', queSeAnota: 'madre o maquina (opcional).', ejemplo: 'madre' },
    ],
    ejemploTecleado: 'ver los pliegos madre',
    ejemploHablado: 'qué pliegos tengo registrados',
    erroresComunes: ['El cursor de la página no es válido: vuelve a empezar desde la primera.'],
    relacionadas: ['formato_pliego_crear', 'maquinas_listar', 'tarifas_listar'],
  },
  async ejecutar(args, ctx, tx) {
    const cursor = args.cursor ? decodificarCursorDeLista(args.cursor) : null;
    if (args.cursor && !cursor) return rechazo('argumentos_invalidos', 'El cursor no es válido.');
    const buscar = args.buscar ? normalizarNombre(args.buscar) : '';
    const r = await listarFormatos(tx, ctx, { ...(buscar && { buscar }), estado: args.estado, ...(args.tipo && { tipo: args.tipo }), cursor, limite: args.limite });
    return exito({ items: r.items.map(aFormatoDto), siguiente: r.siguiente });
  },
});

export const formatoPliegoCrear = definirHerramienta('formato_pliego_crear', {
  modulo: MODULO,
  permiso: 'cotizador:configurar',
  criticidad: 'normal',
  idempotente: true,
  ayuda: {
    titulo: 'Crear un formato de pliego',
    paraQueSirve: 'Registra un tamaño de pliego: madre (el que compras) o de máquina (al que lo cortas para imprimir).',
    cuandoUsarla: 'Cuando compras un papel de otra medida o cambias de máquina.',
    campos: [{ nombre: 'nombre', queSeAnota: 'Cómo lo llamas.', ejemplo: '70 × 100 cm' }, ...MEDIDAS, { nombre: 'tipo', queSeAnota: 'madre o maquina.', ejemplo: 'madre' }],
    ejemploTecleado: 'crear pliego madre de 70 por 100',
    ejemploHablado: 'agrega un pliego madre de setenta por cien',
    erroresComunes: ['Ya existe un formato con ese nombre.', 'Las medidas deben ser mayores que cero.'],
    relacionadas: ['formatos_pliego_listar', 'formato_pliego_editar', 'formato_pliego_archivar'],
  },
  auditar,
  async ejecutar(args, ctx, tx) {
    const malo = rechazoSiMalo(validarFormato(args));
    if (malo) return malo;
    const normalizado = normalizarNombre(args.nombre);
    const otra = await formatoActivoConNombre(tx, ctx, normalizado);
    if (otra) return nombreRepetido('un formato', otra, `${otra.anchoCm} × ${otra.altoCm} cm`);
    const r = await crearFormato(tx, ctx, { ...args, nombreNormalizado: normalizado });
    return r.creada ? exito(aFormatoDto(r.fila)) : nombreRepetido('un formato', r.existente, `${r.existente.anchoCm} × ${r.existente.altoCm} cm`);
  },
});

export const formatoPliegoEditar = definirHerramienta('formato_pliego_editar', {
  modulo: MODULO,
  permiso: 'cotizador:configurar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Cambiar un formato de pliego',
    paraQueSirve: 'Cambia el nombre, las medidas o el tipo de un formato. Los cuadros ya armados no cambian: copiaron las medidas.',
    cuandoUsarla: 'Cuando corriges una medida o renombras un pliego.',
    campos: [ID, { nombre: 'nombre', queSeAnota: 'Nuevo nombre (opcional).', ejemplo: '70 × 100 cm' }, ...MEDIDAS],
    ejemploTecleado: 'cambiar el alto del pliego 70 × 100 a 102',
    ejemploHablado: 'el pliego grande ahora mide ciento dos de alto',
    erroresComunes: ['Hay que indicar al menos un dato.', 'Un formato archivado no se edita.', 'Ya existe un formato con ese nombre.'],
    relacionadas: ['formatos_pliego_listar', 'formato_pliego_archivar'],
  },
  auditar,
  async ejecutar(args, ctx, tx) {
    const actual = await bloquearFormato(tx, ctx, args.id);
    if (!actual) return noExiste(QUE);
    if (actual.archivadoEn) return archivadaNoSeEdita('Un formato');
    const { id, ...cambios } = args;
    const nuevo = { nombre: cambios.nombre ?? actual.nombre, anchoCm: cambios.anchoCm ?? actual.anchoCm, altoCm: cambios.altoCm ?? actual.altoCm, tipo: cambios.tipo ?? (actual.tipo as 'madre' | 'maquina') };
    const malo = rechazoSiMalo(validarFormato(nuevo));
    if (malo) return malo;
    const normalizado = normalizarNombre(nuevo.nombre);
    const otra = await formatoActivoConNombre(tx, ctx, normalizado, id);
    if (otra) return nombreRepetido('un formato', otra, `${otra.anchoCm} × ${otra.altoCm} cm`);
    return exito(aFormatoDto(await editarFormato(tx, ctx, id, { ...nuevo, nombreNormalizado: normalizado })));
  },
});

export const formatoPliegoArchivar = definirHerramienta('formato_pliego_archivar', {
  modulo: MODULO,
  permiso: 'cotizador:configurar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Archivar un formato de pliego',
    paraQueSirve: 'Oculta un formato que ya no usas. Las tarifas y los cuadros que lo usaron se conservan.',
    cuandoUsarla: 'Cuando dejas de comprar o cortar ese tamaño.',
    campos: [ID],
    ejemploTecleado: 'archivar el pliego 50 × 70',
    ejemploHablado: 'ya no uso el pliego de cincuenta por setenta',
    erroresComunes: ['El formato no existe o es de otra empresa.'],
    relacionadas: ['formatos_pliego_listar', 'formato_pliego_crear'],
  },
  auditar,
  async ejecutar(args, ctx, tx) {
    const f = await archivarFormato(tx, ctx, args.id);
    return f ? exito(aFormatoDto(f)) : noExiste(QUE);
  },
});

