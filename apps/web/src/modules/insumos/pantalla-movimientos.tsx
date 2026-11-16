import { useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { datosOError } from '../../shared/api/consultas.ts';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import { EncabezadoDePagina } from '../../shared/ui/datos/encabezado-de-pagina.tsx';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { CLAVE_INSUMOS, listarMovimientos, POR_PAGINA } from './api.ts';
import { ListaPaginada } from './lista-paginada.tsx';
import { columnasDeHistorial } from './columnas.tsx';
import { argumentosDeMovimientos, FILTROS_DE_MOVIMIENTOS, type FiltrosDeMovimientos } from './logica.ts';
import { useSucursales } from './use-inventario.ts';

const COLUMNAS = columnasDeHistorial(true);

/** Todo lo que entró, salió o se ajustó, del más nuevo al más antiguo. El historial no se edita ni se borra. */
export function PantallaMovimientos() {
  const navegar = useNavigate();
  const sucursales = useSucursales();
  const [filtros, setFiltros] = useState<FiltrosDeMovimientos>(FILTROS_DE_MOVIMIENTOS);
  const cambiar = (c: Partial<FiltrosDeMovimientos>) => setFiltros((f) => ({ ...f, ...c }));
  const consulta = useInfiniteQuery({
    queryKey: [...CLAVE_INSUMOS, 'movimientos', filtros],
    queryFn: async ({ pageParam }) => datosOError(await listarMovimientos(argumentosDeMovimientos(filtros, POR_PAGINA, pageParam))),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.siguiente ?? undefined,
  });
  const conFiltros = filtros.tipo !== '' || filtros.sucursalId !== '';

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina titulo="Movimientos" />
      <div className="grid grid-cols-2 gap-3 lg:max-w-xl">
        <CampoSelect etiqueta="Tipo" value={filtros.tipo} onChange={(e) => cambiar({ tipo: e.target.value as FiltrosDeMovimientos['tipo'] })}>
          <option value="">Todos</option>
          <option value="entrada">Entradas</option>
          <option value="salida">Salidas</option>
          <option value="ajuste">Ajustes</option>
        </CampoSelect>
        <CampoSelect etiqueta="Sucursal" value={filtros.sucursalId} onChange={(e) => cambiar({ sucursalId: e.target.value })}>
          <option value="">Todas</option>
          {(sucursales.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </CampoSelect>
      </div>
      <ListaPaginada
        consulta={consulta}
        etiqueta="Movimientos"
        columnas={COLUMNAS}
        clave={(m) => m.id}
        onAbrir={(m) => void navegar(`/m/insumos/articulos/${m.articuloId}`)}
        vacio={<EstadoVacio titulo={conFiltros ? 'Ningún movimiento con esos filtros' : 'Todavía no hay movimientos'} descripcion="Las entradas, salidas y ajustes que registres aparecerán aquí." icono="caja" />}
      />
    </div>
  );
}
