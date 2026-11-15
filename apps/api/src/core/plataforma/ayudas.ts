import type { Ayuda } from '@capaz/shared';

// Ayuda de cada herramienta de la consola (alimenta «qué puedo decir» y al asistente).

const a = (
  titulo: string,
  paraQueSirve: string,
  cuandoUsarla: string,
  campos: Array<[string, string, string]>,
  ejemploTecleado: string,
  ejemploHablado: string,
  erroresComunes: string[],
  relacionadas: string[] = [],
): Ayuda => ({
  titulo,
  paraQueSirve,
  cuandoUsarla,
  campos: campos.map(([nombre, queSeAnota, ejemplo]) => ({ nombre, queSeAnota, ejemplo })),
  ejemploTecleado,
  ejemploHablado,
  erroresComunes,
  relacionadas,
});

const EMPRESA: [string, string, string] = ['empresa', 'El identificador de la empresa.', 'a1b2c3d4'];
const MODULO: [string, string, string] = ['modulo', 'El código del módulo.', 'crm'];
const MOTIVO: [string, string, string] = ['motivo', 'Por qué se hace (queda en el historial).', 'mora de dos meses'];

export const AYUDAS = {
  empresasListar: a('Listar empresas', 'Muestra las empresas clientes con el estado de sus módulos.', 'Para ver quién contrata qué y qué vence pronto.', [['texto', 'Parte del nombre de la empresa.', 'imprenta']], 'empresas imprenta', 'muéstrame las empresas', ['Buscar por un texto que no está en el nombre.'], ['plataforma_empresas_ver']),
  empresaVer: a('Ver una empresa', 'Muestra la ficha de contratación: módulos, plan, precio, vigencia, usuarios, última actividad e historial.', 'Antes de cambiar el contrato de una empresa.', [EMPRESA], 'ver empresa a1b2c3d4', 'abre la ficha de esa empresa', ['Pedir datos de negocio de la empresa: la consola no los ve.'], ['plataforma_empresas_listar', 'plataforma_contrato_fijar']),
  empresaCrear: a('Crear una empresa', 'Da de alta una empresa nueva con una persona ya registrada como dueña.', 'Cuando firma un cliente nuevo.', [['nombre', 'El nombre de la empresa.', 'Imprenta Andina'], ['correoDelDueno', 'El correo de la persona dueña (ya registrada).', 'ana@andina.pe']], 'crear empresa Imprenta Andina con ana@andina.pe', 'crea la empresa Imprenta Andina para Ana', ['La persona todavía no se registró.']),
  moduloActivar: a('Activar un módulo', 'Da a una empresa un módulo, activo o en prueba por unos días.', 'Al contratar o probar un módulo.', [EMPRESA, MODULO, ['pruebaDias', 'Días de prueba; sin ellos queda activo.', '15'], MOTIVO], 'activar crm a la empresa a1b2c3d4 por 15 días', 'dale el CRM a esa empresa quince días de prueba', ['El módulo depende de otro que la empresa no tiene.'], ['plataforma_modulo_suspender', 'plataforma_contrato_fijar']),
  moduloSuspender: a('Suspender un módulo', 'Pausa un módulo sin darlo de baja: la empresa lo ve pero no escribe.', 'Por mora u otro motivo temporal.', [EMPRESA, MODULO, MOTIVO], 'suspender crm de a1b2c3d4 por mora', 'suspende el CRM de esa empresa', ['El módulo no está activo ni en prueba.'], ['plataforma_modulo_reactivar']),
  moduloDarDeBaja: a('Dar de baja un módulo', 'El módulo queda en solo lectura; los datos nunca se borran.', 'Cuando el cliente cancela.', [EMPRESA, MODULO, MOTIVO], 'dar de baja crm de a1b2c3d4', 'da de baja el CRM de esa empresa', ['Otro módulo activo depende de este.'], ['plataforma_modulo_reactivar']),
  moduloReactivar: a('Reactivar un módulo', 'Devuelve a activo un módulo suspendido o en baja.', 'Cuando el cliente regulariza o vuelve.', [EMPRESA, MODULO], 'reactivar crm de a1b2c3d4', 'reactiva el CRM de esa empresa', ['El módulo no estaba suspendido ni en baja.'], ['plataforma_modulo_suspender', 'plataforma_modulo_dar_de_baja']),
  contratoFijar: a('Fijar el contrato', 'Anota plan, precio acordado, vigencia y límite de usuarios de un módulo de una empresa.', 'Al acordar condiciones o dar un mejor precio.', [EMPRESA, MODULO, ['plan', 'Código del plan.', 'basico'], ['precioAcordadoCentimos', 'Precio mensual en céntimos.', '9900'], ['vigenteHasta', 'Fecha de fin del acuerdo.', '2027-12-31T00:00:00Z'], ['maxUsuarios', 'Usuarios permitidos.', '5']], 'fijar precio 9900 céntimos al crm de a1b2c3d4', 'ponle ese precio al CRM de esa empresa', ['El plan no existe.', 'No mandar ningún dato.'], ['plataforma_planes_listar']),
  planesListar: a('Listar planes', 'Muestra el catálogo de planes con sus módulos y precio.', 'Para elegir un plan o revisar precios.', [], 'planes', 'muéstrame los planes', ['Ninguno.'], ['plataforma_planes_guardar']),
  planesGuardar: a('Guardar un plan', 'Crea o cambia un plan: módulos incluidos, precio mensual y usuarios.', 'Al definir o ajustar un paquete.', [['codigo', 'Código corto del plan.', 'basico'], ['nombre', 'Nombre visible.', 'Básico'], ['precioCentimos', 'Precio mensual en céntimos.', '9900'], ['modulos', 'Módulos que incluye.', 'registro, crm']], 'guardar plan basico a 9900 con registro y crm', 'crea el plan básico', ['Un módulo del plan no existe.'], ['plataforma_planes_listar']),
  solicitudesListar: a('Listar solicitudes', 'Muestra lo que las empresas pidieron contratar.', 'Para atender pedidos de módulos.', [['estado', 'pendiente, atendida, descartada o todas.', 'pendiente']], 'solicitudes pendientes', 'qué me han pedido', ['Ninguno.'], ['plataforma_solicitud_atender']),
  solicitudAtender: a('Atender una solicitud', 'Marca una solicitud como atendida o descartada.', 'Después de activar el módulo pedido, o de decidir no hacerlo.', [['id', 'El identificador de la solicitud.', '0190…'], ['resultado', 'atendida o descartada.', 'atendida']], 'atender solicitud 0190… como atendida', 'marca esa solicitud como atendida', ['La solicitud ya se resolvió.'], ['plataforma_solicitudes_listar', 'plataforma_modulo_activar']),
  restablecerContrasena: a('Restablecer una contraseña', 'Genera un enlace de un solo uso para que una persona elija nueva contraseña.', 'Cuando alguien perdió su acceso y no hay correo automático.', [['correo', 'El correo de la cuenta.', 'ana@andina.pe']], 'restablecer contraseña de ana@andina.pe', 'dame el enlace para que Ana cambie su contraseña', ['La cuenta no existe.', 'El enlace se muestra una sola vez: si se pierde, genera otro.']),
} satisfies Record<string, Ayuda>;
