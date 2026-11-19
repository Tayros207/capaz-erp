import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { formatearSoles, type CuentaDto, type MovimientoDto } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import { CampoMonto } from '../../shared/ui/campo-monto.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import { CampoTextarea } from '../../shared/ui/campo-textarea.tsx';
import { HojaInferior } from '../../shared/ui/hoja-inferior.tsx';
import { SelectorDeRegistro } from '../../shared/ui/selector-de-registro.tsx';
import { buscarContactos, listarCategorias } from './api.ts';
import { CLAVE_REGISTRO } from './claves.ts';
import { categoriasDe, diaEnZona, ETIQUETA_DE_CUENTA, ETIQUETA_DE_MEDIO, type MedioDePago } from './logica.ts';
import { argumentosDeCorreccion, formularioDeCorreccion, validarCorreccion, type ErroresDeCorreccion, type FormularioDeCorreccion } from './logica-correccion.ts';
import type { EntradaDe } from '@capaz/shared';

type Props = {
  abierto: boolean;
  movimiento: MovimientoDto;
  cuentas: readonly CuentaDto[];
  /** Devuelve si se aplicó (la confirmación de dos pasos va dentro): solo entonces se cierra la hoja. */
  alEnviar: (args: EntradaDe<'movimiento_corregir'>) => Promise<boolean>;
  alCerrar: () => void;
};

function Contenido({ movimiento: m, cuentas, alEnviar, alCerrar }: Omit<Props, 'abierto'>) {
  const [hoy] = useState(() => diaEnZona(new Date()));
  const [form, setForm] = useState<FormularioDeCorreccion>(() => formularioDeCorreccion(m));
  const [errores, setErrores] = useState<ErroresDeCorreccion>({});
  const [aviso, setAviso] = useState<string | undefined>();
  const [enviando, setEnviando] = useState(false);
  const categorias = useQuery({ queryKey: [...CLAVE_REGISTRO, 'categorias'], queryFn: async () => datosOError(await listarCategorias()) });
  const cambiar = (c: Partial<FormularioDeCorreccion>) => setForm((f) => ({ ...f, ...c }));

  async function enviar() {
    const e = validarCorreccion(form, hoy);
    setErrores(e);
    if (Object.keys(e).length > 0) return;
    const args = argumentosDeCorreccion(m, form);
    if (!args) {
      setAviso('No cambiaste nada: modifica al menos un dato.');
      return;
    }
    setAviso(undefined);
    setEnviando(true);
    const hecho = await alEnviar(args);
    setEnviando(false);
    if (hecho) alCerrar();
  }

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(ev) => { ev.preventDefault(); void enviar(); }}>
      <p className="text-sm text-texto-suave">
        {m.codigo} · {m.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'} de {formatearSoles(m.montoCentimos)}. Se anula y se registra uno nuevo ya corregido, con otro número; el original queda en la papelera.
      </p>
      <CampoMonto autoFocus etiqueta="Monto" valor={form.monto} alCambiar={(monto) => cambiar({ monto })} error={errores.monto} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Fecha" type="date" max={hoy} value={form.fecha} onChange={(e) => cambiar({ fecha: e.target.value })} error={errores.fecha} />
        <CampoSelect etiqueta="Cuenta" value={form.cuentaId} onChange={(e) => cambiar({ cuentaId: e.target.value })} error={errores.cuentaId}>
          {cuentas.filter((c) => c.archivadoEn === null || c.id === form.cuentaId).map((c) => <option key={c.id} value={c.id}>{c.nombre} · {ETIQUETA_DE_CUENTA[c.tipo]}</option>)}
        </CampoSelect>
        <CampoSelect etiqueta={m.tipo === 'ingreso' ? '¿Qué vendiste?' : '¿En qué gastaste?'} value={form.categoriaId} onChange={(e) => cambiar({ categoriaId: e.target.value })}>
          <option value="">Sin categoría</option>
          {categoriasDe(m.tipo, categorias.data?.items ?? []).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </CampoSelect>
        <CampoSelect etiqueta="Medio de pago" value={form.medioDePago} onChange={(e) => cambiar({ medioDePago: e.target.value as MedioDePago })}>
          {Object.entries(ETIQUETA_DE_MEDIO).map(([valor, texto]) => <option key={valor} value={valor}>{texto}</option>)}
        </CampoSelect>
      </div>
      <SelectorDeRegistro etiqueta={`${m.tipo === 'ingreso' ? 'Cliente' : 'Proveedor'} (opcional)`} valor={form.contacto} alCambiar={(contacto) => cambiar({ contacto })} buscar={buscarContactos} textoSinResultados="Ningún cliente o proveedor se parece a eso" />
      <CampoTextarea etiqueta="Descripción (opcional)" filas={2} maxLength={500} value={form.descripcion} onChange={(e) => cambiar({ descripcion: e.target.value })} error={errores.descripcion} />
      <CampoTextarea etiqueta="Nota de la corrección (opcional)" filas={2} maxLength={300} value={form.motivo} onChange={(e) => cambiar({ motivo: e.target.value })} error={errores.motivo} />
      {aviso ? <p role="alert" className="text-sm font-medium text-aviso">{aviso}</p> : null}
      <div className="flex justify-end gap-2">
        <Boton variante="fantasma" onClick={alCerrar}>Volver</Boton>
        <Boton type="submit" variante="primario" cargando={enviando}>Continuar</Boton>
      </div>
    </form>
  );
}

/** Corrige un movimiento: el formulario parte de lo guardado; el servidor pide confirmar con el detalle de lo que cambia. */
export function HojaDeCorreccion({ abierto, ...resto }: Props) {
  return (
    <HojaInferior abierto={abierto} alCerrar={resto.alCerrar} titulo={`Corregir ${resto.movimiento.codigo}`}>
      {abierto ? <Contenido {...resto} /> : null}
    </HojaInferior>
  );
}
