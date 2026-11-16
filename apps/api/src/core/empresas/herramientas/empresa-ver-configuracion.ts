import { eq } from 'drizzle-orm';
import { exito, rechazo, type ConfiguracionDeEmpresa } from '@capaz/shared';
import { empresaConfig } from '../../../db/esquema/core.js';
import { definirHerramienta } from '../../herramientas/tipos.js';

export const aConfiguracion = (f: typeof empresaConfig.$inferSelect): ConfiguracionDeEmpresa => ({
  zonaHoraria: f.zonaHoraria,
  moneda: f.moneda,
  locale: f.locale,
  razonSocial: f.razonSocial,
  ruc: f.ruc,
  direccionFiscal: f.direccionFiscal,
  telefono: f.telefono,
  correo: f.correo,
  pieDeDocumento: f.pieDeDocumento,
  logoDataUrl: f.logoDataUrl,
  actualizadoEn: f.actualizadoEn.toISOString(),
});

export const empresaVerConfiguracion = definirHerramienta('empresa_ver_configuracion', {
  modulo: 'core',
  permiso: 'empresa:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Ver la configuración de la empresa',
    paraQueSirve: 'Muestra la zona horaria, la moneda y el idioma de tu empresa, y sus datos para los documentos: razón social, RUC, dirección fiscal, teléfono, correo, pie de documento y logo.',
    cuandoUsarla: 'Cuando quieras saber con qué formato se muestran las fechas y los montos, o con qué datos salen tus proformas y recibos.',
    campos: [],
    ejemploTecleado: 'ver configuración de la empresa',
    ejemploHablado: 'muéstrame la configuración de la empresa',
    erroresComunes: ['Tu empresa todavía no terminó de prepararse: vuelve a intentarlo en unos segundos.'],
    relacionadas: ['empresa_actualizar_configuracion'],
  },
  async ejecutar(_args, ctx, tx) {
    const [fila] = await tx.select().from(empresaConfig).where(eq(empresaConfig.tenantId, ctx.empresaId));
    return fila ? exito(aConfiguracion(fila)) : rechazo('no_encontrado', 'La configuración de la empresa aún no existe.');
  },
});
