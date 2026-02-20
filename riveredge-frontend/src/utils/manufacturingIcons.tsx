/**
 * 制造业相关图标工具
 * 
 * 使用 Lucide React 提供统一的图标风格
 * 左侧菜单使用 Lucide 图标，其他系统布局图标使用 Ant Design Icons
 * 包含：设备、生产线、工具、工业流程等图标
 * 
 * 全量导入 Lucide React 所有图标，避免导入错误并支持动态访问
 */

import React from 'react';
// Lucide React - 全量导入所有图标
import * as LucideIcons from 'lucide-react';

/**
 * 从 Lucide Icons 获取图标组件
 * 支持动态访问所有 Lucide 图标
 * 
 * @param iconName - 图标名称（PascalCase，如 'Factory', 'Home'）
 * @returns 图标组件，如果不存在则返回默认图标
 */
function getLucideIcon(iconName: string): React.ComponentType<any> {
  // 尝试直接访问
  const Icon = (LucideIcons as any)[iconName];
  if (Icon) {
    return Icon;
  }
  
  // 如果直接访问失败，尝试转换为 PascalCase
  const pascalCaseName = iconName
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
  
  const PascalIcon = (LucideIcons as any)[pascalCaseName];
  if (PascalIcon) {
    return PascalIcon;
  }
  
  // 如果都找不到，返回默认图标
  console.warn(`图标 "${iconName}" 在 Lucide Icons 中不存在，使用默认图标 Factory`);
  return LucideIcons.Factory || React.Fragment;
}

/**
 * 制造业图标映射
 * 提供常用制造业场景的图标映射
 * 所有图标使用 Lucide React，确保风格统一
 * 
 * 使用动态访问 Lucide Icons，支持所有可用图标
 */
