import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { formatearSoles, type DeudaDto } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import { Cifra, GrupoDeCifras } from '../../shared/ui/cifra.tsx';
import { CargarMas } from '../../shared/ui/datos/cargar-mas.tsx';
import { EncabezadoDePagina } from '../../shared/ui/datos/encabezado-de-pagina.tsx';
import type { Columna } from '../../shared/ui/datos/lista-tipos.ts';
import { Lista } from '../../shared/ui/datos/lista.tsx';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { Esqueleto } from '../../shared/ui/esqueleto.tsx';
import { MenuDeAcciones } from '../../shared/ui/datos/menu-de-acciones.tsx';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { listarDeudas, POR_PAGINA, verResumen } from './api.ts';
import { HojaDeDeudaNueva } from './hoja-deuda-nueva.tsx';
import { usePuedeEditar } from './use-registro.ts';
import { CLAVE_REGISTRO } from './claves.ts';
import {
  argumentosDeListadoDeDeudas, diaEnZona, ETIQUETA_DE_FILTRO_DE_DEUDAS, formatearDia, textoDeEstadoDeDeuda, TITULO_DE_DEUDAS, tonoDeEstadoDeDeuda,
  type FiltroDeDeudas, type TipoDeDeuda,
} from './logica.ts';

function columnasDeDeudas(tipo: TipoDeDeuda, ir: (ruta: string) => void): Array<Columna<DeudaDto>> {
  const base: Array<Columna<DeudaDto>> = [
  { id: 'codigo', titulo: 'Código', principal: true, celda: (d) => d.codigo },
  { id: 'contacto', titulo: 'Contacto', celda: (d) => d.contactoNombre },
  { id: 'concepto', titulo: 'Concepto', celda: (d) => d.concepto },
  { id: 'vence', titulo: 'Vence', celda: (d) => (d.venceEn ? formatearDia(d.venceEn) : '—') },
  { id: 'total', titulo: 'Total', alinear: 'derecha', celda: (d) => <span className="tabular-nums">{formatearSoles(d.totalCentimos)}</span> },
  { id: 'saldo', titulo: 'Saldo', alinear: 'derecha', celda: (d) => <span className="font-medium tabular-nums">{formatearSoles(d.saldoCentimos)}</span> },
  { id: 'estado', titulo: 'Estado', celda: (d) => <Insignia tono={tonoDeEstadoDeDeuda(d)}>{textoDeEstadoDeDeuda(d)}</Insignia> },
  ];
  if (tipo !== 'por_cobrar') return base;
  return [...base, {
    id: 'acciones',
    titulo: 'Acciones',
    alinear: 'derecha',
    celda: (d) => (
      <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        <MenuDeAcciones etiqueta={`Acciones de ${d.codigo}`} acciones={[{ etiqueta: 'Estado de cuenta', onSeleccionar: () => ir(`/m/registro/estado-de-cuenta/${d.contactoId}`) }]} />
      </span>
    ),
  }];
}

/** Cifras del tipo de deuda (saldo abierto y vencido). Necesitan el permiso de reportes: sin él, no se muestran. */
function CifrasDeDeudas({ tipo }: { tipo: TipoDeDeuda }) {
  const [hoy] = useState(() => diaEnZona(new Date()));
  const resumen = useQuery({ queryKey: [...CLAVE_REGISTRO, 'resumen', hoy], queryFn: async () => datosOError(await verResumen(hoy, hoy)) });
  if (!resumen.data) return null;
  const r = resumen.data;
  const cobrar = tipo === 'por_cobrar';
  const vencidas = cobrar ? r.vencidasPorCobrar : r.vencidasPorPagar;
  return (
    <GrupoDeCifras etiqueta={`Cifras de ${TITULO_DE_DEUDAS[tipo].toLowerCase()}`}>
      <Cifra etiqueta="Saldo abierto" valor={formatearSoles(cobrar ? r.porCobrarCentimos : r.porPagarCentimos)} tono="aviso" />
      <Cifra
        etiqueta="Vencido"
        valor={cobrar ? formatearSoles(r.vencidasPorCobrarCentimos) : `${vencidas} ${vencidas === 1 ? 'deuda' : 'deudas'}`}
        tono={vencidas > 0 ? 'peligro' : 'neutro'}
        ayuda={cobrar ? `${vencidas} ${vencidas === 1 ? 'deuda vencida' : 'deudas vencidas'}` : undefined}
      />
    </GrupoDeCifras>
  );
}

/** Por cobrar y por pagar: la misma pantalla con el tipo de deuda distinto. */
export function PantallaDeudas({ tipo }: { tipo: TipoDeDeuda }) {
  const navegar = useNavigate();
  const puedeEditar = usePuedeEditar('registro:editar');
  const [nueva, setNueva] = useState(false);
  const [estado, setEstado] = useState<FiltroDeDeudas>('abiertas');
  const lista = useInfiniteQuery({
    queryKey: [...CLAVE_REGISTRO, 'deudas', tipo, estado],
    queryFn: async ({ pageParam }) => datosOError(await listarDeudas(argumentosDeListadoDeDeudas(tipo, estado, POR_PAGINA, pageParam))),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.siguiente ?? undefined,
  });
  const filas = lista.data?.pages.flatMap((p) => p.items) ?? [];
  const titulo = TITULO_DE_DEUDAS[tipo];

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina titulo={titulo} accionPrincipal={puedeEditar ? <Boton variante="primario" icono="mas" onClick={() => setNueva(true)}>Nueva deuda</Boton> : undefined} />
      <CifrasDeDeudas tipo={tipo} />
      <div className="max-w-xs">
        <CampoSelect etiqueta="Estado" value={estado} onChange={(e) => setEstado(e.target.value as FiltroDeDeudas)}>
          {Object.entries(ETIQUETA_DE_FILTRO_DE_DEUDAS).map(([valor, texto]) => <option key={valor} value={valor}>{texto}</option>)}
        </CampoSelect>
      </div>
      {lista.isPending ? (
        <div aria-busy="true" aria-label={`Cargando ${titulo.toLowerCase()}`} className="flex flex-col gap-2">
          <Esqueleto className="h-12" />
          <Esqueleto className="h-12" />
          <Esqueleto className="h-12" />
        </div>
      ) : lista.isError ? (
        <EstadoVacio titulo={`No pudimos cargar ${titulo.toLowerCase()}`} descripcion={lista.error.message} icono="caja" accion={<Boton onClick={() => void lista.refetch()}>Reintentar</Boton>} />
      ) : (
        <>
          <Lista
            etiqueta={titulo}
            columnas={columnasDeDeudas(tipo, (ruta) => void navegar(ruta))}
            filas={filas}
            clave={(d) => d.id}
            onAbrir={(d) => void navegar(`/m/registro/deudas/${d.id}`)}
            vacio={<EstadoVacio titulo="Ninguna deuda con ese estado" descripcion="Cambia el estado para ver otras." icono="caja" />}
          />
          <CargarMas cursor={lista.hasNextPage ? (lista.data?.pages.at(-1)?.siguiente ?? null) : null} cargando={lista.isFetchingNextPage} onCargar={() => void lista.fetchNextPage()} resumen={`Mostrando ${filas.length}`} />
        </>
      )}
      <HojaDeDeudaNueva abierto={nueva} tipo={tipo} alCerrar={() => setNueva(false)} />
    </div>
  );
}
