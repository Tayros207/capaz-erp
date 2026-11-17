import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { ContactoDto } from '@capaz/shared';
import { Boton } from '../../shared/ui/boton.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import { confirmar } from '../../shared/ui/confirmar.ts';
import { Esqueleto } from '../../shared/ui/esqueleto.tsx';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { notificar } from '../../shared/ui/notificar.ts';
import { eliminarContacto, guardarContacto, listarContactos } from './api-ampliados.ts';
import { datosOError } from './api.ts';
import { CLAVE_CLIENTES } from './claves.ts';

type Borrador = { id?: string; nombre: string; cargo: string; telefono: string; correo: string; esPrincipal: boolean };
const NUEVO: Borrador = { nombre: '', cargo: '', telefono: '', correo: '', esPrincipal: false };
const aBorrador = (c: ContactoDto): Borrador => ({ id: c.id, nombre: c.nombre, cargo: c.cargo ?? '', telefono: c.telefono ?? '', correo: c.correo ?? '', esPrincipal: c.esPrincipal });

/** Personas de contacto del cliente o proveedor, con alta, edición y baja en la misma pantalla. */
export function SeccionContactos({ clienteId, puedeEditar }: { clienteId: string; puedeEditar: boolean }) {
  const consultas = useQueryClient();
  const clave = [...CLAVE_CLIENTES, 'contactos', clienteId];
  const consulta = useQuery({ queryKey: clave, queryFn: async () => datosOError(await listarContactos(clienteId)).items });
  const [b, setB] = useState<Borrador | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [ocupado, setOcupado] = useState(false);
  const refrescar = () => consultas.invalidateQueries({ queryKey: clave });

  async function guardar() {
    if (!b) return;
    if (!b.nombre.trim()) return setError('El nombre es obligatorio.');
    setOcupado(true);
    setError(undefined);
    const r = await guardarContacto({ id: b.id, clienteId, nombre: b.nombre, cargo: b.cargo, telefono: b.telefono, correo: b.correo, esPrincipal: b.esPrincipal });
    setOcupado(false);
    if (r.ok && 'datos' in r) {
      notificar('Contacto guardado.', 'exito');
      setB(null);
      await refrescar();
    } else if ('error' in r) setError(r.error.mensaje);
  }

  async function quitar(c: ContactoDto) {
    if (!(await confirmar('Quitar contacto', `«${c.nombre}» saldrá de la lista de contactos.`, { textoConfirmar: 'Quitar', peligroso: true }))) return;
    const r = await eliminarContacto(c.id);
    if (r.ok) {
      notificar('Contacto quitado.', 'exito');
      await refrescar();
    } else if ('error' in r) notificar(r.error.mensaje, 'error');
  }

  if (consulta.isPending) return <Esqueleto className="h-16" />;
  if (consulta.isError) return <p role="alert" className="text-sm text-peligro">{consulta.error.message}</p>;
  return (
    <div className="flex flex-col gap-3">
      {consulta.data.length === 0 && !b ? <p className="text-sm text-texto-suave">Todavía no hay contactos.</p> : null}
      <ul className="flex flex-col gap-2">
        {consulta.data.map((c) => (
          <li key={c.id} className="flex flex-wrap items-start justify-between gap-2 rounded-control border border-borde p-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="font-medium text-texto">{c.nombre} {c.esPrincipal ? <Insignia tono="exito">Principal</Insignia> : null}</span>
              <span className="break-words text-sm text-texto-suave">{[c.cargo, c.telefono, c.correo].filter(Boolean).join(' · ') || 'Sin más datos'}</span>
            </div>
            {puedeEditar ? (
              <div className="flex gap-2">
                <Boton onClick={() => { setError(undefined); setB(aBorrador(c)); }}>Editar</Boton>
                <Boton variante="fantasma" onClick={() => void quitar(c)}>Quitar</Boton>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {b ? (
        <div className="grid gap-3 rounded-control border border-borde p-3 sm:grid-cols-2">
          <Campo etiqueta="Nombre" required value={b.nombre} onChange={(e) => setB({ ...b, nombre: e.target.value })} />
          <Campo etiqueta="Cargo" value={b.cargo} onChange={(e) => setB({ ...b, cargo: e.target.value })} />
          <Campo etiqueta="Teléfono" type="tel" value={b.telefono} onChange={(e) => setB({ ...b, telefono: e.target.value })} />
          <Campo etiqueta="Correo" type="email" value={b.correo} onChange={(e) => setB({ ...b, correo: e.target.value })} />
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={b.esPrincipal} onChange={(e) => setB({ ...b, esPrincipal: e.target.checked })} /> Contacto principal</label>
          {error ? <p role="alert" className="text-sm font-medium text-peligro sm:col-span-2">{error}</p> : null}
          <div className="flex gap-2 sm:col-span-2">
            <Boton variante="primario" cargando={ocupado} onClick={() => void guardar()}>Guardar contacto</Boton>
            <Boton onClick={() => setB(null)}>Cancelar</Boton>
          </div>
        </div>
      ) : puedeEditar ? (
        <div><Boton onClick={() => { setError(undefined); setB(NUEVO); }}>Agregar contacto</Boton></div>
      ) : null}
    </div>
  );
}
