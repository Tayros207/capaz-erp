import { diasAtras, dniFicticio, nombreDePersona, telefonoFicticio } from './azar.ts';
import { contar, escribible, seccion, type Ctx } from './contexto.ts';

const ESTADOS = ['presente', 'presente', 'presente', 'tardanza', 'falta', 'permiso'] as const;

/** Colaboradores, asistencia de hoy y adelantos de los últimos meses. */
export async function sembrarPersonal(c: Ctx): Promise<void> {
  if (!escribible(c, 'personal')) return;
  await seccion(c, 'personal', async () => {
    if ((await contar(c, 'personal.colaboradores')) > 0) return;
    const colaboradores: any[] = [];
    for (let i = 0; i < c.sec.cargos.length + 2; i++) {
      colaboradores.push(
        await c.s.herramienta('colaborador_crear', {
          nombre: nombreDePersona(c.az),
          documentoTipo: 'dni',
          documentoNumero: dniFicticio(c.az),
          telefono: telefonoFicticio(c.az),
          cargo: c.sec.cargos[i % c.sec.cargos.length],
          fechaIngreso: diasAtras(c.az.int(60, 900)),
          sucursalId: c.az.pick(c.sucursales).id,
        }),
      );
    }
    for (const col of colaboradores) {
      const estado = c.az.pick(ESTADOS);
      await c.s.herramienta('asistencia_marcar', { colaboradorId: col.id, estado, entrada: estado === 'presente' || estado === 'tardanza', salida: false });
    }
    for (const col of c.az.mezclar(colaboradores).slice(0, 5)) {
      await c.s.herramienta('adelanto_registrar', { colaboradorId: col.id, montoCentimos: c.az.int(8, 40) * 1000, fecha: diasAtras(c.az.int(2, 90)), motivo: c.az.pick(['Adelanto de quincena', 'Emergencia familiar', 'Adelanto de sueldo']) });
    }
  });
}

/** Borradores en la bandeja, por la vía real: una regla manual en modo «borrador» que propone movimientos. */
export async function sembrarBorradores(c: Ctx): Promise<void> {
  if (!escribible(c, 'registro')) return;
  await seccion(c, 'bandeja de borradores', async () => {
    if ((await contar(c, 'core.borradores')) > 0) return;
    const propuestas = [
      { nombre: 'Cobro sugerido (demostración)', tipo: 'ingreso', descripcion: c.sec.ingresos[0]! },
      { nombre: 'Gasto sugerido (demostración)', tipo: 'egreso', descripcion: c.sec.egresos[0]! },
      { nombre: 'Cobro por Yape (demostración)', tipo: 'ingreso', descripcion: c.sec.ingresos[1] ?? c.sec.ingresos[0]! },
    ];
    for (const p of propuestas) {
      const regla = await c.s.herramienta('regla_guardar', {
        nombre: p.nombre,
        descripcion: 'Regla manual creada por el sembrador de demostración.',
        disparador: { tipo: 'manual' },
        acciones: [{ herramienta: 'movimiento_registrar', args: { tipo: p.tipo, montoCentimos: c.az.int(20, 400) * 100, descripcion: p.descripcion, medioDePago: 'yape', origen: 'agente' } }],
        modo: 'borrador',
      });
      await c.s.herramienta('regla_activar', { id: regla.id });
      await c.s.herramienta('regla_ejecutar', { id: regla.id, datos: {} });
    }
  });
}
