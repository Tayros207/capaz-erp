import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { KardexDto } from '@capaz/shared';
import { formatearSoles } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { formatearFechaHora } from '../../shared/formato/fechas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { Cifra, GrupoDeCifras } from '../../shared/ui/cifra.tsx';
import { Lista } from '../../shared/ui/datos/lista.tsx';
import type { Columna } from '../../shared/ui/datos/lista-tipos.ts';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { CLAVE_INSUMOS } from './api.ts';
import { verKardex } from './api-operaciones.ts';
import { textoDeCantidad, textoDeCosto } from './logica.ts';
import { Cargando } from './marco.tsx';

type Fila = KardexDto['items'][number];

function columnas(unidad: string): Array<Columna<Fila>> {
  return [
    { id: 'fecha', titulo: 'Fecha', principal: true, celda: (f) => formatearFechaHora(f.fecha) },
    { id: 'tipo', titulo: 'Tipo', celda: (f) => (f.tipo === 'entrada' ? 'Entrada' : f.tipo === 'salida' ? 'Salida' : 'Ajuste') },
    { id: 'entra', titulo: 'Entra', alinear: 'derecha', celda: (f) => (f.entradaMilesimas ? textoDeCantidad(f.entradaMilesimas, unidad) : '—') },
    { id: 'sale', titulo: 'Sale', alinear: 'derecha', celda: (f) => (f.salidaMilesimas ? textoDeCantidad(f.salidaMilesimas, unidad) : '—') },
    { id: 'saldo', titulo: 'Saldo', alinear: 'derecha', celda: (f) => <span className="tabular-nums">{textoDeCantidad(f.saldoMilesimas, unidad)}</span> },
    { id: 'costo', titulo: 'Costo promedio', alinear: 'derecha', celda: (f) => textoDeCosto(f.costoPromedioMilesimas) },
    { id: 'valor', titulo: 'Valor', alinear: 'derecha', celda: (f) => <span className="tabular-nums">{formatearSoles(f.saldoValorizadoCentimos)}</span> },
  ];
}

function Contenido({ articuloId }: { articuloId: string }) {
  const consulta = useQuery({ queryKey: [...CLAVE_INSUMOS, 'kardex', articuloId], queryFn: async () => datosOError(await verKardex(articuloId)) });
  if (consulta.isPending) return <Cargando etiqueta="Cargando kardex" />;
  if (consulta.isError) return <EstadoVacio titulo="No pudimos cargar el kardex" descripcion={consulta.error.message} icono="caja" accion={<Boton onClick={() => void consulta.refetch()}>Reintentar</Boton>} />;
  const k = consulta.data;
  return (
    <div className="flex flex-col gap-3">
      <GrupoDeCifras etiqueta="Valorización del artículo">
        <Cifra etiqueta="Saldo" valor={textoDeCantidad(k.saldoMilesimas, k.unidad)} />
        <Cifra etiqueta="Costo promedio" valor={textoDeCosto(k.costoPromedioMilesimas)} ayuda="Promedio ponderado móvil" />
        <Cifra etiqueta="Valor del inventario" valor={formatearSoles(k.valorTotalCentimos)} tono={k.costosIncompletos ? 'aviso' : 'neutro'} />
      </GrupoDeCifras>
      {k.costosIncompletos ? <p role="note" className="text-sm text-aviso">Algunas entradas no traen costo: se valorizaron con el promedio vigente, así que el valor es una estimación.</p> : null}
      <Lista etiqueta="Kardex valorizado" columnas={columnas(k.unidad)} filas={[...k.items].reverse()} clave={(f) => f.movimientoId} vacio={<EstadoVacio titulo="Sin movimientos todavía" icono="caja" />} />
    </div>
  );
}

/** Kardex valorizado del artículo: se carga al abrirlo, porque recorre todo el historial. */
export function SeccionKardex({ articuloId }: { articuloId: string }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <section aria-label="Kardex valorizado" className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-titulo font-semibold text-texto">Kardex valorizado</h2>
        <Boton onClick={() => setAbierto((a) => !a)} aria-expanded={abierto}>{abierto ? 'Ocultar' : 'Ver kardex'}</Boton>
      </div>
      {abierto ? <Contenido articuloId={articuloId} /> : null}
    </section>
  );
}
