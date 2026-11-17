import { exito, rechazo } from '@capaz/shared';
import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import { decodificarCursorDeLista } from '../domain/cursor.js';
import { normalizarNombre } from '../domain/lista.js';
import { validarMaquina, type DatosDeMaquina } from '../domain/taller.js';
import { archivarMaquina, bloquearMaquina, crearMaquina, editarMaquina, listarMaquinas, maquinaActivaConNombre } from '../repositories/taller.repository.js';
import { ID_DE_EJEMPLO, MODULO } from './comun.js';
import { aMaquinaDto, archivadaNoSeEdita, noExiste, nombreRepetido, rechazoSiMalo } from './taller-mapeo.js';

// Máquinas: formato máximo, pinza, sangrado, calle y etapas de merma. Todo en cm y como texto.

const QUE = 'esa máquina';
const auditar = (_a: unknown, d: { id: string } | null) => ({ entidadTipo: 'maquina', entidadId: d?.id });
const ID = { nombre: 'id', queSeAnota: 'Identificador de la máquina.', ejemplo: ID_DE_EJEMPLO };
const CAMPOS = [
  { nombre: 'nombre', queSeAnota: 'Cómo llamas a la máquina.', ejemplo: 'Offset 36 × 52' },
  { nombre: 'formatoMaxAnchoCm', queSeAnota: 'Ancho máximo del pliego en cm, como texto.', ejemplo: '36' },
  { nombre: 'formatoMaxAltoCm', queSeAnota: 'Alto máximo del pliego en cm, como texto.', ejemplo: '52' },
  { nombre: 'pinzaCm', queSeAnota: 'Margen de pinza en cm.', ejemplo: '2' },
  { nombre: 'sangradoCm', queSeAnota: 'Sangrado en cm.', ejemplo: '0.3' },
  { nombre: 'calleCm', queSeAnota: 'Calle entre piezas en cm.', ejemplo: '0.3' },
  { nombre: 'etapas', queSeAnota: 'Etapas con merma: lista de { nombre, mermaPct, arranque } como texto.', ejemplo: '[{"nombre":"Tiraje","mermaPct":"3","arranque":"40"}]' },
];
const nombreRepetidoDe = (o: { id: string; nombre: string }) => nombreRepetido('una máquina', o, 'máquina');

export const maquinasListar = definirHerramienta('maquinas_listar', {
  modulo: MODULO,
  permiso: 'cotizador:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Listar las máquinas',
    paraQueSirve: 'Muestra las máquinas del taller con su formato máximo, pinza, sangrado, calle y mermas.',
    cuandoUsarla: 'Para elegir con qué máquina imponer un trabajo o revisar sus medidas.',
    campos: [
      { nombre: 'buscar', queSeAnota: 'Parte del nombre (opcional).', ejemplo: 'offset' },
      { nombre: 'estado', queSeAnota: 'activas, archivadas o todas (por defecto, activas).', ejemplo: 'activas' },
    ],
    ejemploTecleado: 'ver mis máquinas',
    ejemploHablado: 'qué máquinas tengo',
    erroresComunes: ['El cursor de la página no es válido: vuelve a empezar desde la primera.'],
    relacionadas: ['maquina_crear', 'formatos_pliego_listar'],
  },
  async ejecutar(args, ctx, tx) {
    const cursor = args.cursor ? decodificarCursorDeLista(args.cursor) : null;
    if (args.cursor && !cursor) return rechazo('argumentos_invalidos', 'El cursor no es válido.');
    const buscar = args.buscar ? normalizarNombre(args.buscar) : '';
    const r = await listarMaquinas(tx, ctx, { ...(buscar && { buscar }), estado: args.estado, cursor, limite: args.limite });
    return exito({ items: r.items.map(aMaquinaDto), siguiente: r.siguiente });
  },
});

