import { useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { ExistenciaDto } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { EncabezadoDePagina } from '../../shared/ui/datos/encabezado-de-pagina.tsx';
import type { Columna } from '../../shared/ui/datos/lista-tipos.ts';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { CLAVE_INSUMOS, listarExistencias, POR_PAGINA } from './api.ts';
import { HojaDeMovimiento } from './hoja-movimiento.tsx';
import { ListaPaginada } from './lista-paginada.tsx';
import { argumentosDeExistencias, faltaParaMinimo, FILTROS_DE_EXISTENCIAS, textoDeCantidad, type TipoManual } from './logica.ts';
import { usePermisosDeInventario } from './use-inventario.ts';

const COLUMNAS: Array<Columna<ExistenciaDto>> = [
  { id: 'articulo', titulo: 'Artículo', principal: true, celda: (e) => e.nombre },
  { id: 'sucursal', titulo: 'Sucursal', celda: (e) => e.sucursalNombre },
  { id: 'hay', titulo: 'Hay', alinear: 'derecha', celda: (e) => <span className="tabular-nums">{textoDeCantidad(e.cantidadMilesimas, e.unidad)}</span> },
  { id: 'minimo', titulo: 'Mínimo', alinear: 'derecha', celda: (e) => <span className="tabular-nums">{textoDeCantidad(e.minimoMilesimas, e.unidad)}</span> },
  { id: 'falta', titulo: 'Falta', alinear: 'derecha', celda: (e) => <span className="font-medium tabular-nums text-aviso">{textoDeCantidad(faltaParaMinimo(e), e.unidad)}</span> },
];

const FILTROS = { ...FILTROS_DE_EXISTENCIAS, soloBajoMinimo: true };

/** Lo que está por debajo de su mínimo en cada sucursal, con cuánto falta para llegar a él. */
export function PantallaAlertas() {
  const navegar = useNavigate();
  const { editar } = usePermisosDeInventario();
  const [hoja, setHoja] = useState<TipoManual | null>(null);
  const consulta = useInfiniteQuery({
    queryKey: [...CLAVE_INSUMOS, 'existencias', FILTROS],
    queryFn: async ({ pageParam }) => datosOError(await listarExistencias(argumentosDeExistencias(FILTROS, POR_PAGINA, pageParam))),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.siguiente ?? undefined,
  });

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina
        titulo="Bajo mínimo"
        accionPrincipal={editar ? <Boton variante="primario" onClick={() => setHoja('entrada')}>Registrar entrada</Boton> : undefined}
      />
      <p className="text-sm text-texto-suave">Artículos que quedaron por debajo de su mínimo. Al reponerlos salen de esta lista.</p>
      <ListaPaginada
        consulta={consulta}
        etiqueta="Artículos bajo mínimo"
        columnas={COLUMNAS}
        clave={(e) => e.id}
        onAbrir={(e) => void navegar(`/m/insumos/articulos/${e.articuloId}`)}
        vacio={<EstadoVacio titulo="Nada bajo el mínimo" descripcion="Cuando un artículo baje de su mínimo aparecerá aquí." icono="exito" />}
      />
      <HojaDeMovimiento tipo={hoja} alCerrar={() => setHoja(null)} />
    </div>
  );
}
