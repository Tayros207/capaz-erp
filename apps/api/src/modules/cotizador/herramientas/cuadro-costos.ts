import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import { aplicarColumnasAEnviar, aplicarCostoDirecto, aplicarPrecioFinal, aplicarUtilidad } from '../domain/cuadro-comandos-directo.js';
import { MODULO } from './comun.js';
import { auditarCuadro, editarCuadro, ID_DE_COTIZACION } from './cuadro-comun.js';

// El cuadro de costos directo (tres columnas: 100 / 1.000 / 5.000), la utilidad y el precio final.

export const cuadroFijarCostoDirecto = definirHerramienta('cuadro_fijar_costo_directo', {
  modulo: MODULO,
  permiso: 'cotizador:costos',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Costos escritos en el cuadro',
    paraQueSirve: 'Escribe directamente el costo de una fila (material, planchas, impresión, diseño, acabado, indirectos o un ítem propio como «i1») para 100, 1.000 o 5.000 unidades, en céntimos. Lo escrito manda sobre lo que calcule el detalle. Con null se quita y la celda vuelve al detalle (o a cero). En una fila fija el mismo importe vale para las tres columnas. Se pueden mandar varias celdas en una llamada.',
    cuandoUsarla: 'Cuando ya se sabe lo que cuesta cada cosa y no hace falta armar el detalle fila por fila.',
    campos: [
      ID_DE_COTIZACION,
      { nombre: 'celdas', queSeAnota: 'La fila (material, planchas, impresion, diseno, acabado, indirectos o id de ítem), la columna (100, 1000 o 5000) y el importe en céntimos (o null para quitarlo).', ejemplo: '[{ "fila": "material", "columna": "1000", "importeCentimos": 25000 }]' },
      { nombre: 'fijas', queSeAnota: 'Qué filas pasan a ser fijas (el mismo importe en las tres columnas) o dejan de serlo.', ejemplo: '[{ "fila": "planchas", "fija": true }]' },
    ],
    ejemploTecleado: 'material a mil: 250; placa fija',
    ejemploHablado: 'el material a mil me sale doscientos cincuenta',
    erroresComunes: ['Escribir el importe en soles con decimales: va en céntimos enteros.', 'Nombrar una fila que no existe.', 'Esperar que el detalle de la fila se borre: solo se tapa mientras haya algo escrito.'],
    relacionadas: ['cuadro_fijar_utilidad', 'cuadro_calcular', 'cuadro_fijar_columnas_a_enviar'],
  },
  auditar: auditarCuadro,
  ejecutar: (args, ctx, tx) => editarCuadro(tx, ctx, args.id, (cuadro) => aplicarCostoDirecto(cuadro, args)),
});

export const cuadroFijarColumnasAEnviar = definirHerramienta('cuadro_fijar_columnas_a_enviar', {
  modulo: MODULO,
  permiso: 'cotizador:editar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Qué cantidades se le envían al cliente',
    paraQueSirve: 'Elige cuáles de las tres cantidades del cuadro (100, 1.000 y 5.000) ve el cliente: una, dos o las tres. La cantidad base del trabajo siempre va. Con más de una, el cliente las ve como opciones y aprueba una. Reemplaza la lista completa.',
    cuandoUsarla: 'Antes de emitir, cuando el cliente debe poder elegir entre varias cantidades.',
    campos: [ID_DE_COTIZACION, { nombre: 'columnas', queSeAnota: 'Las cantidades que se envían, entre 100, 1000 y 5000.', ejemplo: '["1000", "5000"]' }],
    ejemploTecleado: 'enviar 1000 y 5000',
    ejemploHablado: 'mándale mil y cinco mil',
    erroresComunes: ['Quitar la cantidad base: siempre va; el sistema la agrega.', 'Elegir varias cantidades con un precio final fijado a mano: vale para una sola; hay que quitarlo antes.', 'Pedir una cantidad que no es 100, 1000 ni 5000, o hacerlo con una cantidad de trabajo que no es una de las tres.'],
    relacionadas: ['cuadro_fijar_trabajo', 'cuadro_fijar_precio_final', 'cotizacion_emitir'],
  },
  auditar: auditarCuadro,
  ejecutar: (args, ctx, tx) => editarCuadro(tx, ctx, args.id, (cuadro) => aplicarColumnasAEnviar(cuadro, args.columnas)),
});

