import { eq } from 'drizzle-orm';
import { exito, rechazo } from '@capaz/shared';
import { empresaConfig } from '../../../db/esquema/core.js';
import { hashCanonico } from '../../herramientas/confirmacion.js';
import { definirHerramienta } from '../../herramientas/tipos.js';
import { aConfiguracion } from './empresa-ver-configuracion.js';

const ETIQUETAS = { zonaHoraria: 'zona horaria', moneda: 'moneda', locale: 'idioma' } as const;
const DATOS = {
  razonSocial: 'la razón social',
  ruc: 'el RUC',
  direccionFiscal: 'la dirección fiscal',
  telefono: 'el teléfono',
  correo: 'el correo',
  pieDeDocumento: 'el pie de documento',
  logoDataUrl: 'el logo',
} as const;
type ClaveDeDato = keyof typeof DATOS;
const CLAVES_DATOS = Object.keys(DATOS) as ClaveDeDato[];

/** Describe los cambios a los datos de la empresa sin repetir su contenido (el logo y los textos no se muestran). */
function describirDatos(args: Record<string, unknown>): string[] {
  return CLAVES_DATOS.filter((k) => args[k] !== undefined).map((k) => (args[k] === '' ? `quitarás ${DATOS[k]}` : `cambiarás ${DATOS[k]}`));
}

/** Cadena vacía = borrar el dato. */
function valoresDeDatos(args: Record<string, unknown>): Partial<Record<ClaveDeDato, string | null>> {
  const salida: Partial<Record<ClaveDeDato, string | null>> = {};
  for (const k of CLAVES_DATOS) {
    const v = args[k];
    if (typeof v === 'string') salida[k] = v === '' ? null : v;
  }
  return salida;
}

export const empresaActualizarConfiguracion = definirHerramienta('empresa_actualizar_configuracion', {
  modulo: 'core',
  permiso: 'empresa:configurar',
  criticidad: 'critica',
  ayuda: {
    titulo: 'Cambiar la configuración de la empresa',
    paraQueSirve: 'Cambia la zona horaria, la moneda, el idioma y los datos de tu empresa para los documentos (razón social, RUC, dirección fiscal, teléfono, correo, pie de documento y logo). Envías solo lo que cambia; una cadena vacía borra el dato.',
    cuandoUsarla: 'Cuando tu empresa cambia de zona horaria o necesita otra moneda o idioma.',
    campos: [
      { nombre: 'zonaHoraria', queSeAnota: 'Zona horaria con su nombre completo.', ejemplo: 'America/Lima' },
      { nombre: 'moneda', queSeAnota: 'Código de tres letras de la moneda.', ejemplo: 'PEN' },
      { nombre: 'locale', queSeAnota: 'Idioma y país.', ejemplo: 'es-PE' },
      { nombre: 'razonSocial', queSeAnota: 'Nombre legal de la empresa (máximo 200 caracteres). Vacío lo borra.', ejemplo: 'Gráfica Andina S.A.C.' },
      { nombre: 'ruc', queSeAnota: 'RUC de 11 dígitos. Vacío lo borra.', ejemplo: '20123456789' },
      { nombre: 'direccionFiscal', queSeAnota: 'Dirección fiscal (máximo 300 caracteres).', ejemplo: 'Av. Los Olivos 123, Lima' },
      { nombre: 'telefono', queSeAnota: 'Teléfono de contacto (máximo 50 caracteres).', ejemplo: '999 888 777' },
      { nombre: 'correo', queSeAnota: 'Correo de contacto (máximo 200 caracteres).', ejemplo: 'ventas@miempresa.pe' },
      { nombre: 'pieDeDocumento', queSeAnota: 'Texto al pie de proformas y recibos: cuentas bancarias, Yape o Plin (máximo 1000 caracteres).', ejemplo: 'BCP 191-1234567-0-12 · Yape 999 888 777' },
      { nombre: 'logoDataUrl', queSeAnota: 'Logo como imagen PNG, JPEG o WebP en data URL, de hasta 150 000 caracteres. Vacío lo quita. No se aceptan SVG ni direcciones externas.', ejemplo: 'data:image/png;base64,iVBORw0...' },
    ],
    ejemploTecleado: 'cambiar la moneda de la empresa a USD',
    ejemploHablado: 'pon la moneda de la empresa en dólares',
    erroresComunes: [
      'Hay que indicar al menos un dato.',
      'La zona horaria debe ser un nombre válido, como America/Lima.',
      'El RUC debe tener 11 dígitos.',
      'El logo debe ser PNG, JPEG o WebP y no pasar de 150 000 caracteres.',
    ],
    relacionadas: ['empresa_ver_configuracion'],
  },
  // Lee la fila bloqueada: el estado sobre el que se confirma no cambia hasta que termina la llamada.
  async resumir(args, ctx, tx) {
    const [fila] = await tx.select().from(empresaConfig).where(eq(empresaConfig.tenantId, ctx.empresaId)).for('update');
    if (!fila) return { ok: false, error: { codigo: 'no_encontrado', mensaje: 'La configuración de la empresa aún no existe.' } };
    const cambios = (Object.keys(ETIQUETAS) as (keyof typeof ETIQUETAS)[])
      .filter((k) => args[k] !== undefined)
      .map((k) => `${ETIQUETAS[k]} de «${fila[k]}» a «${args[k]}»`)
      .concat(describirDatos(args));
    return {
      ok: true,
      resumen: {
        resumen: `Cambiarás la configuración de la empresa: ${cambios.join(', ')}.`,
        huella: hashCanonico({
          zonaHoraria: fila.zonaHoraria,
          moneda: fila.moneda,
          locale: fila.locale,
          ...Object.fromEntries(CLAVES_DATOS.map((k) => [k, fila[k]])),
        }),
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
      ...valoresDeDatos(args),
    };
    const [nueva] = await tx.update(empresaConfig).set(cambios).where(eq(empresaConfig.tenantId, ctx.empresaId)).returning();
    return nueva ? exito(aConfiguracion(nueva)) : rechazo('no_encontrado', 'La configuración de la empresa aún no existe.');
  },
});
