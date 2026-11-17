import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { DireccionDto } from '@capaz/shared';
import { Boton } from '../../shared/ui/boton.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import { confirmar } from '../../shared/ui/confirmar.ts';
import { Esqueleto } from '../../shared/ui/esqueleto.tsx';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { notificar } from '../../shared/ui/notificar.ts';
import { eliminarDireccion, guardarDireccion, listarDirecciones } from './api-ampliados.ts';
import { datosOError } from './api.ts';
import { CLAVE_CLIENTES } from './claves.ts';

const ETIQUETA_DE_TIPO: Record<DireccionDto['tipo'], string> = { fiscal: 'Fiscal', entrega: 'Entrega', otra: 'Otra' };

type Borrador = { id?: string; tipo: DireccionDto['tipo']; direccion: string; ciudad: string; departamento: string; referencia: string; esPrincipal: boolean };
const NUEVA: Borrador = { tipo: 'entrega', direccion: '', ciudad: '', departamento: '', referencia: '', esPrincipal: false };
const aBorrador = (d: DireccionDto): Borrador => ({ id: d.id, tipo: d.tipo, direccion: d.direccion, ciudad: d.ciudad ?? '', departamento: d.departamento ?? '', referencia: d.referencia ?? '', esPrincipal: d.esPrincipal });

/** Direcciones fiscal, de entrega y otras del cliente o proveedor. */
export function SeccionDirecciones({ clienteId, puedeEditar }: { clienteId: string; puedeEditar: boolean }) {
  const consultas = useQueryClient();
  const clave = [...CLAVE_CLIENTES, 'direcciones', clienteId];
  const consulta = useQuery({ queryKey: clave, queryFn: async () => datosOError(await listarDirecciones(clienteId)).items });
  const [b, setB] = useState<Borrador | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [ocupado, setOcupado] = useState(false);
  const refrescar = () => consultas.invalidateQueries({ queryKey: clave });

  async function guardar() {
    if (!b) return;
    if (!b.direccion.trim()) return setError('La dirección es obligatoria.');
    setOcupado(true);
    setError(undefined);
    const r = await guardarDireccion({ id: b.id, clienteId, tipo: b.tipo, direccion: b.direccion, ciudad: b.ciudad, departamento: b.departamento, referencia: b.referencia, esPrincipal: b.esPrincipal });
    setOcupado(false);
    if (r.ok && 'datos' in r) {
      notificar('Dirección guardada.', 'exito');
      setB(null);
      await refrescar();
    } else if ('error' in r) setError(r.error.mensaje);
  }

  async function quitar(d: DireccionDto) {
    if (!(await confirmar('Quitar dirección', `«${d.direccion}» saldrá de la ficha.`, { textoConfirmar: 'Quitar', peligroso: true }))) return;
    const r = await eliminarDireccion(d.id);
    if (r.ok) {
      notificar('Dirección quitada.', 'exito');
      await refrescar();
    } else if ('error' in r) notificar(r.error.mensaje, 'error');
  }

  if (consulta.isPending) return <Esqueleto className="h-16" />;
  if (consulta.isError) return <p role="alert" className="text-sm text-peligro">{consulta.error.message}</p>;
  return (
    <div className="flex flex-col gap-3">
      {consulta.data.length === 0 && !b ? <p className="text-sm text-texto-suave">Todavía no hay direcciones.</p> : null}
      <ul className="flex flex-col gap-2">
        {consulta.data.map((d) => (
          <li key={d.id} className="flex flex-wrap items-start justify-between gap-2 rounded-control border border-borde p-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="font-medium text-texto"><Insignia tono="neutro">{ETIQUETA_DE_TIPO[d.tipo]}</Insignia> {d.direccion} {d.esPrincipal ? <Insignia tono="exito">Principal</Insignia> : null}</span>
              <span className="break-words text-sm text-texto-suave">{[d.ciudad, d.departamento, d.referencia].filter(Boolean).join(' · ') || 'Sin más datos'}</span>
            </div>
            {puedeEditar ? (
              <div className="flex gap-2">
                <Boton onClick={() => { setError(undefined); setB(aBorrador(d)); }}>Editar</Boton>
                <Boton variante="fantasma" onClick={() => void quitar(d)}>Quitar</Boton>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {b ? (
        <div className="grid gap-3 rounded-control border border-borde p-3 sm:grid-cols-2">
          <CampoSelect etiqueta="Tipo" value={b.tipo} onChange={(e) => setB({ ...b, tipo: e.target.value as Borrador['tipo'] })}>
            {Object.entries(ETIQUETA_DE_TIPO).map(([v, t]) => (
              <option key={v} value={v}>{t}</option>
            ))}
          </CampoSelect>
          <Campo etiqueta="Dirección" required value={b.direccion} onChange={(e) => setB({ ...b, direccion: e.target.value })} />
          <Campo etiqueta="Ciudad" value={b.ciudad} onChange={(e) => setB({ ...b, ciudad: e.target.value })} />
          <Campo etiqueta="Departamento" value={b.departamento} onChange={(e) => setB({ ...b, departamento: e.target.value })} />
          <div className="sm:col-span-2">
            <Campo etiqueta="Referencia" value={b.referencia} onChange={(e) => setB({ ...b, referencia: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={b.esPrincipal} onChange={(e) => setB({ ...b, esPrincipal: e.target.checked })} /> Principal de su tipo</label>
          {error ? <p role="alert" className="text-sm font-medium text-peligro sm:col-span-2">{error}</p> : null}
          <div className="flex gap-2 sm:col-span-2">
            <Boton variante="primario" cargando={ocupado} onClick={() => void guardar()}>Guardar dirección</Boton>
            <Boton onClick={() => setB(null)}>Cancelar</Boton>
          </div>
        </div>
      ) : puedeEditar ? (
        <div><Boton onClick={() => { setError(undefined); setB(NUEVA); }}>Agregar dirección</Boton></div>
      ) : null}
    </div>
  );
}
