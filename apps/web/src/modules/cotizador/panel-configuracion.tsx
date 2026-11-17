import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { ConfiguracionDeCotizadorDto } from '@capaz/shared';
import { REDONDEOS_COMERCIALES } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import { CampoTextarea } from '../../shared/ui/campo-textarea.tsx';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { Esqueleto } from '../../shared/ui/esqueleto.tsx';
import { resolverAccion } from './acciones.ts';
import { configurarCotizador, iniciarCotizador, verConfiguracion } from './api.ts';
import { CLAVE_COTIZADOR } from './claves.ts';
import { argumentosDeConfiguracion, formularioDeConfiguracion, validarConfiguracion, type ErroresDeConfiguracion, type FormularioDeConfiguracion } from './logica.ts';

const ETIQUETA_DE_REDONDEO: Record<(typeof REDONDEOS_COMERCIALES)[number], string> = {
  ninguno: 'Sin redondeo', '1': 'Hacia arriba, de sol en sol', '5': 'Hacia arriba, de 5 en 5 soles', '10': 'Hacia arriba, de 10 en 10 soles',
};

function Formulario({ config, puedeConfigurar }: { config: ConfiguracionDeCotizadorDto; puedeConfigurar: boolean }) {
  const [f, setF] = useState<FormularioDeConfiguracion>(() => formularioDeConfiguracion(config));
  const [errores, setErrores] = useState<ErroresDeConfiguracion>({});
  const [guardando, setGuardando] = useState(false);
  const poner = <K extends keyof FormularioDeConfiguracion>(k: K, v: FormularioDeConfiguracion[K]) => setF((a) => ({ ...a, [k]: v }));
  const bloqueado = !puedeConfigurar;

  async function guardar() {
    const e = validarConfiguracion(f);
    setErrores(e);
    if (Object.keys(e).length > 0) return;
    setGuardando(true);
    await resolverAccion(configurarCotizador(argumentosDeConfiguracion(f)), 'Ajustes guardados.');
    setGuardando(false);
  }

  return (
    <form noValidate className="flex flex-col gap-6" onSubmit={(ev) => { ev.preventDefault(); void guardar(); }}>
      <fieldset disabled={bloqueado} className="flex flex-col gap-4">
        <legend className="mb-2 font-titulo text-lg font-semibold text-texto">Cómo se cotiza</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Utilidad (%)" inputMode="decimal" value={f.utilidadPct} error={errores.utilidadPct} onChange={(e) => poner('utilidadPct', e.target.value)} />
          <CampoSelect etiqueta="La utilidad se calcula sobre" value={f.utilidadBase} onChange={(e) => poner('utilidadBase', e.target.value as FormularioDeConfiguracion['utilidadBase'])}>
            <option value="venta">El precio de venta</option>
            <option value="costo">El costo</option>
          </CampoSelect>
          <Campo etiqueta="Margen bueno (%)" inputMode="decimal" value={f.umbralVerdePct} error={errores.umbralVerdePct} ayuda="Desde aquí el margen se ve bien." onChange={(e) => poner('umbralVerdePct', e.target.value)} />
          <Campo etiqueta="Margen mínimo (%)" inputMode="decimal" value={f.umbralMinimoPct} error={errores.umbralMinimoPct} ayuda="Por debajo se pide una razón al emitir." onChange={(e) => poner('umbralMinimoPct', e.target.value)} />
          <CampoSelect etiqueta="Redondeo del precio" value={f.redondeoComercial} onChange={(e) => poner('redondeoComercial', e.target.value as FormularioDeConfiguracion['redondeoComercial'])}>
            {REDONDEOS_COMERCIALES.map((r) => <option key={r} value={r}>{ETIQUETA_DE_REDONDEO[r]}</option>)}
          </CampoSelect>
          <CampoSelect etiqueta="IGV" value={String(f.igvPorcentaje)} onChange={(e) => poner('igvPorcentaje', e.target.value === '0' ? 0 : 18)}>
            <option value="18">18 %</option>
            <option value="0">Sin IGV</option>
          </CampoSelect>
        </div>
      </fieldset>
      <fieldset disabled={bloqueado} className="flex flex-col gap-4">
        <legend className="mb-2 font-titulo text-lg font-semibold text-texto">Condiciones de la cotización</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Días de validez" inputMode="numeric" value={f.validezDias} error={errores.validezDias} ayuda="De 1 a 365; vacío si no quieres plazo." onChange={(e) => poner('validezDias', e.target.value)} />
          <Campo etiqueta="Plazo de entrega" maxLength={300} value={f.plazoEntrega} onChange={(e) => poner('plazoEntrega', e.target.value)} />
          <Campo etiqueta="Forma de pago" maxLength={300} value={f.formaPago} onChange={(e) => poner('formaPago', e.target.value)} />
          <Campo etiqueta="Tolerancia" maxLength={300} value={f.tolerancia} onChange={(e) => poner('tolerancia', e.target.value)} />
        </div>
        <Campo etiqueta="Lo que no incluye" maxLength={300} value={f.noIncluye} onChange={(e) => poner('noIncluye', e.target.value)} />
        <CampoTextarea etiqueta="Mensaje de WhatsApp" filas={3} maxLength={500} value={f.mensajeWhatsapp} ayuda="Si lo dejas vacío, se usa un mensaje por defecto." onChange={(e) => poner('mensajeWhatsapp', e.target.value)} />
      </fieldset>
      {puedeConfigurar ? <div className="flex justify-end"><Boton type="submit" variante="primario" cargando={guardando}>Guardar ajustes</Boton></div> : <p className="text-sm text-texto-suave">Solo quien administra los precios puede cambiar estas reglas.</p>}
    </form>
  );
}

/** Reglas generales del Cotizador (utilidad, márgenes, redondeo, IGV y condiciones). */
export function PanelDeConfiguracion({ puedeConfigurar, puedePreparar }: { puedeConfigurar: boolean; puedePreparar: boolean }) {
  const consulta = useQuery({ queryKey: [...CLAVE_COTIZADOR, 'configuracion'], queryFn: async () => datosOError(await verConfiguracion()) });
  if (consulta.isPending) return <div aria-busy="true" aria-label="Cargando ajustes" className="flex flex-col gap-2"><Esqueleto className="h-12" /><Esqueleto className="h-12" /></div>;
  if (consulta.isError) return <EstadoVacio titulo="No pudimos cargar los ajustes" descripcion={consulta.error.message} icono="caja" accion={<Boton onClick={() => void consulta.refetch()}>Reintentar</Boton>} />;
  const sinPreparar = consulta.data.actualizadoEn === null;
  return (
    <div className="flex flex-col gap-4">
      {sinPreparar ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-tarjeta border border-borde bg-superficie p-4">
          <p className="text-texto">Todavía usas los valores por defecto. Prepara el Cotizador para guardar los tuyos.</p>
          {puedePreparar ? <Boton variante="secundario" onClick={() => void resolverAccion(iniciarCotizador(), 'Cotizador preparado.')}>Preparar el Cotizador</Boton> : null}
        </div>
      ) : null}
      <Formulario key={consulta.data.actualizadoEn ?? 'defecto'} config={consulta.data} puedeConfigurar={puedeConfigurar} />
    </div>
  );
}
