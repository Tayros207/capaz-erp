import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import type { ReactNode } from 'react';
import { datosOError } from '../../shared/api/consultas.ts';
import { formatearFechaHora } from '../../shared/formato/fechas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { EncabezadoDePagina } from '../../shared/ui/datos/encabezado-de-pagina.tsx';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { Esqueleto } from '../../shared/ui/esqueleto.tsx';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { anularMovimiento, verMovimiento } from './api.ts';
import { resolverAccion } from './acciones.ts';
import { HojaMotivo } from './hoja-motivo.tsx';
import { usePuedeEditar } from './use-registro.ts';
import { CLAVE_REGISTRO } from './claves.ts';
import { esTransferencia, ETIQUETA_DE_MEDIO, ETIQUETA_DE_TIPO, formatearDia } from './logica.ts';
import { Monto } from './pantalla-movimientos.tsx';

function Dato({ nombre, children }: { nombre: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-sm text-texto-suave">{nombre}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}

/** Ficha de un movimiento, en lectura. Un movimiento no se edita: se anula. */
export function PantallaMovimiento() {
  const { id = '' } = useParams();
  const consulta = useQuery({ queryKey: [...CLAVE_REGISTRO, 'movimiento', id], queryFn: async () => datosOError(await verMovimiento(id)) });
  const puedeAnular = usePuedeEditar('registro:anular');
  const [anulando, setAnulando] = useState(false);
  if (consulta.isPending) {
    return (
      <div aria-busy="true" aria-label="Cargando movimiento" className="flex flex-col gap-2">
        <Esqueleto className="h-8 w-1/2" />
        <Esqueleto className="h-40" />
      </div>
    );
  }
  if (consulta.isError) return <EstadoVacio titulo="No encontramos este movimiento" descripcion={consulta.error.message} icono="caja" />;
  const m = consulta.data;
  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina
        titulo={`${ETIQUETA_DE_TIPO[m.tipo]} ${m.codigo}`}
        migas={[{ texto: 'Movimientos', a: '/m/registro/movimientos' }, { texto: m.codigo }]}
        accionesSecundarias={
          m.estado === 'anulado' ? <Insignia tono="neutro">Anulado</Insignia> : puedeAnular ? <Boton variante="peligro" onClick={() => setAnulando(true)}>Anular</Boton> : undefined
        }
      />
      <HojaMotivo
        abierto={anulando}
        titulo={esTransferencia(m) ? `Anular la transferencia (${m.codigo} y su otra pata)` : `Anular ${m.codigo}`}
        textoEnviar="Continuar"
        alEnviar={async (motivo) => resolverAccion(await anularMovimiento(m.id, motivo), `${m.codigo} anulado.`)}
        alCerrar={() => setAnulando(false)}
      />
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Dato nombre="Monto"><Monto m={m} /></Dato>
        <Dato nombre="Fecha">{formatearDia(m.fecha)}</Dato>
        <Dato nombre="Cuenta">{m.cuentaNombre}</Dato>
        <Dato nombre="Categoría">{m.categoriaNombre ?? '—'}</Dato>
        <Dato nombre="Contacto">{m.contactoNombre ?? '—'}</Dato>
        <Dato nombre="Medio de pago">{ETIQUETA_DE_MEDIO[m.medioDePago]}</Dato>
        <Dato nombre="Descripción">{m.descripcion ?? '—'}</Dato>
        <Dato nombre="Registrado">{formatearFechaHora(m.creadoEn)}</Dato>
        {esTransferencia(m) ? <Dato nombre="Tipo"><Insignia tono="info">Transferencia entre cuentas</Insignia></Dato> : null}
        {m.deudaId ? <Dato nombre="Abono de una deuda"><Link to={`/m/registro/deudas/${m.deudaId}`}>Ver la deuda</Link></Dato> : null}
        {m.anuladoEn ? <Dato nombre="Anulado">{formatearFechaHora(m.anuladoEn)} · {m.motivoAnulacion ?? 'Sin motivo'}</Dato> : null}
      </dl>
    </div>
  );
}
