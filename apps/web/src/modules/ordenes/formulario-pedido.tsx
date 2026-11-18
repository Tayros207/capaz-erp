import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { HojaNuevoCliente } from '../../core/clientes/hoja-nuevo-cliente.tsx';
import { verCliente } from '../../core/clientes/api.ts';
import { datosOError } from '../../shared/api/consultas.ts';
import { Campo } from '../../shared/ui/campo.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import { CampoTextarea } from '../../shared/ui/campo-textarea.tsx';
import { SelectorDeRegistro } from '../../shared/ui/selector-de-registro.tsx';
import { buscarClientes, listarMiembros, primerosClientes } from './api.ts';
import { FilasDePedido } from './filas-de-pedido.tsx';
import type { ErroresDePedido, FormularioDePedido } from './logica.ts';

type Props = {
  valor: FormularioDePedido;
  errores: ErroresDePedido;
  igvPorcentaje: number;
  /** Día del pedido: la entrega no puede ser anterior. */
  fecha: string;
  alCambiar: (cambio: Partial<FormularioDePedido>) => void;
};

const aOpcion = (c: { id: string; nombre: string; documentoNumero: string | null }) => ({ id: c.id, nombre: c.nombre, ...(c.documentoNumero && { detalle: c.documentoNumero }) });
async function buscar(texto: string) {
  return datosOError(await buscarClientes(texto)).items.map(aOpcion);
}
async function primeros() {
  return datosOError(await primerosClientes()).items.map(aOpcion);
}

/** Los datos editables de un pedido en borrador: cliente, entrega, responsable, notas y líneas. */
export function FormularioPedido({ valor, errores, igvPorcentaje, fecha, alCambiar }: Props) {
  // La lista de miembros exige su propio permiso: quien no lo tiene simplemente no ve el campo.
  const miembros = useQuery({ queryKey: ['miembros', 'para-responsable'], queryFn: async () => datosOError(await listarMiembros()).miembros, retry: false });
  // Si el cliente no existe se crea aquí mismo, con el nombre que ya se tecleó, y queda elegido.
  const [nuevoCliente, setNuevoCliente] = useState<string | null>(null);
  async function elegirCreado(id: string) {
    setNuevoCliente(null);
    alCambiar({ cliente: { id, nombre: datosOError(await verCliente(id)).nombre } });
  }
  return (
    <div className="flex flex-col gap-6">
      <HojaNuevoCliente abierto={nuevoCliente !== null} nombreInicial={nuevoCliente ?? ''} alCerrar={() => setNuevoCliente(null)} alCrear={(id) => void elegirCreado(id)} alAbrirExistente={(id) => void elegirCreado(id)} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectorDeRegistro
          etiqueta="Cliente"
          valor={valor.cliente}
          alCambiar={(o) => alCambiar({ cliente: o ? { id: o.id, nombre: o.nombre } : null })}
          buscar={buscar}
          buscarSinTexto={primeros}
          error={errores.cliente}
          ayuda="Escribe el nombre y haz clic en uno de la lista. Si no existe, créalo ahí mismo."
          textoSinResultados="Ningún cliente se parece a eso"
          alCrear={setNuevoCliente}
          textoCrear="Crear cliente"
        />
        <Campo etiqueta="Fecha de entrega" type="date" min={fecha} value={valor.entregaEl} error={errores.entregaEl} ayuda="Opcional." onChange={(e) => alCambiar({ entregaEl: e.target.value })} />
        {miembros.data ? (
          <CampoSelect etiqueta="Responsable" value={valor.responsableId} onChange={(e) => alCambiar({ responsableId: e.target.value })}>
            <option value="">Sin responsable</option>
            {miembros.data.map((m) => (
              <option key={m.personaId} value={m.personaId}>{m.nombre}</option>
            ))}
          </CampoSelect>
        ) : null}
        <div className="sm:col-span-2">
          <CampoTextarea etiqueta="Notas" filas={3} maxLength={4000} value={valor.notas} error={errores.notas} onChange={(e) => alCambiar({ notas: e.target.value })} />
        </div>
      </div>
      <FilasDePedido lineas={valor.lineas} igvPorcentaje={igvPorcentaje} errores={errores.porLinea} error={errores.lineas} alCambiar={(lineas) => alCambiar({ lineas })} />
    </div>
  );
}
