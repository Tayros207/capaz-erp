import { Link } from 'react-router';
import { menuDesdeYo, type ItemDeMenu } from '../../app/carcasa/menu.ts';
import { IconoMenu } from '../../app/carcasa/iconos-menu.tsx';
import { TONO_DE_ESTADO } from '../../app/carcasa/lista-de-menu.tsx';
import { solicitarModulo } from '../../app/carcasa/solicitar.ts';
import { useYo } from '../../shared/sesion/use-yo.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { unir } from '../../shared/ui/unir.ts';
import { Pendientes } from './pendientes.tsx';

const COLOR_ACENTO: Record<string, string> = {
  esmeralda: 'bg-acento-esmeralda', cian: 'bg-acento-cian', ambar: 'bg-acento-ambar', rosa: 'bg-acento-rosa', gris: 'bg-acento-gris',
};

function Tarjeta({ item }: { item: ItemDeMenu }) {
  const bloqueado = item.ruta === null;
  const cuerpo = (
    <>
      <span className={unir('grid size-11 shrink-0 place-items-center rounded-tarjeta text-texto-inverso shadow-tarjeta', COLOR_ACENTO[item.acento] ?? 'bg-acento-gris', bloqueado && 'opacity-50')}>
        <IconoMenu nombre={bloqueado ? 'candado' : item.icono} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-texto">{item.nombre}</span>
          {item.etiqueta ? <Insignia tono={TONO_DE_ESTADO[item.estado]}>{item.etiqueta}</Insignia> : null}
        </span>
        <span className="text-sm text-texto-suave">{item.nota || item.descripcion}</span>
      </span>
    </>
  );
  const base = 'group flex items-start gap-3 rounded-tarjeta border border-borde bg-superficie p-4 shadow-tarjeta transition duration-150';
  if (!bloqueado) return <Link to={item.ruta!} className={unir(base, 'hover:-translate-y-0.5 hover:border-borde-fuerte hover:shadow-elevada')}>{cuerpo}</Link>;
  return (
    <div className={base}>
      {cuerpo}
      {item.accion ? (
        <Boton variante="secundario" onClick={() => void solicitarModulo(item.accion!.codigo, item.nombre)}>Solicitar</Boton>
      ) : null}
    </div>
  );
}

/** `/inicio`: saludo y las mismas familias del menú, como tarjetas con el estado de cada módulo. */
export function PantallaInicio() {
  const yo = useYo();
  if (!yo?.empresa) return null;
  const menu = menuDesdeYo(yo);
  const primerNombre = yo.usuario.nombre.trim().split(/\s+/)[0] ?? '';
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header>
        <p className="text-sm font-medium tracking-wide text-texto-suave uppercase">{yo.empresa.nombre}</p>
        <h1 className="font-titulo text-3xl font-semibold text-texto">Hola, {primerNombre}</h1>
      </header>
      <Pendientes yo={yo} />
      {menu.familias.map((f) => (
        <section key={f.familia} aria-labelledby={`fam-${f.familia}`} className="flex flex-col gap-2">
          <h2 id={`fam-${f.familia}`} className="font-titulo text-sm font-semibold tracking-wide text-texto-suave uppercase">{f.nombre}</h2>
          {f.items.length === 0 ? (
            <p className="rounded-tarjeta border border-dashed border-borde-fuerte p-3 text-sm text-texto-suave">Sin módulos disponibles todavía.</p>
          ) : (
            <ul className="grid list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-3">
              {f.items.map((i) => <li key={i.clave} className="flex *:flex-1"><Tarjeta item={i} /></li>)}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
