import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { Candidata } from '@capaz/shared';
import { notificar } from '../../shared/ui/notificar.ts';
import type { Opcion } from '../../shared/ui/logica-selector.ts';
import { buscarClientes, crearCliente, datosOError } from './api.ts';
import { CLAVE_CLIENTES } from './claves.ts';
import { argumentosDeCreacion, FORMULARIO_VACIO, mensajeDeRechazo, validarCliente, type ErroresDeCliente, type FormularioDeCliente } from './logica.ts';
import { opcionDeCliente } from './logica-selector-de-cliente.ts';
import { useRetardo } from './use-retardo.ts';

/** Aviso temprano: mientras se escribe el nombre se buscan clientes parecidos. */
function useParecidos(nombreEscrito: string): Candidata[] {
  const nombre = useRetardo(nombreEscrito.trim(), 350);
  const parecidos = useQuery({
    queryKey: [...CLAVE_CLIENTES, 'parecidos', nombre],
    queryFn: async () => datosOError(await buscarClientes(nombre, 5)),
    enabled: nombre.length >= 3,
  });
  return (parecidos.data?.items ?? [])
    .filter((c) => c.archivadoEn === null)
    .map((c) => ({ id: c.id, nombre: c.nombre, detalle: c.documentoNumero ?? c.telefono ?? undefined }));
}

/** Estado y acciones del alta de un cliente: formulario, errores, parecidos y guardado. */
export function useAltaDeCliente(nombreInicial: string, alCrear: (id: string, opcion: Opcion) => void) {
  const consultas = useQueryClient();
  const [form, setForm] = useState<FormularioDeCliente>({ ...FORMULARIO_VACIO, nombre: nombreInicial });
  const [errores, setErrores] = useState<ErroresDeCliente>({});
  const [aviso, setAviso] = useState<string | undefined>();
  const [conflicto, setConflicto] = useState<Candidata[]>([]);
  const [guardando, setGuardando] = useState(false);
  const tempranas = useParecidos(form.nombre);

  function cambiar(c: Partial<FormularioDeCliente>) {
    setForm((f) => ({ ...f, ...c }));
    if (conflicto.length > 0 && c.nombre !== undefined) setConflicto([]);
  }

  async function guardar() {
    const e = validarCliente(form);
    setErrores(e);
    if (Object.keys(e).length > 0) return;
    setGuardando(true);
    setAviso(undefined);
    const r = await crearCliente(argumentosDeCreacion(form));
    setGuardando(false);
    if (r.ok && 'datos' in r) {
      void consultas.invalidateQueries({ queryKey: CLAVE_CLIENTES }); // sin esperar: no frena la hoja
      notificar(`Cliente «${r.datos.nombre}» creado.`, 'exito');
      alCrear(r.datos.id, opcionDeCliente(r.datos));
      return;
    }
    if ('error' in r) {
      setConflicto(r.error.candidatas ?? []);
      setAviso(mensajeDeRechazo(r.error.codigo, r.error.mensaje));
    }
  }

  return { form, errores, aviso, guardando, cambiar, guardar, candidatas: conflicto.length > 0 ? conflicto : tempranas, hayConflicto: conflicto.length > 0 };
}
