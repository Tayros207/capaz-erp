import { Injectable } from '@nestjs/common';
import { ARGUMENTOS_DE_CONTEXTO, ayudaSchema, CONTRATOS, CONTRATOS_DE_PLATAFORMA } from '@capaz/shared';
import type { HerramientaDePlataformaRegistrada } from './tipos.js';

export class RegistroDePlataformaInvalido extends Error {
  constructor(readonly problemas: readonly string[]) {
    super(`Registro de herramientas de plataforma inválido:\n${problemas.map((p) => `  - ${p}`).join('\n')}`);
    this.name = 'RegistroDePlataformaInvalido';
  }
}

/** Validación pura (sirve para pruebas): contratos, ayuda, confirmación y argumentos reservados. */
export function validarHerramientasDePlataforma(herramientas: readonly HerramientaDePlataformaRegistrada[]): void {
  const nombres = new Set(herramientas.map((h) => h.nombre));
  const problemas: string[] = [];
  for (const h of herramientas) {
    const donde = `La herramienta «${h.nombre}»`;
    if (!(h.nombre in CONTRATOS_DE_PLATAFORMA)) problemas.push(`${donde} no tiene contrato en CONTRATOS_DE_PLATAFORMA.`);
    if (h.nombre in CONTRATOS) problemas.push(`${donde} repite el nombre de una herramienta de empresa.`);
    if (!h.nombre.startsWith('plataforma_')) problemas.push(`${donde} debe llamarse «plataforma_…».`);
    const ayuda = ayudaSchema.safeParse(h.ayuda);
    if (!ayuda.success) problemas.push(`${donde} no tiene una ayuda válida.`);
    if (h.criticidad === 'critica' && h.resumir === null) problemas.push(`${donde} es crítica y debe definir «resumir».`);
    if (h.criticidad !== 'critica' && h.resumir !== null) problemas.push(`${donde} no es crítica: no debe definir «resumir».`);
    for (const otra of h.ayuda.relacionadas) {
      if (otra === h.nombre || !nombres.has(otra)) problemas.push(`${donde} nombra una herramienta que no existe: «${otra}».`);
    }
    const forma = (h.entrada as { shape?: Record<string, unknown> }).shape ?? {};
    for (const k of Object.keys(forma)) {
      if ((ARGUMENTOS_DE_CONTEXTO as readonly string[]).includes(k)) problemas.push(`${donde} pide «${k}» como argumento: está reservado a la sesión.`);
    }
  }
  for (const n of Object.keys(CONTRATOS_DE_PLATAFORMA)) {
    if (!nombres.has(n)) problemas.push(`El contrato «${n}» no tiene herramienta de plataforma registrada.`);
  }
  if (problemas.length) throw new RegistroDePlataformaInvalido(problemas);
}

/** Las herramientas de la consola. Nada de esto se puede llamar por la puerta de las herramientas de empresa. */
@Injectable()
export class RegistroDePlataforma {
  private readonly porNombre = new Map<string, HerramientaDePlataformaRegistrada>();

  agregar(herramientas: readonly HerramientaDePlataformaRegistrada[]): void {
    for (const h of herramientas) {
      if (this.porNombre.has(h.nombre)) throw new Error(`La herramienta de plataforma «${h.nombre}» está repetida.`);
      this.porNombre.set(h.nombre, h);
    }
  }

  obtener(nombre: string): HerramientaDePlataformaRegistrada | undefined {
    return this.porNombre.get(nombre);
  }

  todas(): readonly HerramientaDePlataformaRegistrada[] {
    return [...this.porNombre.values()];
  }

  validar(): void {
    validarHerramientasDePlataforma(this.todas());
  }
}
