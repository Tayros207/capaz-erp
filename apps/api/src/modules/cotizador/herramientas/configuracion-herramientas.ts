import { exito } from '@capaz/shared';
import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import { CONFIGURACION_POR_DEFECTO, validarConfiguracion } from '../domain/configuracion.js';
import { asegurarConfiguracion, guardarConfiguracion, leerConfiguracion, type CambiosDeConfiguracion } from '../repositories/configuracion.repository.js';
import { MODULO, rechazoDe } from './comun.js';
import { aConfiguracionDto } from './mapeo.js';

// Arranque y configuración del módulo. La lectura no siembra (con el módulo en baja la base rechazaría la escritura).

export const cotizadorIniciar = definirHerramienta('cotizador_iniciar', {
  modulo: MODULO,
  permiso: 'cotizador:editar',
  criticidad: 'normal',
  idempotente: true,
  ayuda: {
    titulo: 'Preparar el Cotizador',
    paraQueSirve: 'Deja lista la configuración con los valores por defecto (utilidad, umbrales, IGV). Si ya existe, no cambia nada.',
    cuandoUsarla: 'La primera vez que se entra al módulo. Crear una lista de precios también lo hace solo.',
    campos: [],
    ejemploTecleado: 'preparar el cotizador',
    ejemploHablado: 'deja listo el cotizador para empezar',
    erroresComunes: ['El módulo está en solo lectura: no se puede preparar hasta reactivarlo.'],
    relacionadas: ['cotizador_configuracion_ver', 'cotizador_configurar', 'lista_precio_crear'],
  },
  auditar: (_a, d) => ({ entidadTipo: 'cotizador', resumen: { configuracionCreada: d?.configuracionCreada ?? false } }),
  async ejecutar(_args, ctx, tx) {
    return exito({ configuracionCreada: await asegurarConfiguracion(tx, ctx) });
  },
});

export const cotizadorConfiguracionVer = definirHerramienta('cotizador_configuracion_ver', {
  modulo: MODULO,
  permiso: 'cotizador:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Ver la configuración del Cotizador',
    paraQueSirve: 'Muestra la utilidad, los umbrales, el redondeo comercial, el IGV, las condiciones y el mensaje de WhatsApp.',
    cuandoUsarla: 'Para revisar con qué reglas se cotiza antes de cambiarlas.',
    campos: [],
    ejemploTecleado: 'ver la configuración del cotizador',
    ejemploHablado: 'con qué utilidad estoy cotizando',
    erroresComunes: ['Si la empresa nunca configuró nada, se muestran los valores por defecto.'],
    relacionadas: ['cotizador_configurar', 'cotizador_iniciar'],
  },
  async ejecutar(_args, ctx, tx) {
    const fila = await leerConfiguracion(tx, ctx);
    return exito(fila ? aConfiguracionDto(fila) : CONFIGURACION_POR_DEFECTO);
  },
});

export const cotizadorConfigurar = definirHerramienta('cotizador_configurar', {
  modulo: MODULO,
  permiso: 'cotizador:configurar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Configurar el Cotizador',
    paraQueSirve: 'Cambia la utilidad, los umbrales de semáforo, el redondeo comercial, el IGV (18 % o 0 %), las condiciones y el mensaje de WhatsApp.',
    cuandoUsarla: 'Cuando cambian tus márgenes, tus condiciones de venta o la forma de redondear precios.',
    campos: [
      { nombre: 'utilidadPct', queSeAnota: 'Utilidad deseada en porcentaje (opcional).', ejemplo: '35' },
      { nombre: 'redondeoComercial', queSeAnota: 'ninguno, 1, 5 o 10 (opcional).', ejemplo: '5' },
      { nombre: 'igvPorcentaje', queSeAnota: '18 o 0 (opcional).', ejemplo: '18' },
    ],
    ejemploTecleado: 'configurar el redondeo comercial a 5',
    ejemploHablado: 'redondea mis precios hacia arriba de cinco en cinco',
    erroresComunes: ['Hay que indicar al menos un dato.', 'El umbral mínimo debe ser menor que el umbral verde.', 'Con la utilidad sobre la venta, el porcentaje debe ser menor que 100.'],
    relacionadas: ['cotizador_configuracion_ver'],
  },
  auditar: () => ({ entidadTipo: 'cotizador' }),
  async ejecutar(args, ctx, tx) {
    await asegurarConfiguracion(tx, ctx);
    const actual = await leerConfiguracion(tx, ctx);
    if (!actual) throw new Error('La configuración no se pudo leer.');
    const cambios: CambiosDeConfiguracion = {};
    if (args.utilidadPct !== undefined) cambios.utilidadPct = args.utilidadPct;
    if (args.utilidadBase !== undefined) cambios.utilidadBase = args.utilidadBase;
    if (args.umbralVerdePct !== undefined) cambios.umbralVerdePct = args.umbralVerdePct;
    if (args.umbralMinimoPct !== undefined) cambios.umbralMinimoPct = args.umbralMinimoPct;
    if (args.redondeoComercial !== undefined) cambios.redondeoComercial = args.redondeoComercial;
    if (args.igvPorcentaje !== undefined) cambios.igvPorcentaje = args.igvPorcentaje;
    if (args.condiciones !== undefined) cambios.condiciones = args.condiciones;
    if (args.mensajeWhatsapp !== undefined) cambios.mensajeWhatsapp = args.mensajeWhatsapp?.trim() ? args.mensajeWhatsapp.trim() : null;
    const final = { ...actual, ...cambios };
    const invalida = validarConfiguracion({
      utilidadPct: final.utilidadPct,
      utilidadBase: final.utilidadBase as 'venta' | 'costo',
      umbralVerdePct: final.umbralVerdePct,
      umbralMinimoPct: final.umbralMinimoPct,
    });
    if (invalida) return rechazoDe(invalida);
    return exito(aConfiguracionDto(await guardarConfiguracion(tx, ctx, cambios)));
  },
});
