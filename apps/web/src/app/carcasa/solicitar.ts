import { notificar } from '../../shared/ui/notificar.ts';

// «Solicitar» un módulo no contratado. La herramienta `modulo_solicitar` llega a la pantalla con W5
// (`shared/api/herramientas.ts`, aún no integrado). Mientras tanto todo pasa por esta función: cuando
// W5 exista, solo cambia su cuerpo para llamar a la herramienta; el menú y las tarjetas no se tocan.
export async function solicitarModulo(_codigo: string, nombre: string): Promise<void> {
  notificar(`Pronto podrás solicitar «${nombre}» desde aquí. Por ahora, pídelo a tu administrador.`, 'info');
}
