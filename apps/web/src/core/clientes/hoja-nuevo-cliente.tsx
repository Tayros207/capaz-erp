import { Boton } from '../../shared/ui/boton.tsx';
import { HojaInferior } from '../../shared/ui/hoja-inferior.tsx';
import type { Opcion } from '../../shared/ui/logica-selector.ts';
import { ListaDeCandidatas } from './candidatas.tsx';
import { FormularioCliente } from './formulario-cliente.tsx';
import { opcionDeCandidata } from './logica-selector-de-cliente.ts';
import { useAltaDeCliente } from './use-alta-de-cliente.ts';

type Props = {
  abierto: boolean;
  alCerrar: () => void;
  alAbrirExistente: (id: string, opcion: Opcion) => void;
  alCrear: (id: string, opcion: Opcion) => void;
  /** Nombre con el que arranca el formulario (por ejemplo, lo que la persona ya tecleó en un buscador). */
  nombreInicial?: string;
  /** Alta rápida: sin correo ni notas. */
  compacto?: boolean;
};

function ContenidoNuevo({ alCerrar, alAbrirExistente, alCrear, nombreInicial, compacto }: Omit<Props, 'abierto'>) {
  const a = useAltaDeCliente(nombreInicial ?? '', alCrear);
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(ev) => {
        ev.preventDefault();
        void a.guardar();
      }}
    >
      <FormularioCliente valor={a.form} errores={a.errores} alCambiar={a.cambiar} compacto={compacto} />
      {a.aviso ? <p role="alert" className="text-sm font-medium text-peligro">{a.aviso}</p> : null}
      <ListaDeCandidatas
        titulo={a.hayConflicto ? 'Ya existe un cliente parecido' : 'Clientes parecidos: ¿es alguno de estos?'}
        candidatas={a.candidatas}
        alElegir={(c) => alAbrirExistente(c.id, opcionDeCandidata(c))}
      />
      <div className="flex justify-end gap-2">
        <Boton variante="fantasma" onClick={alCerrar}>Cancelar</Boton>
        <Boton type="submit" variante="primario" cargando={a.guardando}>Crear cliente</Boton>
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
