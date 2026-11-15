import { eq } from 'drizzle-orm';
import { exito, rechazo } from '@capaz/shared';
import { empresaConfig } from '../../../db/esquema/core.js';
import { hashCanonico } from '../../herramientas/confirmacion.js';
import { definirHerramienta } from '../../herramientas/tipos.js';
import { aConfiguracion } from './empresa-ver-configuracion.js';

const ETIQUETAS = { zonaHoraria: 'zona horaria', moneda: 'moneda', locale: 'idioma' } as const;

export const empresaActualizarConfiguracion = definirHerramienta('empresa_actualizar_configuracion', {
  modulo: 'core',
  permiso: 'empresa:configurar',
  criticidad: 'critica',
  ayuda: {
    titulo: 'Cambiar la configuración de la empresa',
    paraQueSirve: 'Cambia la zona horaria, la moneda o el idioma de tu empresa. Envías solo lo que cambia.',
    cuandoUsarla: 'Cuando tu empresa cambia de zona horaria o necesita otra moneda o idioma.',
    campos: [
      { nombre: 'zonaHoraria', queSeAnota: 'Zona horaria con su nombre completo.', ejemplo: 'America/Lima' },
      { nombre: 'moneda', queSeAnota: 'Código de tres letras de la moneda.', ejemplo: 'PEN' },
      { nombre: 'locale', queSeAnota: 'Idioma y país.', ejemplo: 'es-PE' },
    ],
    ejemploTecleado: 'cambiar la moneda de la empresa a USD',
    ejemploHablado: 'pon la moneda de la empresa en dólares',
    erroresComunes: ['Hay que indicar al menos un dato.', 'La zona horaria debe ser un nombre válido, como America/Lima.'],
    relacionadas: ['empresa_ver_configuracion'],
  },
  // Lee la fila bloqueada: el estado sobre el que se confirma no cambia hasta que termina la llamada.
  async resumir(args, ctx, tx) {
    const [fila] = await tx.select().from(empresaConfig).where(eq(empresaConfig.tenantId, ctx.empresaId)).for('update');
    if (!fila) return { ok: false, error: { codigo: 'no_encontrado', mensaje: 'La configuración de la empresa aún no existe.' } };
    const cambios = (Object.keys(ETIQUETAS) as (keyof typeof ETIQUETAS)[])
      .filter((k) => args[k] !== undefined)
      .map((k) => `${ETIQUETAS[k]} de «${fila[k]}» a «${args[k]}»`);
    return {
      ok: true,
      resumen: {
        resumen: `Cambiarás la configuración de la empresa: ${cambios.join(', ')}.`,
        huella: hashCanonico({ zonaHoraria: fila.zonaHoraria, moneda: fila.moneda, locale: fila.locale }),
      },
    };
  },
  auditar: (args) => ({
    entidadTipo: 'empresa_config',
    resumen: { campos: Object.keys(args).filter((k) => args[k as keyof typeof args] !== undefined).sort().join(',') },
  }),
  async ejecutar(args, ctx, tx) {
    const [actual] = await tx.select().from(empresaConfig).where(eq(empresaConfig.tenantId, ctx.empresaId)).for('update');
    if (!actual) return rechazo('no_encontrado', 'La configuración de la empresa aún no existe.');
    const cambios = {
      ...(args.zonaHoraria !== undefined && { zonaHoraria: args.zonaHoraria }),
      ...(args.moneda !== undefined && { moneda: args.moneda }),
      ...(args.locale !== undefined && { locale: args.locale }),
    };
    const [nueva] = await tx.update(empresaConfig).set(cambios).where(eq(empresaConfig.tenantId, ctx.empresaId)).returning();
    return nueva ? exito(aConfiguracion(nueva)) : rechazo('no_encontrado', 'La configuración de la empresa aún no existe.');
  },
});
