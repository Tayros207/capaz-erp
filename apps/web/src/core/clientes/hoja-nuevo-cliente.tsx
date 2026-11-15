import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { Candidata } from '@capaz/shared';
import { Boton } from '../../shared/ui/boton.tsx';
import { HojaInferior } from '../../shared/ui/hoja-inferior.tsx';
import { notificar } from '../../shared/ui/notificar.ts';
import { buscarClientes, crearCliente, datosOError } from './api.ts';
import { ListaDeCandidatas } from './candidatas.tsx';
import { CLAVE_CLIENTES } from './claves.ts';
import { FormularioCliente } from './formulario-cliente.tsx';
import { argumentosDeCreacion, FORMULARIO_VACIO, mensajeDeRechazo, validarCliente, type ErroresDeCliente, type FormularioDeCliente } from './logica.ts';
import { useRetardo } from './use-retardo.ts';

type Props = { abierto: boolean; alCerrar: () => void; alAbrirExistente: (id: string) => void; alCrear: (id: string) => void };

function ContenidoNuevo({ alCerrar, alAbrirExistente, alCrear }: Omit<Props, 'abierto'>) {
  const consultas = useQueryClient();
  const [form, setForm] = useState<FormularioDeCliente>(FORMULARIO_VACIO);
  const [errores, setErrores] = useState<ErroresDeCliente>({});
  const [aviso, setAviso] = useState<string | undefined>();
  const [conflicto, setConflicto] = useState<Candidata[]>([]);
  const [guardando, setGuardando] = useState(false);

  // Aviso temprano: mientras se escribe el nombre se buscan clientes parecidos.
  const nombre = useRetardo(form.nombre.trim(), 350);
  const parecidos = useQuery({
    queryKey: [...CLAVE_CLIENTES, 'parecidos', nombre],
    queryFn: async () => datosOError(await buscarClientes(nombre, 5)),
    enabled: nombre.length >= 3,
  });
  const candidatasTempranas: Candidata[] = (parecidos.data?.items ?? [])
    .filter((c) => c.archivadoEn === null)
    .map((c) => ({ id: c.id, nombre: c.nombre, detalle: c.documentoNumero ?? c.telefono ?? undefined }));

  async function guardar() {
    const e = validarCliente(form);
    setErrores(e);
    if (Object.keys(e).length > 0) return;
    setGuardando(true);
    setAviso(undefined);
    const r = await crearCliente(argumentosDeCreacion(form));
    setGuardando(false);
    if (r.ok && 'datos' in r) {
      await consultas.invalidateQueries({ queryKey: CLAVE_CLIENTES });
      notificar('Cliente creado.', 'exito');
      alCrear(r.datos.id);
      return;
    }
    if ('error' in r) {
      setConflicto(r.error.candidatas ?? []);
      setAviso(mensajeDeRechazo(r.error.codigo, r.error.mensaje));
    }
  }

  const candidatas = conflicto.length > 0 ? conflicto : candidatasTempranas;
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(ev) => {
        ev.preventDefault();
        void guardar();
      }}
    >
      <FormularioCliente
        valor={form}
        errores={errores}
        alCambiar={(c) => {
          setForm((f) => ({ ...f, ...c }));
          if (conflicto.length > 0 && c.nombre !== undefined) setConflicto([]);
        }}
      />
      {aviso ? <p role="alert" className="text-sm font-medium text-peligro">{aviso}</p> : null}
      <ListaDeCandidatas
        titulo={conflicto.length > 0 ? 'Ya existe un cliente parecido' : 'Clientes parecidos: ¿es alguno de estos?'}
        candidatas={candidatas}
        alElegir={(c) => alAbrirExistente(c.id)}
      />
      <div className="flex justify-end gap-2">
        <Boton variante="fantasma" onClick={alCerrar}>Cancelar</Boton>
        <Boton type="submit" variante="primario" cargando={guardando}>Crear cliente</Boton>
      </div>
    </form>
  );
}

/** Alta de cliente: hoja inferior que sube desde abajo en el móvil. El formulario se reinicia al cerrar. */
export function HojaNuevoCliente({ abierto, ...resto }: Props) {
  return (
    <HojaInferior abierto={abierto} alCerrar={resto.alCerrar} titulo="Nuevo cliente">
      {abierto ? <ContenidoNuevo {...resto} /> : null}
    </HojaInferior>
  );
}