export const ManufacturingIcons = {
  // 工厂和设备
  factory: getLucideIcon('Factory'),
  manufacturing: getLucideIcon('Factory'),
  industry: getLucideIcon('Factory'),
  building: getLucideIcon('Building2'),
  factoryBuilding: getLucideIcon('Building2'),
  
  // 机器和设备
  machine: getLucideIcon('Cog'),
  equipment: getLucideIcon('Cog'),
  gear: getLucideIcon('Cog'),
  cogs: getLucideIcon('Settings'), // Lucide 没有 Cogs，使用 Settings 替代
  robot: getLucideIcon('Bot'), // Lucide 没有 Robot，使用 Bot 替代
  automation: getLucideIcon('Bot'),
  
  // 工具和维修
  tool: getLucideIcon('Wrench'), // Lucide 没有 Tool，使用 Wrench 替代
  tools: getLucideIcon('Wrench'),
  toolbox: getLucideIcon('Wrench'), // Lucide 没有 Tool，使用 Wrench 替代
  wrench: getLucideIcon('Wrench'),
  hammer: getLucideIcon('Hammer'),
  maintenance: getLucideIcon('Wrench'),
  repair: getLucideIcon('Hammer'),
  
  // 生产线和装配
  productionLine: getLucideIcon('Settings'), // Lucide 没有 Cogs，使用 Settings 替代
  assembly: getLucideIcon('Settings'),
  conveyorBelt: getLucideIcon('Settings'),
  production: getLucideIcon('TrendingUp'),
  workflow: getLucideIcon('Workflow'), // 工作流/工艺路线
  process: getLucideIcon('Workflow'), // 工艺管理
  
  // 仓储和物流
  warehouse: getLucideIcon('Warehouse'),
  storage: getLucideIcon('Warehouse'),
  inventory: getLucideIcon('Box'),
  package: getLucideIcon('Package'),
  box: getLucideIcon('Box'),
  boxes: getLucideIcon('Box'),
  pallet: getLucideIcon('Box'),
  storagePallet: getLucideIcon('Box'),
  
  // 运输和配送
  truck: getLucideIcon('Truck'),
  truckLoading: getLucideIcon('Truck'),
  truckMoving: getLucideIcon('Truck'),
  truckPickup: getLucideIcon('Truck'),
  shipping: getLucideIcon('Truck'),
  shippingFast: getLucideIcon('Truck'),
  
  // 能源和动力
  power: getLucideIcon('Zap'),
  electricity: getLucideIcon('Zap'),
  bolt: getLucideIcon('Zap'),
  
  // 化学和实验室
  chemical: getLucideIcon('FlaskConical'),
  lab: getLucideIcon('FlaskConical'),
  flask: getLucideIcon('FlaskConical'),
  furnace: getLucideIcon('Flame'),
  fire: getLucideIcon('Flame'),
  
  // 电子和芯片
  electronics: getLucideIcon('Cpu'),
  microchip: getLucideIcon('Cpu'),
  
  // 安全和质量
  safety: getLucideIcon('HardHat'),
  hardHat: getLucideIcon('HardHat'),
  quality: getLucideIcon('Shield'), // 质量 - 使用盾牌图标（保持向后兼容）
  shield: getLucideIcon('Shield'), // 角色/权限/安全 - 统一使用盾牌图标
  inspection: getLucideIcon('ClipboardCheck'),
  
  // 订单和交付
  order: getLucideIcon('FileText'),
  delivery: getLucideIcon('Receipt'),
  receipt: getLucideIcon('Receipt'),
  invoice: getLucideIcon('FileText'),
  shoppingCart: getLucideIcon('ShoppingCart'),
  shoppingBag: getLucideIcon('ShoppingBag'),
  
  // 分析和报告
  analytics: getLucideIcon('BarChart3'),
  report: getLucideIcon('PieChart'),
  chartLine: getLucideIcon('TrendingUp'),
  trendingUp: getLucideIcon('TrendingUp'), // 销售增长/趋势上升
  chartBar: getLucideIcon('BarChart3'),
  chartPie: getLucideIcon('PieChart'),
  
  // 清单和检查
  checklist: getLucideIcon('ClipboardList'),
  clipboardCheck: getLucideIcon('ClipboardCheck'),
  clipboardList: getLucideIcon('ClipboardList'),
  
  // 状态图标
  checkCircle: getLucideIcon('CheckCircle2'),
  timesCircle: getLucideIcon('XCircle'),
  exclamationTriangle: getLucideIcon('AlertTriangle'),
  
  // 设置和配置
  mdSettings: getLucideIcon('Settings'),
  mdConfiguration: getLucideIcon('Settings2'),
  mdPrecision: getLucideIcon('Cog'),
  mdFactory: getLucideIcon('Factory'),
  mdManufacturing: getLucideIcon('Factory'),
  mdBuild: getLucideIcon('Construction'),
  mdMaintenance: getLucideIcon('Wrench'),
  mdConstruction: getLucideIcon('Construction'),
  mdWorkshop: getLucideIcon('Construction'),
  mdEngineering: getLucideIcon('Cog'),
  mdDesign: getLucideIcon('Cog'),
  mdPrecisionManufacturing: getLucideIcon('Cog'),
  
  // 通用图标映射（用于替代 Ant Design Icons）
  dashboard: getLucideIcon('Gauge'), // 使用工业仪表盘图标，更符合制造业
  user: getLucideIcon('User'),
  users: getLucideIcon('Users'),
  team: getLucideIcon('Users'),
  userSwitch: getLucideIcon('UserCog'),
  crown: getLucideIcon('Crown'),
  appstore: getLucideIcon('Factory'), // MES 系统使用工厂图标，更工业
  control: getLucideIcon('Cog'), // 系统配置使用齿轮图标，更工业
  shop: getLucideIcon('Store'),
  database: getLucideIcon('Database'),
  monitor: getLucideIcon('Monitor'),
  global: getLucideIcon('Globe'),
  api: getLucideIcon('Network'),
  code: getLucideIcon('Code'),
  printer: getLucideIcon('Printer'),
  history: getLucideIcon('History'),
  calendar: getLucideIcon('Calendar'),
  playCircle: getLucideIcon('PlayCircle'),
  inbox: getLucideIcon('Inbox'),
  bell: getLucideIcon('Bell'),
  mail: getLucideIcon('Mail'),
  login: getLucideIcon('LogIn'),
  logout: getLucideIcon('LogOut'),
  list: getLucideIcon('List'),
  fileCode: getLucideIcon('FileCode'),
  key: getLucideIcon('Key'),
  globe2: getLucideIcon('Globe2'),
  activity: getLucideIcon('Activity'),
  server: getLucideIcon('Server'),
  languages: getLucideIcon('Languages'), // 语言管理
  bookOpen: getLucideIcon('BookOpen'), // 数据字典/书籍
  userCircle: getLucideIcon('UserCircle'), // 个人中心
  hardDrive: getLucideIcon('HardDrive'), // 数据备份/存储
  network: getLucideIcon('Network'), // API/网络接口
  fileText: getLucideIcon('FileText'), // 模板/文件
  logIn: getLucideIcon('LogIn'), // 登录日志
  userCog: getLucideIcon('UserCog'), // 用户管理/角色管理
  
  // 增强工业关联度的图标
  industrialDashboard: getLucideIcon('Gauge'), // 工业仪表盘
  mesSystem: getLucideIcon('Factory'), // MES 制造执行系统
  systemConfig: getLucideIcon('Cog'), // 系统配置（齿轮）
  operationsCenter: getLucideIcon('Factory'), // 运营中心（工厂）
  
  // 新增图标映射
  search: getLucideIcon('Search'),
  edit: getLucideIcon('Edit'),
  'file-check': getLucideIcon('FileCheck'),
  'rotate-ccw': getLucideIcon('RotateCcw'),
  'arrow-down-circle': getLucideIcon('ArrowDownCircle'),
  'arrow-up-circle': getLucideIcon('ArrowUpCircle'),
  'map-pin': getLucideIcon('MapPin'),
  'user-plus': getLucideIcon('UserPlus'),
  funnel: getLucideIcon('Filter'),
  funnelPlot: getLucideIcon('Filter'),
  headphones: getLucideIcon('Headphones'),
  pencil: getLucideIcon('Pencil'),
  book: getLucideIcon('Book'),
  'book-open': getLucideIcon('BookOpen'),
  'refresh-cw': getLucideIcon('RefreshCw'),
  'rotate-cw': getLucideIcon('RotateCcw'), // 顺时针旋转（委外物料）
  download: getLucideIcon('Download'),
  upload: getLucideIcon('Upload'),
  'arrow-down-to-line': getLucideIcon('ArrowDownToLine'), // 入库（向下箭头到线）
  'arrow-up-from-line': getLucideIcon('ArrowUpFromLine'), // 出库（向上箭头从线）
  'file-search': getLucideIcon('FileSearch'),
  'file-edit': getLucideIcon('FileEdit'),
  'file-plus': getLucideIcon('FilePlus'),
  'file-minus': getLucideIcon('FileMinus'),
  folder: getLucideIcon('Folder'),
  'folder-open': getLucideIcon('FolderOpen'),
  grid: getLucideIcon('Grid'),
  layout: getLucideIcon('Layout'),
  'layout-grid': getLucideIcon('LayoutGrid'),
  layoutDashboard: getLucideIcon('LayoutDashboard'), // 大屏/看板布局
  target: getLucideIcon('Target'),
  award: getLucideIcon('Award'),
  star: getLucideIcon('Star'),
  check: getLucideIcon('Check'),
  x: getLucideIcon('X'),
  plus: getLucideIcon('Plus'),
  minus: getLucideIcon('Minus'),
  'arrow-right': getLucideIcon('ArrowRight'),
  'arrow-left': getLucideIcon('ArrowLeft'),
  'arrow-up': getLucideIcon('ArrowUp'),
  'arrow-down': getLucideIcon('ArrowDown'),
  eye: getLucideIcon('Eye'),
  'eye-off': getLucideIcon('EyeOff'),
  lock: getLucideIcon('Lock'),
  unlock: getLucideIcon('Unlock'),
  'shield-check': getLucideIcon('ShieldCheck'),
  'shield-alert': getLucideIcon('ShieldAlert'),
  'shield-off': getLucideIcon('ShieldOff'),
  'alert-circle': getLucideIcon('AlertCircle'),
  info: getLucideIcon('Info'),
  'help-circle': getLucideIcon('HelpCircle'),
  'check-circle': getLucideIcon('CheckCircle'),
  clock: getLucideIcon('Clock'),
  timer: getLucideIcon('Timer'),
  'calendar-days': getLucideIcon('CalendarDays'),
  sun: getLucideIcon('Sun'),
  moon: getLucideIcon('Moon'),
  home: getLucideIcon('Home'),
  home2: getLucideIcon('Home'), // 使用 Home 替代 Home2
  navigation: getLucideIcon('Navigation'),
  navigation2: getLucideIcon('Navigation'), // 使用 Navigation 替代 Navigation2
  compass: getLucideIcon('Compass'),
  map: getLucideIcon('Map'),
  'map-pinned': getLucideIcon('MapPinned'),
  location: getLucideIcon('MapPin'), // 使用 MapPin 替代 Location
  location2: getLucideIcon('MapPin'), // 使用 MapPin 替代 Location2
  pin: getLucideIcon('Pin'),
  'pin-off': getLucideIcon('PinOff'),
  flag: getLucideIcon('Flag'),
  filter: getLucideIcon('Filter'),
  'sort-asc': getLucideIcon('SortAsc'),
  'sort-desc': getLucideIcon('SortDesc'),
  'more-horizontal': getLucideIcon('MoreHorizontal'),
  'more-vertical': getLucideIcon('MoreVertical'),
  menu: getLucideIcon('Menu'),
  'menu-square': getLucideIcon('Menu'), // 使用 Menu 替代 MenuSquare
  
  // 应用图标映射
  // 注意：已移除 dollar 图标，使用更通用的图标（如 Calculator, TrendingUp 等）
  schedule: getLucideIcon('Calendar'), // APS 排程
  certificate: getLucideIcon('Award'), // 认证
  'customer-service': getLucideIcon('Phone'), // CRM 客户服务
  thunderbolt: getLucideIcon('Zap'), // EMS 能源管理
  trophy: getLucideIcon('Trophy'), // EPM 企业绩效
  'cloud-server': getLucideIcon('Cloud'), // IOT 物联网
  experiment: getLucideIcon('FlaskConical'), // LIMS/PDM 实验/研发（使用已有的 FlaskConical）
  calculator: getLucideIcon('Calculator'), // 成本管理/MRP - 使用计算器图标（通用，不含货币符号）
  wallet: getLucideIcon('Wallet'), // 财务管理 - 使用钱包图标
  dollarSign: getLucideIcon('DollarSign'), // 财务/货币相关
  creditCard: getLucideIcon('CreditCard'), // 销售/支付相关
  archive: getLucideIcon('Archive'), // 仓库数据/归档
  boxes: getLucideIcon('Boxes'), // 多个盒子（仓库存储）
  project: getLucideIcon('FolderKanban'), // PM 项目管理
  'safety-certificate': getLucideIcon('ShieldCheck'), // QMS 质量认证（使用已有的 ShieldCheck）
  apartment: getLucideIcon('Building2'), // SCM 供应链（使用已有的 Building2）
  shopping: getLucideIcon('ShoppingCart'), // SRM 供应商关系（使用已有的 ShoppingCart）
  car: getLucideIcon('Car'), // TMS 运输管理
  
  // 兼容性映射（支持多种命名方式）
  'bar-chart': getLucideIcon('BarChart3'),
  'line-chart': getLucideIcon('TrendingUp'),
  'pie-chart': getLucideIcon('PieChart'),
  'trending-down': getLucideIcon('TrendingUp'), // 使用 TrendingUp 替代 TrendingDown（Lucide 没有 TrendingDown）
} as const;

