import { useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { TransferenciaDeInsumosDto } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { formatearFechaHora } from '../../shared/formato/fechas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import type { Columna } from '../../shared/ui/datos/lista-tipos.ts';
import { EncabezadoDePagina } from '../../shared/ui/datos/encabezado-de-pagina.tsx';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { CLAVE_INSUMOS } from './api.ts';
import { listarTransferencias, POR_PAGINA_DE_OPERACIONES } from './api-operaciones.ts';
import { HojaDeTransferencia } from './hoja-transferencia.tsx';
import { ListaPaginada } from './lista-paginada.tsx';
import { textoDeCantidad } from './logica.ts';
import { usePermisosDeInventario } from './use-inventario.ts';

const COLUMNAS: Array<Columna<TransferenciaDeInsumosDto>> = [
  { id: 'numero', titulo: 'N.°', principal: true, celda: (t) => `${String(t.numero).padStart(4, '0')}-${t.anio}` },
  { id: 'fecha', titulo: 'Fecha', celda: (t) => formatearFechaHora(t.creadoEn) },
  { id: 'ruta', titulo: 'Ruta', celda: (t) => `${t.origenCodigo} → ${t.destinoCodigo}` },
  {
    id: 'detalle',
    titulo: 'Artículos',
    celda: (t) => t.lineas.map((l) => `${l.nombre} (${textoDeCantidad(l.cantidadMilesimas, l.unidad)})`).join(', '),
  },
  { id: 'nota', titulo: 'Nota', celda: (t) => t.nota ?? '' },
];

/** Traslados de mercadería entre sucursales, del más nuevo al más antiguo. Una transferencia hecha no se edita. */
export function PantallaTransferencias() {
  const { editar } = usePermisosDeInventario();
  const [hoja, setHoja] = useState(false);
  const consulta = useInfiniteQuery({
    queryKey: [...CLAVE_INSUMOS, 'transferencias'],
    queryFn: async ({ pageParam }) => datosOError(await listarTransferencias({ limite: POR_PAGINA_DE_OPERACIONES, ...(pageParam && { cursor: pageParam }) })),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.siguiente ?? undefined,
  });
  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina titulo="Transferencias" accionPrincipal={editar ? <Boton variante="primario" onClick={() => setHoja(true)}>Nueva transferencia</Boton> : undefined} />
      <ListaPaginada
        consulta={consulta}
        etiqueta="Transferencias"
        columnas={COLUMNAS}
        clave={(t) => t.id}
        vacio={<EstadoVacio titulo="Todavía no hay transferencias" descripcion="Cuando pases mercadería de una sucursal a otra, quedará aquí con su número." icono="caja" />}
      />
      <HojaDeTransferencia abierto={hoja} alCerrar={() => setHoja(false)} />
    </div>
  );
}
