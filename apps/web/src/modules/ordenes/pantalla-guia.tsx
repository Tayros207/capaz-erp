import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import type { GuiaCompletaDto } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { BarraDeImpresion, HojaImprimible, VistaPreviaDeHoja } from '../../shared/impresion/hoja-imprimible.tsx';
import { useDatosDeEmpresaParaImprimir } from '../../shared/impresion/usar-datos-de-empresa.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { usePermisosDePedidos } from './acciones.ts';
import { anular } from './acciones-guias.ts';
import { verGuia } from './api.ts';
import { CLAVE_PEDIDOS } from './claves.ts';
import { CuerpoDeGuia } from './cuerpo-de-guia.tsx';
import { AVISO_DE_GUIA, ETIQUETA_DE_ESTADO_DE_GUIA, TONO_DE_ESTADO_DE_GUIA, formatoDeGuia, guiaParaImprimirDesde, tituloDeGuia } from './guias.ts';
import { HojaTexto } from './hoja-texto.tsx';
import { Cargando } from './marco.tsx';

function Cabecera({ guia }: { guia: GuiaCompletaDto }) {
  return (
    <div className="no-imprimir m-2 flex flex-col gap-2 rounded-md border border-borde bg-superficie p-3">
      <p className="flex flex-wrap items-center gap-2">
        <span className="font-titulo font-semibold text-texto">{guia.codigo}</span>
        <Insignia tono={TONO_DE_ESTADO_DE_GUIA[guia.estado]}>{ETIQUETA_DE_ESTADO_DE_GUIA[guia.estado]}</Insignia>
      </p>
      <p className="text-sm text-texto-suave">{[guia.creadoPorNombre ? `Emitida por ${guia.creadoPorNombre}` : null, guia.anuladoPorNombre ? `Anulada por ${guia.anuladoPorNombre}` : null].filter(Boolean).join(' · ')}</p>
      <p className="text-sm text-texto">
        {'Pedidos: '}
        {guia.pedidos.map((p, i) => (
          <span key={p.id}>
            {i > 0 ? ', ' : ''}
            <Link to={`/m/ordenes/${p.id}`} className="font-medium underline">{p.codigo}</Link>
          </span>
        ))}
        {guia.pedidos.length === 0 ? 'ninguno (solo líneas libres)' : null}
      </p>
    </div>
  );
}

function Guia({ guia }: { guia: GuiaCompletaDto }) {
  const navegar = useNavigate();
  const { cancelar } = usePermisosDePedidos();
  const { datos } = useDatosDeEmpresaParaImprimir();
  const [anulando, setAnulando] = useState(false);
  const paraImprimir = guiaParaImprimirDesde(guia);
  return (
    <div className="flex flex-col">
      <BarraDeImpresion onVolver={() => void navegar('/m/ordenes/guias')} etiquetaVolver="Volver a las guías" />
      <Cabecera guia={guia} />
      {guia.estado === 'emitida' && cancelar ? (
        <div className="no-imprimir m-2"><Boton variante="peligro" onClick={() => setAnulando(true)}>Anular guía</Boton></div>
      ) : null}
      <VistaPreviaDeHoja>
        <HojaImprimible titulo={tituloDeGuia(paraImprimir)} empresa={datos} aviso={AVISO_DE_GUIA} formato={formatoDeGuia(paraImprimir.lineas.length)}>
          <CuerpoDeGuia guia={paraImprimir} />
        </HojaImprimible>
      </VistaPreviaDeHoja>
      <HojaTexto abierto={anulando} titulo="Anular guía" etiqueta="Motivo de la anulación" textoEnviar="Continuar" maximo={300} peligroso alEnviar={(t) => anular(guia.id, t)} alCerrar={() => setAnulando(false)} />
    </div>
  );
}

/** La guía guardada: se reimprime siempre desde lo guardado. `/m/ordenes/guias/:guiaId`. */
export function PantallaGuia() {
  const { guiaId = '' } = useParams();
  const consulta = useQuery({ queryKey: [...CLAVE_PEDIDOS, 'guias', 'ver', guiaId], queryFn: async () => datosOError(await verGuia(guiaId)) });
  if (consulta.isPending) return <Cargando etiqueta="Cargando guía" />;
  if (consulta.isError) return <EstadoVacio titulo="No encontramos esta guía" descripcion={consulta.error.message} icono="caja" />;
  return <Guia guia={consulta.data} />;
}
