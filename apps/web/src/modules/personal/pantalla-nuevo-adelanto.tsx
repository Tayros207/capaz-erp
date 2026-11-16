import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Boton } from '../../shared/ui/boton.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import { CampoMonto } from '../../shared/ui/campo-monto.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import { CampoTextarea } from '../../shared/ui/campo-textarea.tsx';
import { EncabezadoDePagina } from '../../shared/ui/datos/encabezado-de-pagina.tsx';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { resolverAccion, usePermisosDePersonal } from './acciones.ts';
import { cargarActivos, registrarAdelanto } from './api.ts';
import { CLAVE_PERSONAL } from './claves.ts';
import { adelantoInicial, argumentosDeAdelanto, diaEnZona, validarAdelanto, type ErroresDeAdelanto, type FormularioDeAdelanto } from './logica.ts';
import { Cargando } from './marco.tsx';

const MIGAS = [{ texto: 'Adelantos', a: '/m/personal/adelantos' }, { texto: 'Nuevo adelanto' }];

function Formulario({ personas, inicial }: { personas: Array<{ id: string; nombre: string }>; inicial: string }) {
  const navegar = useNavigate();
  const [hoy] = useState(() => diaEnZona(new Date()));
  const [form, setForm] = useState<FormularioDeAdelanto>(() => adelantoInicial(hoy, inicial));
  const [errores, setErrores] = useState<ErroresDeAdelanto>({});
  const [guardando, setGuardando] = useState(false);
  const cambiar = (c: Partial<FormularioDeAdelanto>) => setForm((f) => ({ ...f, ...c }));

  async function guardar() {
    const e = validarAdelanto(form, hoy);
    setErrores(e);
    if (Object.keys(e).length > 0) return;
    setGuardando(true);
    const r = await registrarAdelanto(argumentosDeAdelanto(form));
    setGuardando(false);
    if (await resolverAccion(r, r.ok && 'datos' in r ? `Adelanto registrado: ${r.datos.codigo}.` : '')) void navegar('/m/personal/adelantos');
  }

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(ev) => { ev.preventDefault(); void guardar(); }}>
      <EncabezadoDePagina titulo="Nuevo adelanto" migas={MIGAS} />
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoSelect etiqueta="Colaborador" value={form.colaboradorId} error={errores.colaboradorId} onChange={(e) => cambiar({ colaboradorId: e.target.value })}>
          <option value="">Elige a la persona…</option>
          {personas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </CampoSelect>
        <CampoMonto etiqueta="Monto" valor={form.monto} alCambiar={(monto) => cambiar({ monto })} error={errores.monto} />
        <Campo etiqueta="Fecha" type="date" max={hoy} value={form.fecha} error={errores.fecha} onChange={(e) => cambiar({ fecha: e.target.value })} />
      </div>
      <CampoTextarea etiqueta="Motivo (opcional)" filas={2} maxLength={300} value={form.motivo} error={errores.motivo} onChange={(e) => cambiar({ motivo: e.target.value })} />
      <div className="flex justify-end gap-2">
        <Boton variante="fantasma" onClick={() => void navegar('/m/personal/adelantos')}>Cancelar</Boton>
        <Boton type="submit" variante="primario" cargando={guardando}>Registrar adelanto</Boton>
      </div>
    </form>
  );
}

/** Alta de un adelanto (captura tecleada). Puede llegar con `?colaborador=<id>` desde la ficha. */
export function PantallaNuevoAdelanto() {
  const { adelantos } = usePermisosDePersonal();
  const [params] = useSearchParams();
  const activos = useQuery({ queryKey: [...CLAVE_PERSONAL, 'activos'], queryFn: cargarActivos, enabled: adelantos });
  if (!adelantos) {
    return (
      <div className="flex flex-col gap-4">
        <EncabezadoDePagina titulo="Nuevo adelanto" migas={MIGAS} />
        <EstadoVacio titulo="No puedes registrar adelantos" descripcion="Pide a quien administra tu empresa que te dé acceso completo a Personal." icono="aviso" />
      </div>
    );
  }
  if (activos.isPending) return <Cargando etiqueta="Cargando colaboradores" />;
  if (activos.isError) return <EstadoVacio titulo="No pudimos cargar a los colaboradores" descripcion={activos.error.message} icono="usuario" accion={<Boton onClick={() => void activos.refetch()}>Reintentar</Boton>} />;
  return <Formulario personas={activos.data} inicial={activos.data.some((c) => c.id === params.get('colaborador')) ? (params.get('colaborador') ?? '') : ''} />;
}
