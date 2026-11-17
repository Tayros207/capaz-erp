import { formatearSoles } from '@capaz/shared';
import type { DetallePublico } from '../domain/enlaces.js';

// Páginas HTML del enlace público: español, sin JavaScript y con TODO texto externo escapado. Los únicos datos que
// entran son los del `DetallePublico` (lista blanca); aquí no se lee nada de la base.

export const AVISOS = {
  aprobada: 'Gracias: registramos tu aprobación. La empresa se pondrá en contacto contigo.',
  rechazada: 'Registramos tu respuesta. Gracias por avisarnos.',
  sin_cambio: 'Esta cotización ya tenía una respuesta: no se cambió nada.',
  elige: 'Elige al menos una opción para aprobar.',
} as const;
export type CodigoDeAviso = keyof typeof AVISOS;
export const esAviso = (v: unknown): v is CodigoDeAviso => typeof v === 'string' && Object.hasOwn(AVISOS, v);

const ENTIDADES: Readonly<Record<string, string>> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' };
/** Escapa para texto y para valores de atributo entre comillas. */
export const escapar = (v: string | number | null | undefined): string => String(v ?? '').replace(/[&<>"'`]/g, (c) => ENTIDADES[c]!);

const ESTILO = `
:root{color-scheme:light dark;--fondo:#f4f5f7;--hoja:#fff;--texto:#1c2430;--suave:#5b6675;--linea:#dde1e7;--acento:#0e6b73;--acento-texto:#fff;--bien:#146c43;--mal:#a12b2b}
@media (prefers-color-scheme:dark){:root{--fondo:#12161c;--hoja:#1b212a;--texto:#eceff3;--suave:#a5afbd;--linea:#2e3743;--acento:#4cc3cc;--acento-texto:#06292c;--bien:#5fd195;--mal:#f08a8a}}
*{box-sizing:border-box}body{margin:0;background:var(--fondo);color:var(--texto);font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:760px;margin:0 auto;padding:16px}
.hoja{background:var(--hoja);border:1px solid var(--linea);border-radius:12px;padding:20px;margin-bottom:16px}
.empresa{display:flex;gap:14px;align-items:center}.empresa img{max-height:56px;max-width:140px;object-fit:contain}
.empresa h1{font-size:1.1rem;margin:0}.empresa p{margin:0;color:var(--suave);font-size:.875rem}
h2{font-size:1.25rem;margin:0 0 4px}h3{font-size:1rem;margin:0 0 8px}
.estado{display:inline-block;padding:2px 10px;border-radius:999px;border:1px solid var(--linea);font-size:.8125rem;color:var(--suave)}
.estado.aprobada{color:var(--bien);border-color:var(--bien)}.estado.mala{color:var(--mal);border-color:var(--mal)}
dl{display:grid;grid-template-columns:max-content 1fr;gap:4px 14px;margin:12px 0 0}dt{color:var(--suave)}dd{margin:0}
table{width:100%;border-collapse:collapse;margin-top:8px}th,td{padding:8px 6px;border-bottom:1px solid var(--linea);text-align:left;vertical-align:top}
th{font-size:.8125rem;color:var(--suave);font-weight:600}.der{text-align:right;white-space:nowrap}
.totales{margin-top:12px;margin-left:auto;max-width:300px}.totales div{display:flex;justify-content:space-between;padding:3px 0}.totales .total{font-weight:700;font-size:1.125rem;border-top:2px solid var(--linea);margin-top:4px;padding-top:8px}
.nota{color:var(--suave);font-size:.875rem}
.aviso{border-left:4px solid var(--acento);padding:10px 14px;background:var(--hoja);border-radius:6px;margin-bottom:16px}
label.opcion{display:flex;gap:10px;align-items:flex-start}input[type=checkbox]{width:20px;height:20px;margin-top:2px}
textarea{width:100%;min-height:84px;font:inherit;color:inherit;background:var(--fondo);border:1px solid var(--linea);border-radius:8px;padding:10px}
button{font:inherit;font-weight:600;min-height:48px;padding:10px 20px;border-radius:10px;border:1px solid var(--acento);cursor:pointer;width:100%;margin-top:12px;background:var(--acento);color:var(--acento-texto)}
button.secundario{background:transparent;color:var(--texto);border-color:var(--linea)}
button:focus-visible,a:focus-visible,textarea:focus-visible,input:focus-visible{outline:3px solid var(--acento);outline-offset:2px}
a{color:var(--acento)}
@media (min-width:640px){main{padding:32px 16px}.hoja{padding:28px}button{width:auto}}
@media print{body{background:#fff;color:#000}main{max-width:none;padding:0}.hoja{border:0;padding:0;border-radius:0}.sin-imprimir{display:none!important}:root{--linea:#bbb;--suave:#444}}
`;

type Cabecera = { titulo: string; cuerpo: string };
const documento = ({ titulo, cuerpo }: Cabecera): string =>
  `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><title>${escapar(titulo)}</title><style>${ESTILO}</style></head><body><main>${cuerpo}</main></body></html>`;

/** La misma página para un enlace inexistente, vencido, revocado o de una versión que ya no rige: no se distingue. */
export const paginaNoDisponible = (): string =>
  documento({ titulo: 'Cotización no disponible', cuerpo: '<section class="hoja"><h2>Esta cotización ya no está disponible</h2><p class="nota">Pídele a quien te la envió un enlace nuevo.</p></section>' });

export const paginaDeEspera = (): string =>
  documento({ titulo: 'Demasiados intentos', cuerpo: '<section class="hoja"><h2>Demasiados intentos</h2><p class="nota">Espera un minuto e inténtalo de nuevo.</p></section>' });

export const paginaDeError = (): string =>
  documento({ titulo: 'No pudimos atenderte', cuerpo: '<section class="hoja"><h2>No pudimos atenderte</h2><p class="nota">Inténtalo de nuevo en unos minutos.</p></section>' });

const dia = (v: string | null): string => {
  const m = v ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(v) : null;
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
};

const ETIQUETA_DE_ESTADO: Readonly<Record<string, { texto: string; clase: string }>> = {
  emitida: { texto: 'Pendiente de tu respuesta', clase: '' },
  enviada: { texto: 'Pendiente de tu respuesta', clase: '' },
  aceptada: { texto: 'Aprobada', clase: 'aprobada' },
  rechazada: { texto: 'Rechazada', clase: 'mala' },
  anulada: { texto: 'Anulada', clase: 'mala' },
};

function encabezado(e: DetallePublico['empresa']): string {
  const logo = e.logo ? `<img src="${escapar(e.logo)}" alt="">` : '';
  const datos = [e.ruc ? `RUC ${e.ruc}` : '', e.direccion ?? '', e.telefono ?? '', e.correo ?? ''].filter(Boolean).map((x) => `<p>${escapar(x)}</p>`).join('');
  return `<section class="hoja empresa">${logo}<div><h1>${escapar(e.razonSocial)}</h1>${datos}</div></section>`;
}

function filasDeLineas(d: DetallePublico, conOpciones: boolean): string {
  return d.lineas
    .map((l) => {
      const marca = d.estado === 'aceptada' && l.aceptada ? ' <span class="estado aprobada">Aprobada</span>' : '';
      const celda = conOpciones ? `<label class="opcion"><input type="checkbox" name="posicion" value="${l.posicion}"><span>${escapar(l.descripcion)}</span></label>` : `${escapar(l.descripcion)}${marca}`;
      return `<tr><td>${celda}</td><td class="der">${escapar(l.cantidad)}</td><td class="der">${formatearSoles(l.totalCentimos)}</td></tr>`;
    })
    .join('');
}

function tablaDeLineas(d: DetallePublico, conOpciones: boolean): string {
  return `<table><thead><tr><th>Descripción</th><th class="der">Cantidad</th><th class="der">${d.conOpciones ? 'Importe con IGV' : 'Importe'}</th></tr></thead><tbody>${filasDeLineas(d, conOpciones)}</tbody></table>`;
}

function totales(d: DetallePublico): string {
  if (d.conOpciones) return `<p class="nota">Estas líneas son opciones: puedes elegir una o varias. El importe de cada una ya incluye su IGV (${d.igvPorcentaje} %).</p>`;
  const igv = d.igvPorcentaje > 0 ? `<div><span>IGV (${d.igvPorcentaje} %)</span><span>${formatearSoles(d.igvCentimos)}</span></div>` : '';
  return `<div class="totales"><div><span>Subtotal</span><span>${formatearSoles(d.subtotalCentimos)}</span></div>${igv}<div class="total"><span>Total${d.igvPorcentaje > 0 ? ' con IGV' : ''}</span><span>${formatearSoles(d.totalCentimos)}</span></div></div>`;
}

function condiciones(d: DetallePublico): string {
  if (d.condiciones.length === 0) return '';
  const items = d.condiciones.map((c) => `<dt>${escapar(c.etiqueta)}</dt><dd>${escapar(c.valor)}</dd>`).join('');
  return `<section class="hoja"><h3>Condiciones</h3><dl>${items}</dl></section>`;
}

function formularioDeRespuesta(d: DetallePublico, ruta: string): string {
  const tabla = d.conOpciones ? `<h3>Elige lo que apruebas</h3>${tablaDeLineas(d, true)}` : '';
  const aprobar = `<form method="post" action="${escapar(ruta)}/aprobar">${tabla}<button type="submit">${d.conOpciones ? 'Aprobar lo elegido' : 'Aprobar cotización'}</button></form>`;
  const rechazar = `<form method="post" action="${escapar(ruta)}/rechazar"><h3>¿No te conviene?</h3><label for="nota" class="nota">Cuéntanos por qué (opcional)</label><textarea id="nota" name="nota" maxlength="300"></textarea><button type="submit" class="secundario">Rechazar cotización</button></form>`;
  return `<section class="hoja sin-imprimir">${aprobar}</section><section class="hoja sin-imprimir">${rechazar}</section>`;
}

export type OpcionesDePagina = { ruta: string; aviso?: CodigoDeAviso; paraImprimir?: boolean };

/** La cotización completa. `ruta` es la ruta pública sin dominio (`/api/v1/c/<token>`), ya segura para un atributo. */
export function paginaDeCotizacion(d: DetallePublico, o: OpcionesDePagina): string {
  const est = ETIQUETA_DE_ESTADO[d.estado] ?? { texto: d.estado, clase: '' };
  const pares = [['Cliente', d.cliente ?? ''], ['Referencia', d.titulo], ['Válida hasta', dia(d.validaHasta)]].filter(([, v]) => v);
  const datos = pares.map(([k, v]) => `<dt>${escapar(k)}</dt><dd>${escapar(v)}</dd>`).join('');
  const decide = d.puedeDecidir && !o.paraImprimir;
  const aviso = o.aviso ? `<p class="aviso" role="status">${escapar(AVISOS[o.aviso])}</p>` : '';
  const enlaceImprimir = o.paraImprimir ? '' : `<p class="nota sin-imprimir"><a href="${escapar(o.ruta)}/imprimir">Versión para imprimir o guardar como PDF</a></p>`;
  const pie = d.empresa.pie ? `<p class="nota">${escapar(d.empresa.pie)}</p>` : '';
  const cuerpo = [
    aviso,
    encabezado(d.empresa),
    `<section class="hoja"><h2>Cotización ${escapar(d.codigo)}</h2><span class="estado ${est.clase}">${escapar(est.texto)}</span><dl>${datos}</dl>${decide && d.conOpciones ? '' : tablaDeLineas(d, false)}${totales(d)}${enlaceImprimir}</section>`,
    condiciones(d),
    decide ? formularioDeRespuesta(d, o.ruta) : '',
    `<section class="hoja">${pie}<p class="nota">Cotización, no válida como comprobante de pago.</p></section>`,
  ].join('');
  return documento({ titulo: `Cotización ${d.codigo} · ${d.empresa.razonSocial}`, cuerpo });
}
