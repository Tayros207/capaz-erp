import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import type { CompraCompletaDto } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { ZONA_POR_DEFECTO } from '../../shared/formato/fechas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import { CampoTextarea } from '../../shared/ui/campo-textarea.tsx';
import { EncabezadoDePagina } from '../../shared/ui/datos/encabezado-de-pagina.tsx';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { notificar } from '../../shared/ui/notificar.ts';
import { refrescarCompras, usePermisosDeCompras } from './acciones.ts';
import { recibirCompra, verCompra } from './api.ts';
import { CLAVE_COMPRAS } from './claves.ts';
import { FilasDeRecepcion, ResumenDeRecepcion } from './filas-de-recepcion.tsx';
import { argumentosDeRecepcion, filasDeRecepcion, recibirTodo, sinErrores, validarRecepcion, vistaPrevia, type ErroresDeRecepcion } from './logica-recepcion.ts';
import { diaEnZona, mensajeDeRechazo, porRecibir } from './logica.ts';
import { Cargando } from './marco.tsx';

/** El estado del formulario de recepción y cómo se envía. */
function useRecepcion(compra: CompraCompletaDto) {
  const navegar = useNavigate();
  const [hoy] = useState(() => diaEnZona(new Date(), ZONA_POR_DEFECTO));
  const [filas, setFilas] = useState(() => filasDeRecepcion(compra));
  const [fecha, setFecha] = useState(hoy);
  const [nota, setNota] = useState('');
  const [errores, setErrores] = useState<ErroresDeRecepcion>({ filas: {} });
  const [aviso, setAviso] = useState<string | undefined>();
  const [guardando, setGuardando] = useState(false);

  async function registrar() {
    const e = validarRecepcion(filas, fecha, { fechaDeLaOrden: compra.fecha, hoy });
    setErrores(e);
    if (!sinErrores(e)) return;
    setGuardando(true);
    setAviso(undefined);
    const r = await recibirCompra(argumentosDeRecepcion(compra.id, filas, fecha, nota));
    setGuardando(false);
    if (r.ok && 'datos' in r) {
      notificar(`Recepción N.º ${r.datos.recepciones.at(-1)?.numero ?? ''} registrada: ${r.datos.codigo}.`, 'exito');
      await refrescarCompras();
      void navegar(`/m/compras/${compra.id}`, { replace: true });
    } else if ('error' in r) setAviso(mensajeDeRechazo(r.error.codigo, r.error.mensaje));
  }

  const cambiarFila = (id: string, v: number | null) => setFilas((fs) => fs.map((f) => (f.ordenLineaId === id ? { ...f, cantidadMilesimas: v } : f)));
  return { hoy, filas, fecha, nota, errores, aviso, guardando, setFecha, setNota, cambiarFila, llegoTodo: () => setFilas(recibirTodo), registrar };
}

function Formulario({ compra }: { compra: CompraCompletaDto }) {
  const navegar = useNavigate();
  const r = useRecepcion(compra);
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(ev) => {
        ev.preventDefault();
        void r.registrar();
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-titulo font-semibold text-texto">¿Qué llegó de {compra.proveedorNombre}?</h2>
        <Boton onClick={r.llegoTodo}>Llegó todo lo pendiente</Boton>
      </div>
      <FilasDeRecepcion filas={r.filas} errores={r.errores.filas} alCambiar={r.cambiarFila} />
      {r.errores.general ? <p role="alert" className="text-sm font-medium text-peligro">{r.errores.general}</p> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Día en que llegó" type="date" min={compra.fecha} max={r.hoy} value={r.fecha} error={r.errores.fecha} onChange={(e) => r.setFecha(e.target.value)} />
        <CampoTextarea etiqueta="Nota de la entrega" filas={2} maxLength={300} value={r.nota} ayuda="Opcional: cajas dañadas, faltantes, guía de remisión." onChange={(e) => r.setNota(e.target.value)} />
      </div>
      <ResumenDeRecepcion vista={vistaPrevia(r.filas)} />
      {r.aviso ? <p role="alert" className="text-sm font-medium text-peligro">{r.aviso}</p> : null}
      <div className="flex justify-end gap-2">
        <Boton variante="fantasma" onClick={() => void navegar(`/m/compras/${compra.id}`)}>Volver</Boton>
        <Boton type="submit" variante="primario" cargando={r.guardando}>Registrar recepción</Boton>
      </div>
    </form>
  );
}

/** Recepción total o parcial de una orden enviada: cantidad por línea, tecleada. Se guarda una vez y no se edita. */
export function PantallaRecepcion() {
  const { id = '' } = useParams();
  const { editar } = usePermisosDeCompras();
  const consulta = useQuery({ queryKey: [...CLAVE_COMPRAS, 'ficha', id], queryFn: async () => datosOError(await verCompra(id)) });
  if (consulta.isPending) return <Cargando etiqueta="Cargando orden de compra" />;
  if (consulta.isError) return <EstadoVacio titulo="No encontramos esta orden de compra" descripcion={consulta.error.message} icono="caja" />;
  const c = consulta.data;
  const migas = [{ texto: 'Órdenes de compra', a: '/m/compras' }, { texto: c.codigo, a: `/m/compras/${c.id}` }, { texto: 'Recepción' }];
  const bloqueo = !editar
    ? { titulo: 'Tu acceso a Compras es de solo lectura', descripcion: 'Pide a quien administra tu empresa que te dé acceso completo.' }
    : !porRecibir(c.estado)
      ? { titulo: 'Esta orden no espera mercadería', descripcion: 'Solo se registra lo que llega de una orden enviada o recibida en parte.' }
      : null;
  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina titulo={`Recepción de ${c.codigo}`} migas={migas} />
      {bloqueo ? <EstadoVacio titulo={bloqueo.titulo} descripcion={bloqueo.descripcion} icono="aviso" /> : <Formulario key={`${c.id}-${c.actualizadoEn}`} compra={c} />}
    </div>
  );
}
