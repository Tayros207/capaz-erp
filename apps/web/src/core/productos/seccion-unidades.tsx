import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Boton } from '../../shared/ui/boton.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import { CampoCantidad } from '../../shared/ui/campo-cantidad.tsx';
import { confirmar } from '../../shared/ui/confirmar.ts';
import { Esqueleto } from '../../shared/ui/esqueleto.tsx';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { notificar } from '../../shared/ui/notificar.ts';
import { formatearCantidad } from '../../shared/formato/milesimas.ts';
import { datosOError } from '../clientes/api.ts';
import { eliminarUnidad, guardarUnidad, listarUnidades } from './api-ampliados.ts';
import { CLAVE_PRODUCTOS } from './claves.ts';

/** Otras unidades en que se compra o se vende el producto, con su equivalencia en la unidad base. */
export function SeccionUnidades({ productoId, unidadBase, puedeEditar }: { productoId: string; unidadBase: string; puedeEditar: boolean }) {
  const consultas = useQueryClient();
  const clave = [...CLAVE_PRODUCTOS, 'unidades', productoId];
  const consulta = useQuery({ queryKey: clave, queryFn: async () => datosOError(await listarUnidades(productoId)).items });
  const [abierto, setAbierto] = useState(false);
  const [unidad, setUnidad] = useState('');
  const [factor, setFactor] = useState<number | null>(null);
  const [paraCompra, setParaCompra] = useState(true);
  const [paraVenta, setParaVenta] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const refrescar = () => consultas.invalidateQueries({ queryKey: clave });

  async function guardar() {
    if (!unidad.trim()) return setError('La unidad es obligatoria.');
    if (!factor || factor <= 0) return setError('La equivalencia debe ser mayor que cero.');
    setError(undefined);
    const r = await guardarUnidad({ productoId, unidad, factorMilesimas: factor, paraCompra, paraVenta });
    if (r.ok && 'datos' in r) {
      notificar('Unidad guardada.', 'exito');
      setAbierto(false);
      setUnidad('');
      setFactor(null);
      await refrescar();
    } else if ('error' in r) setError(r.error.mensaje);
  }

  async function quitar(id: string, nombre: string) {
    if (!(await confirmar('Quitar unidad', `Se quitará la unidad «${nombre}» del producto.`, { textoConfirmar: 'Quitar', peligroso: true }))) return;
    const r = await eliminarUnidad(id);
    if (r.ok) {
      notificar('Unidad quitada.', 'exito');
      await refrescar();
    } else if ('error' in r) notificar(r.error.mensaje, 'error');
  }

  if (consulta.isPending) return <Esqueleto className="h-16" />;
  if (consulta.isError) return <p role="alert" className="text-sm text-peligro">{consulta.error.message}</p>;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-texto-suave">Unidad base: <strong className="text-texto">{unidadBase}</strong></p>
      {consulta.data.length === 0 && !abierto ? <p className="text-sm text-texto-suave">Solo se maneja en la unidad base.</p> : null}
      <ul className="flex flex-col gap-2">
        {consulta.data.map((u) => (
          <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-borde p-3">
            <span className="text-texto">
              1 {u.unidad} = {formatearCantidad(u.factorMilesimas, unidadBase)}{' '}
              {u.paraCompra ? <Insignia tono="neutro">Compra</Insignia> : null} {u.paraVenta ? <Insignia tono="neutro">Venta</Insignia> : null}
            </span>
            {puedeEditar ? <Boton variante="fantasma" onClick={() => void quitar(u.id, u.unidad)}>Quitar</Boton> : null}
          </li>
        ))}
      </ul>
      {abierto ? (
        <div className="grid gap-3 rounded-control border border-borde p-3 sm:grid-cols-2">
          <Campo etiqueta="Unidad (caja, paquete…)" value={unidad} onChange={(e) => setUnidad(e.target.value)} />
          <CampoCantidad etiqueta={`Equivale a (en ${unidadBase})`} valor={factor} alCambiar={setFactor} unidad={unidadBase} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={paraCompra} onChange={(e) => setParaCompra(e.target.checked)} /> Se compra así</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={paraVenta} onChange={(e) => setParaVenta(e.target.checked)} /> Se vende así</label>
          {error ? <p role="alert" className="text-sm font-medium text-peligro sm:col-span-2">{error}</p> : null}
          <div className="flex gap-2 sm:col-span-2">
            <Boton variante="primario" onClick={() => void guardar()}>Guardar unidad</Boton>
            <Boton onClick={() => setAbierto(false)}>Cancelar</Boton>
          </div>
        </div>
      ) : puedeEditar ? (
        <div><Boton onClick={() => { setError(undefined); setAbierto(true); }}>Agregar unidad</Boton></div>
      ) : null}
    </div>
  );
}
