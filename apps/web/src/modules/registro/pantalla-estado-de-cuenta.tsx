import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Boton } from '../../shared/ui/boton.tsx';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { Esqueleto } from '../../shared/ui/esqueleto.tsx';
import { notificar } from '../../shared/ui/notificar.ts';
import { BarraDeImpresion, BloqueDeDatos, HojaImprimible, TablaImprimible, VistaPreviaDeHoja } from '../../shared/impresion/hoja-imprimible.tsx';
import { normalizarEmpresa } from '../../shared/impresion/logica-impresion.ts';
import { useDatosDeEmpresaParaImprimir } from '../../shared/impresion/usar-datos-de-empresa.ts';
import { diaEnZona, formatearDia } from './logica.ts';
import { AvisoDeEmpresa } from './pantalla-recibo.tsx';
import { AVISO_DE_ESTADO_DE_CUENTA, deudasDelEstado, enlaceDeWhatsApp, filasDeEstadoDeCuenta, filasDeTotalesDeEstado, mensajeDeEstadoDeCuenta, totalesDeEstadoDeCuenta } from './recibos.ts';
import { PAGINAS_MAXIMAS, useEstadoDeCuenta } from './use-estado-de-cuenta.ts';

const COLUMNAS = [
  { clave: 'codigo', titulo: 'Código' },
  { clave: 'concepto', titulo: 'Concepto' },
  { clave: 'fecha', titulo: 'Fecha' },
  { clave: 'vence', titulo: 'Vence' },
  { clave: 'total', titulo: 'Total', formato: 'soles' },
  { clave: 'abonado', titulo: 'Abonado', formato: 'soles' },
  { clave: 'saldo', titulo: 'Saldo', formato: 'soles' },
  { clave: 'estado', titulo: 'Estado' },
] as const;

/** `/m/registro/estado-de-cuenta/:contactoId`: deudas por cobrar de un cliente, imprimible y enviable por WhatsApp. */
export function PantallaEstadoDeCuenta() {
  const { contactoId = '' } = useParams();
  const navegar = useNavigate();
  const [hoy] = useState(() => diaEnZona(new Date()));
  const [conPagadas, setConPagadas] = useState(false);
  const { datos } = useDatosDeEmpresaParaImprimir();
  const empresa = normalizarEmpresa(datos);
  const { cliente, abiertas, pagadas } = useEstadoDeCuenta(contactoId, conPagadas);

  if (cliente.isPending || abiertas.isPending) return <div aria-busy="true" aria-label="Cargando estado de cuenta" className="flex flex-col gap-2 p-4"><Esqueleto className="h-8 w-1/2" /><Esqueleto className="h-40" /></div>;
  const fallo = cliente.error ?? abiertas.error;
  if (fallo || !cliente.data || !abiertas.data) return <EstadoVacio titulo="No pudimos armar el estado de cuenta" descripcion={fallo?.message} icono="caja" />;

  const deudas = deudasDelEstado(abiertas.data.items, pagadas.data?.items ?? [], conPagadas, hoy);
  const totales = totalesDeEstadoDeCuenta(deudas);
  const truncado = abiertas.data.truncado || (conPagadas && pagadas.data?.truncado === true);

  function enviar() {
    const enlace = enlaceDeWhatsApp(cliente.data?.telefono, mensajeDeEstadoDeCuenta(cliente.data?.nombre ?? '', totales.adeudadoCentimos, totales.vencidoCentimos));
    if (!enlace) notificar('El cliente no tiene un teléfono válido registrado.', 'error');
    else window.open(enlace, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="flex flex-col">
      <BarraDeImpresion onVolver={() => void navegar('/m/registro/por-cobrar')} etiquetaVolver="Volver a Por cobrar" />
      <div className="no-imprimir m-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex min-h-(--alto-control) items-center gap-2 text-sm">
          <input type="checkbox" checked={conPagadas} onChange={(e) => setConPagadas(e.target.checked)} />
          Incluir deudas pagadas del último año
        </label>
        <Boton onClick={enviar}>Enviar por WhatsApp</Boton>
      </div>
      <AvisoDeEmpresa razonSocial={empresa.razonSocial} ruc={empresa.ruc} />
      {truncado ? <p role="status" className="no-imprimir m-2 rounded-md border border-borde bg-superficie p-3 text-sm">Hay más deudas de las que se muestran (máximo {PAGINAS_MAXIMAS * 100} por tipo); los totales pueden estar incompletos.</p> : null}
      {conPagadas && pagadas.isPending ? <p role="status" className="no-imprimir m-2 text-sm">Cargando pagadas…</p> : null}
      <VistaPreviaDeHoja>
        <HojaImprimible titulo="Estado de cuenta" empresa={datos} aviso={AVISO_DE_ESTADO_DE_CUENTA}>
          <BloqueDeDatos pares={[{ etiqueta: 'Cliente', valor: cliente.data.nombre }, { etiqueta: 'Documento', valor: cliente.data.documentoNumero }, { etiqueta: 'Fecha de emisión', valor: formatearDia(hoy) }, { etiqueta: 'Deudas', valor: String(deudas.length) }]} />
          <TablaImprimible etiqueta="Deudas del cliente" columnas={[...COLUMNAS]} filas={filasDeEstadoDeCuenta(deudas)} totales={filasDeTotalesDeEstado(totales)} />
        </HojaImprimible>
      </VistaPreviaDeHoja>
    </div>
  );
}
