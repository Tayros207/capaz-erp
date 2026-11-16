import { datosOError } from '../../shared/api/consultas.ts';
import { Campo } from '../../shared/ui/campo.tsx';
import { CampoTextarea } from '../../shared/ui/campo-textarea.tsx';
import { SelectorDeRegistro } from '../../shared/ui/selector-de-registro.tsx';
import { buscarProveedores } from './api.ts';
import { LineasDeCompra } from './lineas-de-compra.tsx';
import type { ErroresDeCompra, FormularioDeCompra } from './logica.ts';

type Props = {
  valor: FormularioDeCompra;
  errores: ErroresDeCompra;
  igvPorcentaje: number;
  /** Día de la orden: la entrega no puede ser anterior. */
  fecha: string;
  alCambiar: (cambio: Partial<FormularioDeCompra>) => void;
};

const TIPO: Readonly<Record<string, string>> = { proveedor: 'Proveedor', cliente: 'Cliente', ambos: 'Cliente y proveedor' };

async function buscar(texto: string) {
  const { items } = datosOError(await buscarProveedores(texto));
  return items.map((c) => ({ id: c.id, nombre: c.nombre, detalle: [TIPO[c.tipo], c.documentoNumero].filter(Boolean).join(' · ') }));
}

/** Los datos editables de una orden en borrador: proveedor, entrega, notas y líneas. */
export function FormularioCompra({ valor, errores, igvPorcentaje, fecha, alCambiar }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectorDeRegistro
          etiqueta="Proveedor"
          valor={valor.proveedor}
          alCambiar={(o) => alCambiar({ proveedor: o ? { id: o.id, nombre: o.nombre } : null })}
          buscar={buscar}
          error={errores.proveedor}
          textoSinResultados="Ningún contacto se parece a eso"
        />
        <Campo etiqueta="Entrega esperada" type="date" min={fecha} value={valor.entregaEl} error={errores.entregaEl} ayuda="Opcional." onChange={(e) => alCambiar({ entregaEl: e.target.value })} />
        <div className="sm:col-span-2">
          <CampoTextarea etiqueta="Notas para el proveedor" filas={3} maxLength={4000} value={valor.notas} error={errores.notas} onChange={(e) => alCambiar({ notas: e.target.value })} />
        </div>
      </div>
      <LineasDeCompra lineas={valor.lineas} igvPorcentaje={igvPorcentaje} error={errores.lineas} alCambiar={(lineas) => alCambiar({ lineas })} />
    </div>
  );
}
