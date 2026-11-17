import { exito, formatearSoles, rechazo, type ErrorDeRespuesta } from '@capaz/shared';
import { hashCanonico } from '../../../core/herramientas/confirmacion.js';
import { definirHerramienta, type ContextoDeHerramienta } from '../../../core/herramientas/tipos.js';
import type { Transaccion } from '../../../infra/database/con-empresa.js';
import { hashDeToken, nuevoToken, vencimientoDe } from '../domain/enlaces.js';
import { codigoDeCotizacion } from '../domain/cotizacion.js';
import { verCotizacion, type Cotizacion } from '../repositories/cotizaciones.repository.js';
import { crearEnlace, listarEnlaces, revocarEnlace, verEnlace } from '../repositories/enlaces.repository.js';
import { registrarEvento, versionDe, type Version } from '../repositories/versiones.repository.js';
import { MODULO } from './comun.js';
import { alcanceDeCotizaciones, NO_EXISTE } from './cotizacion-comun.js';
import { registrarEnvio, tomarCotizacionPara } from './decision-de-cliente.js';
import { aEnlaceDto } from './enlaces-mapeo.js';
import type { EstadoDeCotizacion } from '../domain/estados.js';

// Enlace público de una cotización (B3). El token completo solo sale en la respuesta de `enlace_generar`.

const ID_COTIZACION = { nombre: 'id', queSeAnota: 'Identificador de la cotización.', ejemplo: '0192f0c4-7b1e-7000-8000-000000000020' };
const NO_EXISTE_ENLACE = 'No existe ese enlace.';

type Lista = { ok: true; c: Cotizacion; version: Version } | { ok: false; error: ErrorDeRespuesta };

/** La cotización con su versión vigente, lista para tener enlace: emitida alguna vez y no anulada. */
async function cotizacionConEnlace(tx: Transaccion, ctx: ContextoDeHerramienta, id: string, bloquear: boolean): Promise<Lista> {
  const c = await verCotizacion(tx, ctx, id, { alcance: alcanceDeCotizaciones(ctx), bloquear });
  if (!c) return rechazo('no_encontrado', NO_EXISTE);
  if (c.estado === 'anulada') return rechazo('conflicto', 'La cotización está anulada: no se puede enviar.');
  const version = await versionDe(tx, ctx, c.id, c.versionActual);
  if (c.estado === 'borrador' || !version?.emitidaEn) return rechazo('conflicto', 'Solo se envía una cotización emitida.');
  return { ok: true, c, version };
}

export type DependenciasDeEnlaces = { urlBase: string };

function crearGenerar(base: string) {
  return definirHerramienta('enlace_generar', {
    modulo: MODULO,
    permiso: 'cotizador:emitir',
    criticidad: 'critica',
    ayuda: {
      titulo: 'Generar el enlace de una cotización para el cliente',
      paraQueSirve: 'Crea un enlace público para que el cliente vea la cotización, la apruebe o la rechace sin entrar al sistema. El enlace completo se muestra una sola vez. Si la cotización estaba emitida, pasa a enviada.',
      cuandoUsarla: 'Cuando vas a mandarle la cotización al cliente por WhatsApp o correo.',
      campos: [ID_COTIZACION, { nombre: 'diasDeVigencia', queSeAnota: 'Cuántos días vale el enlace (1 a 365; por defecto 30).', ejemplo: '15' }],
      ejemploTecleado: 'generar el enlace de la cotización de Imprenta Sol por 15 días',
      ejemploHablado: 'mándale la cotización a Imprenta Sol con un enlace',
      erroresComunes: ['Solo se envía una cotización emitida.', 'La cotización está anulada.', 'La cotización cambió mientras confirmabas: vuelve a pedir el enlace.'],
      relacionadas: ['enlaces_listar', 'enlace_revocar', 'cotizacion_emitir'],
    },
    // Solo cifras y códigos: nunca el token ni nombres (R13).
    auditar: (a, datos) => ({ entidadTipo: 'enlace', entidadId: datos?.enlace.id, resumen: { codigo: datos?.codigo ?? null, version: datos?.enlace.version ?? null, diasDeVigencia: a.diasDeVigencia } }),
    async resumir(args, ctx, tx) {
      const t = await cotizacionConEnlace(tx, ctx, args.id, false);
      if (!t.ok) return t;
      const codigo = codigoDeCotizacion(t.c.numero, t.c.anio, t.c.versionActual);
      return {
        ok: true,
        resumen: {
          resumen: `¿Envío la cotización ${codigo} por ${formatearSoles(t.version.totalCentimos)} al cliente? Quien tenga el enlace podrá verla y aprobarla o rechazarla durante ${args.diasDeVigencia} días.`,
          huella: hashCanonico({ estado: t.c.estado, version: t.c.versionActual, totalCentimos: t.version.totalCentimos, dias: args.diasDeVigencia }),
        },
      };
    },
    async ejecutar(args, ctx, tx) {
      const t = await cotizacionConEnlace(tx, ctx, args.id, true);
      if (!t.ok) return t;
      const token = nuevoToken();
      const fila = await crearEnlace(tx, ctx, { cotizacionId: t.c.id, version: t.version.version, tokenHash: hashDeToken(token), venceEn: vencimientoDe(new Date(), args.diasDeVigencia) });
      await registrarEvento(tx, ctx, t.c.id, t.version.version, { tipo: 'enlace_generado', datos: { enlaceId: fila.id, diasDeVigencia: args.diasDeVigencia } });
      let estado = t.c.estado as EstadoDeCotizacion;
      if (estado === 'emitida') {
        const paso = await tomarCotizacionPara(tx, ctx, t.c.id, 'enviar', alcanceDeCotizaciones(ctx), false);
        if (!paso.ok) return paso;
        await registrarEnvio(tx, ctx, paso);
        estado = 'enviada';
      }
      return exito({ enlace: aEnlaceDto(fila), url: `${base}/api/v1/c/${token}`, codigo: codigoDeCotizacion(t.c.numero, t.c.anio, t.c.versionActual), estadoDeLaCotizacion: estado });
    },
  });
}

