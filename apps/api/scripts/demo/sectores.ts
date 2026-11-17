// Las cinco empresas de demostración: sector, módulos contratados (con estados distintos a propósito),
// usuarios y catálogos de productos por rubro. Todo ficticio.

export type Grupo = { cat: string; prefijo: string; bases: string[]; variantes: string[]; unidad: string; precio: [number, number]; tipo?: 'producto' | 'servicio' };
export type UsuarioDemo = { clave: string; nombre: string; rol: 'owner' | 'admin' | 'member'; modulos: Record<string, 'completo' | 'lectura'> };
/** Estado final del módulo tras sembrar (no se puede escribir en uno suspendido o en baja). */
export type ModuloDemo = { prueba?: number; despues?: 'suspendido' | 'baja' };
export type Sector = {
  clave: string;
  nombre: string;
  rubro: string;
  sucursales: { codigo: string; nombre: string; direccion: string }[];
  modulos: Record<string, ModuloDemo>;
  usuarios: UsuarioDemo[];
  grupos: Grupo[];
  objetivoProductos: number;
  clientes: number;
  proveedores: number;
  /** Para armar razones sociales: «<prefijo> <rubro> <sufijo>». */
  prefijos: string[];
  giros: string[];
  proveedoresBase: string[];
  ingresos: string[];
  egresos: string[];
  /** Venta típica en soles [mínimo, máximo]. */
  ticket: [number, number];
  cargos: string[];
};

const TODOS_COMPLETO = (...m: string[]): Record<string, 'completo'> => Object.fromEntries(m.map((x) => [x, 'completo' as const]));