export const cuadroFijarUtilidad = definirHerramienta('cuadro_fijar_utilidad', {
  modulo: MODULO,
  permiso: 'cotizador:costos',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Utilidad de esta cotización',
    paraQueSirve: 'Cambia el porcentaje de utilidad de esta cotización y, si se pide, su base: «venta» es un porcentaje del precio (con 35 %, el margen real es 35 %) y «costo» es un recargo sobre el costo (con 35 % el margen real es menor). Con una columna (100, 1000 o 5000) cambia solo la utilidad de esa cantidad; con null la quita y vuelve a regir la general. No cambia la utilidad por defecto de la empresa.',
    cuandoUsarla: 'Cuando este trabajo lleve una utilidad distinta de la habitual.',
    campos: [
      ID_DE_COTIZACION,
      { nombre: 'pct', queSeAnota: 'El porcentaje, como texto con punto. Sobre la venta debe ser menor que 100.', ejemplo: '35' },
      { nombre: 'base', queSeAnota: 'Sobre qué se calcula: venta o costo (opcional).', ejemplo: 'venta' },
      { nombre: 'columna', queSeAnota: 'La cantidad a la que vale solo este porcentaje: 100, 1000 o 5000 (opcional).', ejemplo: '5000' },
    ],
    ejemploTecleado: 'utilidad 40 % sobre la venta',
    ejemploHablado: 'pon la utilidad en cuarenta por ciento',
    erroresComunes: ['Creer que 35 % sobre el costo da 35 % de ganancia: el margen real sobre el precio es menor.', 'Poner 100 % o más sobre la venta: es imposible.'],
    relacionadas: ['cuadro_fijar_precio_final', 'cuadro_calcular', 'cuadro_fijar_costo_directo'],
  },
  auditar: auditarCuadro,
  ejecutar: (args, ctx, tx) => editarCuadro(tx, ctx, args.id, (cuadro) => aplicarUtilidad(cuadro, args)),
});

export const cuadroFijarPrecioFinal = definirHerramienta('cuadro_fijar_precio_final', {
  modulo: MODULO,
  permiso: 'cotizador:editar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Precio final',
    paraQueSirve: 'Fija el precio que se le dirá al cliente (sin IGV, en céntimos) en lugar del sugerido, o con null vuelve al sugerido. Se negocia el precio, no el margen: el recibo muestra el margen resultante y, si queda bajo el mínimo, avisa. Vale para una sola cantidad.',
    cuandoUsarla: 'Cuando el cliente pide rebaja o el precio se redondea distinto del sugerido.',
    campos: [ID_DE_COTIZACION, { nombre: 'precioCentimos', queSeAnota: 'El precio del lote sin IGV en céntimos, o null para volver al sugerido.', ejemplo: '30000' }],
    ejemploTecleado: 'precio final 300',
    ejemploHablado: 'déjalo en trescientos',
    erroresComunes: ['Fijarlo mientras se envían varias cantidades: vale para una sola.', 'Bajar el precio del mínimo sin pensar en el motivo: al emitir en rojo se exige uno.', 'Escribirlo en soles con decimales: va en céntimos.'],
    relacionadas: ['cuadro_fijar_utilidad', 'cuadro_calcular', 'cuadro_fijar_columnas_a_enviar', 'cotizacion_emitir'],
  },
  auditar: auditarCuadro,
  ejecutar: (args, ctx, tx) => editarCuadro(tx, ctx, args.id, (cuadro, { config }) => aplicarPrecioFinal(cuadro, args.precioCentimos, config)),
});
