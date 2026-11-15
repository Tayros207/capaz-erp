import {
  Inject,
  Injectable,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import {
  ARGUMENTOS_DE_CONTEXTO,
  ayudaSchema,
  CONTRATOS,
  CONTRATOS_DE_PLATAFORMA,
  type ContratoDeHerramienta,
  type ManifiestoDeModulo,
} from '@capaz/shared';
import { CatalogoDeModulos } from '../modulos/catalogo.js';
import type { HerramientaRegistrada } from './tipos.js';

const NOMBRE_VALIDO = /^[a-z][a-z0-9_]*$/;

export class RegistroInvalido extends Error {
  constructor(readonly problemas: readonly string[]) {
    super(
      `Registro de herramientas inválido:\n${problemas.map((p) => `  - ${p}`).join('\n')}`,
    );
    this.name = 'RegistroInvalido';
  }
}

type Fuentes = {
  contratos: Readonly<Record<string, ContratoDeHerramienta>>;
  manifiestos: readonly Pick<ManifiestoDeModulo, 'codigo' | 'permisos'>[];
};

function problemasDe(
  h: HerramientaRegistrada,
  nombres: ReadonlySet<string>,
  f: Fuentes,
): string[] {
  const donde = `La herramienta «${h.nombre}»`;
  const p: string[] = [];
  if (!NOMBRE_VALIDO.test(h.nombre))
    p.push(
      `${donde} tiene un nombre inválido: usa minúsculas, números y guion bajo.`,
    );
  if (!f.contratos[h.nombre])
    p.push(`${donde} no tiene contrato en @capaz/shared.`);
  const ayuda = ayudaSchema.safeParse(h.ayuda);
  if (!ayuda.success) {
    p.push(
      `${donde} no tiene una ayuda válida (${ayuda.error.issues.map((i) => `${i.path.join('.') || 'ayuda'}: ${i.message}`).join('; ')}).`,
    );
  }
  if (h.criticidad === 'critica' && h.resumir === null)
    p.push(
      `${donde} es crítica y debe definir «resumir» para pedir confirmación.`,
    );
  if (h.criticidad !== 'critica' && h.resumir !== null)
    p.push(`${donde} no es crítica: no debe definir «resumir».`);
  for (const otra of h.ayuda.relacionadas ?? []) {
    if (otra === h.nombre || !nombres.has(otra))
      p.push(
        `${donde} nombra en su ayuda una herramienta que no existe: «${otra}».`,
      );
  }
  const manifiesto = f.manifiestos.find((m) => m.codigo === h.modulo);
  if (!manifiesto)
    p.push(`${donde} declara el módulo «${h.modulo}», que no existe.`);
  else if (h.permiso !== null && !manifiesto.permisos.includes(h.permiso)) {
    p.push(
      `${donde} pide el permiso «${h.permiso}», que no está en el manifiesto de «${h.modulo}».`,
    );
  }
  const forma = (h.entrada as { shape?: Record<string, unknown> }).shape;
  for (const clave of Object.keys(forma ?? {})) {
    if ((ARGUMENTOS_DE_CONTEXTO as readonly string[]).includes(clave)) {
      p.push(
        `${donde} pide «${clave}» como argumento: eso sale de la sesión del servidor, no de quien llama.`,
      );
    }
  }
  return p;
}

/** Validación completa del registro frente a los contratos y los manifiestos. Pura: sirve para pruebas. */
export function validarHerramientas(
  herramientas: readonly HerramientaRegistrada[],
  f: Fuentes,
): void {
  const nombres = new Set(herramientas.map((h) => h.nombre));
  const problemas = herramientas.flatMap((h) => problemasDe(h, nombres, f));
  for (const nombre of Object.keys(f.contratos)) {
    if (!nombres.has(nombre))
      problemas.push(
        `El contrato «${nombre}» no tiene herramienta registrada.`,
      );
  }
  if (problemas.length) throw new RegistroInvalido(problemas);
}

/**
 * Las herramientas de todas las áreas. Cada área registra las suyas en `onModuleInit` de un
 * proveedor propio; al terminar el arranque (`onApplicationBootstrap`, que Nest llama cuando todos
 * los `onModuleInit` ya corrieron) se valida el conjunto y, si falla, el servidor no arranca.
 */
@Injectable()
export class RegistroDeHerramientas implements OnApplicationBootstrap {
  private readonly porNombre = new Map<string, HerramientaRegistrada>();

  constructor(
    @Inject(CatalogoDeModulos) private readonly catalogo: CatalogoDeModulos,
  ) {}

  /** Lanza si un nombre se repite. */
  agregar(herramientas: readonly HerramientaRegistrada[]): void {
    for (const h of herramientas) {
      if (this.porNombre.has(h.nombre))
        throw new Error(`La herramienta «${h.nombre}» está repetida.`);
      this.porNombre.set(h.nombre, h);
    }
  }

  obtener(nombre: string): HerramientaRegistrada | undefined {
    return this.porNombre.get(nombre);
  }

  todas(): readonly HerramientaRegistrada[] {
    return [...this.porNombre.values()];
  }

  onApplicationBootstrap(): void {
    validarHerramientas(this.todas(), {
      contratos: { ...CONTRATOS, ...CONTRATOS_DE_PLATAFORMA },
      manifiestos: this.catalogo.manifiestos,
    });
  }
}
