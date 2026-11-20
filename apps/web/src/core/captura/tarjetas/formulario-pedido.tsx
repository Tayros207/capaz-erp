import { useEffect } from 'react';
import { CampoTextarea } from '../../../shared/ui/campo-textarea.tsx';
import { Campo } from '../../../shared/ui/campo.tsx';
import { EditorDeLineas } from '../../bandeja/editor-de-lineas.tsx';
import { motivoDePedidoIncompleto } from '../../bandeja/lineas-de-pedido.ts';
import { conCampo, sugerenciaDe, textoDe } from '../logica-tarjeta.ts';
import { SelectorDeContacto } from './selector-de-contacto.tsx';
import type { PropsDeFormulario } from './tipos.ts';

/** `pedido_crear`: cliente, líneas con cantidad y precio, entrega y notas. El adelanto se cobra al confirmar el pedido. */
export function FormularioPedido({ args, sugerencias, alCambiar, alInvalidar, deshabilitado }: PropsDeFormulario) {
  const motivo = motivoDePedidoIncompleto(args);
  useEffect(() => {
    alInvalidar(motivo !== null);
  }, [motivo, alInvalidar]);
  const poner = (clave: string, valor: unknown) => alCambiar(conCampo(args, clave, valor));
  return (
    <fieldset disabled={deshabilitado} className="flex flex-col gap-4">
      <SelectorDeContacto etiqueta="Cliente" contactoId={textoDe(args.clienteId) || null} sugerencia={sugerenciaDe(sugerencias, 'clienteId')} alCambiar={(id) => poner('clienteId', id)} />
      <EditorDeLineas lineasIniciales={args.lineas} alCambiar={(l) => alCambiar(conCampo(args, 'lineas', l))} />
      <Campo etiqueta="Entrega (opcional)" type="date" value={textoDe(args.entregaEl)} onChange={(e) => poner('entregaEl', e.target.value)} />
      <CampoTextarea etiqueta="Notas (opcional)" filas={2} maxLength={4000} value={textoDe(args.notas)} onChange={(e) => poner('notas', e.target.value)} />
      {motivo ? <p role="status" className="text-sm font-medium text-aviso">{motivo}</p> : null}
    </fieldset>
  );
}
