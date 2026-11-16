import { useState } from 'react';
import { formatearCantidad, milesimasATexto } from '../../shared/formato/milesimas.ts';
import { formatearSoles } from '../../shared/formato/soles.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { Cifra, GrupoDeCifras } from '../../shared/ui/cifra.tsx';
import { Lista } from '../../shared/ui/datos/lista.tsx';
import type { Columna } from '../../shared/ui/datos/lista-tipos.ts';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { HojaLinea } from './hoja-linea.tsx';
import { importeDeLinea, lineaVacia, totalesDe, validarLinea, type LineaDeFormulario } from './logica.ts';

const soles = (centimos: number | null) => (centimos === null ? '—' : formatearSoles(centimos));

const COLUMNAS: Array<Columna<LineaDeFormulario>> = [
  {
    id: 'descripcion',
    titulo: 'Descripción',
    principal: true,
    celda: (l) => (
      <span className="inline-flex flex-wrap items-center gap-2">
        {l.descripcion || 'Línea sin descripción'}
        {l.producto ? null : <Insignia tono="neutro">Gasto</Insignia>}
        {l.afectoIgv ? null : <Insignia tono="neutro">No afecto</Insignia>}
        {Object.keys(validarLinea(l)).length > 0 ? <Insignia tono="aviso">Incompleta</Insignia> : null}
      </span>
    ),
  },
  { id: 'cantidad', titulo: 'Cantidad', alinear: 'derecha', celda: (l) => (l.cantidadMilesimas === null ? '—' : formatearCantidad(l.cantidadMilesimas, l.unidad)) },
  { id: 'costo', titulo: 'Costo unitario', alinear: 'derecha', celda: (l) => (l.costoUnitarioMilesimas === null ? '—' : `S/ ${milesimasATexto(l.costoUnitarioMilesimas)}`) },
  { id: 'importe', titulo: 'Importe', alinear: 'derecha', celda: (l) => soles(importeDeLinea(l)) },
];

type Props = {
  lineas: LineaDeFormulario[];
  igvPorcentaje: number;
  alCambiar: (lineas: LineaDeFormulario[]) => void;
  error?: string;
};

/**
 * Editor de las líneas de un borrador y sus totales. Cada línea se abre en una hoja para editarla (en el
 * móvil se ven como tarjetas). Los totales salen de `calcularTotalesDeCompra`, la misma función del servidor.
 */
export function LineasDeCompra({ lineas, igvPorcentaje, alCambiar, error }: Props) {
  const [abierta, setAbierta] = useState<{ linea: LineaDeFormulario; esNueva: boolean } | null>(null);
  const totales = totalesDe(lineas, igvPorcentaje);
  const cerrar = () => setAbierta(null);

  function guardar(l: LineaDeFormulario) {
    if (!abierta) return;
    alCambiar(abierta.esNueva ? [...lineas, l] : lineas.map((x) => (x.clave === l.clave ? l : x)));
    cerrar();
  }

  return (
    <section aria-label="Líneas de la orden" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-titulo font-semibold text-texto">Líneas</h2>
        {lineas.length < 100 ? <Boton icono="mas" onClick={() => setAbierta({ linea: lineaVacia(crypto.randomUUID()), esNueva: true })}>Agregar línea</Boton> : null}
      </div>
      <Lista
        etiqueta="Líneas de la orden"
        columnas={COLUMNAS}
        filas={lineas}
        clave={(l) => l.clave}
        onAbrir={(l) => setAbierta({ linea: l, esNueva: false })}
        vacio={<EstadoVacio titulo="Sin líneas todavía" descripcion="Agrega lo que vas a comprar. Puedes guardar el borrador y completarlo después." icono="caja" />}
      />
      {error ? <p role="alert" className="text-sm font-medium text-peligro">{error}</p> : null}
      <GrupoDeCifras etiqueta="Totales de la orden">
        <Cifra etiqueta="Subtotal" valor={soles(totales?.subtotalCentimos ?? null)} />
        <Cifra etiqueta={`IGV ${igvPorcentaje} %`} valor={soles(totales?.igvCentimos ?? null)} />
        <Cifra etiqueta="Total" valor={soles(totales?.totalCentimos ?? null)} ayuda="Los costos ya incluyen IGV." />
      </GrupoDeCifras>
      <HojaLinea
        linea={abierta?.linea ?? null}
        esNueva={abierta?.esNueva ?? true}
        alGuardar={guardar}
        alQuitar={() => {
          if (abierta) alCambiar(lineas.filter((x) => x.clave !== abierta.linea.clave));
          cerrar();
        }}
        alCerrar={cerrar}
      />
    </section>
  );
}
