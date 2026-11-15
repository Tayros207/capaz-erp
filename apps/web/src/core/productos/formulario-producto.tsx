import { Campo } from '../../shared/ui/campo.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import { ETIQUETA_DE_TIPO, type ErroresDeProducto, type FormularioDeProducto, type TipoDeProducto } from './logica.ts';

type Props = {
  valor: FormularioDeProducto;
  errores: ErroresDeProducto;
  alCambiar: (cambio: Partial<FormularioDeProducto>) => void;
};

/** Campos de un producto, en una columna en el móvil y en dos desde 640 px. Sirve para crear y para editar. */
export function FormularioProducto({ valor, errores, alCambiar }: Props) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Campo etiqueta="Nombre" required autoComplete="off" value={valor.nombre} error={errores.nombre} onChange={(e) => alCambiar({ nombre: e.target.value })} />
      </div>
      <CampoSelect etiqueta="Tipo" value={valor.tipo} onChange={(e) => alCambiar({ tipo: e.target.value as TipoDeProducto })}>
        {Object.entries(ETIQUETA_DE_TIPO).map(([v, t]) => (
          <option key={v} value={v}>{t}</option>
        ))}
      </CampoSelect>
      <Campo etiqueta="Código" autoComplete="off" value={valor.codigo} onChange={(e) => alCambiar({ codigo: e.target.value })} />
      <Campo etiqueta="Precio unitario (S/)" inputMode="decimal" autoComplete="off" value={valor.precio} error={errores.precio} ayuda="Hasta tres decimales." onChange={(e) => alCambiar({ precio: e.target.value })} />
      <Campo etiqueta="Unidad" autoComplete="off" value={valor.unidad} ayuda="Por ejemplo: UND, m, kg." onChange={(e) => alCambiar({ unidad: e.target.value })} />
      <CampoSelect etiqueta="Afecto a IGV" value={valor.afectoIgv ? 'si' : 'no'} onChange={(e) => alCambiar({ afectoIgv: e.target.value === 'si' })}>
        <option value="si">Sí</option>
        <option value="no">No</option>
      </CampoSelect>
      <div className="sm:col-span-2">
        <Campo etiqueta="Descripción" value={valor.descripcion} onChange={(e) => alCambiar({ descripcion: e.target.value })} />
      </div>
    </div>
  );
}
