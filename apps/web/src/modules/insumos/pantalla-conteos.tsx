import { useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { ConteoResumenDto } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { formatearFechaHora } from '../../shared/formato/fechas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import type { Columna } from '../../shared/ui/datos/lista-tipos.ts';
import { EncabezadoDePagina } from '../../shared/ui/datos/encabezado-de-pagina.tsx';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { HojaInferior } from '../../shared/ui/hoja-inferior.tsx';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { notificar } from '../../shared/ui/notificar.ts';
import { CLAVE_INSUMOS } from './api.ts';
import { abrirConteo, listarConteos, POR_PAGINA_DE_OPERACIONES } from './api-operaciones.ts';
import { ListaPaginada } from './lista-paginada.tsx';
import { codigoDeConteo, ETIQUETA_DE_CONTEO, TONO_DE_CONTEO } from './logica-operaciones.ts';
import { mensajeDeRechazo } from './logica.ts';
import { refrescarInventario, usePermisosDeInventario, useSucursales } from './use-inventario.ts';

const FILTROS = { todos: 'Todos', abiertos: 'Abiertos', cerrados: 'Cerrados', anulados: 'Anulados' } as const;
type Filtro = keyof typeof FILTROS;

const COLUMNAS: Array<Columna<ConteoResumenDto>> = [
  { id: 'codigo', titulo: 'Inventario', principal: true, celda: (c) => codigoDeConteo(c) },
  { id: 'fecha', titulo: 'Abierto', celda: (c) => formatearFechaHora(c.creadoEn) },
  { id: 'sucursal', titulo: 'Sucursal', celda: (c) => c.sucursalCodigo },
  { id: 'estado', titulo: 'Estado', celda: (c) => <Insignia tono={TONO_DE_CONTEO[c.estado]}>{ETIQUETA_DE_CONTEO[c.estado]}</Insignia> },
  { id: 'avance', titulo: 'Avance', alinear: 'derecha', celda: (c) => `${c.lineasContadas} de ${c.totalLineas}` },
];

function HojaDeApertura({ abierto, alCerrar, alAbrir }: { abierto: boolean; alCerrar: () => void; alAbrir: (id: string) => void }) {
  const sucursales = useSucursales();
  const [sucursalId, setSucursalId] = useState('');
  const [fallo, setFallo] = useState<string | undefined>();
  const [guardando, setGuardando] = useState(false);
  const elegida = sucursalId || sucursales.data?.[0]?.id || '';

  async function abrir() {
    setGuardando(true);
    setFallo(undefined);
    const r = await abrirConteo({ sucursalId: elegida });
    setGuardando(false);
    if (r.ok && 'datos' in r) {
      notificar(`Inventario ${codigoDeConteo(r.datos)} abierto con ${r.datos.totalLineas} artículos.`, 'exito');
      await refrescarInventario();
      alAbrir(r.datos.id);
    } else if ('error' in r) setFallo(mensajeDeRechazo(r.error.codigo, r.error.mensaje));
  }

  return (
    <HojaInferior abierto={abierto} alCerrar={alCerrar} titulo="Abrir inventario físico">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-texto-suave">Se prepara la hoja de conteo con lo que dice el sistema de cada artículo de la sucursal. Solo puede haber un inventario abierto por sucursal.</p>
        <CampoSelect etiqueta="Sucursal" value={elegida} onChange={(e) => setSucursalId(e.target.value)}>
          {(sucursales.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.nombre} · {s.codigo}</option>)}
        </CampoSelect>
        {fallo ? <p role="alert" className="text-sm font-medium text-peligro">{fallo}</p> : null}
        <div className="flex justify-end gap-2">
          <Boton variante="fantasma" onClick={alCerrar}>Cancelar</Boton>
          <Boton variante="primario" cargando={guardando} disabled={!elegida} onClick={() => void abrir()}>Abrir inventario</Boton>
        </div>
      </div>
    </HojaInferior>
  );
}

/** Inventarios físicos: se abren con la foto del sistema, se cuentan y al cerrar ajustan las diferencias. */
export function PantallaConteos() {
  const navegar = useNavigate();
  const { editar } = usePermisosDeInventario();
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [hoja, setHoja] = useState(false);
  const consulta = useInfiniteQuery({
    queryKey: [...CLAVE_INSUMOS, 'conteos', filtro],
    queryFn: async ({ pageParam }) => datosOError(await listarConteos({ estado: filtro, limite: POR_PAGINA_DE_OPERACIONES, ...(pageParam && { cursor: pageParam }) })),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.siguiente ?? undefined,
  });
  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina titulo="Inventario físico" accionPrincipal={editar ? <Boton variante="primario" onClick={() => setHoja(true)}>Abrir inventario</Boton> : undefined} />
      <div className="lg:max-w-xs">
        <CampoSelect etiqueta="Estado" value={filtro} onChange={(e) => setFiltro(e.target.value as Filtro)}>
          {Object.entries(FILTROS).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </CampoSelect>
      </div>
      <ListaPaginada
        consulta={consulta}
        etiqueta="Inventarios físicos"
        columnas={COLUMNAS}
        clave={(c) => c.id}
        onAbrir={(c) => void navegar(`/m/insumos/conteos/${c.id}`)}
        vacio={<EstadoVacio titulo="Todavía no hay inventarios físicos" descripcion="Abre uno para contar una sucursal y ajustar las diferencias de una vez." icono="caja" />}
      />
      <HojaDeApertura abierto={hoja} alCerrar={() => setHoja(false)} alAbrir={(id) => void navegar(`/m/insumos/conteos/${id}`)} />
    </div>
  );
}
