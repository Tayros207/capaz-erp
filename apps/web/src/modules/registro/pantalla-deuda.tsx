import { useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router';
import { formatearSoles, type DeudaConAbonosDto, type MovimientoDto } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { formatearFechaHora } from '../../shared/formato/fechas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { Cifra, GrupoDeCifras } from '../../shared/ui/cifra.tsx';
import { BarraDeEstado } from '../../shared/ui/datos/barra-de-estado.tsx';
import { EncabezadoDePagina } from '../../shared/ui/datos/encabezado-de-pagina.tsx';
import type { Columna } from '../../shared/ui/datos/lista-tipos.ts';
import { Lista } from '../../shared/ui/datos/lista.tsx';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { Esqueleto } from '../../shared/ui/esqueleto.tsx';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { anularDeuda, verDeuda } from './api.ts';
import { resolverAccion } from './acciones.ts';
import { CLAVE_REGISTRO } from './claves.ts';
import { HojaDeAbono } from './hoja-abono.tsx';
import { HojaDeDeuda } from './hoja-deuda.tsx';
import { HojaMotivo } from './hoja-motivo.tsx';
import { estaAbierta, ETIQUETA_DE_MEDIO, formatearDia, PASOS_DE_DEUDA, pasoDeDeuda, textoDeEstadoDeDeuda, TITULO_DE_DEUDAS, tonoDeEstadoDeDeuda } from './logica.ts';
import { Monto } from './pantalla-movimientos.tsx';
import { useCuentas, usePuedeEditar } from './use-registro.ts';

function Dato({ nombre, children }: { nombre: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-sm text-texto-suave">{nombre}</dt>
      <dd className="font-medium break-words">{children}</dd>
    </div>
  );
}

const COLUMNAS_DE_ABONOS: Array<Columna<MovimientoDto>> = [
  { id: 'fecha', titulo: 'Fecha', principal: true, celda: (m) => formatearDia(m.fecha) },
  { id: 'codigo', titulo: 'Código', celda: (m) => m.codigo },
  { id: 'medio', titulo: 'Medio', celda: (m) => ETIQUETA_DE_MEDIO[m.medioDePago] },
  { id: 'cuenta', titulo: 'Cuenta', celda: (m) => m.cuentaNombre },
  { id: 'monto', titulo: 'Monto', alinear: 'derecha', celda: (m) => <Monto m={m} /> },
];

function Contenido({ d }: { d: DeudaConAbonosDto }) {
  const navegar = useNavigate();
  const cuentas = useCuentas();
  const puedeEditar = usePuedeEditar('registro:editar');
  const puedeAnular = usePuedeEditar('registro:anular');
  const [hoja, setHoja] = useState<'abono' | 'editar' | 'anular' | null>(null);
  const abierta = estaAbierta(d);
  const paso = pasoDeDeuda(d.estado);

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina
        titulo={`${TITULO_DE_DEUDAS[d.tipo]} ${d.codigo}`}
        migas={[{ texto: TITULO_DE_DEUDAS[d.tipo], a: `/m/registro/${d.tipo === 'por_cobrar' ? 'por-cobrar' : 'por-pagar'}` }, { texto: d.codigo }]}
        accionPrincipal={abierta && puedeEditar ? <Boton variante="primario" onClick={() => setHoja('abono')}>Registrar abono</Boton> : undefined}
        accionesSecundarias={
          <>
            <Insignia tono={tonoDeEstadoDeDeuda(d)}>{textoDeEstadoDeDeuda(d)}</Insignia>
            {abierta && puedeEditar ? <Boton onClick={() => setHoja('editar')}>Editar</Boton> : null}
            {abierta && puedeAnular ? <Boton variante="peligro" onClick={() => setHoja('anular')}>Anular</Boton> : null}
          </>
        }
      />
      {paso >= 0 ? <BarraDeEstado pasos={[...PASOS_DE_DEUDA]} actual={paso} etiqueta="Estado de la deuda" /> : null}
      <GrupoDeCifras etiqueta="Cifras de la deuda">
        <Cifra etiqueta="Total" valor={formatearSoles(d.totalCentimos)} />
        <Cifra etiqueta="Abonado" valor={formatearSoles(d.abonadoCentimos)} tono={d.abonadoCentimos > 0 ? 'exito' : 'neutro'} />
        <Cifra etiqueta="Saldo" valor={formatearSoles(d.saldoCentimos)} tono={d.estado === 'anulada' || d.saldoCentimos === 0 ? 'neutro' : d.vencida ? 'peligro' : 'aviso'} />
      </GrupoDeCifras>
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Dato nombre="Contacto">{d.contactoNombre}</Dato>
        <Dato nombre="Concepto">{d.concepto}</Dato>
        <Dato nombre="Fecha">{formatearDia(d.fecha)}</Dato>
        <Dato nombre="Vence">{d.venceEn ? formatearDia(d.venceEn) : '—'}</Dato>
        <Dato nombre="Notas">{d.notas ?? '—'}</Dato>
        <Dato nombre="Registrada">{formatearFechaHora(d.creadoEn)}</Dato>
        {d.anuladoEn ? <Dato nombre="Anulada">{formatearFechaHora(d.anuladoEn)} · {d.motivoAnulacion ?? 'Sin motivo'}</Dato> : null}
      </dl>
      <section aria-label="Abonos" className="flex flex-col gap-2">
        <h2 className="font-titulo font-semibold text-texto">Abonos</h2>
        <Lista
          etiqueta="Abonos de la deuda"
          columnas={COLUMNAS_DE_ABONOS}
          filas={d.abonos}
          clave={(m) => m.id}
          onAbrir={(m) => void navegar(`/m/registro/movimientos/${m.id}`)}
          vacio={<EstadoVacio titulo="Sin abonos todavía" descripcion={abierta ? 'Los abonos que registres aparecerán aquí.' : undefined} icono="caja" />}
        />
      </section>
      <HojaDeAbono abierto={hoja === 'abono'} deuda={d} cuentas={cuentas.data?.items ?? []} alCerrar={() => setHoja(null)} />
      <HojaDeDeuda abierto={hoja === 'editar'} deuda={d} alCerrar={() => setHoja(null)} />
      <HojaMotivo
        abierto={hoja === 'anular'}
        titulo={`Anular ${d.codigo}`}
        textoEnviar="Continuar"
        alEnviar={async (motivo) => resolverAccion(await anularDeuda(d.id, motivo), `${d.codigo} anulada.`)}
        alCerrar={() => setHoja(null)}
      />
    </div>
  );
}

/** Ficha de una deuda: estado, cifras, abonos y acciones. Con abonos vivos, el servidor rechaza la anulación y su mensaje se muestra. */
export function PantallaDeuda() {
  const { id = '' } = useParams();
  const consulta = useQuery({ queryKey: [...CLAVE_REGISTRO, 'deuda', id], queryFn: async () => datosOError(await verDeuda(id)) });
  if (consulta.isPending) {
    return (
      <div aria-busy="true" aria-label="Cargando deuda" className="flex flex-col gap-2">
        <Esqueleto className="h-8 w-1/2" />
        <Esqueleto className="h-40" />
      </div>
    );
  }
  if (consulta.isError) return <EstadoVacio titulo="No encontramos esta deuda" descripcion={consulta.error.message} icono="caja" />;
  return <Contenido d={consulta.data} />;
}
