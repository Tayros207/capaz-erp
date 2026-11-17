import { describe, expect, it } from 'vitest';
import { admiteDecision, armarDetallePublico, contarVista, enlaceAplica, estadoDeEnlace, hashDeToken, nuevoToken, pareceToken, vencimientoDe, type EntradaDeDetalle } from './enlaces.js';

const AHORA = new Date('2026-11-17T12:00:00Z');

describe('token', () => {
  it('mide 43 caracteres base64url, es distinto cada vez y su hash es sha256 en hexadecimal', () => {
    const a = nuevoToken();
    expect(pareceToken(a)).toBe(true);
    expect(nuevoToken()).not.toBe(a);
    expect(hashDeToken(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashDeToken(a)).not.toContain(a);
  });
  it('rechaza lo que no tiene la forma de un token', () => {
    for (const x of ['', 'abc', 'a'.repeat(42), 'a'.repeat(44), `${'a'.repeat(42)}=`, `${'a'.repeat(42)}/`]) expect(pareceToken(x), x).toBe(false);
  });
});

describe('vigencia', () => {
  it('vigente, vencido (incluido el instante exacto) y revocado; revocado manda sobre vencido', () => {
    const venceEn = vencimientoDe(AHORA, 30);
    expect(venceEn.toISOString()).toBe('2026-12-17T12:00:00.000Z');
    expect(estadoDeEnlace({ venceEn, revocadoEn: null }, AHORA)).toBe('vigente');
    expect(estadoDeEnlace({ venceEn, revocadoEn: null }, venceEn)).toBe('vencido');
    expect(estadoDeEnlace({ venceEn, revocadoEn: AHORA }, AHORA)).toBe('revocado');
    expect(estadoDeEnlace({ venceEn: AHORA, revocadoEn: AHORA }, new Date(AHORA.getTime() + 1))).toBe('revocado');
  });
  it('la vista se cuenta una vez por hora', () => {
    expect(contarVista(null, AHORA)).toBe(true);
    expect(contarVista(new Date(AHORA.getTime() - 59 * 60_000), AHORA)).toBe(false);
    expect(contarVista(new Date(AHORA.getTime() - 60 * 60_000), AHORA)).toBe(true);
  });
  it('el enlace sirve para la versión enviada y mientras la cotización no vuelva a borrador', () => {
    expect(enlaceAplica({ version: 2 }, { versionActual: 2, estado: 'enviada' })).toBe(true);
    expect(enlaceAplica({ version: 1 }, { versionActual: 2, estado: 'emitida' })).toBe(false);
    expect(enlaceAplica({ version: 2 }, { versionActual: 2, estado: 'borrador' })).toBe(false);
    expect(['emitida', 'enviada', 'aceptada', 'rechazada', 'anulada', 'borrador'].filter(admiteDecision)).toEqual(['emitida', 'enviada']);
  });
});

const SECRETOS = { costoCentimos: 111_111, margenPct: '27.777', listaId: 'LISTA-SECRETA', motivoMargenBajo: 'MOTIVO-SECRETO', ajustePct: '-9.9', detalle: { listaNombre: 'DETALLE-SECRETO', costo: 5 }, notas: 'NOTA-INTERNA', observaciones: 'OBS-INTERNA', creadoPor: 'usuario-secreto', datosExtra: { x: 'EXTRA-SECRETO' }, tenantId: 'EMPRESA-ID-SECRETO', clienteId: 'CLIENTE-ID-SECRETO' };

const entrada = (): EntradaDeDetalle =>
  ({
    empresa: { razonSocial: 'Gráfica Sol', ruc: '20123456789', direccionFiscal: 'Av. Perú 1', telefono: '999', correo: 'a@b.pe', pieDeDocumento: 'Gracias', logoDataUrl: 'data:image/png;base64,AAAA', ...SECRETOS },
    cotizacion: { numero: 7, anio: 2026, estado: 'enviada', titulo: 'Volantes', clienteNombre: 'Cristina', validaHasta: '2026-12-01', lineasAceptadas: null, ...SECRETOS },
    version: { version: 2, conOpciones: false, igvPorcentaje: 18, subtotalCentimos: 10_000, igvCentimos: 1_800, totalCentimos: 11_800, condiciones: { validezDias: 15, plazoEntrega: '3 días', formaPago: '50 %', tolerancia: '', noIncluye: '', ...SECRETOS }, ...SECRETOS },
    lineas: [{ posicion: 0, descripcion: 'Volantes A5', unidad: 'unidad', cantidadMilesimas: 2_500_000, totalCentimos: 11_800, ...SECRETOS }],
  }) as EntradaDeDetalle;

describe('detalle público (lista blanca)', () => {
  it('copia lo que el cliente ve', () => {
    const d = armarDetallePublico(entrada());
    expect(d).toMatchObject({ codigo: 'COT-2026-0007 v2', estado: 'enviada', cliente: 'Cristina', puedeDecidir: true, totalCentimos: 11_800 });
    expect(d.lineas).toEqual([{ posicion: 0, descripcion: 'Volantes A5', cantidad: '2.500 unidad', totalCentimos: 11_800, aceptada: false }]);
    expect(d.condiciones).toEqual([{ etiqueta: 'Plazo de entrega', valor: '3 días' }, { etiqueta: 'Forma de pago', valor: '50 %' }]);
  });
  it('NUNCA deja salir costo, margen, lista, ajuste, notas ni identificadores internos, aunque la entrada los traiga', () => {
    const texto = JSON.stringify(armarDetallePublico(entrada()));
    for (const secreto of ['111111', '27.777', 'LISTA-SECRETA', 'MOTIVO-SECRETO', '-9.9', 'DETALLE-SECRETO', 'NOTA-INTERNA', 'OBS-INTERNA', 'usuario-secreto', 'EXTRA-SECRETO', 'EMPRESA-ID-SECRETO', 'CLIENTE-ID-SECRETO']) {
      expect(texto, secreto).not.toContain(secreto);
    }
    expect(texto).not.toMatch(/costo|margen|lista|ajuste/i);
  });
  it('el conjunto de campos es exactamente el permitido', () => {
    const d = armarDetallePublico(entrada());
    expect(Object.keys(d).sort()).toEqual(['cliente', 'codigo', 'condiciones', 'conOpciones', 'empresa', 'estado', 'igvCentimos', 'igvPorcentaje', 'lineas', 'puedeDecidir', 'subtotalCentimos', 'titulo', 'totalCentimos', 'validaHasta', 'version'].sort());
    expect(Object.keys(d.empresa).sort()).toEqual(['correo', 'direccion', 'logo', 'pie', 'razonSocial', 'ruc', 'telefono']);
    expect(Object.keys(d.lineas[0]!).sort()).toEqual(['aceptada', 'cantidad', 'descripcion', 'posicion', 'totalCentimos']);
  });
  it('un logo que no es una imagen en base64 se descarta; un estado desconocido se trata como anulada', () => {
    const e = entrada();
    e.empresa!.logoDataUrl = 'data:image/svg+xml;base64,AAAA';
    expect(armarDetallePublico(e).empresa.logo).toBeNull();
    e.empresa!.logoDataUrl = 'data:image/png;base64,AAAA" onerror="x';
    expect(armarDetallePublico(e).empresa.logo).toBeNull();
    e.cotizacion.estado = 'rara';
    expect(armarDetallePublico(e)).toMatchObject({ estado: 'anulada', puedeDecidir: false });
  });
  it('marca las líneas aceptadas', () => {
    const e = entrada();
    e.cotizacion.estado = 'aceptada';
    e.cotizacion.lineasAceptadas = [0];
    expect(armarDetallePublico(e).lineas[0]!.aceptada).toBe(true);
  });
});