/**
 * 获取制造业图标组件
 * 
 * @param iconName - 图标名称
 * @param props - 图标属性（如 size, color 等）
 * @returns React 图标组件
 * 
 * @example
 * ```tsx
 * import { getManufacturingIcon } from '../utils/manufacturingIcons';
 * 
 * // 使用工厂图标
 * <Icon component={getManufacturingIcon('factory', { size: 24 })} />
 * 
 * // 或者直接使用
 * const FactoryIcon = getManufacturingIcon('factory');
 * <FactoryIcon size={24} color="#1890ff" />
 * ```
 */
/**
 * 获取制造业图标组件
 * 
 * @param iconName - 图标名称（支持 ManufacturingIcons 中的键名，或直接使用 Lucide 图标名）
 * @param props - 图标属性（如 size, color 等）
 * @returns React 图标组件
 * 
 * @example
 * ```tsx
 * import { getManufacturingIcon } from '../utils/manufacturingIcons';
 * 
 * // 使用预定义的图标
 * <Icon component={getManufacturingIcon('factory', { size: 24 })} />
 * 
 * // 或者直接使用
 * const FactoryIcon = getManufacturingIcon('factory');
 * <FactoryIcon size={24} color="#1890ff" />
 * 
 * // 直接使用 Lucide 图标名（动态访问）
 * const CustomIcon = getManufacturingIcon('Camera');
 * <CustomIcon size={24} />
 * ```
 */
