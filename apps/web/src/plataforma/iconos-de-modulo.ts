import { Boxes, Calculator, ChartColumn, Factory, ClipboardList, Handshake, Package, ShoppingCart, Users, Wallet, Webhook, type LucideIcon } from 'lucide-react';

const ICONOS: Readonly<Record<string, LucideIcon>> = {
  registro: Wallet,
  crm: Handshake,
  ordenes: ClipboardList,
  insumos: Boxes,
  compras: ShoppingCart,
  personal: Users,
  reportes: ChartColumn,
  webhooks: Webhook,
  cotizador: Calculator,
  produccion: Factory,
};

export const iconoDeModulo = (codigo: string): LucideIcon => ICONOS[codigo] ?? Package;
