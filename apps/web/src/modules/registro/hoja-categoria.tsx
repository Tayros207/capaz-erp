import { useState } from 'react';
import type { CategoriaDto } from '@capaz/shared';
import { Boton } from '../../shared/ui/boton.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import { HojaInferior } from '../../shared/ui/hoja-inferior.tsx';
import { crearCategoria, editarCategoria } from './api.ts';
import { resolverAccion } from './acciones.ts';
import { ETIQUETA_DE_TIPO, validarNombre, type TipoDeMovimiento } from './logica.ts';

type Props = { abierto: boolean; categoria: CategoriaDto | null; alCerrar: () => void };

function Contenido({ categoria, alCerrar }: { categoria: CategoriaDto | null; alCerrar: () => void }) {
  const [nombre, setNombre] = useState(categoria?.nombre ?? '');
  const [tipo, setTipo] = useState<TipoDeMovimiento>(categoria?.tipo ?? 'egreso');
  const [error, setError] = useState<string | undefined>();
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    const e = validarNombre(nombre);
    setError(e);
    if (e) return;
    setGuardando(true);
    const r = categoria ? await editarCategoria(categoria.id, nombre.trim()) : await crearCategoria({ nombre: nombre.trim(), tipo });
    setGuardando(false);
    if (await resolverAccion(r, categoria ? 'Categoría actualizada.' : 'Categoría creada.')) alCerrar();
  }

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(ev) => { ev.preventDefault(); void guardar(); }}>
      <Campo etiqueta="Nombre" autoFocus maxLength={80} value={nombre} onChange={(e) => setNombre(e.target.value)} error={error} />
      {categoria ? null : (
        <CampoSelect etiqueta="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoDeMovimiento)}>
          {Object.entries(ETIQUETA_DE_TIPO).map(([valor, texto]) => <option key={valor} value={valor}>{texto}</option>)}
        </CampoSelect>
      )}
      <div className="flex justify-end gap-2">
        <Boton variante="fantasma" onClick={alCerrar}>Cerrar</Boton>
        <Boton type="submit" variante="primario" cargando={guardando}>{categoria ? 'Guardar cambios' : 'Crear categoría'}</Boton>
      </div>
    </form>
  );
}

/** Alta o renombrado de una categoría; el tipo no cambia una vez creada. */
export function HojaDeCategoria({ abierto, categoria, alCerrar }: Props) {
  return (
    <HojaInferior abierto={abierto} alCerrar={alCerrar} titulo={categoria ? 'Editar categoría' : 'Nueva categoría'}>
      {abierto ? <Contenido key={categoria?.id ?? 'nueva'} categoria={categoria} alCerrar={alCerrar} /> : null}
    </HojaInferior>
  );
}
