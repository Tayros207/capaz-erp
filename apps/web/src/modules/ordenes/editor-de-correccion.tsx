import { useState } from 'react';
import { MOTIVOS_DE_CORRECCION, centimosSchema, type PedidoCompletoDto } from '@capaz/shared';
import { formatearSoles } from '../../shared/formato/soles.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import { CampoMonto } from '../../shared/ui/campo-monto.tsx';
import { FilasDePedido } from './filas-de-pedido.tsx';
import { MAXIMO_DE_MOTIVO_TEXTO, MOTIVO_DE_ATAJO, avisoDeEstado, alternarDesglose, conIgvEncima, diferenciaDelAtajo, sinIgvIncluido, type ErroresDeCorreccion, type FormularioDeCorreccion } from './correccion.ts';
import { ETIQUETA_DE_MOTIVO } from './huella-de-correccion.ts';

type Props = {
  pedido: PedidoCompletoDto;
  form: FormularioDeCorreccion;
  errores: ErroresDeCorreccion;
  alCambiar: (c: Partial<FormularioDeCorreccion>) => void;
};

function Atajos({ pedido, form, alCambiar }: Omit<Props, 'errores'>) {
  const [fijando, setFijando] = useState(form.fijarTotalCentimos !== null);
  const [precision, setPrecision] = useState<ReturnType<typeof diferenciaDelAtajo>>(null);
  const igv = pedido.igvPorcentaje;
  const conCambio = (lineas: FormularioDeCorreccion['lineas'], sentido?: 'encima' | 'quitar') => {
    setPrecision(sentido ? diferenciaDelAtajo(form.lineas, lineas, igv, sentido) : null);
    alCambiar({ lineas, fijarTotalCentimos: null, motivo: form.motivo ?? MOTIVO_DE_ATAJO });
  };
  return (
    <section aria-label="Atajos" className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-texto">Atajos de un toque</h3>
      <div className="flex flex-wrap gap-2">
        <Boton onClick={() => conCambio(conIgvEncima(form.lineas, igv), 'encima')}>Faltó sumar el IGV</Boton>
        <Boton onClick={() => conCambio(sinIgvIncluido(form.lineas, igv), 'quitar')}>Se cobró IGV de más</Boton>
        <Boton onClick={() => alCambiar({ lineas: alternarDesglose(form.lineas), motivo: form.motivo ?? MOTIVO_DE_ATAJO })}>Solo cambia el desglose del IGV</Boton>
        <Boton aria-expanded={fijando} onClick={() => { setFijando((a) => !a); if (fijando) alCambiar({ fijarTotalCentimos: null }); }}>
          {form.fijarTotalCentimos !== null ? `Total fijado en ${formatearSoles(form.fijarTotalCentimos)}` : 'Fijar total en S/ …'}
        </Boton>
      </div>
      {precision ? (
        <p role="status" className="rounded-control border border-aviso/30 bg-aviso/10 p-3 text-sm text-texto">
          Con precios de hasta tres decimales el total queda en <strong>{formatearSoles(precision.conPreciosCentimos)}</strong>; el {igv} % exacto daría {formatearSoles(precision.exactoCentimos)}. Si acordaron {formatearSoles(precision.exactoCentimos)}, prueba «Fijar total»; si con esa cantidad no se llega al céntimo, el sistema te avisará y puedes cambiar la unidad (por ejemplo, millar).
        </p>
      ) : null}
      {fijando ? (
        <div className="max-w-xs">
          <CampoMonto etiqueta="Total del pedido (con IGV)" valor={form.fijarTotalCentimos === null ? null : centimosSchema.parse(form.fijarTotalCentimos)} alCambiar={(v) => alCambiar({ fijarTotalCentimos: v })} ayuda="El sistema reparte la diferencia entre los precios de las líneas." />
        </div>
      ) : null}
    </section>
  );
}

function Motivo({ form, errores, alCambiar }: Omit<Props, 'pedido'>) {
  return (
    <section aria-label="Motivo de la corrección" className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-texto">¿Por qué se corrige?</h3>
      <div role="group" aria-label="Motivo" className="flex flex-wrap gap-2">
        {MOTIVOS_DE_CORRECCION.map((m) => (
          <Boton key={m} variante={form.motivo === m ? 'primario' : 'secundario'} aria-pressed={form.motivo === m} onClick={() => alCambiar({ motivo: m })}>{ETIQUETA_DE_MOTIVO[m]}</Boton>
        ))}
      </div>
      {errores.motivo ? <p role="alert" className="text-sm font-medium text-peligro">{errores.motivo}</p> : null}
      <Campo etiqueta="Detalle (opcional)" maxLength={MAXIMO_DE_MOTIVO_TEXTO} value={form.motivoTexto} error={errores.motivoTexto} ayuda={form.motivo === 'otro' ? 'Con «Otro», cuenta qué pasó.' : 'Una frase corta, por ejemplo: «Acordado por teléfono».'} onChange={(e) => alCambiar({ motivoTexto: e.target.value })} />
    </section>
  );
}

/** El primer paso de «Corregir pedido»: filas en línea, atajos y motivo. */
export function EditorDeCorreccion({ pedido, form, errores, alCambiar }: Props) {
  const aviso = avisoDeEstado(pedido.estado);
  return (
    <div className="flex flex-col gap-5">
      {aviso ? <p role="status" className="rounded-control border border-aviso/30 bg-aviso/10 p-3 text-sm font-medium text-texto">{aviso}</p> : null}
      <Atajos pedido={pedido} form={form} alCambiar={alCambiar} />
      <FilasDePedido lineas={form.lineas} igvPorcentaje={pedido.igvPorcentaje} errores={errores.porLinea} error={errores.lineas} soloPrecio={pedido.estado === 'entregado'} alCambiar={(lineas) => alCambiar({ lineas })} />
      <Motivo form={form} errores={errores} alCambiar={alCambiar} />
      {errores.cambios ? <p role="alert" className="text-sm font-medium text-peligro">{errores.cambios}</p> : null}
      {errores.total ? <p role="alert" className="text-sm font-medium text-peligro">{errores.total}</p> : null}
    </div>
  );
}
