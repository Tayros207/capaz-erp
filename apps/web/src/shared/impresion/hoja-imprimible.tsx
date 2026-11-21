import type { ReactNode } from 'react';
import './impresion.css';
import {
  AVISO_DOCUMENTO_INTERNO,
  alineacionPorDefecto,
  formatearCelda,
  lineasDelEncabezado,
  lineasDelPie,
  normalizarEmpresa,
  type AlineacionDeColumna,
  type DatosDeEmpresaImpresion,
  type FilaDeTotal,
  type FormatoDeColumna,
  type ValorDeCelda,
  TEXTO_DE_CREDITO,
  type FormatoDeHoja,
} from './logica-impresion.ts';
import { unir } from '../ui/unir.ts';
import { Boton } from '../ui/boton.tsx';
import { imprimirDocumento } from './imprimir.ts';

export type { DatosDeEmpresaImpresion } from './logica-impresion.ts';

type PropsHoja = {
  titulo: string;
  empresa?: Partial<DatosDeEmpresaImpresion> | null;
  children: ReactNode;
  /** Texto libre extra del pie; si falta se usa `empresa.pieDeDocumento`. */
  pie?: string | null;
  /** Aviso final; `null` lo quita. Por defecto: «Documento interno, no válido como comprobante de pago». */
  aviso?: string | null;
  /** Tamaño de la hoja. Por defecto A4; A5 y A6 achican la hoja, la letra y el vacío. */
  formato?: FormatoDeHoja;
};

/** Hoja A4 con encabezado de la empresa, título, contenido y pie. En pantalla es la vista previa. */
export function HojaImprimible({ titulo, empresa, children, pie, aviso = AVISO_DOCUMENTO_INTERNO, formato = 'a4' }: PropsHoja) {
  const datos = normalizarEmpresa(empresa);
  const encabezado = lineasDelEncabezado(datos);
  const lineasPie = lineasDelPie(pie ?? datos.pieDeDocumento, aviso);
  return (
    <article className={unir('hoja-imprimible', formato !== 'a4' && `hoja-${formato}`)} aria-label={`Vista previa: ${titulo}`}>
      <header className="flex items-start gap-4 border-b border-black pb-3" style={{ borderBottomWidth: '0.4mm' }}>
        {datos.logoDataUrl && <img src={datos.logoDataUrl} alt="Logo de la empresa" className="max-h-20 max-w-40 object-contain" />}
        <div className="min-w-0 flex-1">
          <p className="text-[13pt] font-bold">{datos.razonSocial ?? 'Empresa sin nombre'}</p>
          {encabezado.map((linea) => (
            <p key={linea} className="text-[9pt]">{linea}</p>
          ))}
        </div>
      </header>
      <h1 className="my-4 text-center text-[15pt] font-bold uppercase tracking-wide">{titulo}</h1>
      <div className="flex flex-col gap-4">{children}</div>
      {lineasPie.length > 0 && (
        <footer className="evitar-corte mt-6 border-t border-black pt-2 text-center text-[8.5pt]">
          {lineasPie.map((l) => (
            <p key={l}>{l}</p>
          ))}
        </footer>
      )}
      <p className="credito-erp">{TEXTO_DE_CREDITO}</p>
    </article>
  );
}

export type ColumnaImprimible<F extends Record<string, ValorDeCelda>> = {
  clave: keyof F & string;
  titulo: string;
  formato?: FormatoDeColumna;
  alineacion?: AlineacionDeColumna;
  /** Ancho CSS opcional, p. ej. `'20%'`. */
  ancho?: string;
  /** Clave de un texto secundario impreso debajo, más chico (la ficha bajo la descripción). */
  secundaria?: keyof F & string;
};

const ALINEA: Record<AlineacionDeColumna, string> = { izquierda: 'text-left', centro: 'text-center', derecha: 'text-right tabular-nums' };

type PropsTabla<F extends Record<string, ValorDeCelda>> = {
  /** Describe la tabla para lectores de pantalla. */
  etiqueta: string;
  columnas: Array<ColumnaImprimible<F>>;
  filas: F[];
  totales?: FilaDeTotal[];
};

