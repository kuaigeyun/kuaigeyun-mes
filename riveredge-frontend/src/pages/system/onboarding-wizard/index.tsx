/**
 * 自助式上线向导页面
 *
 * 系统上线：从0到可开单的步骤式引导（数据校验）
 * 按角色：为每个角色提供上线准备向导，包括数据准备、权限配置、操作培训等
 *
 * @author Luigi Lu
 * @date 2026-01-27
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, Tabs, Steps, Checkbox, Space, Typography, Tag, Button, List, Empty, Alert, theme, ConfigProvider, Row, Col, Menu, Popover, Progress } from 'antd';
import Lottie from 'lottie-react';
import guideAnimation from '../../../../static/lottie/guide.json';
import { getTenantId } from '../../../utils/auth';
import {
  AlertCircle,
  AlertTriangle,
  Archive,
  CheckCircle2,
  FileSearch,
  PlayCircle,
  RefreshCw,
  Rocket,
  Target,
  Zap,
  CalendarClock,
  type LucideIcon,
} from 'lucide-react';
import { App } from 'antd';
import { getRoleOnboardingGuide, getSystemGoLiveGuide } from '../../../services/onboarding';
import { useGuideStore } from '../../../components/onboarding-guide/store';
import { getUserList } from '../../../services/user';
import { listSalesOrders } from '../../../apps/kuaizhizao/services/sales-order';
import { listPurchaseOrders } from '../../../apps/kuaizhizao/services/purchase';

// 引入真实的业务接口
import { customerApi, supplierApi } from '../../../apps/master-data/services/supply-chain';
import { materialApi, bomApi } from '../../../apps/master-data/services/material';
import { warehouseApi } from '../../../apps/master-data/services/warehouse';
import { workCenterApi } from '../../../apps/master-data/services/factory';
import { processRouteApi } from '../../../apps/master-data/services/process';
import { useThemeStore } from '../../../stores/themeStore';
import { ManufacturingIcons } from '../../../utils/manufacturingIcons';

const { Title, Paragraph, Text } = Typography;
const { Step } = Steps;

/** 与侧栏/顶栏菜单 pathMap 对齐的 Lucide 图标尺寸（上线向导左栏） */
const ONBOARDING_MENU_ICON_SIZE = 16;

function onboardingMenuIcon(Icon: React.ComponentType<{ size?: number }>): React.ReactNode {
  return React.createElement(Icon, { size: ONBOARDING_MENU_ICON_SIZE });
}

/** 页面内统一 Lucide 图标（antd Button/Alert 等需要 ReactNode） */
function wizIcon(
  Icon: LucideIcon,
  size: number,
  style?: React.CSSProperties,
  color?: string
): React.ReactElement {
  return React.createElement(Icon, {
    size,
    strokeWidth: size <= 14 ? 1.75 : 2,
    style,
    color,
  });
}

/**
 * 角色向导：图标与「快制造 / 主数据 / 财务」等菜单一一对应，且互不重复（见 BasicLayout getMenuIcon pathMap）
 */
const ROLE_KEYS: Array<{ code: string; name: string; icon: React.ReactNode }> = [
  { code: 'sales', name: '销售业务向导', icon: onboardingMenuIcon(ManufacturingIcons.chartLine) }, // 销售管理
  { code: 'purchase', name: '采购业务向导', icon: onboardingMenuIcon(ManufacturingIcons.shoppingBag) }, // 采购管理
  { code: 'warehouse', name: '仓储管理向导', icon: onboardingMenuIcon(ManufacturingIcons.warehouse) }, // 仓储管理
  { code: 'technician', name: '工艺与技术向导', icon: onboardingMenuIcon(ManufacturingIcons.workflow) }, // 工艺路线/工作流
  { code: 'planner', name: '生产计划向导', icon: onboardingMenuIcon(ManufacturingIcons.calendar) }, // 计划管理
  { code: 'supervisor', name: '车间班组向导', icon: onboardingMenuIcon(ManufacturingIcons.users) }, // 现场班组
  { code: 'operator', name: '生产操作向导', icon: onboardingMenuIcon(ManufacturingIcons.activity) }, // 生产执行
  { code: 'quality', name: '品质控制向导', icon: onboardingMenuIcon(ManufacturingIcons.quality) }, // 质量管理
  { code: 'equipment', name: '设备运维向导', icon: onboardingMenuIcon(ManufacturingIcons.wrench) }, // 设备管理
  { code: 'finance', name: '财务结算向导', icon: onboardingMenuIcon(ManufacturingIcons.wallet) }, // 财务管理
  { code: 'manager', name: '管理决策向导', icon: onboardingMenuIcon(ManufacturingIcons.trophy) }, // 绩效管理/经营结果
  { code: 'implementer', name: '系统实施专家向导', icon: onboardingMenuIcon(ManufacturingIcons.package) }, // 实施交付（与菜单包裹应用包意象一致，不重复）
];

/**
 * 自助式上线向导页面组件
 */
const OnboardingWizardPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const runGuide = useGuideStore((s) => s.runGuide);
  const { token } = theme.useToken();
  const isDark = useThemeStore((s) => s.resolved.isDark);

  // 注入局部样式以强制 Steps 标题撑开并实现右对齐
  const stepStyle = `
    .onboarding-steps .ant-steps-item-content {
      width: 100%;
      overflow: hidden;
    }
    .onboarding-steps .ant-steps-item-title {
      width: 100% !important;
      padding-right: 0 !important;
      display: block !important;
    }
    .onboarding-action-btn {
      transition: all 0.3s ease !important;
    }
    .onboarding-action-btn:hover {
      transform: translateY(-1px);
      filter: brightness(1.1);
      box-shadow: 0 6px 15px rgba(0,0,0,0.15) !important;
    }
    /* 完成态：避免 ant-btn-default 的灰底/hover 盖住 inline，读起来像禁用 */
    .onboarding-completed-btn.ant-btn {
      background: ${token.colorSuccessBg} !important;
      border: 1px solid ${token.colorSuccessBorder} !important;
      color: ${token.colorSuccess} !important;
      box-shadow: none !important;
      opacity: 1 !important;
    }
    .onboarding-completed-btn.ant-btn .anticon,
    .onboarding-completed-btn.ant-btn svg {
      color: ${token.colorSuccess} !important;
    }
    .onboarding-completed-btn.ant-btn:not(:disabled):hover,
    .onboarding-completed-btn.ant-btn:not(:disabled):focus-visible {
      background: ${token.colorSuccessBg} !important;
      border-color: ${token.colorSuccess} !important;
      color: ${token.colorSuccess} !important;
    }
  `;


  /**
   * 业务深度引导内容库
   * 针对核心任务项注入“实施专家”级别的详实说明
   */
  /**
   * “快格云制造”进销存+生产一体化引导库
   * 严格切合制造现场与仓储流转的真实业务场景
   */
  const ENHANCED_MISSION_GUIDE: Record<string, { mission: string; standard: string; tip?: string; dependency?: string }> = {
    'material_data': {
      mission: '定义物料的“数字孪生”属性，包括进销存端的采购/销售单价，及生产端的 BOM/工艺关联关系。',
      standard: '完成核心原料、半成品、成品的分类录入，且计量单位体系（主/辅单位）已确立。',
      tip: '物料的“提前期”设置将直接影响后续计划系统的准确性，请根据历史平均值填写。',
      dependency: '需预先确立物料编码规范与分类体系。'
    },
    'bom_config': {
      mission: '构建产品的制造结构，确立物料清单（BOM）与进销存端成本核算的对应关系。',
      standard: '主推产品的 BOM 处于“已审核”状态，且损耗率配置符合车间实际损耗情况。',
      tip: '对于需要批次追溯的物料，请在 BOM 子项中明确标注，这会触发生产领料时的校验。',
      dependency: '需先完成所有子项物料的【主数据录入】。'
    },
    'warehouse_data': {
      mission: '规划物理仓库在数字化系统中的逻辑布局，支撑进销存出入库与生产领料。',
      standard: '完成原材料仓、半成品/成品仓的定义，且货位管理逻辑（如开启/关闭）已明确。',
      tip: '生产现场建议设置一个“现场仓（线边仓）”，用于管理正在加工中的在制品（WIP）。'
    },
    'process_routing': {
      mission: '锁定生产工序流转顺序、标准工时及工作中心。这是生产成本核算与进度跟踪的核心。',
      standard: '完成产品工艺路线配置，且工序间的逻辑关系（串行/并行）与车间实操一致。',
      tip: '工时数据的精度直接影响排产（APS）的有效性，初期可使用经验值，后期通过报工数据优化。',
      dependency: '需预先定义【工作中心】与【资源组】。'
    },
    'sales_config': {
      mission: '建立以销定产的源头，定义客户档案、价格体系及销售订单流转规则。',
      standard: '完成核心客户数据录入，且销售订单到生产订单的触发逻辑已配置。',
      tip: '建议开启“信用额度”控制，将财务风险防范前置到销售录单阶段。'
    },
    'purchase_config': {
      mission: '确保生产物料的稳定供应，定义供应商档案、采购合同模板及入库检验流程。',
      standard: '完成核心供应商录入，且采购到收货入库的流程已跑通。',
      tip: '配置“收货待检区”能有效配合质量管理（QC）流程，确保入库物料 100% 合格。'
    },
    'first_order_run': {
      mission: '快格云制造全链路闭环验证：销售下单 -> 计划排产 -> 车间生产/报工 -> 完工入库 -> 销售发货。',
      standard: '完成至少一笔完整的“进-销-存-产”一体化业务循环，且库存台账与生产档案准确。',
      tip: '这是系统正式上线的终极考核，务必邀请各部门业务骨干参与，确认数据流与价值流的连贯性。',
      dependency: '需保证【进销存基础、MES 建模、权限配置】均已就绪。'
    }
  };

  /**
   * 角色使命映射
   * 为每个岗位提供更高维度的业务视角
   */
  const ROLE_MISSION_MAP: Record<string, string> = {
    'sales': '核心使命：打通从客户询价到订单交付的全过程，确保交货不延期。',
    'purchase': '核心使命：找准供应商，管好采购进度，确保生产不缺料。',
    'warehouse': '核心使命：管好仓库，确保存货账实相符，物料找得到、发得快。',
    'technician': '核心使命：规范产品资料与生产工艺，让生产有标准可循。',
    'planner': '核心使命：排好生产计划，平衡订单与产能，解决车间堵点。',
    'supervisor': '核心使命：盯着现场进度，及时解决异常，把控生产节奏。',
    'quality': '核心使命：严控产品质量，实现全过程追溯，降低废品成本。',
    'equipment': '核心使命：保养好机器设备，减少临时停机，保障生产不停工。',
    'finance': '核心使命：算清每一笔账，实时掌握成本，为老板提供决策参考。',
    'manager': '核心使命：通过数字化看板，随时随地掌握工厂全局动态。',
    'implementer': '核心使命：负责整个快格云制造系统的架构搭建与平滑上线。'
  };

  const ROLE_DETAILS_MAP: Record<string, { data: string; docs: string; value: string }> = {
    'sales': {
      data: '客户档案、产品报价单、销售价格表',
      docs: '销售报价单、销售订单、发货通知单、销售退货单',
      value: '防漏单防错价，实时跟踪订单生产和发货进度，提升客户满意度。'
    },
    'purchase': {
      data: '供应商档案、物料采购价目表、采购周期设置',
      docs: '采购申请单、采购订单、到货质检单、采购退货单',
      value: '系统智能计算缺料并推荐采购，避免停工待料或库存积压。'
    },
    'warehouse': {
      data: '仓库/储位划分、期初库存建账、安全库存设置',
      docs: '采购入库单、生产领料单、生产入库单、销售出库单、盘点单',
      value: '告别手工做账，实现库存流水扫码即时更新，库存数据 100% 准确。'
    },
    'technician': {
      data: '物料主数据、产品 BOM、工艺路线与标准工时',
      docs: '工程变更单 (ECO)、打样申请单、工艺图纸挂载',
      value: '实现工艺图纸和 BOM 的版本管控，确保车间拿到的永远是最新标准。'
    },
    'planner': {
      data: '工作中心定义、产线产能配置、日历与排班',
      docs: '生产计划表、生产工单、委外加工单',
      value: '系统智能排程推算交期，平衡产能负荷，最大化车间产出。'
    },
    'supervisor': {
      data: '车间人员档案、班组排班表、不良品原因字典',
      docs: '工序派工单、生产报工单、异常报告',
      value: '无纸化派工与扫码报工，实时掌控产线进度，异常随时预警。'
    },
    'operator': {
      data: '无（作为执行层，通常无需维护主数据）',
      docs: '生产任务接收、完工扫码报工、不良品登记',
      value: '用手机或平板扫一扫即可领料和报工，绩效工资自动统计。'
    },
    'quality': {
      data: '检验标准 (AQL)、质检方案、检验项目字典',
      docs: '来料检验单 (IQC)、过程检验单 (PQC)、成品检验单 (OQC)',
      value: '全生命周期质量追溯，一键生成质检报告，从源头卡死不良品。'
    },
    'equipment': {
      data: '设备台账、备品备件库、保养计划模板',
      docs: '设备点检单、设备维修单、设备保养单',
      value: '变“事后抢修”为“事前预防”，降低设备故障率，保障产线运转。'
    },
    'finance': {
      data: '科目余额表、收支类别、成本核算规则',
      docs: '应收/应付单、收款/付款单、成本核算单据',
      value: '业务单据自动生成财务凭证，订单成本/毛利实时可见。'
    },
    'manager': {
      data: '审批流程设置、数据字典规划、企业目标 (KPI) 设定',
      docs: '各类核心业务单据的审批、总经理看板',
      value: '随时随地通过数字驾驶舱掌握工厂经营全貌（营收/产能/库存）。'
    },
    'implementer': {
      data: '组织架构设置、角色与权限分配、系统全局参数配置',
      docs: '系统日志、数据导入模板、实施验收报告',
      value: '利用向导快速完成初始化建模，降低实施交付周期与沟通成本。'
    }
  };

  // 前端默认的角色操作引导清单（当后端接口不存在时作为 fallback 兜底使用，确保用户有实际的操作引导）
  const ROLE_DEFAULT_CHECKLISTS: Record<string, any[]> = {
    'sales': [
      { id: 'sales_customer', name: '维护客户档案', description: '录入客户的基本信息、联系人与账期', required: true, jump_path: '/apps/master-data/supply-chain/customers' },
      { id: 'sales_price', name: '制定产品报价', description: '为不同的客户设定针对性的销售价格', required: false, jump_path: '/apps/kuaizhizao/sales-management/price-lists' },
      { id: 'sales_order', name: '录入销售订单', description: '承接客户需求，生成正式的销售订单，触发生产或发货需求', required: true, jump_path: '/apps/kuaizhizao/sales-management/sales-orders' },
      { id: 'sales_delivery', name: '跟进发货进度', description: '根据库存和生产情况，开具发货通知单', required: true, jump_path: '/apps/kuaizhizao/sales-management/deliveries' }
    ],
    'purchase': [
      { id: 'pur_supplier', name: '建立供应商档案', description: '录入供应商库，进行资质管理', required: true, jump_path: '/apps/master-data/supply-chain/suppliers' },
      { id: 'pur_price', name: '维护采购价目表', description: '记录物料的采购成本价与最小起订量', required: true, jump_path: '/apps/kuaizhizao/purchase-management/price-lists' },
      { id: 'pur_order', name: '下达采购订单', description: '向供应商正式下达采购任务，明确交期', required: true, jump_path: '/apps/kuaizhizao/purchase-management/purchase-orders' },
      { id: 'pur_receipt', name: '跟踪到货入库', description: '确认供应商送货情况，协同质检与仓储入库', required: true, jump_path: '/apps/kuaizhizao/purchase-management/receipts' }
    ],
    'warehouse': [
      { id: 'wh_setup', name: '规划物理仓库', description: '定义原材料仓、半成品仓及成品仓', required: true, jump_path: '/apps/master-data/warehouse/warehouses' },
      { id: 'wh_stock_in', name: '处理采购入库', description: '核对采购到货单，完成物料实物入库', required: true, jump_path: '/apps/kuaizhizao/warehouse-management/stock-in' },
      { id: 'wh_picking', name: '处理生产领料', description: '根据车间领料申请，精准发料出库', required: true, jump_path: '/apps/kuaizhizao/warehouse-management/picking' },
      { id: 'wh_stock_out', name: '处理销售发货', description: '拣货打包，完成成品出库发给客户', required: true, jump_path: '/apps/kuaizhizao/warehouse-management/stock-out' }
    ],
    'technician': [
      { id: 'tech_material', name: '定义物料主数据', description: '统一下发全厂的物料编码与属性', required: true, jump_path: '/apps/master-data/materials' },
      { id: 'tech_bom', name: '搭建产品 BOM', description: '构建产品结构的数字孪生（物料清单）', required: true, jump_path: '/apps/master-data/process/engineering-bom' },
      { id: 'tech_route', name: '设计工艺路线', description: '梳理生产工序先后顺序与标准工时', required: true, jump_path: '/apps/master-data/process/routes' }
    ],
    'planner': [
      { id: 'plan_wc', name: '维护工作中心产能', description: '定义产线或机台的基础产能信息', required: true, jump_path: '/apps/master-data/factory/work-centers' },
      { id: 'plan_mrp', name: '运行物料需求计划', description: '一键推算缺料情况，生成采购建议', required: false, jump_path: '/apps/kuaizhizao/production-planning/mrp' },
      { id: 'plan_order', name: '下达生产工单', description: '将销售订单转化为车间可执行的生产工单', required: true, jump_path: '/apps/kuaizhizao/production-planning/work-orders' }
    ],
    'supervisor': [
      { id: 'sup_team', name: '管理车间班组', description: '维护排班信息与车间操作人员档案', required: true, jump_path: '/apps/master-data/factory/teams' },
      { id: 'sup_dispatch', name: '工序派工下发', description: '将工单拆解到具体工位和工人', required: true, jump_path: '/apps/kuaizhizao/production-execution/dispatch' },
      { id: 'sup_monitor', name: '生产进度看板', description: '实时监控产线运行情况与报工异常', required: true, jump_path: '/apps/kuaizhizao/production-execution/dashboard' }
    ],
    'operator': [
      { id: 'op_receive', name: '接收生产任务', description: '在移动端/平板上查看自己的派工任务', required: true, jump_path: '/apps/kuaizhizao/production-execution/tasks' },
      { id: 'op_report', name: '扫码完工报工', description: '工序做完后，一键报工并自动计算计件工资', required: true, jump_path: '/apps/kuaizhizao/production-execution/reporting' }
    ],
    'quality': [
      { id: 'qa_standard', name: '制定检验标准', description: '设置物料与产品的 AQL 与抽样方案', required: true, jump_path: '/apps/master-data/quality/standards' },
      { id: 'qa_iqc', name: '来料检验 (IQC)', description: '对外协或采购回来的物料进行质检', required: true, jump_path: '/apps/kuaizhizao/quality-control/iqc' },
      { id: 'qa_oqc', name: '成品检验 (OQC)', description: '对即将发货的成品进行最终出厂前检验', required: true, jump_path: '/apps/kuaizhizao/quality-control/oqc' }
    ],
    'equipment': [
      { id: 'eq_ledger', name: '建立设备台账', description: '对全厂机器设备进行一物一码建档', required: true, jump_path: '/apps/master-data/equipment/ledger' },
      { id: 'eq_maintain', name: '设备巡检与保养', description: '执行设备日常点检与预防性保养任务', required: true, jump_path: '/apps/kuaizhizao/equipment-maintenance/maintenance' }
    ],
    'finance': [
      { id: 'fi_ap', name: '应付账款对账', description: '与供应商核对应付款项，生成付款单', required: true, jump_path: '/apps/kuaizhizao/finance/ap' },
      { id: 'fi_ar', name: '应收账款对账', description: '与客户核对销售账单，进行收款核销', required: true, jump_path: '/apps/kuaizhizao/finance/ar' },
      { id: 'fi_cost', name: '订单成本核算', description: '自动归集料工费，核算产品真实成本', required: false, jump_path: '/apps/kuaizhizao/finance/costing' }
    ],
    'manager': [
      { id: 'mgr_approve', name: '业务单据审批', description: '集中处理各部门提交的核心业务审批流', required: true, jump_path: '/apps/system/workflow/approvals' },
      { id: 'mgr_dashboard', name: '经营分析看板', description: '查看营收、利润、库存周转等核心指标', required: true, jump_path: '/apps/dashboard/bi' }
    ],
    'implementer': [
      { id: 'imp_org', name: '组织架构搭建', description: '建立公司部门层级树', required: true, jump_path: '/apps/system/departments' },
      { id: 'imp_role', name: '角色权限分配', description: '为各个岗位赋予对应的系统操作权限', required: true, jump_path: '/apps/system/roles' }
    ]
  };

  const ENHANCED_CHECKLIST = [
    {
      id: 'foundation_phase',
      name: '第一阶段：基础资料准备',
      items: [
        { id: 'material_data', name: '创建物料与产品', required: true, description: '录入原材料、半成品和成品的档案', completed: false, jump_path: '/apps/master-data/materials' },
        { id: 'warehouse_data', name: '划分仓库与库位', required: true, description: '建立原材料仓、成品仓及车间仓库', completed: false, jump_path: '/apps/master-data/warehouse/warehouses' },
        { id: 'partner_data', name: '登记客户与供应商', required: true, description: '建立合作伙伴档案，方便后续开单', completed: false, jump_path: '/apps/master-data/supply-chain/customers' },
      ]
    },
    {
      id: 'manufacturing_model_phase',
      name: '第二阶段：生产流程建模',
      items: [
        { id: 'bom_config', name: '配置产品 BOM', required: true, description: '定义产品的物料清单与零件构成', completed: false, jump_path: '/apps/master-data/process/engineering-bom' },
        { id: 'work_center_config', name: '建立车间与产线', required: true, description: '划分生产区域，定义工位与设备', completed: false, jump_path: '/apps/master-data/factory/work-centers' },
        { id: 'process_routing', name: '设置工艺流程', required: true, description: '规划工序顺序，明确生产该怎么做', completed: false, jump_path: '/apps/master-data/process/routes' },
      ]
    },
    {
      id: 'rules_phase',
      name: '第三阶段：业务规则定义',
      items: [
        { id: 'sales_config', name: '销售规则配置', required: true, description: '设置产品价格体系与订单规则', completed: false, jump_path: '/apps/kuaizhizao/sales-management/sales-orders' },
        { id: 'user_config', name: '创建业务用户', required: true, description: '为同事分配账号，协作开展业务', completed: false, jump_path: '/apps/system/users' },
        { id: 'data_collection_config', name: '生产现场报工', required: true, description: '配置扫码报工模式，实时反馈进度', completed: false, jump_path: '/apps/kuaizhizao/production-execution/reporting' },
      ]
    },
    {
      id: 'validation_phase',
      name: '第四阶段：业务链路试运行',
      items: [
        { id: 'first_order_run', name: '开出第一张生产单据', required: true, description: '全流程走通：销售->生产->报工->入库', completed: false, jump_path: '/apps/kuaizhizao/production-execution/work-orders' },
      ]
    }
  ];

  const allTabs = useMemo(() => [
    { code: 'system', name: '系统上线向导', icon: onboardingMenuIcon(ManufacturingIcons.compass) },
    ...ROLE_KEYS.map((r) => ({ code: r.code, name: r.name, icon: r.icon })),
  ], []);

  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('system');
  const [guideData, setGuideData] = useState<any>(null);
  const [completedItems, setCompletedItems] = useState<Set<string>>(new Set());
  const [systemGuideData, setSystemGuideData] = useState<any>(null);
  const [realCounts, setRealCounts] = useState<Record<string, number>>({});

  // 实时存量补偿器：加入用户、订单统计
  useEffect(() => {
    const fetchRealCounts = async () => {
      try {
        const [customers, suppliers, materials, warehouses, boms, workCenters, routes, users, sales, purchases] = await Promise.all([
          customerApi.list().catch(() => null),
          supplierApi.list().catch(() => null),
          materialApi.list().catch(() => null),
          warehouseApi.list().catch(() => null),
          bomApi.getGroups().catch(() => null),
          workCenterApi.list().catch(() => null),
          processRouteApi.list().catch(() => null),
          getUserList({ page: 1, page_size: 1 }).catch(() => null),
          listSalesOrders({ limit: 1 }).catch(() => null),
          listPurchaseOrders({ limit: 1 }).catch(() => null)
        ]);

        const getCount = (res: any) => {
          if (!res) return undefined;
          const data = res.data || res;
          if (Array.isArray(data)) return data.length;
          if (data.total !== undefined) return Number(data.total);
          if (data.count !== undefined) return Number(data.count);
          if (Array.isArray(data.items)) return data.items.length;
          return 0;
        };

        const counts: Record<string, number> = {};
        const cCount = getCount(customers);
        const sCount = getCount(suppliers);
        if (cCount !== undefined || sCount !== undefined) counts['partner_data'] = (cCount || 0) + (sCount || 0);
        
        counts['material_data'] = getCount(materials) ?? 0;
        counts['warehouse_data'] = getCount(warehouses) ?? 0;
        counts['bom_config'] = getCount(boms) ?? 0;
        counts['work_center_config'] = getCount(workCenters) ?? 0;
        counts['process_routing'] = getCount(routes) ?? 0;
        
        // 特别处理用户：减去 1 个（通常是超级管理员）
        const uCount = getCount(users);
        if (uCount !== undefined) counts['user_data'] = Math.max(0, uCount - 1);

        // 订单/单据统计
        const soCount = getCount(sales);
        const poCount = getCount(purchases);
        if (soCount !== undefined || poCount !== undefined) counts['order_data'] = (soCount || 0) + (poCount || 0);

        setRealCounts(counts);
      } catch (error) {
        console.error('实时存量获取系统异常:', error);
      }
    };

    fetchRealCounts();
  }, []);

  /**
   * 加载系统上线向导
   */
  const loadSystemGuide = async () => {
    try {
      setLoading(true);
      const data = await getSystemGoLiveGuide();
      setSystemGuideData(data);
    } catch (error: any) {
      messageApi.error(error?.message || t('pages.system.onboardingWizard.loadSystemFailed'));
      setSystemGuideData(null);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 加载角色上线向导数据
   */
  const loadRoleGuide = async (roleCode: string) => {
    try {
      setLoading(true);
      const response: any = await getRoleOnboardingGuide(undefined, roleCode);
      const data = response.guide || response;
      setGuideData(data);

      const tenantId = getTenantId();
      const storageKey = tenantId != null ? `onboarding_completed_t${tenantId}_${roleCode}` : `onboarding_completed_${roleCode}`;
      const savedCompleted = localStorage.getItem(storageKey);
      if (savedCompleted) {
        setCompletedItems(new Set(JSON.parse(savedCompleted)));
      } else {
        setCompletedItems(new Set());
      }
    } catch (error: any) {
      // 很多角色的 API 可能尚未开发完毕或暂不提供配置清单，为避免频繁弹窗报错，这里改为静默处理并让 UI 自动降级显示 Empty 状态
      console.warn(`[Onboarding] Role ${roleCode} guide data not found or API failed.`, error?.message);
      setGuideData(null);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 切换 Tab
   */
  const handleTabChange = (key: string) => {
    setActiveTab(key);
    if (key === 'system') {
      loadSystemGuide();
    } else {
      loadRoleGuide(key);
    }
  };

  /**
   * 切换完成状态
   */
  const handleItemToggle = (itemId: string) => {
    const newCompleted = new Set(completedItems);
    if (newCompleted.has(itemId)) {
      newCompleted.delete(itemId);
    } else {
      newCompleted.add(itemId);
    }
    setCompletedItems(newCompleted);
    const tenantId = getTenantId();
    const storageKey = tenantId != null ? `onboarding_completed_t${tenantId}_${activeTab}` : `onboarding_completed_${activeTab}`;
    localStorage.setItem(storageKey, JSON.stringify(Array.from(newCompleted)));
  };

  /**
   * 计算完成进度
   */
  const calculateProgress = () => {
    if (!guideData || !guideData.checklist) return 0;
    let total = 0;
    let completed = 0;
    guideData.checklist.forEach((category: any) => {
      category.items.forEach((item: any) => {
        total++;
        if (completedItems.has(item.id)) {
          completed++;
        }
      });
    });
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  };

  useEffect(() => {
    if (activeTab === 'system') {
      loadSystemGuide();
    } else {
      loadRoleGuide(activeTab);
    }
  }, [activeTab]);

  const progress = calculateProgress();

  const systemChecklist = useMemo(() => {
    const apiChecklist = systemGuideData?.guide?.checklist || [];

    // 强制使用 ENHANCED_CHECKLIST 作为前端的基准骨架结构，确保“从0到1”的 4 阶段全链路引导不缺失
    return ENHANCED_CHECKLIST.map((enhancedCat) => {
      // 尝试在后端返回的清单中找到匹配的分类
      const apiCat = apiChecklist.find((c: any) => c.id === enhancedCat.id || c.name === enhancedCat.name) || {};
      
      return {
        ...enhancedCat,
        ...apiCat,
        id: enhancedCat.id,
        name: enhancedCat.name,
        items: enhancedCat.items.map((enhancedItem) => {
          // 遍历后端所有分类，寻找匹配的任务项，以同步后端可能的完成状态
          let apiItem = null;
          for (const cat of apiChecklist) {
            const found = (cat.items || []).find((i: any) => i.id === enhancedItem.id || i.name === enhancedItem.name);
            if (found) {
              apiItem = found;
              break;
            }
          }
          
          return {
            ...enhancedItem,
            ...apiItem,
            id: enhancedItem.id, // 保持前端的 ID，防止后端缺失
            name: enhancedItem.name,
            description: apiItem?.description || enhancedItem.description,
            jump_path: apiItem?.jump_path || enhancedItem.jump_path,
            required: apiItem?.required ?? enhancedItem.required,
            completed: apiItem?.completed ?? enhancedItem.completed,
          };
        })
      };
    });
  }, [systemGuideData]);

  const sysProgress = useMemo(() => {
    let sysCompleted = 0;
    let sysTotal = 0;
    systemChecklist.forEach((cat: any) => {
      cat.items?.forEach((item: any) => {
        sysTotal++;
        if (item.completed || completedItems.has(item.id)) sysCompleted++;
      });
    });
    return sysTotal > 0 ? Math.round((sysCompleted / sysTotal) * 100) : 0;
  }, [systemChecklist, completedItems]);


  /** 系统上线 Tab 内容 */
  const renderSystemTab = () => {
    if (loading && !systemGuideData) {
      return <Card loading={loading} />;
    }
    if (!systemGuideData) {
      return <Card><Empty description={t('pages.system.onboardingWizard.emptySystem')} /></Card>;
    }
    const { init_completed, guide } = systemGuideData;
    if (!init_completed) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Alert
            message={t('pages.system.onboardingWizard.alertInitTitle')}
            description={
              <div>
                <Paragraph style={{ marginBottom: 8 }}>
                  {t('pages.system.onboardingWizard.alertInitDesc')}
                </Paragraph>
                <Button type="primary" onClick={() => navigate('/init/wizard')}>
                  {t('pages.system.onboardingWizard.goToInit')}
                </Button>
              </div>
            }
            type="warning"
            showIcon
            icon={wizIcon(AlertTriangle, 18)}
          />
        </div>
      );
    }

    // 计算当前应该进行到哪一个阶段（第一个包含未完成项的阶段）
    const currentStep = systemChecklist.findIndex((cat: any) => 
      (cat.items || []).some((item: any) => !item.completed && !completedItems.has(item.id))
    );
    const activeStep = currentStep === -1 ? systemChecklist.length : currentStep;

    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {/* 四阶段分层引导 */}
        <Card 
          title={
            <Space size={8}>
              <span style={{ color: token.colorPrimary, display: 'flex', alignItems: 'center' }}>
                {onboardingMenuIcon(ManufacturingIcons.compass)}
              </span>
              <span>{guide?.name || '系统上线向导'}</span>
              <Tag color="blue" bordered={false} style={{ fontSize: 10, borderRadius: token.borderRadiusSM }}>正式环境部署</Tag>
            </Space>
          }
          style={{ borderRadius: token.borderRadiusLG, border: `1px solid ${token.colorBorderSecondary}`, marginBottom: '16px' }}
          styles={{ body: { padding: '16px' } }}
        >
          <Steps
            direction="vertical"
            size="small"
            className="onboarding-steps"
            current={activeStep}
            items={systemChecklist.map((category: any, idx: number) => {
              const incompleteItems = (category.items || []).filter((i: any) => !i.completed && i.jump_path);
              const hasIncomplete = incompleteItems.length > 0;
              
              const handleDirectJump = () => {
                if (incompleteItems.length === 1) {
                  navigate(incompleteItems[0].jump_path);
                }
              };

              const popoverContent = (
                <div style={{ width: 280 }}>
                  <div style={{ padding: '8px 12px', borderBottom: `1px solid ${token.colorBorderSecondary}`, marginBottom: 4 }}>
                    <Text strong style={{ fontSize: 13 }}>待完善任务</Text>
                  </div>
                  <List
                    size="small"
                    dataSource={incompleteItems}
                    renderItem={(item: any) => (
                      <List.Item
                        style={{ padding: '8px 12px' }}
                        actions={[
                          <Button 
                            key="go" 
                            type="primary" 
                            ghost 
                            size="small" 
                            onClick={() => navigate(item.jump_path)}
                            style={{ borderRadius: token.borderRadius, fontSize: 11 }}
                          >
                            立即前往
                          </Button>
                        ]}
                      >
                        <Text style={{ fontSize: 13 }}>{item.name}</Text>
                      </List.Item>
                    )}
                  />
                </div>
              );

              const isCurrentStep = idx === activeStep;

              return {
                title: (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <span style={{ 
                      fontSize: 14, 
                      fontWeight: isCurrentStep ? 600 : 500,
                      color: isCurrentStep ? token.colorText : token.colorTextSecondary 
                    }}>
                      {category.name}
                    </span>
                  </div>
                ),
                status: 'finish',
                description: (
                  <List
                    dataSource={category.items || []}
                    renderItem={(item: any) => {
                      // 激进式数据探测：扫描 item 中所有可能的数值字段
                      const getAggressiveCount = (obj: any) => {
                        if (!obj) return 0;
                        // 优先寻找已知字段
                        const known = obj.actual_count ?? obj.actualCount ?? obj.current_count ?? obj.count ?? obj.total;
                        if (known !== undefined && known !== null) return Number(known);
                        // 扫描所有 key，寻找数值
                        for (const key in obj) {
                          if (typeof obj[key] === 'number' && !['id', 'order', 'sort', 'status'].includes(key.toLowerCase())) {
                            return obj[key];
                          }
                        }
                        return 0;
                      };

                      // 智能存量匹配：优先 ID 匹配，其次名称关键词模糊匹配
                      const getSmartCount = () => {
                        // 1. 优先尝试 ID 精确匹配
                        if (realCounts[item.id] !== undefined) return realCounts[item.id];
                        
                        // 2. 备选方案：通过名称关键词模糊匹配（解决后端 ID 不固定的问题）
                        const name = item.name || '';
                        if (name.includes('单据') || name.includes('订单') || name.includes('开单')) return realCounts['order_data'] || 0;
                        if (name.includes('用户') || name.includes('人员')) return realCounts['user_data'] || 0;
                        if (name.includes('客户') || name.includes('供应商')) return realCounts['partner_data'] || 0;
                        if (name.includes('物料') || name.includes('产品')) return realCounts['material_data'] || 0;
                        if (name.includes('仓库') || name.includes('库位')) return realCounts['warehouse_data'] || 0;
                        if (name.includes('BOM') || name.includes('清单')) return realCounts['bom_config'] || 0;
                        if (name.includes('工作中心') || name.includes('产线')) return realCounts['work_center_config'] || 0;
                        if (name.includes('工艺') || name.includes('路线')) return realCounts['process_routing'] || 0;
                        
                        // 3. 最后手段：使用对象属性扫描器
                        return getAggressiveCount(item);
                      };

                      const realCount = getSmartCount();
                      // 终极状态纠正：如果探测到存量为 0，即便后端返回 completed: true，也强行标记为未完成（除非手动勾选）
                      const isCompleted = (realCount > 0 && (item.completed === true || completedItems.has(item.id)));
                      const enhanced = ENHANCED_MISSION_GUIDE[item.id] || ENHANCED_MISSION_GUIDE[item.check_key || ''];
                      
                      return (
                        <List.Item
                          style={{
                            padding: '16px',
                            marginBottom: 12,
                            borderRadius: token.borderRadiusLG,
                            border: `1px solid ${isCompleted ? 'rgba(82, 196, 26, 0.25)' : token.colorBorderSecondary}`,
                            background: isCompleted 
                              ? (isDark 
                                  ? 'linear-gradient(145deg, rgba(82, 196, 26, 0.08) 0%, rgba(0, 0, 0, 0) 100%)' 
                                  : 'linear-gradient(145deg, rgba(82, 196, 26, 0.06) 0%, rgba(255, 255, 255, 0.6) 100%)')
                              : token.colorBgContainer,
                            position: 'relative',
                            transition: 'all 0.3s ease',
                            boxShadow: isCompleted ? `0 4px 12px rgba(82, 196, 26, 0.04)` : 'none',
                          }}
                        >
                          <Space direction="vertical" style={{ width: '100%' }} size={12}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <Space size={12} align="center">
                                <Checkbox 
                                  checked={isCompleted}
                                  onChange={(e) => handleItemToggle(item.id)}
                                  style={{ transform: 'scale(1.1)' }}
                                />
                                <Text strong style={{ fontSize: 15, color: isCompleted ? token.colorSuccess : token.colorText }}>
                                  {item.name}
                                </Text>
                                {item.required && !isCompleted && (
                                  <Tag bordered color="error" style={{ fontSize: 10, borderRadius: token.borderRadiusSM }}>核心必办</Tag>
                                )}
                              </Space>
                              <Space size={16} align="center">
                                {/* 深度探测后端真实数据字段 */}
                                <div style={{ 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  gap: 6,
                                  background: (realCount > 0) ? (isDark ? 'rgba(82, 196, 26, 0.1)' : '#f6ffed') : 'transparent',
                                  padding: (realCount > 0) ? '2px 10px' : '0',
                                  borderRadius: token.borderRadiusSM,
                                  border: (realCount > 0) ? `1px solid ${token.colorSuccess}20` : 'none',
                                }}>
                                  {realCount > 0 ? (
                                    <Text style={{ fontSize: 12, color: token.colorSuccess }}>
                                      当前存量 <Text strong>{realCount}</Text>
                                    </Text>
                                  ) : (
                                    <Text type="secondary" style={{ fontSize: 12 }}>暂无数据</Text>
                                  )}
                                </div>
                                {item.jump_path && (
                                  <Button
                                    type={isCompleted ? 'default' : 'primary'}
                                    size="small"
                                    className={isCompleted ? 'onboarding-completed-btn' : undefined}
                                    icon={
                                      isCompleted
                                        ? wizIcon(CheckCircle2, 14, undefined, token.colorSuccess)
                                        : wizIcon(PlayCircle, 14)
                                    }
                                    onClick={() => !isCompleted && navigate(item.jump_path)}
                                    style={{
                                      borderRadius: token.borderRadiusLG,
                                      ...(isCompleted
                                        ? {
                                            background: token.colorSuccessBg,
                                            borderColor: token.colorSuccessBorder,
                                            color: token.colorSuccess,
                                            borderWidth: 1,
                                            borderStyle: 'solid',
                                            boxShadow: 'none',
                                            cursor: 'default',
                                          }
                                        : {}),
                                    }}
                                  >
                                    {isCompleted ? '已完成' : '立即前往'}
                                  </Button>
                                )}
                              </Space>
                            </div>
                            <div style={{ paddingLeft: 40 }}>
                              {item.description && (
                                <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>
                                  {item.description}
                                </Text>
                              )}
                              {enhanced?.dependency && (
                                <div style={{ marginTop: 2 }}>
                                  <Text type="danger" style={{ fontSize: 13 }}>
                                    {wizIcon(CalendarClock, 14, { marginRight: 6, verticalAlign: 'middle', display: 'inline-block' })}
                                    <Text strong type="danger" style={{ fontSize: 13 }}>前置要求：</Text>
                                    {enhanced.dependency}
                                  </Text>
                                </div>
                              )}
                              {enhanced?.tip && (
                                <div style={{ marginTop: 2 }}>
                                  <Text type="warning" style={{ fontSize: 13 }}>
                                    {wizIcon(AlertCircle, 14, { marginRight: 6, verticalAlign: 'middle', display: 'inline-block' }, token.colorWarning)}
                                    <Text strong type="warning" style={{ fontSize: 13 }}>专家建议：</Text>
                                    {enhanced.tip}
                                  </Text>
                                </div>
                              )}
                            </div>
                          </Space>
                        </List.Item>
                      );
                    }}
                    />
                  ),
                };
              })}
          />
        </Card>

        {sysProgress === 100 && (
          <Alert
            message={t('pages.system.onboardingWizard.systemComplete')}
            description={t('pages.system.onboardingWizard.systemCompleteDesc')}
            type="success"
            showIcon
            icon={wizIcon(CheckCircle2, 18)}
          />
        )}
      </div>
    );
  };

  /** 角色 Tab 内容 */
  const renderRoleTab = () => {
    if (loading && !guideData) return <Card loading={loading} />;
    
    // 优先使用后端的 guideData 清单，如果后端没有返回任何 items，则启用强大的前端默认指引兜底
    const apiRoleItems = guideData?.checklist?.[0]?.items || [];
    const roleChecklistItems = apiRoleItems.length > 0 ? apiRoleItems : (ROLE_DEFAULT_CHECKLISTS[activeTab] || []);
    
    const progress = calculateProgress();
    const firstIncompleteRoleItem = roleChecklistItems.find((i: any) => !completedItems.has(i.id) && i.completed !== true && i.jump_path);
    
    // 从左侧菜单找到当前角色的名字
    const currentRoleName = ROLE_KEYS.find(k => k.code === activeTab)?.name || '角色准备向导';

    const completedCount = roleChecklistItems.filter((i: any) => completedItems.has(i.id) || i.completed === true).length;
    const totalCount = roleChecklistItems.length;
    const roleProgress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    if (true) {
      return (
        <Card
          style={{ borderRadius: token.borderRadiusLG, border: `1px solid ${token.colorBorderSecondary}`, overflow: 'hidden' }}
          styles={{ body: { padding: 0 } }}
        >
          {/* 顶层整合 Header */}
          <div style={{ 
            padding: '24px', 
            background: isDark ? `linear-gradient(135deg, ${token.colorPrimary}1A 0%, #141414 100%)` : `linear-gradient(135deg, ${token.colorInfoBg} 0%, #ffffff 100%)`,
            borderBottom: `1px solid ${token.colorBorderSecondary}`
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ 
                width: 48, height: 48, borderRadius: 12, 
                background: `linear-gradient(135deg, ${token.colorPrimary} 0%, ${token.colorPrimaryActive} 100%)`, 
                color: '#fff', 
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24, marginRight: 16,
                boxShadow: `0 4px 12px ${token.colorPrimary}40`
              }}>
                {ROLE_KEYS.find(k => k.code === activeTab)?.icon || wizIcon(Rocket, 22, undefined, '#fff')}
              </div>
              <div>
                <Typography.Title level={4} style={{ margin: 0 }}>
                  {currentRoleName}
                </Typography.Title>
                <Text type="secondary" style={{ fontSize: 14, marginTop: 4, display: 'flex', alignItems: 'center' }}>
                  {wizIcon(Target, 16, { marginRight: 6, flexShrink: 0 }, token.colorPrimary)}
                  {ROLE_MISSION_MAP[activeTab] || '核心使命：确保业务流程在系统中的完整流转。'}
                </Text>
              </div>
            </div>

            {ROLE_DETAILS_MAP[activeTab] && (
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <div style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)', padding: '16px', borderRadius: token.borderRadiusLG, border: `1px solid ${token.colorBorderSecondary}60`, height: '100%', backdropFilter: 'blur(8px)' }}>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                      {wizIcon(Archive, 14, { marginRight: 6, verticalAlign: 'middle', display: 'inline-block' })}
                      需要录入的基础数据
                    </Text>
                    <Text strong style={{ fontSize: 13, color: token.colorText }}>{ROLE_DETAILS_MAP[activeTab].data}</Text>
                  </div>
                </Col>
                <Col xs={24} md={12}>
                  <div style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)', padding: '16px', borderRadius: token.borderRadiusLG, border: `1px solid ${token.colorBorderSecondary}60`, height: '100%', backdropFilter: 'blur(8px)' }}>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                      {wizIcon(FileSearch, 14, { marginRight: 6, verticalAlign: 'middle', display: 'inline-block' })}
                      可以操作的业务单据
                    </Text>
                    <Text strong style={{ fontSize: 13, color: token.colorText }}>{ROLE_DETAILS_MAP[activeTab].docs}</Text>
                  </div>
                </Col>
              </Row>
            )}
            
            <div style={{ marginTop: 16, display: 'flex', alignItems: 'flex-start' }}>
              {wizIcon(AlertCircle, 16, { marginTop: 4, marginRight: 8, flexShrink: 0 }, token.colorWarning)}
              <Text type="secondary" style={{ fontSize: 13 }}>
                <span style={{ color: token.colorWarning, fontWeight: 500 }}>专家提示：</span>
                角色上线不仅是权限的开启，更代表了业务数据的闭环。请务必检查前置数据是否准确，建议在正式操作前先通过“演示引导”熟悉核心流程。
              </Text>
            </div>
          </div>

          {/* 清单部分 */}
          <div style={{ padding: '24px' }}>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Space size={8}>
                <span style={{ fontSize: 16, fontWeight: 600 }}>核心操作指引</span>
                <Text type="secondary" style={{ fontSize: 13, fontWeight: 'normal' }}>
                  — 共 {roleChecklistItems.length} 项关键任务
                </Text>
              </Space>
            </div>

            {roleChecklistItems.length === 0 ? (
              <Empty description={t('pages.system.onboardingWizard.emptyRole') || '该角色暂无配置项'} />
            ) : (
              <List
                dataSource={roleChecklistItems}
                renderItem={(item: any) => {
                  const isCompleted = completedItems.has(item.id) || item.completed === true;
                  return (
                    <List.Item
                      style={{
                        padding: '16px',
                        marginBottom: 12,
                        borderRadius: token.borderRadiusLG,
                        border: `1px solid ${isCompleted ? token.colorBorder : token.colorBorderSecondary}`,
                        background: isCompleted 
                          ? (isDark ? 'rgba(255, 255, 255, 0.02)' : '#fafafa')
                          : token.colorBgContainer,
                      }}
                    >
                      <Space direction="vertical" style={{ width: '100%' }} size={12}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Space size={12}>
                            <Checkbox 
                              checked={isCompleted}
                              disabled={isCompleted}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  handleItemToggle(item.id);
                                  messageApi.success(`已标记完成: ${item.name}`);
                                }
                              }}
                            />
                            <Text strong={item.required} style={{ fontSize: 14 }}>{item.name}</Text>
                            {item.required && <Tag bordered color="error" style={{ fontSize: 10 }}>核心必办</Tag>}
                            {isCompleted && wizIcon(CheckCircle2, 16, { color: token.colorSuccess })}
                          </Space>
                          <Space>
                            {item.jump_path && (
                              <Button
                                type={isCompleted ? 'default' : 'primary'}
                                size="small"
                                icon={
                                  isCompleted
                                    ? wizIcon(CheckCircle2, 14, undefined, token.colorSuccess)
                                    : wizIcon(PlayCircle, 14)
                                }
                                onClick={() => !isCompleted && navigate(item.jump_path)}
                                className={
                                  isCompleted ? 'onboarding-completed-btn' : 'onboarding-action-btn'
                                }
                                style={{ 
                                  borderRadius: token.borderRadiusLG, 
                                  padding: '0 16px',
                                  fontSize: 12,
                                  height: 28,
                                  display: 'flex',
                                  alignItems: 'center',
                                  ...(isCompleted
                                    ? {
                                        background: token.colorSuccessBg,
                                        border: `1px solid ${token.colorSuccessBorder}`,
                                        color: token.colorSuccess,
                                        boxShadow: 'none',
                                        cursor: 'default',
                                      }
                                    : {
                                        background: `linear-gradient(90deg, ${token.colorPrimary} 0%, ${token.colorPrimaryActive} 100%)`,
                                        border: 'none',
                                        boxShadow: `0 4px 10px ${token.colorPrimary}40`,
                                        color: '#fff',
                                      }),
                                }}
                              >
                                {isCompleted ? '已完成' : '立即前往'}
                              </Button>
                            )}
                          </Space>
                        </div>
                        <div style={{ paddingLeft: 32 }}>
                          <Text type="secondary" style={{ fontSize: 13 }}>
                            {item.description}
                          </Text>
                          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
                            <Tag bordered={false} style={{ fontSize: 11 }}>业务准则：确保数据录入的完整性与及时性</Tag>
                          </div>
                        </div>
                      </Space>
                    </List.Item>
                  );
                }}
              />
            )}
          </div>

          {ROLE_DETAILS_MAP[activeTab]?.value && (
            <div
              style={{
                padding: '16px 24px',
                borderTop: `1px solid ${token.colorBorderSecondary}`,
                background: token.colorPrimaryBg,
                borderInlineStart: `3px solid ${token.colorPrimary}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                {wizIcon(Zap, 16, { marginRight: 8, flexShrink: 0 }, token.colorPrimary)}
                <Text style={{ fontSize: 12, fontWeight: 600, color: token.colorPrimary, margin: 0 }}>
                  系统使用赋能与收益
                </Text>
              </div>
              <Text strong style={{ fontSize: 13, color: token.colorText, fontWeight: 500 }}>
                {ROLE_DETAILS_MAP[activeTab].value}
              </Text>
            </div>
          )}
        </Card>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {/* 角色特定的专家指引 */}
        <Alert
          message={t('pages.system.onboardingWizard.roleTip')}
          description={
            <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontWeight: 600, color: token.colorPrimary, fontSize: 14, display: 'flex', alignItems: 'center' }}>
                {wizIcon(Target, 16, { marginRight: 6 })}
                {ROLE_MISSION_MAP[activeTab] || '核心使命：确保业务流程在系统中的完整流转。'}
              </div>
              
              {ROLE_DETAILS_MAP[activeTab] && (
                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <div style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)', padding: '12px 16px', borderRadius: token.borderRadiusLG, height: '100%' }}>
                      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
                        {wizIcon(Archive, 14, { marginRight: 6, verticalAlign: 'middle', display: 'inline-block' })}
                        需要录入的基础数据
                      </Text>
                      <Text strong style={{ fontSize: 13, color: token.colorText }}>{ROLE_DETAILS_MAP[activeTab].data}</Text>
                    </div>
                  </Col>
                  <Col xs={24} md={12}>
                    <div style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)', padding: '12px 16px', borderRadius: token.borderRadiusLG, height: '100%' }}>
                      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
                        {wizIcon(FileSearch, 14, { marginRight: 6, verticalAlign: 'middle', display: 'inline-block' })}
                        可以操作的业务单据
                      </Text>
                      <Text strong style={{ fontSize: 13, color: token.colorText }}>{ROLE_DETAILS_MAP[activeTab].docs}</Text>
                    </div>
                  </Col>
                </Row>
              )}
              
              <div>
                <Text type="warning" style={{ fontSize: 13 }}>
                  {wizIcon(AlertCircle, 14, { marginRight: 6, verticalAlign: 'middle', display: 'inline-block' }, token.colorWarning)}
                  <Text strong type="warning" style={{ fontSize: 13 }}>专家提示：</Text>
                  角色上线不仅是权限的开启，更代表了业务数据的闭环。请务必检查前置数据是否准确，建议在正式操作前先通过“演示引导”熟悉核心流程。
                </Text>
              </div>
            </div>
          }
          type="info"
          showIcon
          style={{ marginBottom: '16px', borderRadius: token.borderRadiusLG }}
        />

        {/* 上线准备清单 */}
        {roleChecklistItems.length === 0 ? (
          <Card style={{ borderRadius: token.borderRadiusLG, border: `1px solid ${token.colorBorderSecondary}` }}>
            <Empty description={t('pages.system.onboardingWizard.emptyRole') || '该角色暂无配置项'} />
          </Card>
        ) : (
          <Card 
            title={
              <Space size={8}>
                <span>{guideData?.name || currentRoleName}</span>
                <Text type="secondary" style={{ fontSize: 13, fontWeight: 'normal' }}>
                  — {t('pages.system.onboardingWizard.roleChecklist')}
                </Text>
              </Space>
            }
            style={{ borderRadius: token.borderRadiusLG, border: `1px solid ${token.colorBorderSecondary}` }}
            styles={{ body: { padding: '16px' } }}
          >
            <List
              dataSource={roleChecklistItems}
            renderItem={(item: any) => {
              const isCompleted = completedItems.has(item.id) || item.completed === true;
              return (
                <List.Item
                  style={{
                    padding: '16px',
                    marginBottom: 12,
                    borderRadius: token.borderRadiusLG,
                    border: `1px solid ${isCompleted ? token.colorBorder : token.colorBorderSecondary}`,
                    background: isCompleted 
                      ? (isDark ? 'rgba(255, 255, 255, 0.02)' : '#fafafa')
                      : token.colorBgContainer,
                  }}
                >
                  <Space direction="vertical" style={{ width: '100%' }} size={12}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Space size={12}>
                        <Checkbox 
                          checked={isCompleted}
                          disabled={isCompleted}
                          onChange={(e) => {
                            if (e.target.checked) {
                              handleItemToggle(item.id);
                              messageApi.success(`已标记完成: ${item.name}`);
                            }
                          }}
                        />
                        <Text strong={item.required} style={{ fontSize: 14 }}>{item.name}</Text>
                        {item.required && <Tag bordered color="error" style={{ fontSize: 10 }}>核心必办</Tag>}
                        {isCompleted && wizIcon(CheckCircle2, 16, { color: token.colorSuccess })}
                      </Space>
                      <Space>
                        {item.jump_path && (
                          <Button
                            type={isCompleted ? 'default' : 'primary'}
                            size="small"
                            icon={
                              isCompleted
                                ? wizIcon(CheckCircle2, 14, undefined, token.colorSuccess)
                                : wizIcon(PlayCircle, 14)
                            }
                            onClick={() => !isCompleted && navigate(item.jump_path)}
                            className={
                              isCompleted ? 'onboarding-completed-btn' : 'onboarding-action-btn'
                            }
                            style={{ 
                              borderRadius: token.borderRadiusLG, 
                              padding: '0 16px',
                              fontSize: 12,
                              height: 28,
                              display: 'flex',
                              alignItems: 'center',
                              ...(isCompleted
                                ? {
                                    background: token.colorSuccessBg,
                                    border: `1px solid ${token.colorSuccessBorder}`,
                                    color: token.colorSuccess,
                                    boxShadow: 'none',
                                    cursor: 'default',
                                  }
                                : {
                                    background: `linear-gradient(90deg, ${token.colorPrimary} 0%, ${token.colorPrimaryActive} 100%)`,
                                    border: 'none',
                                    boxShadow: `0 4px 10px ${token.colorPrimary}40`,
                                    color: '#fff',
                                  }),
                            }}
                          >
                            {isCompleted ? '已完成' : '立即前往'}
                          </Button>
                        )}
                        {item.guide_id && (
                          <Button
                            type="primary"
                            ghost
                            size="small"
                            icon={wizIcon(PlayCircle, 14)}
                            onClick={() => runGuide(item.guide_id)}
                          >
                            开始引导
                          </Button>
                        )}
                      </Space>
                    </div>
                    <div style={{ paddingLeft: 32 }}>
                      <Text type="secondary" style={{ fontSize: 13 }}>
                        {item.description}
                      </Text>
                      <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
                        <Tag bordered={false} style={{ fontSize: 11 }}>业务准则：确保数据录入的完整性与及时性</Tag>
                      </div>
                    </div>
                  </Space>
                </List.Item>
              );
            }}
          />
        </Card>
        )}
        {ROLE_DETAILS_MAP[activeTab]?.value && (
          <div
            style={{
              marginTop: 16,
              padding: '16px 20px',
              borderRadius: token.borderRadiusLG,
              border: `1px solid ${token.colorPrimaryBorder}`,
              background: token.colorPrimaryBg,
              borderInlineStart: `3px solid ${token.colorPrimary}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              {wizIcon(Zap, 16, { marginRight: 8, flexShrink: 0 }, token.colorPrimary)}
              <Text style={{ fontSize: 12, fontWeight: 600, color: token.colorPrimary, margin: 0 }}>
                系统使用赋能与收益
              </Text>
            </div>
            <Text strong style={{ fontSize: 13, color: token.colorText, fontWeight: 500 }}>
              {ROLE_DETAILS_MAP[activeTab].value}
            </Text>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ width: '100%', padding: 0, boxSizing: 'border-box' }}>
      <style>{stepStyle}</style>
      <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'flex-start', marginBottom: 16 }}>
        <div style={{ width: 140, height: 85, marginTop: -25, marginLeft: -10,marginRight:-20, overflow: 'hidden', pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Lottie 
            animationData={guideAnimation} 
            loop 
            autoplay 
            style={{ width: 160, height: 160, marginBottom: -25 }} // 通过负边距向上拉伸，裁切底部空白
          />
        </div>
        <div style={{ flex: 1 }}>
          <Title level={2} style={{ marginTop: 0, marginBottom: 8, letterSpacing: '-0.02em', fontSize: '24px' }}>
            {t('pages.system.onboardingWizard.title')}
          </Title>
          <Paragraph type="secondary" style={{ fontSize: 14, marginBottom: 0 }}>
            {t('pages.system.onboardingWizard.subtitle')}
          </Paragraph>
        </div>
        
        {/* 右侧环形进度组件 */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 16, 
          background: token.colorBgContainer, 
          padding: '8px 16px', 
          borderRadius: 32,
          border: `1px solid ${token.colorBorderSecondary}`,
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <Text strong style={{ fontSize: 14 }}>
              {activeTab === 'system' ? t('pages.system.onboardingWizard.systemProgress') : t('pages.system.onboardingWizard.roleProgress')}
            </Text>
            <Space size={4}>
              <Button 
                type="text" 
                size="small" 
                icon={wizIcon(RefreshCw, 15)} 
                onClick={activeTab === 'system' ? loadSystemGuide : () => loadRoleGuide(activeTab)}
                style={{ fontSize: 12, color: token.colorTextSecondary, padding: 0, height: 'auto', lineHeight: 1 }}
              >
                {t('pages.system.onboardingWizard.refresh')}
              </Button>
            </Space>
          </div>
          <Progress 
            type="circle" 
            percent={activeTab === 'system' ? sysProgress : progress} 
            size={48} 
            strokeColor={token.colorSuccess}
            format={(percent) => (
              <span style={{ fontSize: 12, fontWeight: 600, color: token.colorSuccess }}>
                {percent}%
              </span>
            )}
          />
        </div>
      </div>

      <Row gutter={16}>
        {/* 左侧角色列表 */}
        <Col xs={24} sm={24} md={6} lg={5} xl={4}>
          <div style={{ 
            background: token.colorBgContainer, 
            borderRadius: token.borderRadiusLG, 
            border: `1px solid ${token.colorBorderSecondary}`,
            overflow: 'hidden',
            position: 'sticky',
            top: 24
          }}>
            <Menu
              mode="vertical"
              selectedKeys={[activeTab]}
              onClick={({ key }) => handleTabChange(key)}
              style={{ border: 'none' }}
              items={allTabs.map((tab) => ({
                key: tab.code,
                label: (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ display: 'flex', alignItems: 'center', fontSize: 16 }}>{tab.icon}</span>
                    <span style={{ fontSize: 14 }}>{tab.name}</span>
                  </div>
                ),
              }))}
            />
          </div>
        </Col>

        {/* 右侧引导内容 */}
        <Col xs={24} sm={24} md={18} lg={19} xl={20}>
          <div style={{ minHeight: 600 }}>
            {activeTab === 'system' ? renderSystemTab() : renderRoleTab()}
          </div>
        </Col>
      </Row>
    </div>
  );
};

export default OnboardingWizardPage;
