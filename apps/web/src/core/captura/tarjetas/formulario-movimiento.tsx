import { CampoMonto } from '../../../shared/ui/campo-monto.tsx';
import { CampoSelect } from '../../../shared/ui/campo-select.tsx';
import { Campo } from '../../../shared/ui/campo.tsx';
import { centimosDe, conCampo, sugerenciaDe, textoDe } from '../logica-tarjeta.ts';
import { useCatalogos } from '../use-catalogos.ts';
import { SelectorDeContacto } from './selector-de-contacto.tsx';
import type { Centimos } from '@capaz/shared';
import type { PropsDeFormulario } from './tipos.ts';

/** `movimiento_registrar`: ingreso o egreso con monto, fecha, contacto, categoría y cuenta. */
export function FormularioMovimiento({ args, sugerencias, alCambiar, deshabilitado }: PropsDeFormulario) {
  const { cuentas, categorias } = useCatalogos();
  const tipo = textoDe(args.tipo) === 'egreso' ? 'egreso' : 'ingreso';
  const poner = (clave: string, valor: unknown) => alCambiar(conCampo(args, clave, valor));
  return (
    <fieldset disabled={deshabilitado} className="grid gap-4 sm:grid-cols-2">
      <CampoMonto etiqueta="Monto" valor={centimosDe(args.montoCentimos) as Centimos | null} alCambiar={(v) => poner('montoCentimos', v)} />
      <CampoSelect etiqueta="Tipo" value={tipo} onChange={(e) => alCambiar(conCampo(conCampo(args, 'tipo', e.target.value), 'categoriaId', null))}>
        <option value="ingreso">Ingreso</option>
        <option value="egreso">Egreso</option>
      </CampoSelect>
      <Campo etiqueta="Fecha" type="date" value={textoDe(args.fecha)} onChange={(e) => poner('fecha', e.target.value)} />
      <CampoSelect etiqueta="Cuenta" value={textoDe(args.cuentaId)} onChange={(e) => poner('cuentaId', e.target.value)}>
        <option value="">Cuenta principal</option>
        {cuentas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
      </CampoSelect>
      <CampoSelect etiqueta="Categoría" value={textoDe(args.categoriaId)} onChange={(e) => poner('categoriaId', e.target.value)}>
        <option value="">Sin categoría</option>
        {categorias.filter((c) => c.tipo === tipo).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
      </CampoSelect>
      <Campo etiqueta="Descripción (opcional)" maxLength={500} value={textoDe(args.descripcion)} onChange={(e) => poner('descripcion', e.target.value)} />
      <div className="sm:col-span-2">
        <SelectorDeContacto etiqueta="Contacto (opcional)" contactoId={textoDe(args.contactoId) || null} sugerencia={sugerenciaDe(sugerencias, 'contactoId')} alCambiar={(id) => poner('contactoId', id)} />
      </div>
    </fieldset>
  );
}