/** Tabla del documento: encabezado que se repite, filas sin cortes y números a la derecha. */
export function TablaImprimible<F extends Record<string, ValorDeCelda>>({ etiqueta, columnas, filas, totales }: PropsTabla<F>) {
  const alinear = (c: ColumnaImprimible<F>) => ALINEA[c.alineacion ?? alineacionPorDefecto(c.formato ?? 'texto')];
  return (
    <div className="flex flex-col gap-2">
      <table aria-label={etiqueta}>
        <thead>
          <tr>
            {columnas.map((c) => (
              <th key={c.clave} scope="col" className={alinear(c)} style={c.ancho ? { width: c.ancho } : undefined}>
                {c.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.length === 0 && (
            <tr>
              <td colSpan={columnas.length} className="text-center">Sin elementos</td>
            </tr>
          )}
          {filas.map((fila, i) => (
            <tr key={i}>
              {columnas.map((c) => (
                <td key={c.clave} className={alinear(c)}>
                  {formatearCelda(fila[c.clave], c.formato)}
                  {c.secundaria && fila[c.secundaria] ? <span className="block text-[0.85em] italic">{formatearCelda(fila[c.secundaria])}</span> : null}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {totales && totales.length > 0 && (
        <table aria-label={`Totales: ${etiqueta}`} className="evitar-corte self-end" style={{ width: '70mm' }}>
          <tbody>
            {totales.map((t) => (
              <tr key={t.etiqueta} className={unir(t.destacado && 'font-bold')}>
                <th scope="row" className="text-left font-normal" style={t.destacado ? { fontWeight: 700 } : undefined}>{t.etiqueta}</th>
                <td className="text-right tabular-nums">{t.valor}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

type PropsBloque = {
  titulo?: string;
  pares: Array<{ etiqueta: string; valor: ReactNode }>;
  /** Columnas de la rejilla (1 a 3). Por defecto 2. */
  columnas?: 1 | 2 | 3;
};

const COLUMNAS = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3' } as const;

/** Pares etiqueta/valor en rejilla (datos del cliente, fechas, condiciones). */
export function BloqueDeDatos({ titulo, pares, columnas = 2 }: PropsBloque) {
  return (
    <section className="evitar-corte" aria-label={titulo ?? 'Datos del documento'}>
      {titulo && <h2 className="mb-1 text-[10pt] font-bold uppercase">{titulo}</h2>}
      <dl className={unir('grid gap-x-6 gap-y-1', COLUMNAS[columnas])}>
        {pares.map((p) => (
          <div key={p.etiqueta} className="min-w-0">
            <dt className="text-[8.5pt] font-semibold uppercase">{p.etiqueta}</dt>
            <dd className="break-words">{p.valor === null || p.valor === '' ? '—' : p.valor}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** Línea para firmar con el nombre o cargo debajo. */
export function LineaDeFirma({ etiqueta, detalle }: { etiqueta: string; detalle?: string }) {
  return (
    <div className="evitar-corte mt-12 w-64 max-w-full text-center" role="group" aria-label={`Firma: ${etiqueta}`}>
      <div className="border-t border-black pt-1 text-[9pt]" style={{ borderTopWidth: '0.3mm' }}>
        <p className="font-semibold">{etiqueta}</p>
        {detalle && <p>{detalle}</p>}
      </div>
    </div>
  );
}

type PropsBarra = { onVolver?: () => void; etiquetaVolver?: string };

/** Acciones de la vista previa: solo en pantalla, oculta al imprimir. Móvil primero. */
export function BarraDeImpresion({ onVolver, etiquetaVolver = 'Volver' }: PropsBarra) {
  return (
    <nav
      aria-label="Acciones del documento"
      className="no-imprimir sticky top-0 z-10 flex flex-col gap-2 border-b border-borde bg-superficie p-3 sm:flex-row sm:justify-end"
    >
      <Boton variante="primario" tamano="grande" className="w-full sm:w-auto" onClick={() => imprimirDocumento()}>
        Imprimir / Guardar como PDF
      </Boton>
      {onVolver && (
        <Boton tamano="grande" className="w-full sm:w-auto" onClick={onVolver}>
          {etiquetaVolver}
        </Boton>
      )}
    </nav>
  );
}

/** Contenedor de pantalla que desplaza la hoja A4 en pantallas angostas. */
export function VistaPreviaDeHoja({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto bg-superficie-alta p-2 sm:p-4"><div className="mx-auto w-fit">{children}</div></div>;
}
