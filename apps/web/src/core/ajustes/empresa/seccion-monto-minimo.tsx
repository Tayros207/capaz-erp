import type { Centimos, ConfiguracionDeEmpresa } from '@capaz/shared';
import { CampoMonto } from '../../../shared/ui/campo-monto.tsx';
import { CampoSelect } from '../../../shared/ui/campo-select.tsx';
import { Dato } from './campos-de-empresa.tsx';
import { conModoDeMontoMinimo, textoDeMontoMinimo, type ErroresDeEmpresa, type FormularioDeEmpresa, type ModoDeMontoMinimo } from './logica-datos.ts';

const OPCIONES: Array<{ valor: ModoDeMontoMinimo; texto: string }> = [
  { valor: 'defecto', texto: 'Por defecto (S/ 40.00)' },
  { valor: 'personalizado', texto: 'Personalizado' },
  { valor: 'apagado', texto: 'Apagado (no avisar)' },
];

export function LecturaDeMontoMinimo({ config }: { config: ConfiguracionDeEmpresa }) {
  return (
    <dl>
      <Dato etiqueta="Monto mínimo por trabajo" valor={textoDeMontoMinimo(config.montoMinimoCentimos)} />
    </dl>
  );
}

type Props = {
  form: FormularioDeEmpresa;
  errores: ErroresDeEmpresa;
  cambiar: (parcial: Partial<FormularioDeEmpresa>) => void;
};

/** Selector Por defecto / Personalizado / Apagado y, si es personalizado, el monto en soles. Solo es un aviso: nunca bloquea. */
export function EdicionDeMontoMinimo({ form, errores, cambiar }: Props) {
  return (
    <div className="flex max-w-md flex-col gap-3">
      <p className="text-sm text-texto-suave">Si un pedido o una cotización suma menos que este monto, te lo avisamos. Es solo un aviso: nunca impide guardar.</p>
      <CampoSelect etiqueta="Aviso de monto mínimo" value={form.montoMinimoModo} onChange={(ev) => cambiar(conModoDeMontoMinimo(form, ev.target.value as ModoDeMontoMinimo))}>
        {OPCIONES.map((o) => (
          <option key={o.valor} value={o.valor}>{o.texto}</option>
        ))}
      </CampoSelect>
      {form.montoMinimoModo === 'personalizado' ? (
        <CampoMonto etiqueta="Monto mínimo (con IGV)" valor={form.montoMinimoCentimos as Centimos | null} alCambiar={(montoMinimoCentimos) => cambiar({ montoMinimoCentimos })} error={errores.montoMinimo} />
      ) : null}
    </div>
  );
}