export function getManufacturingIcon(
  iconName: string,
  props?: React.ComponentProps<any>
): React.ComponentType<any> {
  // 首先尝试从预定义的 ManufacturingIcons 中获取
  if (iconName in ManufacturingIcons) {
    const IconComponent = ManufacturingIcons[iconName as keyof typeof ManufacturingIcons];
    if (IconComponent) {
      // 返回一个包装组件，应用传入的 props
      return (iconProps: any) => {
        return React.createElement(IconComponent, { ...props, ...iconProps });
      };
    }
  }
  
  // 如果预定义映射中没有，尝试直接从 Lucide Icons 中获取
  const LucideIcon = getLucideIcon(iconName);
  if (LucideIcon && LucideIcon !== React.Fragment) {
    return (iconProps: any) => {
      return React.createElement(LucideIcon, { ...props, ...iconProps });
    };
  }
  
  // 如果都找不到，返回默认图标
  console.warn(`图标 "${iconName}" 不存在，使用默认图标 Factory`);
  const DefaultIcon = getLucideIcon('Factory');
  return (iconProps: any) => {
    return React.createElement(DefaultIcon, { ...props, ...iconProps });
  };
}

/**
 * 制造业图标类型
 */
export type ManufacturingIconName = keyof typeof ManufacturingIcons;

/**
 * 常用制造业场景图标映射
 */
export const ManufacturingIconMap = {
  // 生产管理
  production: ManufacturingIcons.production,
  productionLine: ManufacturingIcons.productionLine,
  assembly: ManufacturingIcons.assembly,
  
  // 设备管理
  machine: ManufacturingIcons.machine,
  equipment: ManufacturingIcons.equipment,
  maintenance: ManufacturingIcons.maintenance,
  
  // 仓储管理
  warehouse: ManufacturingIcons.warehouse,
  inventory: ManufacturingIcons.inventory,
  storage: ManufacturingIcons.storage,
  
  // 物流配送
  shipping: ManufacturingIcons.shipping,
  truck: ManufacturingIcons.truck,
  delivery: ManufacturingIcons.delivery,
  
  // 质量管理
  quality: ManufacturingIcons.quality,
  inspection: ManufacturingIcons.inspection,
  checklist: ManufacturingIcons.checklist,
  
  // 订单管理
  order: ManufacturingIcons.order,
  receipt: ManufacturingIcons.receipt,
  invoice: ManufacturingIcons.invoice,
} as const;
