/** Lo que cambió en los precios de lista al volver a cotizar: se queda a la vista en la ficha hasta que se la cierra o se la deja. */
export function AvisoDePrecios({ avisos }: { avisos: readonly string[] }) {
  if (avisos.length === 0) return null;
  return (
    <section role="status" aria-label="Precios actualizados" className="flex flex-col gap-1 rounded-tarjeta border border-aviso/40 bg-aviso/10 p-3 text-sm text-texto">
      <h2 className="font-medium">Los precios de lista se actualizaron</h2>
      <ul className="list-disc pl-5">{avisos.map((a) => <li key={a} className="break-words">{a}</li>)}</ul>
    </section>
  );
}
