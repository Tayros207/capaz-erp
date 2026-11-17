import { useQuery } from '@tanstack/react-query';
import type { Centimos } from '@capaz/shared';
import { datosOError } from '../../../shared/api/consultas.ts';
import { CampoMonto } from '../../../shared/ui/campo-monto.tsx';
import { CampoSelect } from '../../../shared/ui/campo-select.tsx';
import { Campo } from '../../../shared/ui/campo.tsx';
import { CLAVE_CAPTURA, verDeuda } from '../api.ts';
import { aplicarOpcion, centimosDe, conCampo, sugerenciaDe, textoDe } from '../logica-tarjeta.ts';
import { useCatalogos } from '../use-catalogos.ts';
import type { PropsDeFormulario } from './tipos.ts';

/** `deuda_abonar`: abono a una deuda; si había varias abiertas, se elige cuál. */
export function FormularioDeudaAbonar({ args, sugerencias, alCambiar, deshabilitado }: PropsDeFormulario) {
  const { cuentas } = useCatalogos();
  const id = textoDe(args.id);
  const deuda = useQuery({ queryKey: [...CLAVE_CAPTURA, 'deuda', id], queryFn: async () => datosOError(await verDeuda(id)), enabled: id !== '', staleTime: 30_000 });
  const sugerencia = sugerenciaDe(sugerencias, 'id');
  const poner = (clave: string, valor: unknown) => alCambiar(conCampo(args, clave, valor));
  return (
    <fieldset disabled={deshabilitado} className="grid gap-4 sm:grid-cols-2">
      {sugerencia ? (
        <div className="sm:col-span-2">
          <CampoSelect etiqueta="Deuda" ayuda={sugerencia.texto} value={id} onChange={(e) => alCambiar(aplicarOpcion(args, sugerencia, e.target.value))}>
            {sugerencia.opciones.map((o) => <option key={o.id} value={o.id}>{o.nombre}{o.detalle ? ` · ${o.detalle}` : ''}</option>)}
          </CampoSelect>
        </div>
      ) : deuda.data ? (
        <p className="text-texto sm:col-span-2">Deuda: <strong>{deuda.data.codigo}</strong> · {deuda.data.concepto}</p>
      ) : null}
      <CampoMonto etiqueta="Monto del abono" valor={centimosDe(args.montoCentimos) as Centimos | null} alCambiar={(v) => poner('montoCentimos', v)} />
      <Campo etiqueta="Fecha" type="date" value={textoDe(args.fecha)} onChange={(e) => poner('fecha', e.target.value)} />
      <CampoSelect etiqueta="Cuenta" value={textoDe(args.cuentaId)} onChange={(e) => poner('cuentaId', e.target.value)}>
        <option value="">Cuenta principal</option>
        {cuentas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
      </CampoSelect>
    </fieldset>
  );
}
