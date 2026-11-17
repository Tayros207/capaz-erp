import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { SugerenciaDeCaptura } from '@capaz/shared';
import { datosOError } from '../../../shared/api/consultas.ts';
import { Boton } from '../../../shared/ui/boton.tsx';
import { SelectorDeRegistro, type Opcion } from '../../../shared/ui/selector-de-registro.tsx';
import { buscarContactos, CLAVE_CAPTURA, crearCliente, verCliente } from '../api.ts';

type Props = {
  etiqueta: string;
  contactoId: string | null;
  sugerencia: SugerenciaDeCaptura | undefined;
  alCambiar: (id: string | null) => void;
};

/** Contacto del borrador por su nombre: elige entre las opciones que halló el intérprete, busca, o crea el cliente. */
export function SelectorDeContacto({ etiqueta, contactoId, sugerencia, alCambiar }: Props) {
  const [elegido, setElegido] = useState<Opcion | null>(null);
  const [fallo, setFallo] = useState<string | undefined>();
  const ficha = useQuery({
    queryKey: [...CLAVE_CAPTURA, 'cliente', contactoId],
    queryFn: async () => datosOError(await verCliente(contactoId ?? '')),
    enabled: contactoId !== null && elegido?.id !== contactoId,
    staleTime: 60_000,
  });
  const valor: Opcion | null = contactoId === null ? null : elegido?.id === contactoId ? elegido : { id: contactoId, nombre: ficha.data?.nombre ?? 'Cargando…' };
  const opciones = sugerencia?.opciones ?? [];
  const puedeCrear = opciones.length === 0;

  const elegir = (o: Opcion | null) => {
    setElegido(o);
    setFallo(undefined);
    alCambiar(o?.id ?? null);
  };

  async function crear(nombre: string) {
    const r = await crearCliente(nombre);
    if (r.ok && 'datos' in r) elegir({ id: r.datos.id, nombre: r.datos.nombre });
    else if ('error' in r) setFallo(r.error.mensaje);
  }

  return (
    <div className="flex flex-col gap-2">
      {valor === null && opciones.length > 0 ? (
        <div className="flex flex-col gap-2" role="group" aria-label={`Opciones para «${sugerencia?.texto ?? ''}»`}>
          <p className="text-sm text-texto-suave">No estoy seguro de quién es «{sugerencia?.texto}». Elige uno:</p>
          <div className="flex flex-wrap gap-2">
            {opciones.map((o) => (
              <Boton key={o.id} onClick={() => elegir({ id: o.id, nombre: o.nombre, detalle: o.detalle })}>{o.nombre}</Boton>
            ))}
          </div>
        </div>
      ) : null}
      <SelectorDeRegistro
        etiqueta={etiqueta}
        valor={valor}
        alCambiar={elegir}
        buscar={buscarContactos}
        error={fallo}
        textoSinResultados="Ningún cliente se parece a eso"
        alCrear={puedeCrear ? (texto) => void crear(texto) : undefined}
        textoCrear="Crear cliente"
      />
    </div>
  );
}
