import { useState } from 'react';
import { Boton } from '../../shared/ui/boton.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import { CampoMonto } from '../../shared/ui/campo-monto.tsx';
import { CampoTextarea } from '../../shared/ui/campo-textarea.tsx';
import { HojaInferior } from '../../shared/ui/hoja-inferior.tsx';
import { SelectorDeRegistro, type Opcion } from '../../shared/ui/selector-de-registro.tsx';
import { buscarClientes, crearOportunidad } from './api.ts';
import { useEscribir } from './acciones.ts';
import { argumentosDeCreacion, formularioVacio, validarOportunidad, type ErroresDeOportunidad } from './logica.ts';

async function opcionesDeCliente(texto: string): Promise<Opcion[]> {
  const r = await buscarClientes(texto);
  return r.ok && 'datos' in r ? r.datos.items.map((c) => ({ id: c.id, nombre: c.nombre })) : [];
}

type Props = { abierto: boolean; alCerrar: () => void; alCrear?: (id: string) => void };

/** Alta tecleada de una oportunidad para un cliente existente. Entra en la primera etapa del embudo. */
export function HojaNuevaOportunidad({ abierto, alCerrar, alCrear }: Props) {
  const escribir = useEscribir();
  const [cliente, setCliente] = useState<Opcion | null>(null);
  const [form, setForm] = useState(formularioVacio);
  const [errores, setErrores] = useState<ErroresDeOportunidad>({});
  const [enviando, setEnviando] = useState(false);
  const cambiar = (c: Partial<typeof form>) => setForm((f) => ({ ...f, ...c }));

  function cerrar() {
    setCliente(null);
    setForm(formularioVacio());
    setErrores({});
    alCerrar();
  }

  async function guardar() {
    const e = validarOportunidad(form, cliente?.id ?? null);
    setErrores(e);
    if (!cliente || Object.keys(e).length > 0) return;
    setEnviando(true);
    const creada = await escribir(crearOportunidad(argumentosDeCreacion(form, cliente.id)), 'Oportunidad creada.');
    setEnviando(false);
    if (!creada) return;
    cerrar();
    alCrear?.(creada.id);
  }

  return (
    <HojaInferior abierto={abierto} alCerrar={cerrar} titulo="Nueva oportunidad">
      <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); void guardar(); }}>
        <SelectorDeRegistro etiqueta="Cliente" valor={cliente} alCambiar={setCliente} buscar={opcionesDeCliente} error={errores.cliente} textoSinResultados="Ningún cliente con ese nombre" />
        <Campo etiqueta="Título" value={form.titulo} onChange={(e) => cambiar({ titulo: e.target.value })} error={errores.titulo} maxLength={160} placeholder="Qué se quiere vender" />
        <CampoMonto etiqueta="Monto estimado" valor={form.montoEstimadoCentimos} alCambiar={(v) => cambiar({ montoEstimadoCentimos: v })} error={errores.montoEstimadoCentimos} />
        <Campo etiqueta="Cierre esperado" type="date" value={form.fechaEsperada} onChange={(e) => cambiar({ fechaEsperada: e.target.value })} />
        <CampoTextarea etiqueta="Notas" value={form.notas} onChange={(e) => cambiar({ notas: e.target.value })} error={errores.notas} filas={3} />
        <Boton variante="primario" type="submit" cargando={enviando}>Crear oportunidad</Boton>
      </form>
    </HojaInferior>
  );
}
