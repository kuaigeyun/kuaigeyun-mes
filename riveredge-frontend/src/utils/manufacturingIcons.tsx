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
  // 新增常用图标
  Search,
  Edit,
  FileCheck,
  RotateCcw,
  ArrowDownCircle,
  ArrowUpCircle,
  MapPin,
  UserPlus,
  Filter,
  Headphones,
  Pencil,
  Book,
  BookOpen,
  RefreshCw,
  FileSearch,
  FileEdit,
  FilePlus,
  FileMinus,
  Folder,
  FolderOpen,
  Grid,
  Layout,
  LayoutGrid,
  Target,
  Award,
  Star,
  Check,
  X,
  Plus,
  Minus,
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
  AlertCircle,
  Info,
  HelpCircle,
  CheckCircle,
  Clock,
  Timer,
  CalendarDays,
  Sun,
  Moon,
  Home,
  Navigation,
  Compass,
  Map,
  MapPinned,
  Pin,
  PinOff,
  Flag,
  SortAsc,
  SortDesc,
  MoreHorizontal,
  MoreVertical,
  Menu,
  // WMS 相关图标
  Download,
  Upload,
  ArrowDownToLine,
  ArrowUpFromLine,
  // 应用图标
  DollarSign,
  Phone,
  Trophy,
  Cloud,
  Calculator,
  FolderKanban,
  Car,
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
  
  // 新增图标映射
  search: Search,
  edit: Edit,
  'file-check': FileCheck,
  'rotate-ccw': RotateCcw,
  'arrow-down-circle': ArrowDownCircle,
  'arrow-up-circle': ArrowUpCircle,
  'map-pin': MapPin,
  'user-plus': UserPlus,
  funnel: Filter,
  funnelPlot: Filter,
  headphones: Headphones,
  pencil: Pencil,
  book: Book,
  'book-open': BookOpen,
  'refresh-cw': RefreshCw,
  'rotate-cw': RotateCcw, // 顺时针旋转（委外物料）
  download: Download,
  upload: Upload,
  'arrow-down-to-line': ArrowDownToLine, // 入库（向下箭头到线）
  'arrow-up-from-line': ArrowUpFromLine, // 出库（向上箭头从线）
  'file-search': FileSearch,
  'file-edit': FileEdit,
  'file-plus': FilePlus,
  'file-minus': FileMinus,
  folder: Folder,
  'folder-open': FolderOpen,
  grid: Grid,
  layout: Layout,
  'layout-grid': LayoutGrid,
  target: Target,
  award: Award,
  star: Star,
  check: Check,
  x: X,
  plus: Plus,
  minus: Minus,
  'arrow-right': ArrowRight,
  'arrow-left': ArrowLeft,
  'arrow-up': ArrowUp,
  'arrow-down': ArrowDown,
  eye: Eye,
  'eye-off': EyeOff,
  lock: Lock,
  unlock: Unlock,
  'shield-check': ShieldCheck,
  'shield-alert': ShieldAlert,
  'shield-off': ShieldOff,
  'alert-circle': AlertCircle,
  info: Info,
  'help-circle': HelpCircle,
  'check-circle': CheckCircle,
  clock: Clock,
  timer: Timer,
  'calendar-days': CalendarDays,
  sun: Sun,
  moon: Moon,
  home: Home,
  home2: Home, // 使用 Home 替代 Home2
  navigation: Navigation,
  navigation2: Navigation, // 使用 Navigation 替代 Navigation2
  compass: Compass,
  map: Map,
  'map-pinned': MapPinned,
  location: MapPin, // 使用 MapPin 替代 Location
  location2: MapPin, // 使用 MapPin 替代 Location2
  pin: Pin,
  'pin-off': PinOff,
  flag: Flag,
  filter: Filter,
  'sort-asc': SortAsc,
  'sort-desc': SortDesc,
  'more-horizontal': MoreHorizontal,
  'more-vertical': MoreVertical,
  menu: Menu,
  'menu-square': Menu, // 使用 Menu 替代 MenuSquare
  
  // 应用图标映射
  dollar: DollarSign, // 财务
  schedule: Calendar, // APS 排程
  certificate: Award, // 认证
  'customer-service': Phone, // CRM 客户服务
  thunderbolt: Zap, // EMS 能源管理
  trophy: Trophy, // EPM 企业绩效
  'cloud-server': Cloud, // IOT 物联网
  experiment: FlaskConical, // LIMS/PDM 实验/研发（使用已有的 FlaskConical）
  calculator: Calculator, // MRP 物料需求计划
  project: FolderKanban, // PM 项目管理
  'safety-certificate': ShieldCheck, // QMS 质量认证（使用已有的 ShieldCheck）
  apartment: Building2, // SCM 供应链（使用已有的 Building2）
  shopping: ShoppingCart, // SRM 供应商关系（使用已有的 ShoppingCart）
  car: Car, // TMS 运输管理
  
  // 兼容性映射（支持多种命名方式）
  'bar-chart': BarChart3,
  'line-chart': TrendingUp,
  'pie-chart': PieChart,
  'trending-down': TrendingUp, // 使用 TrendingUp 替代 TrendingDown（Lucide 没有 TrendingDown）
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
