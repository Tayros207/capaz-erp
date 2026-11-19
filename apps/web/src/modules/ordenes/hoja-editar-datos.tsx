import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { PedidoDto } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import { CampoTextarea } from '../../shared/ui/campo-textarea.tsx';
import { HojaInferior } from '../../shared/ui/hoja-inferior.tsx';
import { listarMiembros } from './api.ts';
import { MAXIMO_DE_MOTIVO, MAXIMO_DE_NOTAS, cambiosDeFormulario, formularioDeDatosDesde, validarDatos, type ArgumentosDeDatos, type ErroresDeDatos, type FormularioDeDatos } from './datos-de-pedido.ts';

type Props = {
  abierto: boolean;
  pedido: Pick<PedidoDto, 'entregaEl' | 'responsableId' | 'notas' | 'fecha' | 'codigo'>;
  /** Devuelve si se aplicó: solo entonces se cierra la hoja. */
  alEnviar: (args: ArgumentosDeDatos) => Promise<boolean>;
  alCerrar: () => void;
};

function Formulario({ pedido, alEnviar, alCerrar }: Omit<Props, 'abierto'>) {
  const [valor, setValor] = useState<FormularioDeDatos>(() => formularioDeDatosDesde(pedido));
  const [errores, setErrores] = useState<ErroresDeDatos>({});
  const [enviando, setEnviando] = useState(false);
  // La lista de miembros exige su propio permiso: quien no lo tiene simplemente no ve el campo.
  const miembros = useQuery({ queryKey: ['miembros', 'para-responsable'], queryFn: async () => datosOError(await listarMiembros()).miembros, retry: false });
  const cambiar = (c: Partial<FormularioDeDatos>) => setValor((v) => ({ ...v, ...c }));

  async function enviar() {
    if (enviando) return;
    const problemas = validarDatos(pedido, valor);
    const args = cambiosDeFormulario(pedido, valor);
    if (Object.keys(problemas).length > 0) return setErrores(problemas);
    if (!args) return setErrores({ entregaEl: 'No cambiaste ningún dato.' });
    setErrores({});
    setEnviando(true);
    const hecho = await alEnviar(args).catch(() => false);
    setEnviando(false);
    if (hecho) alCerrar();
  }

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(ev) => { ev.preventDefault(); void enviar(); }}>
      <p className="text-sm text-texto-suave">Corrige la entrega, el responsable o las notas de {pedido.codigo}. No cambia los importes. Queda anotado en el historial quién lo hizo, cuándo y qué decía antes.</p>
      <Campo etiqueta="Fecha de entrega" type="date" min={pedido.fecha} value={valor.entregaEl} error={errores.entregaEl} ayuda="Déjala vacía para quitarla." onChange={(e) => cambiar({ entregaEl: e.target.value })} />
      {miembros.data ? (
        <CampoSelect etiqueta="Responsable" value={valor.responsableId} onChange={(e) => cambiar({ responsableId: e.target.value })}>
          <option value="">Sin responsable</option>
          {miembros.data.map((m) => (
            <option key={m.personaId} value={m.personaId}>{m.nombre}</option>
          ))}
        </CampoSelect>
      ) : null}
      <CampoTextarea etiqueta="Notas" filas={3} maxLength={MAXIMO_DE_NOTAS} value={valor.notas} error={errores.notas} onChange={(e) => cambiar({ notas: e.target.value })} />
      <Campo etiqueta="Motivo (opcional)" maxLength={MAXIMO_DE_MOTIVO} value={valor.motivo} error={errores.motivo} ayuda="Una frase corta: queda en el historial." onChange={(e) => cambiar({ motivo: e.target.value })} />
      <div className="flex justify-end gap-2">
        <Boton variante="fantasma" onClick={alCerrar}>Volver</Boton>
        <Boton type="submit" variante="primario" cargando={enviando}>Guardar cambios</Boton>
      </div>
    </form>
  );
}

/** Hoja «Editar datos» de un pedido confirmado: entrega, responsable, notas y un motivo corto. */
export function HojaEditarDatos({ abierto, ...resto }: Props) {
  return (
    <HojaInferior abierto={abierto} alCerrar={resto.alCerrar} titulo="Editar datos del pedido">
      {abierto ? <Formulario {...resto} /> : null}
    </HojaInferior>
  );
}
