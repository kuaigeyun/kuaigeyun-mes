/**
 * 快捷入口菜单图标渲染（与工作台 dashboard 一致）
 */

import React from 'react';
import {
  FileText,
  FileBarChart2,
  Boxes,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  AlertTriangle,
  ClipboardCheck,
  ShoppingCart,
  ReceiptText,
  CalendarClock,
  Wrench,
  Database,
  Target,
  BarChart3,
  Factory,
  Calculator,
  Sparkles,
  FileSearch,
  FileCheck,
  FilePlus2,
  FileLock2,
  FileWarning,
  FileClock,
  LayoutGrid,
} from 'lucide-react';
import type { MenuTree } from '../../services/menu';
import { ManufacturingIcons } from '../../utils/manufacturingIcons';
import { LucideIconByName } from '../../utils/lucideDynamicIcon';

export function renderQuickEntryMenuIcon(menu: MenuTree): React.ReactNode {
  const resolveIconByPath = (path?: string): React.ComponentType<any> | null => {
    if (!path) return null;
    const p = path.toLowerCase();
    const segments = p.split('/').filter(Boolean);
    const appCode = segments[1] || '';
    const moduleCode = segments[2] || '';

    if (p.includes('work-order')) return FileText;
    if (p.includes('reporting') || p.includes('report')) return FileBarChart2;
    if (p.includes('inventory')) return Boxes;
    if (p.includes('inbound') || p.includes('receipt') || p.includes('putaway')) return ArrowDownToLine;
    if (p.includes('outbound') || p.includes('shipment') || p.includes('picking')) return ArrowUpFromLine;
    if (p.includes('transfer') || p.includes('allocation')) return ArrowLeftRight;
    if (p.includes('warning') || p.includes('alert')) return AlertTriangle;
    if (p.includes('quality') || p.includes('inspection') || p.includes('iqc') || p.includes('oqc')) return ClipboardCheck;
    if (p.includes('purchase')) return ShoppingCart;
    if (p.includes('sales')) return ReceiptText;
    if (p.includes('plan') || p.includes('scheduling')) return CalendarClock;
    if (p.includes('equipment') || p.includes('maintenance')) return Wrench;
    if (p.includes('master-data') || p.includes('base-data')) return Database;

    const moduleIconMap: Record<string, React.ComponentType<any>> = {
      'sales-management': ReceiptText,
      'purchase-management': ShoppingCart,
      'warehouse-management': Boxes,
      'production-execution': FileText,
      'quality-management': ClipboardCheck,
      'equipment-management': Wrench,
      'plan-management': CalendarClock,
      'performance-management': Target,
      reports: BarChart3,
      analytics: BarChart3,
      'analysis-center': BarChart3,
      'master-data': Database,
    };
    if (moduleCode && moduleIconMap[moduleCode]) {
      return moduleIconMap[moduleCode];
    }

    const appIconMap: Record<string, React.ComponentType<any>> = {
      kuaizhizao: Factory,
      kuaicaiwu: Calculator,
      kuaireport: BarChart3,
      'master-data': Database,
      kuaiai: Sparkles,
    };
    return appIconMap[appCode] || null;
  };

  const lucideIconMap: Record<string, React.ComponentType<any>> = {
    AppstoreOutlined: ManufacturingIcons.appstore,
    ControlOutlined: ManufacturingIcons.control,
    ShopOutlined: ManufacturingIcons.shop,
    FileTextOutlined: ManufacturingIcons.fileCode,
    DatabaseOutlined: ManufacturingIcons.database,
    MonitorOutlined: ManufacturingIcons.monitor,
    GlobalOutlined: ManufacturingIcons.global,
    ApiOutlined: ManufacturingIcons.api,
    CodeOutlined: ManufacturingIcons.code,
    PrinterOutlined: ManufacturingIcons.printer,
    HistoryOutlined: ManufacturingIcons.history,
    UnorderedListOutlined: ManufacturingIcons.list,
    CalendarOutlined: ManufacturingIcons.calendar,
    PlayCircleOutlined: ManufacturingIcons.playCircle,
    InboxOutlined: ManufacturingIcons.inbox,
    SafetyOutlined: ManufacturingIcons.safety,
    ShoppingOutlined: ManufacturingIcons.shop,
    UserSwitchOutlined: ManufacturingIcons.userSwitch,
    SettingOutlined: ManufacturingIcons.mdSettings,
    BellOutlined: ManufacturingIcons.bell,
    LoginOutlined: ManufacturingIcons.login,
    UserOutlined: ManufacturingIcons.user,
    TeamOutlined: ManufacturingIcons.team,
    FileSearchOutlined: FileSearch,
    FileDoneOutlined: FileCheck,
    FileAddOutlined: FilePlus2,
    FileProtectOutlined: FileLock2,
    FileExclamationOutlined: FileWarning,
    FileSyncOutlined: FileClock,
    ReconciliationOutlined: ClipboardCheck,
    AuditOutlined: ClipboardCheck,
    ContainerOutlined: Boxes,
    WarningOutlined: AlertTriangle,
    AlertOutlined: AlertTriangle,
    SwapOutlined: ArrowLeftRight,
    ImportOutlined: ArrowDownToLine,
    ExportOutlined: ArrowUpFromLine,
  };

  const lowerCaseIconMap: Record<string, React.ComponentType<any>> = {
    order: FileText,
    workorder: FileText,
    work_order: FileText,
    report: FileBarChart2,
    reporting: FileBarChart2,
    inventory: Boxes,
    inbound: ArrowDownToLine,
    outbound: ArrowUpFromLine,
    transfer: ArrowLeftRight,
    warning: AlertTriangle,
    quality: ClipboardCheck,
    inspection: ClipboardCheck,
    purchase: ShoppingCart,
    sales: ReceiptText,
    plan: CalendarClock,
    equipment: Wrench,
    warehouse: Boxes,
    production: Factory,
    masterdata: Database,
    'master-data': Database,
  };

  if (menu.icon && lucideIconMap[menu.icon]) {
    const IconComponent = lucideIconMap[menu.icon];
    return React.createElement(IconComponent, { size: 24 });
  }

  if (menu.icon) {
    const iconName = menu.icon as string;
    const normalizedIconName = iconName.toLowerCase().replace(/[\s-_]/g, '');
    if (lowerCaseIconMap[normalizedIconName]) {
      const IconComponent = lowerCaseIconMap[normalizedIconName];
      return React.createElement(IconComponent, { size: 24 });
    }
    return React.createElement(LucideIconByName, { name: iconName, size: 24 });
  }

  const pathIcon = resolveIconByPath(menu.path);
  if (pathIcon) {
    return React.createElement(pathIcon, { size: 24 });
  }

  return React.createElement(LayoutGrid, { size: 24 });
}

export function getQuickEntryIconByPath(menuPath: string, menuName?: string): React.ReactNode {
  const pseudoMenu = {
    uuid: menuPath || 'quick-entry',
    tenant_id: 0,
    name: menuName || menuPath || '',
    path: menuPath,
    sort_order: 0,
    is_active: true,
    is_external: false,
    created_at: '',
    updated_at: '',
    children: [],
  } as MenuTree;
  return renderQuickEntryMenuIcon(pseudoMenu);
}
