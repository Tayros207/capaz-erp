import { Campo } from '../../shared/ui/campo.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import {
  claseSugerida,
  ETIQUETA_DE_CLASE,
  ETIQUETA_DE_DOCUMENTO,
  ETIQUETA_DE_TIPO,
  type ClaseDeCliente,
  type ErroresDeCliente,
  type FormularioDeCliente,
  type TipoDeCliente,
  type TipoDeDocumento,
} from './logica.ts';

type Props = {
  valor: FormularioDeCliente;
  errores: ErroresDeCliente;
  alCambiar: (cambio: Partial<FormularioDeCliente>) => void;
  /** Alta rápida desde otro formulario: sin correo ni notas. */
  compacto?: boolean;
};

/** Campos de un cliente, en una columna en el móvil y en dos desde 640 px. Sirve para crear y para editar. */
export function FormularioCliente({ valor, errores, alCambiar, compacto }: Props) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Campo etiqueta="Nombre" required autoComplete="off" value={valor.nombre} error={errores.nombre} onChange={(e) => alCambiar({ nombre: e.target.value })} />
      </div>
      <CampoSelect etiqueta="Tipo" value={valor.tipo} onChange={(e) => alCambiar({ tipo: e.target.value as TipoDeCliente })}>
        {Object.entries(ETIQUETA_DE_TIPO).map(([v, t]) => (
          <option key={v} value={v}>{t}</option>
        ))}
      </CampoSelect>
      <CampoSelect etiqueta="Clase" value={valor.clase} onChange={(e) => alCambiar({ clase: e.target.value as ClaseDeCliente })}>
        {Object.entries(ETIQUETA_DE_CLASE).map(([v, t]) => (
          <option key={v} value={v}>{t}</option>
        ))}
      </CampoSelect>
      <CampoSelect
        etiqueta="Tipo de documento"
        value={valor.documentoTipo}
        error={errores.documentoTipo}
        onChange={(e) => {
          const documentoTipo = e.target.value as TipoDeDocumento;
          alCambiar({ documentoTipo, clase: claseSugerida(documentoTipo, valor.clase) });
        }}
      >
        <option value="">Sin documento</option>
        {Object.entries(ETIQUETA_DE_DOCUMENTO).map(([v, t]) => (
          <option key={v} value={v}>{t}</option>
        ))}
      </CampoSelect>
      <Campo etiqueta="Número de documento" inputMode="numeric" autoComplete="off" value={valor.documentoNumero} error={errores.documentoNumero} onChange={(e) => alCambiar({ documentoNumero: e.target.value })} />
      <Campo etiqueta="Teléfono" type="tel" autoComplete="off" value={valor.telefono} onChange={(e) => alCambiar({ telefono: e.target.value })} />
      {compacto ? null : <Campo etiqueta="Correo" type="email" autoComplete="off" value={valor.correo} error={errores.correo} onChange={(e) => alCambiar({ correo: e.target.value })} />}
      <div className={compacto ? '' : 'sm:col-span-2'}>
        <Campo etiqueta="Dirección" autoComplete="off" value={valor.direccion} onChange={(e) => alCambiar({ direccion: e.target.value })} />
      </div>
      {compacto ? null : (
        <div className="sm:col-span-2">
          <Campo etiqueta="Notas" value={valor.notas} onChange={(e) => alCambiar({ notas: e.target.value })} />
        </div>
      )}
    </div>
  );
}
