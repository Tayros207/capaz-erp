import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import { aplicarAgregarLinea, aplicarEditarLinea, aplicarQuitarLinea, type TarifaCopiada } from '../domain/cuadro-comandos-lineas.js';
import { rechazarCuadro } from '../domain/cuadro-tipos.js';
import { verTarifa } from '../repositories/taller.repository.js';
import { MODULO } from './comun.js';
import { veCostos } from './cotizacion-comun.js';
import { auditarCuadro, editarCuadro, ID_DE_COTIZACION } from './cuadro-comun.js';

// Las filas del cuadro: agregar (de una tarifa del taller o a mano), corregir un dato y quitar. Escribir un costo a mano pide el permiso de costos.

const SIN_COSTOS = 'Para anotar el costo de una fila necesitas el permiso de costos (también puedes tomarlo de una tarifa del taller).';
const FILA = { nombre: 'linea', queSeAnota: 'Qué fila: por id, por número o por un texto de su descripción.', ejemplo: '{ "texto": "papel" }' };

export const cuadroLineaAgregar = definirHerramienta('cuadro_linea_agregar', {
  modulo: MODULO,
  permiso: 'cotizador:editar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Agregar una fila al cuadro',
    paraQueSirve: 'Suma una fila a un factor del cuadro (material, planchas, impresión, diseño, acabado u otros), tomada de una tarifa del taller o escrita a mano. De la tarifa se copian el nombre, la unidad, el costo y la escala; lo que se diga aparte los reemplaza. El cuadro admite hasta 60 filas.',
    cuandoUsarla: 'Para cada costo del trabajo, salvo el papel y las planchas que el motor ya llena.',
    campos: [
      ID_DE_COTIZACION,
      { nombre: 'tarifaId', queSeAnota: 'Una tarifa del taller.', ejemplo: '0192f0c4-7b1e-7000-8000-000000000041' },
      { nombre: 'factor', queSeAnota: 'material, impresion, planchas, diseno, acabado o indirectos (sin tarifa es obligatorio).', ejemplo: 'acabado' },
      { nombre: 'descripcion', queSeAnota: 'Cómo se llama la fila (sin tarifa es obligatoria).', ejemplo: 'Barniz de máquina' },
      { nombre: 'cantidad', queSeAnota: 'Cuántas unidades, como texto con punto decimal.', ejemplo: '1' },
      { nombre: 'unidad', queSeAnota: 'En qué se mide (opcional).', ejemplo: 'servicio' },
      { nombre: 'costoUnitario', queSeAnota: 'Costo por unidad, como texto con punto (hasta 4 decimales); sin tarifa es obligatorio y pide permiso de costos.', ejemplo: '28.00' },
      { nombre: 'escala', queSeAnota: 'fija, por_pliego o por_unidad: cómo cambia al correr el cuadro a otra cantidad (opcional).', ejemplo: 'por_pliego' },
    ],
    ejemploTecleado: 'agrega barniz de máquina, 1 servicio a 28.00',
    ejemploHablado: 'agrega el barniz de máquina, uno a veintiocho',
    erroresComunes: ['No decir la cantidad: siempre hace falta, también con tarifa.', 'Agregar aparte el papel que el motor ya llena: se corrige con cuadro_linea_editar.', 'El cuadro ya tiene 60 filas.'],
    relacionadas: ['cuadro_linea_editar', 'cuadro_linea_quitar', 'tarifas_listar'],
  },
  auditar: auditarCuadro,
  ejecutar: (args, ctx, tx) =>
    editarCuadro(tx, ctx, args.id, async (cuadro) => {
      if (args.costoUnitario !== undefined && !veCostos(ctx)) return rechazarCuadro('argumentos_invalidos', SIN_COSTOS);
      let tarifa: TarifaCopiada | undefined;
      if (args.tarifaId) {
        const t = await verTarifa(tx, ctx, args.tarifaId);
        if (!t) return rechazarCuadro('no_encontrado', 'No existe esa tarifa.');
        if (t.archivadoEn) return rechazarCuadro('conflicto', `La tarifa «${t.nombre}» está archivada.`);
        tarifa = { factor: t.factor as TarifaCopiada['factor'], nombre: t.nombre, unidad: t.unidad, costoUnitario: t.costoUnitario, escalaPorDefecto: t.escalaPorDefecto as TarifaCopiada['escalaPorDefecto'] };
      }
      return aplicarAgregarLinea(cuadro, { ...args, tarifa });
    }),
});

export const cuadroLineaEditar = definirHerramienta('cuadro_linea_editar', {
  modulo: MODULO,
  permiso: 'cotizador:editar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Corregir una fila',
    paraQueSirve: 'Cambia un dato de una fila: descripción, cantidad, unidad, costo unitario, escala o factor. La fila se indica por su id, su número o un texto de su descripción; si el texto coincide con varias no se cambia nada y se pregunta cuál.',
    cuandoUsarla: 'Para corregir un costo o una cantidad, o llenar el costo de una fila sugerida por la plantilla.',
    campos: [
      ID_DE_COTIZACION,
      FILA,
      { nombre: 'campo', queSeAnota: 'Qué dato: descripcion, cantidad, unidad, costoUnitario, escala o factor.', ejemplo: 'costoUnitario' },
      { nombre: 'valor', queSeAnota: 'El valor nuevo, como texto con punto decimal.', ejemplo: '0.50' },
    ],
    ejemploTecleado: 'corrige el costo del papel a 0.50',
    ejemploHablado: 'el papel ahora cuesta cincuenta céntimos',
    erroresComunes: ['Indicar la fila con un texto que coincide con varias: se pregunta cuál, por su número.', 'Cambiar la cantidad del papel o de las planchas: la fila deja de seguir a la imposición o a tintas por caras.', 'Escribir el valor con coma decimal.'],
    relacionadas: ['cuadro_linea_agregar', 'cuadro_linea_quitar', 'cuadro_fijar_imposicion'],
  },
  auditar: auditarCuadro,
  ejecutar: (args, ctx, tx) =>
    editarCuadro(tx, ctx, args.id, (cuadro) => {
      if (args.campo === 'costoUnitario' && !veCostos(ctx)) return rechazarCuadro('argumentos_invalidos', SIN_COSTOS);
      return aplicarEditarLinea(cuadro, args.linea, args.campo, args.valor);
    }),
});

export const cuadroLineaQuitar = definirHerramienta('cuadro_linea_quitar', {
  modulo: MODULO,
  permiso: 'cotizador:editar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Quitar una fila',
    paraQueSirve: 'Elimina una fila del cuadro. La fila se indica por su id, su número o un texto de su descripción; si coincide con varias no se quita ninguna y se pregunta cuál.',
    cuandoUsarla: 'Cuando una fila sobra o se agregó por error. Al quitar una, los números de las que siguen bajan uno.',
    campos: [ID_DE_COTIZACION, FILA],
    ejemploTecleado: 'quita la fila 3',
    ejemploHablado: 'quita el barniz',
    erroresComunes: ['Indicar la fila por un texto que coincide con varias.', 'Quitar la fila de papel o de planchas: el motor deja de calcularla (el papel se vuelve a ligar con cuadro_fijar_imposicion).'],
    relacionadas: ['cuadro_linea_agregar', 'cuadro_linea_editar'],
  },
  auditar: auditarCuadro,
  ejecutar: (args, ctx, tx) => editarCuadro(tx, ctx, args.id, (cuadro) => aplicarQuitarLinea(cuadro, args.linea)),
});

