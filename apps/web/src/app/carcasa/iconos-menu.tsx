import {
  BriefcaseBusiness, Building2, Calculator, ClipboardList, Handshake, ChartColumn, Clock3, Inbox, Link2, Lock, LogOut, MapPin, Network, PanelLeft, Package, ShieldCheck,
  ShoppingCart, Tags, UserRound, Users, Wallet, Warehouse, Zap, Factory, type LucideIcon,
} from 'lucide-react';
import { Icono } from '../../shared/ui/icono.tsx';
import { unir } from '../../shared/ui/unir.ts';

// Iconos del menú, elegidos por el nombre de icono del manifiesto o por la clave del destino; lo que
// no se conoce cae en el icono genérico del kit.
const GLIFOS: Record<string, LucideIcon> = {
  bandeja: Inbox,
  clientes: Users,
  productos: Package,
  precios: Tags,
  empresa: Building2,
  sucursales: MapPin,
  conecta: Link2,
  automatizaciones: Zap,
  historial: Clock3,
  ventas: ChartColumn,
  compras: ShoppingCart,
  inventario: Warehouse,
  finanzas: Wallet,
  personal: UserRound,
  produccion: Factory,
  analisis: ChartColumn,
  conexiones: Network,
  candado: Lock,
  plataforma: ShieldCheck,
  salir: LogOut,
  'panel-izquierda': PanelLeft,
  trabajo: BriefcaseBusiness,
  crm: Handshake,
  ordenes: ClipboardList,
  registro: Wallet,
  insumos: Warehouse,
  reportes: ChartColumn,
  cotizador: Calculator,
};

export function IconoMenu({ nombre, className }: { nombre: string; className?: string }) {
  const Glifo = GLIFOS[nombre];
  if (!Glifo) return <Icono nombre={nombre === 'inicio' || nombre === 'usuario' || nombre === 'menu' || nombre === 'mas' ? nombre : 'caja'} className={className} />;
  return <Glifo strokeWidth={1.75} className={unir('size-[1.125rem] shrink-0', className)} aria-hidden="true" focusable="false" />;
}
