import type { Centimos } from '@capaz/shared';
import { CampoMonto } from '../../../shared/ui/campo-monto.tsx';
import { CampoSelect } from '../../../shared/ui/campo-select.tsx';
import { Campo } from '../../../shared/ui/campo.tsx';
import { centimosDe, conCampo, sugerenciaDe, textoDe } from '../logica-tarjeta.ts';
import { useCatalogos } from '../use-catalogos.ts';
import { SelectorDeContacto } from './selector-de-contacto.tsx';
import type { PropsDeFormulario } from './tipos.ts';

/** `deuda_crear` y `deuda_crear_con_adelanto`: quién debe, cuánto, y con adelanto, cuánto entró y a qué cuenta. */
export function FormularioDeudaCrear({ args, sugerencias, alCambiar, deshabilitado, conAdelanto }: PropsDeFormulario & { conAdelanto: boolean }) {
  const { cuentas } = useCatalogos();
  const poner = (clave: string, valor: unknown) => alCambiar(conCampo(args, clave, valor));
  return (
    <fieldset disabled={deshabilitado} className="grid gap-4 sm:grid-cols-2">
      <CampoSelect etiqueta="Clase" value={textoDe(args.tipo) === 'por_pagar' ? 'por_pagar' : 'por_cobrar'} onChange={(e) => poner('tipo', e.target.value)}>
        <option value="por_cobrar">Por cobrar</option>
        <option value="por_pagar">Por pagar</option>
      </CampoSelect>
      <Campo etiqueta="Concepto" maxLength={200} value={textoDe(args.concepto)} onChange={(e) => poner('concepto', e.target.value)} />
      <CampoMonto etiqueta="Total" valor={centimosDe(args.totalCentimos) as Centimos | null} alCambiar={(v) => poner('totalCentimos', v)} />
      {conAdelanto ? (
        <CampoMonto etiqueta="Adelanto" valor={centimosDe(args.adelantoCentimos) as Centimos | null} alCambiar={(v) => poner('adelantoCentimos', v)} />
      ) : null}
      <Campo etiqueta="Fecha" type="date" value={textoDe(args.fecha)} onChange={(e) => poner('fecha', e.target.value)} />
      <Campo etiqueta="Vence (opcional)" type="date" value={textoDe(args.venceEn)} onChange={(e) => poner('venceEn', e.target.value)} />
      {conAdelanto ? (
        <CampoSelect etiqueta="Cuenta del adelanto" value={textoDe(args.cuentaId)} onChange={(e) => poner('cuentaId', e.target.value)}>
          <option value="">Cuenta principal</option>
          {cuentas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </CampoSelect>
      ) : null}
      <div className="sm:col-span-2">
        <SelectorDeContacto etiqueta="Cliente" contactoId={textoDe(args.contactoId) || null} sugerencia={sugerenciaDe(sugerencias, 'contactoId')} alCambiar={(id) => poner('contactoId', id)} />
      </div>
    </fieldset>
  );
}
