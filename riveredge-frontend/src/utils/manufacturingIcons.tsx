/**
 * 制造业相关图标工具
 * 
 * 使用 Lucide React 提供统一的图标风格
 * 左侧菜单使用 Lucide 图标，其他系统布局图标使用 Ant Design Icons
 * 包含：设备、生产线、工具、工业流程等图标
 */

import React from 'react';
// Lucide React - 统一的图标库，用于左侧菜单
// Lucide React - 统一的图标库，用于左侧菜单
import {
  Factory,
  Building2,
  Cog,
  Settings,
  Settings2,
  Wrench,
  Hammer,
  Warehouse,
  Box,
  Package,
  Truck,
  Cpu,
  Zap,
  FlaskConical,
  Flame,
  HardHat,
  Shield,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  TrendingUp,
  BarChart3,
  PieChart,
  ClipboardCheck,
  ClipboardList,
  FileText,
  Receipt,
  ShoppingCart,
  ShoppingBag,
  Construction,
  Bot,
  // 通用图标，用于替代 Ant Design Icons
  LayoutDashboard,
  User,
  Users,
  UserCog,
  Crown,
  Grid3x3,
  Sliders,
  Store,
  Database,
  Monitor,
  Globe,
  Network,
  Code,
  Printer,
  History,
  Calendar,
  PlayCircle,
  Inbox,
  Bell,
  Mail,
  LogIn,
  LogOut,
  List,
  FileCode,
  Key,
  Globe2,
  Activity,
  Server,
  Gauge,
  Workflow,
  Layers,
  Package2,
  Boxes,
} from 'lucide-react';

/**
 * 制造业图标映射
 * 提供常用制造业场景的图标映射
 * 所有图标使用 Lucide React，确保风格统一
 */
export const ManufacturingIcons = {
  // 工厂和设备
  factory: Factory,
  manufacturing: Factory,
  industry: Factory,
  building: Building2,
  factoryBuilding: Building2,
  
  // 机器和设备
  machine: Cog,
  equipment: Cog,
  gear: Cog,
  cogs: Settings, // Lucide 没有 Cogs，使用 Settings 替代
  robot: Bot, // Lucide 没有 Robot，使用 Bot 替代
  automation: Bot,
  
  // 工具和维修
  tool: Wrench, // Lucide 没有 Tool，使用 Wrench 替代
  tools: Wrench,
  toolbox: Wrench, // Lucide 没有 Tool，使用 Wrench 替代
  wrench: Wrench,
  hammer: Hammer,
  maintenance: Wrench,
  repair: Hammer,
  
  // 生产线和装配
  productionLine: Settings, // Lucide 没有 Cogs，使用 Settings 替代
  assembly: Settings,
  conveyorBelt: Settings,
  production: TrendingUp,
  workflow: Workflow, // 工作流/工艺路线
  process: Workflow, // 工艺管理
  
  // 仓储和物流
  warehouse: Warehouse,
  storage: Warehouse,
  inventory: Box,
  package: Package,
  box: Box,
  boxes: Box,
  pallet: Box,
  storagePallet: Box,
  
  // 运输和配送
  truck: Truck,
  truckLoading: Truck,
  truckMoving: Truck,
  truckPickup: Truck,
  shipping: Truck,
  shippingFast: Truck,
  
  // 能源和动力
  power: Zap,
  electricity: Zap,
  bolt: Zap,
  
  // 化学和实验室
  chemical: FlaskConical,
  lab: FlaskConical,
  flask: FlaskConical,
  furnace: Flame,
  fire: Flame,
  
  // 电子和芯片
  electronics: Cpu,
  microchip: Cpu,
  
  // 安全和质量
  safety: HardHat,
  hardHat: HardHat,
  quality: Shield,
  shield: Shield,
  inspection: ClipboardCheck,
  
  // 订单和交付
  order: FileText,
  delivery: Receipt,
  receipt: Receipt,
  invoice: FileText,
  shoppingCart: ShoppingCart,
  shoppingBag: ShoppingBag,
  
  // 分析和报告
  analytics: BarChart3,
  report: PieChart,
  chartLine: TrendingUp,
  chartBar: BarChart3,
  chartPie: PieChart,
  
  // 清单和检查
  checklist: ClipboardList,
  clipboardCheck: ClipboardCheck,
  clipboardList: ClipboardList,
  
  // 状态图标
  checkCircle: CheckCircle2,
  timesCircle: XCircle,
  exclamationTriangle: AlertTriangle,
  
  // 设置和配置
  mdSettings: Settings,
  mdConfiguration: Settings2,
  mdPrecision: Cog,
  mdFactory: Factory,
  mdManufacturing: Factory,
  mdBuild: Construction,
  mdMaintenance: Wrench,
  mdConstruction: Construction,
  mdWorkshop: Construction,
  mdEngineering: Cog,
  mdDesign: Cog,
  mdPrecisionManufacturing: Cog,
  
  // 通用图标映射（用于替代 Ant Design Icons）
  dashboard: Gauge, // 使用工业仪表盘图标，更符合制造业
  user: User,
  users: Users,
  team: Users,
  userSwitch: UserCog,
  crown: Crown,
  appstore: Factory, // MES 系统使用工厂图标，更工业
  control: Cog, // 系统配置使用齿轮图标，更工业
  shop: Store,
  database: Database,
  monitor: Monitor,
  global: Globe,
  api: Network,
  code: Code,
  printer: Printer,
  history: History,
  calendar: Calendar,
  playCircle: PlayCircle,
  inbox: Inbox,
  bell: Bell,
  mail: Mail,
  login: LogIn,
  logout: LogOut,
  list: List,
  fileCode: FileCode,
  key: Key,
  globe2: Globe2,
  activity: Activity,
  server: Server,
  
  // 增强工业关联度的图标
  industrialDashboard: Gauge, // 工业仪表盘
  mesSystem: Factory, // MES 制造执行系统
  systemConfig: Cog, // 系统配置（齿轮）
  operationsCenter: Factory, // 运营中心（工厂）
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
 * import { getManufacturingIcon } from '@/utils/manufacturingIcons';
 * 
 * // 使用工厂图标
 * <Icon component={getManufacturingIcon('factory', { size: 24 })} />
 * 
 * // 或者直接使用
 * const FactoryIcon = getManufacturingIcon('factory');
 * <FactoryIcon size={24} color="#1890ff" />
 * ```
 */
export function getManufacturingIcon(
  iconName: keyof typeof ManufacturingIcons,
  props?: React.ComponentProps<typeof ManufacturingIcons[typeof iconName]>
): React.ComponentType<any> {
  const IconComponent = ManufacturingIcons[iconName];
  if (!IconComponent) {
    console.warn(`图标 "${iconName}" 不存在，使用默认图标`);
    return Factory;
  }
  
  // 返回一个包装组件，应用传入的 props
  return (iconProps: any) => {
    return React.createElement(IconComponent, { ...props, ...iconProps });
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
