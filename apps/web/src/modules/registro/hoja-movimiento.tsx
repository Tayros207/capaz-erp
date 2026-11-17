import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { formatearSoles, type Aviso, type CuentaDto } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import { CampoMonto } from '../../shared/ui/campo-monto.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import { CampoTextarea } from '../../shared/ui/campo-textarea.tsx';
import { HojaInferior } from '../../shared/ui/hoja-inferior.tsx';
import { SelectorDeRegistro } from '../../shared/ui/selector-de-registro.tsx';
import { buscarContactos, crearDeudaConAdelanto, listarCategorias, registrarMovimiento } from './api.ts';
import { CLAVE_REGISTRO } from './claves.ts';
import {
  argumentosDeAdelanto, argumentosDeMovimiento, categoriasDe, diaEnZona, ETIQUETA_DE_CUENTA, ETIQUETA_DE_MEDIO, faltaCancelar, formularioInicial, mensajeDeRechazo, siguienteFormulario,
  validarMovimiento, type ErroresDeMovimiento, type FormularioDeMovimiento, type MedioDePago, type TipoDeMovimiento,
} from './logica.ts';

type Props = { tipo: TipoDeMovimiento | null; cuentas: readonly CuentaDto[]; alCerrar: () => void };

function Contenido({ tipo, cuentas, alCerrar }: { tipo: TipoDeMovimiento; cuentas: readonly CuentaDto[]; alCerrar: () => void }) {
  const consultas = useQueryClient();
  // El día se fija al abrir la hoja; el servidor decide el día real de la empresa.
  const [hoy] = useState(() => diaEnZona(new Date()));
  const [form, setForm] = useState<FormularioDeMovimiento>(() => formularioInicial(tipo, hoy, cuentas));
  const [errores, setErrores] = useState<ErroresDeMovimiento>({});
  const [fallo, setFallo] = useState<string | undefined>();
  const [hecho, setHecho] = useState<{ codigo: string; avisos: Aviso[] } | undefined>();
  const [guardando, setGuardando] = useState(false);
  const [vuelta, setVuelta] = useState(0);
  const categorias = useQuery({ queryKey: [...CLAVE_REGISTRO, 'categorias'], queryFn: async () => datosOError(await listarCategorias()) });
  const cambiar = (c: Partial<FormularioDeMovimiento>) => setForm((f) => ({ ...f, ...c }));

  async function guardar() {
    const e = validarMovimiento(form, hoy);
    setErrores(e);
    if (Object.keys(e).length > 0) return;
    setGuardando(true);
    setFallo(undefined);
    // Con adelanto nace una deuda (por cobrar o por pagar) y, en el mismo gesto, el movimiento del adelanto.
    const r = form.conAdelanto ? await crearDeudaConAdelanto(argumentosDeAdelanto(form)) : await registrarMovimiento(argumentosDeMovimiento(form));
    setGuardando(false);
    if (r.ok && 'datos' in r) {
      await consultas.invalidateQueries({ queryKey: CLAVE_REGISTRO });
      const d = r.datos;
      setHecho({ codigo: 'deuda' in d ? `${d.deuda.codigo} con adelanto ${d.movimiento.codigo} (falta ${formatearSoles(d.deuda.saldoCentimos)})` : d.codigo, avisos: r.avisos });
      // La hoja queda abierta para el siguiente; la clave reinicia el campo de monto y le devuelve el foco.
      setForm(siguienteFormulario(form));
      setVuelta((v) => v + 1);
    } else if ('error' in r) {
      setHecho(undefined);
      setFallo(mensajeDeRechazo(r.error.codigo, r.error.mensaje));
    }
  }

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(ev) => { ev.preventDefault(); void guardar(); }}>
      {hecho ? (
        <div role="status" className="flex flex-col gap-1 text-sm font-medium">
          <p className="text-exito">Registrado: {hecho.codigo}</p>
          {hecho.avisos.map((a) => <p key={a.codigo} className="text-aviso">{a.mensaje}</p>)}
        </div>
      ) : null}
      <CampoMonto key={vuelta} autoFocus etiqueta="Monto total" valor={form.monto} alCambiar={(monto) => cambiar({ monto })} error={errores.monto} />
      <label className="flex items-center gap-2 text-sm font-medium text-texto">
        <input type="checkbox" checked={form.conAdelanto} onChange={(e) => cambiar({ conAdelanto: e.target.checked })} />
        ¿Hubo adelanto? <span className="font-normal text-texto-suave">El resto queda por {tipo === 'ingreso' ? 'cobrar' : 'pagar'}.</span>
      </label>
      {form.conAdelanto ? (
        <div className="flex flex-col gap-3 rounded-control border border-borde bg-superficie-alta p-3">
          <CampoMonto key={`a${vuelta}`} etiqueta="Adelanto en soles" valor={form.adelanto} alCambiar={(adelanto) => cambiar({ adelanto })} error={errores.adelanto} ayuda={tipo === 'ingreso' ? 'Lo que el cliente dejó hoy.' : 'Lo que le pagaste hoy al proveedor.'} />
          <div className="flex items-baseline justify-between gap-2" aria-live="polite">
            <span className="text-sm text-texto-suave">Falta cancelar</span>
            <span className={`text-lg font-semibold tabular-nums ${faltaCancelar(form) > 0 ? 'text-aviso' : 'text-exito'}`}>{formatearSoles(faltaCancelar(form))}</span>
          </div>
          <Campo etiqueta="Lo esperas para el (opcional)" type="date" min={form.fecha} value={form.venceEn} onChange={(e) => cambiar({ venceEn: e.target.value })} error={errores.venceEn} />
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Fecha" type="date" max={hoy} value={form.fecha} onChange={(e) => cambiar({ fecha: e.target.value })} error={errores.fecha} />
        <CampoSelect etiqueta="Cuenta" value={form.cuentaId} onChange={(e) => cambiar({ cuentaId: e.target.value })} error={errores.cuentaId}>
          {cuentas.filter((c) => c.archivadoEn === null).map((c) => <option key={c.id} value={c.id}>{c.nombre} · {ETIQUETA_DE_CUENTA[c.tipo]}</option>)}
        </CampoSelect>
        <CampoSelect etiqueta={tipo === 'ingreso' ? '¿Qué vendiste?' : '¿En qué gastaste?'} value={form.categoriaId} onChange={(e) => cambiar({ categoriaId: e.target.value })}>
          <option value="">Sin categoría</option>
          {categoriasDe(form.tipo, categorias.data?.items ?? []).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </CampoSelect>
        <CampoSelect etiqueta="Medio de pago" value={form.medioDePago} onChange={(e) => cambiar({ medioDePago: e.target.value as MedioDePago })}>
          {Object.entries(ETIQUETA_DE_MEDIO).map(([valor, texto]) => <option key={valor} value={valor}>{texto}</option>)}
        </CampoSelect>
      </div>
      <SelectorDeRegistro etiqueta={`${tipo === 'ingreso' ? 'Cliente' : 'Proveedor'}${form.conAdelanto ? '' : ' (opcional)'}`} valor={form.contacto} alCambiar={(contacto) => cambiar({ contacto })} buscar={buscarContactos} error={errores.contacto} textoSinResultados="Ningún cliente o proveedor se parece a eso" />
      <CampoTextarea etiqueta="Descripción del trabajo o producto (opcional)" placeholder="Ej: troqueles gráficos, cartulina folcote" filas={2} maxLength={500} value={form.descripcion} onChange={(e) => cambiar({ descripcion: e.target.value })} error={errores.descripcion} />
      {fallo ? <p role="alert" className="text-sm font-medium text-peligro">{fallo}</p> : null}
      <div className="flex justify-end gap-2">
        <Boton variante="fantasma" onClick={alCerrar}>Cerrar</Boton>
        <Boton type="submit" variante="primario" cargando={guardando}>{form.conAdelanto ? 'Registrar con adelanto' : tipo === 'ingreso' ? 'Registrar ingreso' : 'Registrar egreso'}</Boton>
      </div>
    </form>
  );
}

/** Alta de un ingreso o un egreso: el monto primero y con foco; tras guardar queda abierta para el siguiente. */
export function HojaDeMovimiento({ tipo, cuentas, alCerrar }: Props) {
  return (
    <HojaInferior abierto={tipo !== null} alCerrar={alCerrar} titulo={tipo === 'egreso' ? 'Nuevo egreso' : 'Nuevo ingreso'}>
      {tipo ? <Contenido key={tipo} tipo={tipo} cuentas={cuentas} alCerrar={alCerrar} /> : null}
    </HojaInferior>
  );
}