export const SECTORES: Sector[] = [
  {
    clave: 'grafica',
    nombre: 'Gráfica Andina S.A.C.',
    rubro: 'Taller gráfico e imprenta',
    sucursales: [
      { codigo: 'PRI', nombre: 'Taller principal · Lima Cercado', direccion: 'Jr. Ucayali 482, Lima' },
      { codigo: 'MIR', nombre: 'Tienda Miraflores', direccion: 'Av. Larco 1120, Miraflores' },
    ],
    modulos: { registro: {}, crm: {}, ordenes: {}, cotizador: {}, insumos: {}, compras: {}, personal: {}, reportes: {} },
    usuarios: [
      { clave: 'admin', nombre: 'Rosa Quispe Mamani', rol: 'owner', modulos: {} },
      { clave: 'ventas', nombre: 'Daniel Huamán Rojas', rol: 'member', modulos: TODOS_COMPLETO('crm', 'ordenes') },
      { clave: 'caja', nombre: 'Lucía Flores Paredes', rol: 'member', modulos: { registro: 'completo', reportes: 'lectura' } },
      { clave: 'taller', nombre: 'Marco Salazar Ccori', rol: 'member', modulos: { ordenes: 'completo', insumos: 'completo' } },
    ],
    grupos: [
      { cat: 'Tarjetas', prefijo: 'TAR', bases: ['Tarjeta de presentación', 'Tarjeta con barniz UV', 'Tarjeta laminada mate'], variantes: ['x100', 'x500', 'x1000', 'x2000'], unidad: 'millar', precio: [28, 160] },
      { cat: 'Volantes', prefijo: 'VOL', bases: ['Volante A5', 'Volante A6', 'Volante A4 couché'], variantes: ['x500', 'x1000', 'x3000', 'x5000', 'a dos caras'], unidad: 'millar', precio: [55, 420] },
      { cat: 'Gran formato', prefijo: 'GRF', bases: ['Banner en lona', 'Gigantografía', 'Vinil adhesivo', 'Backing para evento', 'Roll up'], variantes: ['1x1 m', '2x1 m', '3x1 m', '2x2 m', '3x2 m'], unidad: 'unidad', precio: [45, 380] },
      { cat: 'Papelería', prefijo: 'PAP', bases: ['Talonario de recibos', 'Talonario de guías', 'Folder institucional', 'Hoja membretada', 'Sobre manila impreso'], variantes: ['x50 juegos', 'x100 juegos', 'A4', 'oficio'], unidad: 'unidad', precio: [18, 210] },
      { cat: 'Adhesivos', prefijo: 'ADH', bases: ['Sticker troquelado', 'Etiqueta adhesiva', 'Sticker holográfico', 'Etiqueta para frasco'], variantes: ['5 cm', '7 cm', '10 cm', 'rollo x1000'], unidad: 'millar', precio: [30, 250] },
      { cat: 'Promocionales', prefijo: 'PRO', bases: ['Taza sublimada', 'Polo estampado', 'Lapicero personalizado', 'Llavero acrílico', 'Gorra bordada', 'Calendario de escritorio'], variantes: ['x1', 'x12', 'x50', 'x100'], unidad: 'unidad', precio: [6, 140] },
      { cat: 'Servicios', prefijo: 'SRV', bases: ['Diseño de logotipo', 'Diseño de tarjeta', 'Diagramación de revista', 'Edición de arte final', 'Instalación de banner', 'Delivery de pedido'], variantes: ['básico', 'estándar', 'premium'], unidad: 'servicio', precio: [20, 480], tipo: 'servicio' },
    ],
    objetivoProductos: 140,
    clientes: 70,
    proveedores: 14,
    prefijos: ['Corporación', 'Grupo', 'Inversiones', 'Comercial', 'Servicios', 'Consultores', 'Importadora', 'Constructora'],
    giros: ['Los Andes', 'del Pacífico', 'San Martín', 'Inca', 'Miraflores', 'Rímac', 'Delta', 'Horizonte', 'Pachacútec', 'Nuevo Sol', 'Santa Rosa', 'Lima Norte'],
    proveedoresBase: ['Distribuidora de Papeles Arequipa', 'Tintas y Químicos del Perú', 'Planchas Offset Lima', 'Vinilos y Lonas Rímac', 'Cartones Industriales Callao', 'Maquinaria Gráfica Surco', 'Importaciones Pliego', 'Laminados y Barnices Trujillo', 'Papelera Nacional', 'Suministros Gráficos Ate', 'Sublimados Peruanos', 'Textiles Gamarra', 'Embalajes Santa Anita', 'Acrílicos y Corte Láser'],
    ingresos: ['Cobro de pedido de tarjetas', 'Adelanto de banner', 'Venta al mostrador', 'Cobro de volantes', 'Pago de gigantografía', 'Cobro de talonarios', 'Venta de promocionales'],
    egresos: ['Compra de papel couché', 'Pago de planchas', 'Compra de tintas', 'Pago de luz', 'Alquiler del local', 'Pago de planilla semanal', 'Mantenimiento de máquina', 'Compra de vinil', 'Movilidad y delivery'],
    ticket: [60, 2400],
    cargos: ['Operador de máquina offset', 'Diseñador gráfico', 'Acabados y corte', 'Atención al cliente', 'Ayudante de taller', 'Repartidor'],
  },
  {
    clave: 'abarrotes',
    nombre: 'Distribuidora Los Nogales E.I.R.L.',
    rubro: 'Distribución de abarrotes',
    sucursales: [
      { codigo: 'ALM', nombre: 'Almacén central · Ate', direccion: 'Av. Nicolás Ayllón 3350, Ate' },
      { codigo: 'MER', nombre: 'Punto de venta Mercado Mayorista', direccion: 'Puesto 112, Mercado Mayorista, La Victoria' },
      { codigo: 'CAL', nombre: 'Reparto Callao', direccion: 'Av. Argentina 2450, Callao' },
    ],
    modulos: { registro: {}, crm: {}, ordenes: {}, cotizador: {}, insumos: {}, compras: { prueba: 15 }, reportes: {} },
    usuarios: [
      { clave: 'admin', nombre: 'Jorge Mendoza Castillo', rol: 'owner', modulos: {} },
      { clave: 'ventas', nombre: 'Patricia Torres Vargas', rol: 'member', modulos: { crm: 'completo', ordenes: 'completo' } },
      { clave: 'almacen', nombre: 'Víctor Ramos Soto', rol: 'member', modulos: { insumos: 'completo', compras: 'completo' } },
    ],
    grupos: [
      { cat: 'Arroz y menestras', prefijo: 'ARR', bases: ['Arroz extra', 'Arroz superior', 'Frijol canario', 'Lentejas', 'Garbanzo', 'Pallares', 'Quinua'], variantes: ['saco 50 kg', 'bolsa 5 kg', 'bolsa 1 kg', 'caja x10'], unidad: 'saco', precio: [3.5, 215] },
      { cat: 'Aceites y salsas', prefijo: 'ACE', bases: ['Aceite vegetal', 'Aceite de oliva', 'Mayonesa', 'Ketchup', 'Ají amarillo molido', 'Vinagre blanco', 'Salsa de soya'], variantes: ['botella 1 L', 'botella 500 ml', 'bidón 5 L', 'sachet x24', 'caja x12'], unidad: 'caja', precio: [4, 180] },
      { cat: 'Conservas', prefijo: 'CON', bases: ['Atún en aceite', 'Filete de caballa', 'Durazno en almíbar', 'Leche evaporada', 'Choclo desgranado', 'Pasta de tomate'], variantes: ['lata 170 g', 'lata 425 g', 'caja x24', 'pack x6'], unidad: 'caja', precio: [2.8, 130] },
      { cat: 'Fideos y harinas', prefijo: 'FID', bases: ['Fideo spaghetti', 'Fideo tornillo', 'Fideo cabello de ángel', 'Harina sin preparar', 'Harina preparada', 'Avena en hojuelas'], variantes: ['bolsa 250 g', 'bolsa 500 g', 'paquete x20', 'saco 25 kg'], unidad: 'bolsa', precio: [1.9, 98] },
      { cat: 'Azúcar y endulzantes', prefijo: 'AZU', bases: ['Azúcar rubia', 'Azúcar blanca', 'Chancaca', 'Miel de abeja', 'Stevia'], variantes: ['saco 50 kg', 'bolsa 1 kg', 'bolsa 5 kg', 'frasco 500 g'], unidad: 'bolsa', precio: [3.2, 210] },
      { cat: 'Bebidas', prefijo: 'BEB', bases: ['Gaseosa cola', 'Gaseosa lima limón', 'Agua mineral', 'Néctar de durazno', 'Chicha morada', 'Bebida rehidratante', 'Cerveza rubia'], variantes: ['botella 500 ml', 'botella 1.5 L', 'botella 3 L', 'caja x12', 'caja x6'], unidad: 'caja', precio: [2.5, 78] },
      { cat: 'Limpieza', prefijo: 'LIM', bases: ['Detergente en polvo', 'Lejía', 'Lavavajilla', 'Jabón de lavar', 'Papel higiénico', 'Servilletas', 'Bolsas de basura'], variantes: ['bolsa 800 g', 'botella 1 L', 'pack x4', 'pack x12', 'caja x24'], unidad: 'caja', precio: [3, 96] },
      { cat: 'Snacks y galletas', prefijo: 'SNK', bases: ['Galleta de soda', 'Galleta rellena', 'Papas fritas', 'Chocolate en barra', 'Caramelos surtidos', 'Maní salado'], variantes: ['paquete x6', 'caja x24', 'bolsa 150 g', 'caja x48'], unidad: 'caja', precio: [4, 120] },
    ],
    objetivoProductos: 150,
    clientes: 80,
    proveedores: 16,
    prefijos: ['Bodega', 'Minimarket', 'Restaurante', 'Comercial', 'Panadería', 'Juguería', 'Pollería', 'Hostal', 'Cevichería'],
    giros: ['Doña Rosa', 'El Sol', 'La Esquina', 'Mi Perú', 'San Judas', 'Los Olivos', 'El Mirador', 'Santa Ana', 'El Buen Sabor', 'La Fortuna', 'Don Pepe', 'Nuevo Amanecer'],
    proveedoresBase: ['Alicorp Distribución Lima', 'Molinos del Sur', 'Arrocera Nor Perú', 'Aceites del Pacífico', 'Lácteos Cajamarca', 'Conservas Chimbote', 'Industrias del Fideo', 'Bebidas y Refrescos Callao', 'Azucarera Cartavio Mayorista', 'Limpieza Total Perú', 'Galletas Victoria Comercial', 'Importadora Oriental', 'Empaques Plásticos Lima', 'Transportes Rápidos del Centro', 'Granos Andinos', 'Dulces y Confites Perú'],
    ingresos: ['Venta al crédito a bodega', 'Cobro de reparto', 'Venta al contado mostrador', 'Cobro de factura', 'Venta mayorista', 'Pago de cliente restaurante'],
    egresos: ['Compra de mercadería', 'Pago a proveedor de arroz', 'Combustible de reparto', 'Alquiler de almacén', 'Planilla de repartidores', 'Pago de arbitrios', 'Mantenimiento de camión', 'Compra de bolsas y empaques'],
    ticket: [180, 9500],
    cargos: ['Jefe de almacén', 'Repartidor', 'Vendedor de ruta', 'Cajera', 'Auxiliar de almacén'],
  },
  {
    clave: 'consultora',
    nombre: 'Consultora Horizonte S.A.C.',
    rubro: 'Consultoría y servicios profesionales',
    sucursales: [{ codigo: 'SAN', nombre: 'Oficina San Isidro', direccion: 'Av. Javier Prado Oeste 1650, San Isidro' }],
    modulos: { registro: {}, crm: { despues: 'suspendido' }, reportes: {} },
    usuarios: [
      { clave: 'admin', nombre: 'Elena Cárdenas Ponce', rol: 'owner', modulos: {} },
      { clave: 'comercial', nombre: 'Andrés Zevallos Luna', rol: 'admin', modulos: { crm: 'completo', registro: 'completo' } },
    ],
    grupos: [
      { cat: 'Consultoría', prefijo: 'CON', bases: ['Diagnóstico organizacional', 'Plan estratégico', 'Estudio de mercado', 'Auditoría de procesos', 'Asesoría tributaria mensual', 'Asesoría laboral', 'Análisis financiero'], variantes: ['micro empresa', 'pequeña empresa', 'mediana empresa'], unidad: 'servicio', precio: [900, 14500], tipo: 'servicio' },
      { cat: 'Capacitación', prefijo: 'CAP', bases: ['Taller de ventas', 'Taller de liderazgo', 'Curso de Excel empresarial', 'Curso de seguridad y salud', 'Taller de atención al cliente'], variantes: ['4 horas', '8 horas', '16 horas', 'in house'], unidad: 'servicio', precio: [450, 5800], tipo: 'servicio' },
      { cat: 'Legal y contable', prefijo: 'LEG', bases: ['Constitución de empresa', 'Registro de marca', 'Elaboración de contratos', 'Balance anual', 'Declaración mensual PDT', 'Regularización de libros'], variantes: ['básico', 'completo', 'urgente'], unidad: 'servicio', precio: [250, 4200], tipo: 'servicio' },
      { cat: 'Tecnología', prefijo: 'TEC', bases: ['Implementación de sistema', 'Soporte técnico mensual', 'Diseño de página web', 'Capacitación de usuarios'], variantes: ['plan inicial', 'plan profesional'], unidad: 'servicio', precio: [350, 9800], tipo: 'servicio' },
      { cat: 'Horas', prefijo: 'HRS', bases: ['Hora de consultor senior', 'Hora de consultor junior', 'Hora de analista'], variantes: ['presencial', 'virtual'], unidad: 'hora', precio: [60, 280], tipo: 'servicio' },
    ],
    objetivoProductos: 55,
    clientes: 34,
    proveedores: 8,
    prefijos: ['Grupo', 'Corporación', 'Servicios Generales', 'Inversiones', 'Constructora', 'Transportes', 'Agroexportadora', 'Clínica'],
    giros: ['Pacífico', 'Los Cedros', 'Andino', 'Santa Elena', 'Atlántida', 'Meridian', 'Lima Sur', 'Mirasol', 'Del Norte'],
    proveedoresBase: ['Alquiler de oficinas San Isidro', 'Software Contable Perú', 'Papelería y Útiles Centro', 'Telecomunicaciones Andinas', 'Coworking Miraflores', 'Estudio Jurídico Asociado', 'Servicios de Limpieza Express', 'Catering Corporativo Lima'],
    ingresos: ['Honorarios de asesoría mensual', 'Pago de diagnóstico', 'Cobro de capacitación', 'Honorarios de auditoría', 'Cobro de estudio de mercado'],
    egresos: ['Alquiler de oficina', 'Planilla de consultores', 'Licencias de software', 'Internet y telefonía', 'Capacitación del equipo', 'Viáticos', 'Honorarios de abogado externo'],
    ticket: [450, 14500],
    cargos: ['Consultor senior', 'Consultor junior', 'Analista contable', 'Asistente administrativa'],
  },
  {
    clave: 'cafeteria',
    nombre: 'Café Qori S.R.L.',
    rubro: 'Cafetería y restaurante',
    sucursales: [
      { codigo: 'BAR', nombre: 'Local Barranco', direccion: 'Calle Domeyer 280, Barranco' },
      { codigo: 'SUR', nombre: 'Local Surco', direccion: 'Av. Primavera 1450, Surco' },
    ],
    modulos: { registro: {}, insumos: {}, compras: {}, personal: { despues: 'baja' } },
    usuarios: [
      { clave: 'admin', nombre: 'Sofía Rivera Delgado', rol: 'owner', modulos: {} },
      { clave: 'cocina', nombre: 'Raúl Gutiérrez Bravo', rol: 'member', modulos: { insumos: 'completo', compras: 'lectura' } },
      { clave: 'caja', nombre: 'Karen Campos Navarro', rol: 'member', modulos: { registro: 'completo' } },
    ],
    grupos: [
      { cat: 'Cafés', prefijo: 'CAF', bases: ['Espresso', 'Americano', 'Cappuccino', 'Latte', 'Mocca', 'Café filtrado', 'Cold brew', 'Flat white'], variantes: ['chico', 'mediano', 'grande', 'con leche de almendras'], unidad: 'taza', precio: [6.5, 18] },
      { cat: 'Infusiones y frías', prefijo: 'INF', bases: ['Té chai', 'Matcha latte', 'Limonada frozen', 'Chicha morada', 'Jugo de naranja', 'Smoothie de frutas', 'Frappé de chocolate'], variantes: ['12 oz', '16 oz', 'jarra'], unidad: 'vaso', precio: [6, 24] },
      { cat: 'Desayunos', prefijo: 'DES', bases: ['Tostada con palta', 'Sándwich de pavo', 'Croissant de jamón y queso', 'Pan con chicharrón', 'Tamal criollo', 'Huevos revueltos', 'Bowl de frutas y granola'], variantes: ['simple', 'con café', 'combo familiar'], unidad: 'plato', precio: [8, 36] },
      { cat: 'Almuerzos', prefijo: 'ALM', bases: ['Lomo saltado', 'Ají de gallina', 'Arroz con pollo', 'Causa limeña', 'Tallarines verdes', 'Ensalada César', 'Ceviche', 'Menú ejecutivo'], variantes: ['personal', 'para dos', 'con bebida'], unidad: 'plato', precio: [14, 62] },
      { cat: 'Postres', prefijo: 'POS', bases: ['Torta de chocolate', 'Cheesecake de maracuyá', 'Alfajor de manjar', 'Suspiro limeño', 'Brownie', 'Tres leches'], variantes: ['porción', 'entera', 'caja x6'], unidad: 'porción', precio: [7, 95] },
      { cat: 'Insumos de cocina', prefijo: 'INS', bases: ['Café en grano tostado', 'Leche entera', 'Azúcar rubia', 'Harina', 'Palta Hass', 'Pollo entero', 'Lomo fino', 'Queso fresco', 'Aceite vegetal', 'Huevos'], variantes: ['kg', 'caja', 'bolsa'], unidad: 'kg', precio: [3.5, 120] },
    ],
    objetivoProductos: 90,
    clientes: 32,
    proveedores: 14,
    prefijos: ['Oficinas', 'Empresa', 'Catering', 'Colegio', 'Eventos', 'Agencia', 'Studio'],
    giros: ['Barranco Work', 'Mirador', 'Los Álamos', 'Lima Creativa', 'Surco Plaza', 'Punto Verde', 'Don Lucho', 'Santa Teresa'],
    proveedoresBase: ['Tostaduría Selva Central', 'Lácteos Cajamarca', 'Avícola San Fernando Mayorista', 'Frutas y Verduras Surquillo', 'Panadería Industrial Lima', 'Carnes Selectas Callao', 'Descartables Eco Perú', 'Gas y Combustibles Lurín', 'Abarrotes Mayoristas Central', 'Bebidas Frías Perú', 'Quesos Artesanales Andinos', 'Limpieza Profesional', 'Mantenimiento de Equipos Café', 'Empaques Compostables'],
    ingresos: ['Ventas del día · salón', 'Pedido de catering', 'Ventas delivery', 'Venta de postres', 'Evento corporativo', 'Ventas del día · barra'],
    egresos: ['Compra de café en grano', 'Compra de lácteos', 'Alquiler del local', 'Planilla de mozos', 'Gas y combustible', 'Compra de frutas', 'Mantenimiento de máquina de café', 'Descartables y empaques', 'Luz y agua'],
    ticket: [18, 1800],
    cargos: ['Barista', 'Cocinero', 'Mozo', 'Cajera', 'Ayudante de cocina', 'Encargado de local'],
  },
  {
    clave: 'ferreteria',
    nombre: 'Ferretería Constructora Pacífico S.A.C.',
    rubro: 'Ferretería y materiales de construcción',
    sucursales: [
      { codigo: 'CHO', nombre: 'Tienda Chorrillos', direccion: 'Av. Huaylas 640, Chorrillos' },
      { codigo: 'VMT', nombre: 'Almacén Villa María del Triunfo', direccion: 'Av. Pachacútec 2210, Villa María del Triunfo' },
    ],
    modulos: { registro: {}, crm: {}, ordenes: { prueba: 10 }, insumos: {}, compras: {}, reportes: {} },
    usuarios: [
      { clave: 'admin', nombre: 'Hugo Chávez Palomino', rol: 'owner', modulos: {} },
      { clave: 'ventas', nombre: 'Silvia Ayala Cáceres', rol: 'member', modulos: { crm: 'completo', ordenes: 'completo', reportes: 'lectura' } },
      { clave: 'almacen', nombre: 'Walter Condori Yupanqui', rol: 'member', modulos: { insumos: 'completo', compras: 'completo' } },
    ],
    grupos: [
      { cat: 'Cemento y agregados', prefijo: 'CEM', bases: ['Cemento Portland tipo I', 'Cemento antisalitre', 'Arena gruesa', 'Piedra chancada', 'Hormigón', 'Yeso'], variantes: ['bolsa 42.5 kg', 'm³', 'saco 25 kg'], unidad: 'bolsa', precio: [9, 85] },
      { cat: 'Fierro y acero', prefijo: 'FIE', bases: ['Fierro corrugado', 'Alambre N°16', 'Alambre N°8', 'Malla electrosoldada', 'Clavos de 3 pulgadas', 'Clavos de 2 pulgadas', 'Perfil angular'], variantes: ['1/4"', '3/8"', '1/2"', '5/8"', '3/4"', 'kg', 'rollo'], unidad: 'varilla', precio: [4, 78] },
      { cat: 'Tubería y gasfitería', prefijo: 'GAS', bases: ['Tubo PVC desagüe', 'Tubo PVC agua', 'Codo PVC', 'Tee PVC', 'Llave de paso', 'Grifería de lavatorio', 'Válvula check', 'Cinta teflón'], variantes: ['1/2"', '3/4"', '1"', '2"', '4"'], unidad: 'unidad', precio: [2, 140] },
      { cat: 'Electricidad', prefijo: 'ELE', bases: ['Cable THW', 'Cable vulcanizado', 'Interruptor simple', 'Tomacorriente doble', 'Foco LED', 'Tablero de distribución', 'Llave termomagnética', 'Cinta aislante'], variantes: ['#12', '#14', '9 W', '12 W', '15 A', '20 A', 'rollo 100 m'], unidad: 'unidad', precio: [2.5, 240] },
      { cat: 'Pinturas', prefijo: 'PIN', bases: ['Pintura látex', 'Pintura esmalte sintético', 'Barniz marino', 'Thinner', 'Imprimante', 'Sellador de paredes', 'Pintura epóxica'], variantes: ['1/4 galón', 'galón', 'balde 4 galones', 'blanco', 'beige'], unidad: 'galón', precio: [12, 310] },
      { cat: 'Herramientas', prefijo: 'HER', bases: ['Martillo de uña', 'Alicate universal', 'Destornillador Phillips', 'Taladro percutor', 'Amoladora angular', 'Nivel de burbuja', 'Wincha', 'Carretilla buggy', 'Pico', 'Pala cuadrada', 'Escalera telescópica'], variantes: ['estándar', 'profesional', 'industrial', '16 oz', '5 m'], unidad: 'unidad', precio: [8, 690] },
      { cat: 'Acabados', prefijo: 'ACA', bases: ['Cerámico piso', 'Porcelanato', 'Pegamento para cerámico', 'Fragua', 'Zócalo', 'Drywall', 'Perfil de aluminio'], variantes: ['40x40', '60x60', 'm²', 'bolsa 25 kg', 'plancha'], unidad: 'm²', precio: [7, 160] },
      { cat: 'Seguridad', prefijo: 'SEG', bases: ['Casco de seguridad', 'Guantes de cuero', 'Lentes de protección', 'Chaleco reflectivo', 'Botas punta de acero', 'Mascarilla N95'], variantes: ['estándar', 'talla M', 'talla L', 'caja x12'], unidad: 'unidad', precio: [4, 120] },
    ],
    objetivoProductos: 150,
    clientes: 60,
    proveedores: 15,
    prefijos: ['Constructora', 'Inmobiliaria', 'Contratistas', 'Obras y Proyectos', 'Ingeniería', 'Servicios Generales', 'Maestro de obra'],
    giros: ['Sol Naciente', 'del Sur', 'Villa Hermosa', 'Los Pinos', 'San Gabriel', 'Mar Azul', 'Chorrillos', 'Santa Clara', 'Nuevo Horizonte', 'El Progreso'],
    proveedoresBase: ['Cementos Lima Distribuidora', 'Aceros Arequipa Mayorista', 'Pavco Tuberías Distribución', 'Pinturas del Pacífico', 'Cerámicos Cumbre', 'Herramientas Bosch Perú', 'Eléctricos Indeco Comercial', 'Agregados San Juan', 'Maderas y Drywall Callao', 'Importadora de Herramientas Ate', 'Equipos de Seguridad Lima', 'Transportes de Carga Pesada', 'Cables y Conductores Peruanos', 'Griferías Sol', 'Adhesivos y Selladores Perú'],
    ingresos: ['Venta de cemento al contado', 'Cobro de obra', 'Venta de fierro', 'Cobro a contratista', 'Venta de herramientas', 'Venta de pinturas', 'Cobro de factura'],
    egresos: ['Compra de cemento', 'Compra de fierro corrugado', 'Flete de mercadería', 'Alquiler del almacén', 'Planilla', 'Compra de pinturas', 'Pago de luz y agua', 'Mantenimiento de camión'],
    ticket: [35, 11800],
    cargos: ['Vendedor de mostrador', 'Jefe de almacén', 'Chofer', 'Cajero', 'Ayudante de carga'],
  },
];
