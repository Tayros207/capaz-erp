import { CampoMonto } from '../../shared/ui/campo-monto.tsx';
import { ControlSegmentado } from './control-segmentado.tsx';
import { OPCIONES_DE_AJUSTE, SIN_AJUSTE, type AjusteDeFormulario, type TipoDeAjuste } from './logica-precio.ts';

const ETIQUETA_DEL_CAMPO: Readonly<Record<Exclude<TipoDeAjuste, 'ninguno'>, string>> = {
  precio: 'Precio de esta cotización (sin IGV)',
  sumar: 'Monto a sumar (sin IGV)',
  restar: 'Monto a restar (sin IGV)',
};
const AYUDA: Readonly<Record<TipoDeAjuste, string>> = {
  ninguno: 'Se usa el precio de tu lista.',
  precio: 'Fija el precio final de esta línea; la lista no cambia.',
  sumar: 'Se suma al precio de lista, solo en esta cotización.',
  restar: 'Se resta al precio de lista, solo en esta cotización.',
};

type Props = { ajuste: AjusteDeFormulario; alCambiar: (a: AjusteDeFormulario) => void; error?: string | undefined; etiqueta?: string };

/** El precio de esta cotización sin tocar la lista: «Lista» lo deja como está; «A mano» lo fija; «Sumar» y «Restar» lo mueven un monto. */
export function AjusteDePrecio({ ajuste, alCambiar, error, etiqueta = 'Precio para esta cotización' }: Props) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-texto">{etiqueta}</span>
      <ControlSegmentado
        etiqueta={etiqueta}
        valor={ajuste.tipo}
        opciones={OPCIONES_DE_AJUSTE}
        alCambiar={(tipo) => alCambiar(tipo === 'ninguno' ? SIN_AJUSTE : { tipo, centimos: ajuste.centimos })}
      />
      {ajuste.tipo === 'ninguno' ? (
        <p className="text-sm text-texto-suave">{AYUDA.ninguno}</p>
      ) : (
        <div className="sm:max-w-xs">
          <CampoMonto etiqueta={ETIQUETA_DEL_CAMPO[ajuste.tipo]} valor={ajuste.centimos} ayuda={AYUDA[ajuste.tipo]} error={error} alCambiar={(centimos) => alCambiar({ tipo: ajuste.tipo, centimos })} />
        </div>
      )}
    </div>
  );
}