export const maquinaCrear = definirHerramienta('maquina_crear', {
  modulo: MODULO,
  permiso: 'cotizador:configurar',
  criticidad: 'normal',
  idempotente: true,
  ayuda: {
    titulo: 'Crear una máquina',
    paraQueSirve: 'Registra una máquina con su formato máximo, pinza, sangrado, calle y etapas de merma, para no teclearlos en cada cotización.',
    cuandoUsarla: 'Cuando incorporas una máquina o quieres otra configuración de la misma.',
    campos: CAMPOS,
    ejemploTecleado: 'crear máquina Offset 36 por 52 con pinza 2',
    ejemploHablado: 'agrega la offset de treinta y seis por cincuenta y dos',
    erroresComunes: ['Ya existe una máquina con ese nombre.', 'La merma debe ser menor que 100 %.'],
    relacionadas: ['maquinas_listar', 'maquina_editar', 'maquina_archivar'],
  },
  auditar,
  async ejecutar(args, ctx, tx) {
    const malo = rechazoSiMalo(validarMaquina(args));
    if (malo) return malo;
    const normalizado = normalizarNombre(args.nombre);
    const otra = await maquinaActivaConNombre(tx, ctx, normalizado);
    if (otra) return nombreRepetidoDe(otra);
    const r = await crearMaquina(tx, ctx, { ...args, nombreNormalizado: normalizado });
    return r.creada ? exito(aMaquinaDto(r.fila)) : nombreRepetidoDe(r.existente);
  },
});

export const maquinaEditar = definirHerramienta('maquina_editar', {
  modulo: MODULO,
  permiso: 'cotizador:configurar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Cambiar una máquina',
    paraQueSirve: 'Cambia el nombre, las medidas o las etapas de una máquina. Los cuadros ya armados no cambian: copiaron los valores.',
    cuandoUsarla: 'Cuando corriges una medida o ajustas una merma.',
    campos: [ID, ...CAMPOS],
    ejemploTecleado: 'cambiar la pinza de la offset a 1.5',
    ejemploHablado: 'la pinza de la offset ahora es uno punto cinco',
    erroresComunes: ['Hay que indicar al menos un dato.', 'Una máquina archivada no se edita.', 'Ya existe una máquina con ese nombre.'],
    relacionadas: ['maquinas_listar', 'maquina_archivar'],
  },
  auditar,
  async ejecutar(args, ctx, tx) {
    const actual = await bloquearMaquina(tx, ctx, args.id);
    if (!actual) return noExiste(QUE);
    if (actual.archivadoEn) return archivadaNoSeEdita('Una máquina');
    const { id, ...c } = args;
    const nuevo: DatosDeMaquina = {
      nombre: c.nombre ?? actual.nombre,
      formatoMaxAnchoCm: c.formatoMaxAnchoCm ?? actual.formatoMaxAnchoCm,
      formatoMaxAltoCm: c.formatoMaxAltoCm ?? actual.formatoMaxAltoCm,
      pinzaCm: c.pinzaCm ?? actual.pinzaCm,
      sangradoCm: c.sangradoCm ?? actual.sangradoCm,
      calleCm: c.calleCm ?? actual.calleCm,
      etapas: c.etapas ?? (actual.etapas as DatosDeMaquina['etapas']),
    };
    const malo = rechazoSiMalo(validarMaquina(nuevo));
    if (malo) return malo;
    const normalizado = normalizarNombre(nuevo.nombre);
    const otra = await maquinaActivaConNombre(tx, ctx, normalizado, id);
    if (otra) return nombreRepetidoDe(otra);
    return exito(aMaquinaDto(await editarMaquina(tx, ctx, id, { ...nuevo, nombreNormalizado: normalizado })));
  },
});

export const maquinaArchivar = definirHerramienta('maquina_archivar', {
  modulo: MODULO,
  permiso: 'cotizador:configurar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Archivar una máquina',
    paraQueSirve: 'Oculta una máquina que ya no usas. Los cuadros que la usaron se conservan.',
    cuandoUsarla: 'Cuando vendes o retiras una máquina.',
    campos: [ID],
    ejemploTecleado: 'archivar la máquina Offset 36 × 52',
    ejemploHablado: 'ya no tengo la offset',
    erroresComunes: ['La máquina no existe o es de otra empresa.'],
    relacionadas: ['maquinas_listar', 'maquina_crear'],
  },
  auditar,
  async ejecutar(args, ctx, tx) {
    const m = await archivarMaquina(tx, ctx, args.id);
    return m ? exito(aMaquinaDto(m)) : noExiste(QUE);
  },
});
