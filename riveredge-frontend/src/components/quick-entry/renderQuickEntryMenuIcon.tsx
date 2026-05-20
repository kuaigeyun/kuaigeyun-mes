/**
 * 快捷入口菜单图标渲染（与工作台 dashboard 一致）
 */

import React from 'react';
import * as LucideIcons from 'lucide-react';
import type { MenuTree } from '../../services/menu';
import { ManufacturingIcons } from '../../utils/manufacturingIcons';

export function renderQuickEntryMenuIcon(menu: MenuTree): React.ReactNode {
  const resolveIconByPath = (path?: string): React.ComponentType<any> | null => {
    if (!path) return null;
    const p = path.toLowerCase();
    const segments = p.split('/').filter(Boolean);
    const appCode = segments[1] || '';
    const moduleCode = segments[2] || '';

    if (p.includes('work-order')) return LucideIcons.FileText;
    if (p.includes('reporting') || p.includes('report')) return LucideIcons.FileBarChart2;
    if (p.includes('inventory')) return LucideIcons.Boxes;
    if (p.includes('inbound') || p.includes('receipt') || p.includes('putaway')) return LucideIcons.ArrowDownToLine;
    if (p.includes('outbound') || p.includes('shipment') || p.includes('picking')) return LucideIcons.ArrowUpFromLine;
    if (p.includes('transfer') || p.includes('allocation')) return LucideIcons.ArrowLeftRight;
    if (p.includes('warning') || p.includes('alert')) return LucideIcons.AlertTriangle;
    if (p.includes('quality') || p.includes('inspection') || p.includes('iqc') || p.includes('oqc')) return LucideIcons.ClipboardCheck;
    if (p.includes('purchase')) return LucideIcons.ShoppingCart;
    if (p.includes('sales')) return LucideIcons.ReceiptText;
    if (p.includes('plan') || p.includes('scheduling')) return LucideIcons.CalendarClock;
    if (p.includes('equipment') || p.includes('maintenance')) return LucideIcons.Wrench;
    if (p.includes('master-data') || p.includes('base-data')) return LucideIcons.Database;

    const moduleIconMap: Record<string, React.ComponentType<any>> = {
      'sales-management': LucideIcons.ReceiptText,
      'purchase-management': LucideIcons.ShoppingCart,
      'warehouse-management': LucideIcons.Boxes,
      'production-execution': LucideIcons.FileText,
      'quality-management': LucideIcons.ClipboardCheck,
      'equipment-management': LucideIcons.Wrench,
      'plan-management': LucideIcons.CalendarClock,
      'performance-management': LucideIcons.Target,
      reports: LucideIcons.BarChart3,
      analytics: LucideIcons.BarChart3,
      'analysis-center': LucideIcons.BarChart3,
      'master-data': LucideIcons.Database,
    };
    if (moduleCode && moduleIconMap[moduleCode]) {
      return moduleIconMap[moduleCode];
    }

    const appIconMap: Record<string, React.ComponentType<any>> = {
      kuaizhizao: LucideIcons.Factory,
      kuaicaiwu: LucideIcons.Calculator,
      kuaireport: LucideIcons.BarChart3,
      'master-data': LucideIcons.Database,
      kuaiai: LucideIcons.Sparkles,
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
    FileSearchOutlined: LucideIcons.FileSearch,
    FileDoneOutlined: LucideIcons.FileCheck,
    FileAddOutlined: LucideIcons.FilePlus2,
    FileProtectOutlined: LucideIcons.FileLock2,
    FileExclamationOutlined: LucideIcons.FileWarning,
    FileSyncOutlined: LucideIcons.FileClock,
    ReconciliationOutlined: LucideIcons.ClipboardCheck,
    AuditOutlined: LucideIcons.ClipboardCheck,
    ContainerOutlined: LucideIcons.Boxes,
    WarningOutlined: LucideIcons.AlertTriangle,
    AlertOutlined: LucideIcons.AlertTriangle,
    SwapOutlined: LucideIcons.ArrowLeftRight,
    ImportOutlined: LucideIcons.ArrowDownToLine,
    ExportOutlined: LucideIcons.ArrowUpFromLine,
  };

  const lowerCaseIconMap: Record<string, React.ComponentType<any>> = {
    order: LucideIcons.FileText,
    workorder: LucideIcons.FileText,
    work_order: LucideIcons.FileText,
    report: LucideIcons.FileBarChart2,
    reporting: LucideIcons.FileBarChart2,
    inventory: LucideIcons.Boxes,
    inbound: LucideIcons.ArrowDownToLine,
    outbound: LucideIcons.ArrowUpFromLine,
    transfer: LucideIcons.ArrowLeftRight,
    warning: LucideIcons.AlertTriangle,
    quality: LucideIcons.ClipboardCheck,
    inspection: LucideIcons.ClipboardCheck,
    purchase: LucideIcons.ShoppingCart,
    sales: LucideIcons.ReceiptText,
    plan: LucideIcons.CalendarClock,
    equipment: LucideIcons.Wrench,
    warehouse: LucideIcons.Boxes,
    production: LucideIcons.Factory,
    masterdata: LucideIcons.Database,
    'master-data': LucideIcons.Database,
  };

  if (menu.icon && lucideIconMap[menu.icon]) {
    const IconComponent = lucideIconMap[menu.icon];
    return React.createElement(IconComponent, { size: 24 });
  }

  if (menu.icon) {
    const iconName = menu.icon as string;
    let DirectIcon = (LucideIcons as any)[iconName];

    if (!DirectIcon) {
      const pascalCaseName = iconName
        .split(/[-_]/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('');
      DirectIcon = (LucideIcons as any)[pascalCaseName];
    }

    if (DirectIcon) {
      return React.createElement(DirectIcon, { size: 24 });
    }

    const normalizedIconName = iconName.toLowerCase().replace(/[\s-_]/g, '');
    if (lowerCaseIconMap[normalizedIconName]) {
      const IconComponent = lowerCaseIconMap[normalizedIconName];
      return React.createElement(IconComponent, { size: 24 });
    }
  }

  const pathIcon = resolveIconByPath(menu.path);
  if (pathIcon) {
    return React.createElement(pathIcon, { size: 24 });
  }

  return React.createElement(LucideIcons.LayoutGrid, { size: 24 });
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