const enlacesListar = definirHerramienta('enlaces_listar', {
  modulo: MODULO,
  permiso: 'cotizador:emitir',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Ver los enlaces de una cotización',
    paraQueSirve: 'Lista los enlaces que se generaron para el cliente: hasta cuándo valen, cuántas veces se abrieron y si están revocados. No muestra el enlace en sí.',
    cuandoUsarla: 'Para saber si el cliente ya abrió la cotización o para revocar un enlace.',
    campos: [{ nombre: 'cotizacionId', queSeAnota: 'Identificador de la cotización.', ejemplo: '0192f0c4-7b1e-7000-8000-000000000020' }],
    ejemploTecleado: 'enlaces de la cotización de Imprenta Sol',
    ejemploHablado: '¿ya abrió Imprenta Sol la cotización?',
    erroresComunes: ['No existe esa cotización.'],
    relacionadas: ['enlace_generar', 'enlace_revocar'],
  },
  async ejecutar(args, ctx, tx) {
    const c = await verCotizacion(tx, ctx, args.cotizacionId, { alcance: alcanceDeCotizaciones(ctx) });
    if (!c) return rechazo('no_encontrado', NO_EXISTE);
    const ahora = new Date();
    return exito({ items: (await listarEnlaces(tx, ctx, c.id)).map((e) => aEnlaceDto(e, ahora)) });
  },
});

const enlaceRevocar = definirHerramienta('enlace_revocar', {
  modulo: MODULO,
  permiso: 'cotizador:emitir',
  criticidad: 'normal',
  idempotente: true,
  ayuda: {
    titulo: 'Revocar el enlace de una cotización',
    paraQueSirve: 'Hace que el enlace deje de funcionar: quien lo abra verá que la cotización ya no está disponible. Si ya estaba revocado, no cambia nada.',
    cuandoUsarla: 'Cuando mandaste el enlace a la persona equivocada o ya no quieres que el cliente la vea.',
    campos: [{ nombre: 'id', queSeAnota: 'Identificador del enlace (sale en la lista de enlaces).', ejemplo: '0192f0c4-7b1e-7000-8000-000000000031' }],
    ejemploTecleado: 'revocar el enlace de la cotización de Imprenta Sol',
    ejemploHablado: 'quita el enlace que le mandé a Imprenta Sol',
    erroresComunes: ['No existe ese enlace.'],
    relacionadas: ['enlaces_listar', 'enlace_generar'],
  },
  auditar: (_a, datos) => ({ entidadTipo: 'enlace', entidadId: datos?.id }),
  async ejecutar(args, ctx, tx) {
    const previo = await verEnlace(tx, ctx, args.id);
    const c = previo && (await verCotizacion(tx, ctx, previo.cotizacionId, { alcance: alcanceDeCotizaciones(ctx) }));
    if (!previo || !c) return rechazo('no_encontrado', NO_EXISTE_ENLACE);
    const revocado = await revocarEnlace(tx, ctx, previo.id);
    if (revocado) await registrarEvento(tx, ctx, c.id, previo.version, { tipo: 'enlace_revocado', datos: { enlaceId: previo.id } });
    return exito(aEnlaceDto(revocado ?? previo));
  },
});

export function crearHerramientasDeEnlaces(d: DependenciasDeEnlaces) {
  return [crearGenerar(d.urlBase.replace(/\/+$/, '')), enlacesListar, enlaceRevocar];
}
