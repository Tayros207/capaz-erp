import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { TarifaDelTallerDto } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { Campo } from '../../shared/ui/campo.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import { CampoUnidad } from '../../shared/ui/campo-unidad.tsx';
import { HojaInferior } from '../../shared/ui/hoja-inferior.tsx';
import { crearTarifa, editarTarifa, listarFormatos } from './api-taller.ts';
import { CLAVE_COTIZADOR } from './claves.ts';
import { ESCALAS, FACTORES, TARIFA_VACIA, argumentosDeCreacionDeTarifa, argumentosDeEdicionDeTarifa, formularioDeTarifa, medidasDe, validarTarifa, type ErroresDeTarifa, type Escala, type Factor, type FormularioDeTarifa } from './logica-taller.ts';
import { guardarEnTaller } from './taller-guardar.ts';
import { PieDeHoja } from './taller-hoja-pie.tsx';

type Props = { abierto: boolean; tarifa: TarifaDelTallerDto | null; alCerrar: () => void };

function SelectorDeFormato({ valor, alCambiar }: { valor: string; alCambiar: (id: string) => void }) {
  const formatos = useQuery({ queryKey: [...CLAVE_COTIZADOR, 'taller', 'formatos-para-tarifa'], queryFn: async () => datosOError(await listarFormatos({ estado: 'activas' })) });
  return (
    <CampoSelect etiqueta="Formato de pliego (opcional)" value={valor} onChange={(e) => alCambiar(e.target.value)} ayuda="Si la tarifa es de un papel de una medida concreta, elígela aquí.">
      <option value="">Ninguno</option>
      {(formatos.data?.items ?? []).map((f) => <option key={f.id} value={f.id}>{f.nombre} ({medidasDe(f.anchoCm, f.altoCm)})</option>)}
    </CampoSelect>
  );
}

function Contenido({ tarifa, alCerrar }: { tarifa: TarifaDelTallerDto | null; alCerrar: () => void }) {
  const [f, setF] = useState<FormularioDeTarifa>(() => (tarifa ? formularioDeTarifa(tarifa) : TARIFA_VACIA));
  const [errores, setErrores] = useState<ErroresDeTarifa>({});
  const [guardando, setGuardando] = useState(false);
  const poner = <K extends keyof FormularioDeTarifa>(k: K, v: FormularioDeTarifa[K]) => setF((a) => ({ ...a, [k]: v }));

  async function guardar() {
    const cerrar = await guardarEnTaller(
      { formulario: f, original: tarifa, validar: validarTarifa, alErrores: setErrores, armarCreacion: argumentosDeCreacionDeTarifa, armarEdicion: argumentosDeEdicionDeTarifa, crear: crearTarifa, editar: editarTarifa, mensajes: { creado: 'Tarifa creada.', editado: 'Tarifa actualizada.' } },
      () => setGuardando(true),
      () => setGuardando(false),
    );
    if (cerrar) alCerrar();
  }

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(ev) => { ev.preventDefault(); ev.stopPropagation(); void guardar(); }}>
      <CampoSelect etiqueta="Factor" value={f.factor} onChange={(e) => poner('factor', e.target.value as Factor)}>
        {FACTORES.map((x) => <option key={x.valor} value={x.valor}>{x.etiqueta}</option>)}
      </CampoSelect>
      <Campo etiqueta="Nombre" autoFocus maxLength={120} value={f.nombre} error={errores.nombre} onChange={(e) => poner('nombre', e.target.value)} />
      <CampoUnidad valor={f.unidad} error={errores.unidad} alCambiar={(u) => poner('unidad', u)} />
      <Campo etiqueta="Costo por unidad" inputMode="decimal" autoComplete="off" value={f.costoUnitario} error={errores.costoUnitario} ayuda="Escribe el costo como lo pagas, hasta 4 decimales (0.45)." onChange={(e) => poner('costoUnitario', e.target.value)} />
      <CampoSelect etiqueta="Cómo cambia con la cantidad" value={f.escalaPorDefecto} onChange={(e) => poner('escalaPorDefecto', e.target.value as Escala)}>
        {ESCALAS.map((x) => <option key={x.valor} value={x.valor}>{x.etiqueta}</option>)}
      </CampoSelect>
      <SelectorDeFormato valor={f.formatoId} alCambiar={(id) => poner('formatoId', id)} />
      <PieDeHoja alCerrar={alCerrar} guardando={guardando} etiqueta={tarifa ? 'Guardar cambios' : 'Crear tarifa'} />
    </form>
  );
}

/** Alta o edición de una tarifa. Cambiar el costo pide confirmar (lo hace el servidor con su resumen). */
export function HojaDeTarifa({ abierto, tarifa, alCerrar }: Props) {
  return (
    <HojaInferior abierto={abierto} alCerrar={alCerrar} titulo={tarifa ? 'Editar tarifa' : 'Nueva tarifa'}>
      {abierto ? <Contenido key={tarifa?.id ?? 'nueva'} tarifa={tarifa} alCerrar={alCerrar} /> : null}
    </HojaInferior>
  );
}
