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
import { Card, Tabs, Steps, Checkbox, Space, Typography, Tag, Button, List, Empty, Alert, theme, ConfigProvider, Row, Col, Menu, Popover, Progress, Modal, Table } from 'antd';
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
  ArrowRight,
  Layers,
  Activity,
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
import { warehouseApi, storageAreaApi, storageLocationApi } from '../../../apps/master-data/services/warehouse';
import { plantApi, workshopApi, productionLineApi, workstationApi, workCenterApi, workGroupApi } from '../../../apps/master-data/services/factory';
import { defectTypeApi, operationApi, processRouteApi, sopApi } from '../../../apps/master-data/services/process';
import { variantAttributeApi } from '../../../apps/master-data/services/variant-attribute';
import { batchRuleApi, serialRuleApi } from '../../../apps/master-data/services/batchSerialRules';
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
  { code: 'technician', name: '技术研发向导', icon: onboardingMenuIcon(ManufacturingIcons.workflow) }, // 工艺路线/工作流
  { code: 'planner', name: '生产计划向导', icon: onboardingMenuIcon(ManufacturingIcons.calendar) }, // 计划管理
  { code: 'supervisor', name: '车间班组向导', icon: onboardingMenuIcon(ManufacturingIcons.users) }, // 现场班组
  { code: 'operator', name: '生产操作向导', icon: onboardingMenuIcon(ManufacturingIcons.activity) }, // 生产执行
  { code: 'quality', name: '品质控制向导', icon: onboardingMenuIcon(ManufacturingIcons.quality) }, // 质量管理
  { code: 'equipment', name: '设备运维向导', icon: onboardingMenuIcon(ManufacturingIcons.wrench) }, // 设备管理
  { code: 'finance', name: '财务结算向导', icon: onboardingMenuIcon(ManufacturingIcons.wallet) }, // 财务管理
  { code: 'manager', name: '管理决策向导', icon: onboardingMenuIcon(ManufacturingIcons.trophy) }, // 绩效管理/经营结果
  { code: 'implementer', name: '系统设定向导', icon: onboardingMenuIcon(ManufacturingIcons.package) }, // 实施交付（与菜单包裹应用包意象一致，不重复）
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
      margin-bottom: 8px !important;
    }
    .onboarding-steps .ant-steps-item-description {
      padding-top: 8px !important;
      padding-bottom: 12px !important;
    }
    .onboarding-action-btn {
      transition: all 0.3s ease !important;
    }
    .onboarding-action-btn:hover {
      transform: translateY(-1px);
      filter: brightness(1.1);
      box-shadow: 0 6px 15px rgba(0,0,0,0.15) !important;
    }
    .onboarding-list-item {
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      cursor: pointer;
    }
    .onboarding-list-item:hover {
      border-color: ${token.colorPrimary}40 !important;
      box-shadow: 0 8px 24px rgba(0,0,0,0.06);
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
    'warehouse_main': {
      mission: '定义工厂的物理仓储中心，支撑原材料、在制品与成品的数字化入出库流转。',
      standard: '完成核心原材料仓与成品仓的建立，确立基本的出入库策略。',
      tip: '建议将线边仓与原材料仓分开定义，便于实现生产现场的 WIP 在制品库存管理。'
    },
    'warehouse_locations': {
      mission: '细化仓库内的物理坐标，实现物料的精准定位与扫码自动化作业。',
      standard: '完成高频作业区域的货位定义，且货位编码规则已与货架标牌同步。',
      tip: '对于快速流转物料，建议设置“拣货位”，缩短作业人员的步行距离。'
    },
    'material_main': {
      mission: '定义物料的“数字孪生”属性，包括进销存端的采购/销售单价，及生产端的 BOM/工艺关联关系。',
      standard: '完成核心原料、半成品、成品的分类录入，且计量单位体系（主/辅单位）已确立。',
      tip: '物料的“提前期”设置将直接影响后续计划系统的准确性，请根据历史平均值填写。',
      dependency: '需预先确立物料编码规范与分类体系。'
    },
    'partner_customers': {
      mission: '建立以销定产的源头，定义客户档案、价格体系及销售订单流转规则。',
      standard: '完成核心客户数据录入，且销售订单到生产订单的触发逻辑已配置。',
      tip: '建议开启“信用额度”控制，将财务风险防范前置到销售录单阶段。'
    },
    'partner_suppliers': {
      mission: '确保生产物料的稳定供应，定义供应商档案、采购合同模板及入库检验流程。',
      standard: '完成核心供应商录入，且采购到收货入库的流程已跑通。',
      tip: '配置“收货待检区”能有效配合质量管理（QC）流程，确保入库物料 100% 合格。'
    },
    'process_operations': {
      mission: '定义标准作业工序，确立每一道加工环节的质量标准与能力要求。',
      standard: '完成全流程工序档案建立，且工序代码与车间物理工序一一对应。',
      tip: '在工序中定义“报工触发器”，可实现生产进度的实时感知。'
    },
    'process_routes': {
      mission: '锁定生产工序流转顺序、标准工时及工作中心。这是生产成本核算与进度跟踪的核心。',
      standard: '完成产品工艺路线配置，且工序间的逻辑关系（串行/并行）与车间实操一致。',
      tip: '工时数据的精度直接影响排产（APS）的有效性，初期可使用经验值，后期通过报工数据优化。',
      dependency: '需预先定义【工作中心】与【资源组】。'
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
    'technician': '核心使命：规范产品资料与研发工艺，让生产有标准可循，提升产品竞争力。',
    'planner': '核心使命：排好生产计划，平衡订单与产能，解决车间堵点。',
    'supervisor': '核心使命：盯着现场进度，及时解决异常，把控生产节奏。',
    'quality': '核心使命：严控产品质量，实现全过程追溯，降低废品成本。',
    'equipment': '核心使命：保养好机器设备，减少临时停机，保障生产不停工。',
    'finance': '核心使命：算清每一笔账，实时掌握成本，为老板提供决策参考。',
    'manager': '核心使命：通过数字化看板，随时随地掌握工厂全局动态。',
    'implementer': '核心使命：负责系统底层架构配置与全局参数设定，确保软件运行环境稳健。',
    'system': '核心使命：通过建立标准化的工厂、物料、仓库与工艺模型，为数字化运营奠定坚实底座。'
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
      data: '物料主数据、产品 BOM、研发图纸、打样参数',
      docs: '工程变更单 (ECO)、技术标准书、工艺图纸挂载',
      value: '实现研发资料与 BOM 的版本管控，确保车间拿到的永远是最新标准。'
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
      data: '组织架构、权限模型、审批工作流、单据流水号规则',
      docs: '系统参数配置表、审计日志、自定义字段定义',
      value: '建立工厂数字底座，通过标准化配置降低运维成本，确保数据安全合规。'
    },
    'system': {
      data: '工厂组织、仓库库位、物料主文件、业务伙伴档案',
      docs: '产品 BOM、工艺路线、期初库存建账',
      value: '统一全厂数据语言，消除信息孤岛，支撑从销售到生产的全链路自动化流转。'
    }
  };

  // 前端默认的角色操作引导清单（当后端接口不存在时作为 fallback 兜底使用，确保用户有实际的操作引导）
  const ROLE_DEFAULT_CHECKLISTS: Record<string, any[]> = {
    'sales': [
      { id: 'sales_customer', name: '维护客户档案', description: '录入客户的基本信息、联系人与账期', required: true, jump_path: '/apps/master-data/supply-chain/customers' },
      { id: 'sales_price', name: '制定产品报价', description: '为不同的客户设定针对性的销售价格', required: false, jump_path: '/apps/kuaizhizao/sales-management/quotations' },
      { id: 'sales_order', name: '录入销售订单', description: '承接客户需求，生成正式的销售订单，触发生产或发货需求', required: true, jump_path: '/apps/kuaizhizao/sales-management/sales-orders' },
      { id: 'sales_delivery', name: '跟进发货进度', description: '根据库存和生产情况，开具发货通知单', required: true, jump_path: '/apps/kuaizhizao/sales-management/deliveries' }
    ],
    'purchase': [
      { id: 'pur_supplier', name: '建立供应商档案', description: '录入供应商库，进行资质管理', required: true, jump_path: '/apps/master-data/supply-chain/suppliers' },
      { id: 'pur_price', name: '维护采购价目', description: '记录物料的采购成本价与历史采购记录', required: true, jump_path: '/apps/kuaizhizao/purchase-management/purchase-orders' },
      { id: 'pur_order', name: '下达采购订单', description: '向供应商正式下达采购任务，明确交期', required: true, jump_path: '/apps/kuaizhizao/purchase-management/purchase-orders' },
      { id: 'pur_receipt', name: '跟踪到货入库', description: '确认供应商送货情况，协同质检与仓储入库', required: true, jump_path: '/apps/kuaizhizao/purchase-management/receipt-notices' }
    ],
    'warehouse': [
      { id: 'wh_setup', name: '规划物理仓库', description: '定义原材料仓、半成品仓及成品仓', required: true, jump_path: '/apps/master-data/warehouse/warehouses' },
      { id: 'wh_stock_in', name: '处理采购入库', description: '核对采购到货单，完成物料实物入库', required: true, jump_path: '/apps/kuaizhizao/warehouse-management/inbound' },
      { id: 'wh_picking', name: '处理生产领料', description: '根据车间领料申请，精准发料出库', required: true, jump_path: '/apps/kuaizhizao/warehouse-management/outbound' },
      { id: 'wh_stock_out', name: '处理销售发货', description: '拣货打包，完成成品出库发给客户', required: true, jump_path: '/apps/kuaizhizao/warehouse-management/outbound' }
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
    'implementer': [] // 基础列表留空，使用下方的 IMPLEMENTER_ENHANCED_CHECKLIST
  };

  /**
   * 系统设定向导 (实施人员/管理员) 建设标准
   * 按 4 阶段拆解，引导管理员完成系统底层配置
   *
   * 子项 required：表示跳过易导致下游建单、过账、派工等环节校验失败或无法闭环（不仅是“建议配置”）。
   */
  const IMPLEMENTER_ENHANCED_CHECKLIST = [
    {
      id: 'imp_security_phase',
      name: '第一阶段：权限基建与用户体系',
      items: [
        {
          id: 'imp_security_group',
          name: '建立用户与权限基座',
          required: true,
          description: '配置公司的部门架构、岗位体系以及基于角色的权限访问控制。',
          subItems: [
            { id: 'imp_dept', name: '部门管理', description: '定义行政组织架构，建立部门树。', required: true, jump_path: '/system/departments' },
            { id: 'imp_post', name: '职位管理', description: '定义企业岗位的职责边界与职等。', required: false, jump_path: '/system/positions' },
            { id: 'imp_role', name: '角色权限', description: '分配菜单与操作权限，实现安全隔离。', required: true, jump_path: '/system/roles' },
            { id: 'imp_user', name: '账户管理', description: '开通人员账号，绑定角色并激活。', required: true, jump_path: '/system/users' },
          ]
        }
      ]
    },
    {
      id: 'imp_config_phase',
      name: '第二阶段：核心业务建模规则',
      items: [
        {
          id: 'imp_standard_group',
          name: '业务建模与标准化',
          required: true,
          description: '以编号规则为主干；数据字典与业务参数多为系统预置，可按企业规则再细化。',
          subItems: [
            { id: 'imp_rule', name: '编号规则', description: '物料、订单的自动编号逻辑设定。', required: true, jump_path: '/system/code-rules' },
            { id: 'imp_dict', name: '数据字典', description: '预定义枚举项（支付方式、单据分类等）；通常已预置，可按需增补。', required: false, jump_path: '/system/data-dictionaries' },
            { id: 'imp_business', name: '业务配置', description: '仓储策略、负库存、批号/序列号/库位等开关；默认即可起步，启用进阶能力后再逐项对齐。', required: false, jump_path: '/system/config-center' },
            { id: 'imp_lang', name: '语言管理', description: '多语言翻译字典维护，支撑全球化作业。', required: false, jump_path: '/system/languages' },
            { id: 'imp_field', name: '自定义字段', description: '单据动态字段扩展与数据采集配置。', required: false, jump_path: '/system/custom-fields' },
          ]
        },
        {
          id: 'imp_site_group',
          name: '界面布局与站点配置',
          required: false,
          description: '配置左侧菜单布局、系统 LOGO、租户名称等全局性视觉属性（不影响核心过账链路）。',
          subItems: [
            { id: 'imp_menu', name: '菜单管理', description: '自定义侧栏排序、图标与显示名称。', required: false, jump_path: '/system/menus' },
            { id: 'imp_site', name: '站点设置', description: '配置系统名称、LOGO 与多租户参数。', required: false, jump_path: '/system/site-settings' },
          ]
        }
      ]
    },
    {
      id: 'imp_process_phase',
      name: '第三阶段：流程引擎与交付模板',
      items: [
        {
          id: 'imp_workflow_group',
          name: '定义审批与交付标准',
          required: true,
          description: '配置全业务全链路的审批流、消息预警触发以及单据打印模板。',
          subItems: [
            { id: 'imp_workflow', name: '审批流程', description: '销售、采购单据的多级审批链路定义。', required: true, jump_path: '/system/approval-processes' },
            { id: 'imp_msg', name: '消息与渠道', description: '消息模板设定与通知渠道配置。', required: false, jump_path: '/system/message-templates' },
            { id: 'imp_print', name: '打印与设备', description: '送货单等模板设计及车间打印设备关联。', required: false, jump_path: '/system/print-templates' },
          ]
        }
      ]
    },
    {
      id: 'imp_data_phase',
      name: '第四阶段：数据治理与接口集成',
      items: [
        {
          id: 'imp_integration_group',
          name: '外部集成与数据治理',
          required: false,
          description: '配置外部 API、数据集管理以及文件中心，打通系统间数据壁垒。',
          subItems: [
            { id: 'imp_file', name: '文件管理', description: '集中管理图纸、SOP 等非结构化文件。', required: false, jump_path: '/system/files' },
            { id: 'imp_api', name: '接口与数据源', description: '外部 API 注册与数据库连接配置。', required: false, jump_path: '/system/apis' },
            { id: 'imp_connector', name: '应用连接器', description: '标准连接器快速打通第三方 SaaS 数据。', required: false, jump_path: '/system/application-connections' },
            { id: 'imp_dataset', name: '数据集管理', description: '定义 BI 看板与报表底层的数据集逻辑。', required: false, jump_path: '/system/datasets' },
          ]
        }
      ]
    },
    {
      id: 'imp_ops_phase',
      name: '第五阶段：系统运维与安全监控',
      items: [
        {
          id: 'imp_ops_group',
          name: '全方位运维与监控',
          required: false,
          description: '安全审计、登录与会话监控、备份策略等治理与灾备项；不参与业务单据硬门禁，建议在上线前按合规要求落实。',
          subItems: [
            { id: 'imp_audit', name: '操作日志', description: '查询操作留痕，支撑安全审计（非业务过账前置条件）。', required: false, jump_path: '/system/operation-logs' },
            { id: 'imp_login', name: '登录日志', description: '监控系统访问记录，识别异常登录。', required: false, jump_path: '/system/login-logs' },
            { id: 'imp_online', name: '在线用户', description: '实时掌握活跃人员状态，保障登录安全。', required: false, jump_path: '/system/online-users' },
            { id: 'imp_backup', name: '数据备份', description: '定时备份与恢复策略，降低丢失风险（不做一般不阻塞日常开单）。', required: false, jump_path: '/system/data-backups' },
          ]
        }
      ]
    },
    {
      id: 'imp_app_phase',
      name: '第六阶段：应用扩展与个人效能',
      items: [
        {
          id: 'imp_ext_group',
          name: '功能扩展与个人定制',
          required: false,
          description: '通过应用中心动态扩展功能，并为个人定制专属的作业环境。',
          subItems: [
            { id: 'imp_app_center', name: '应用中心', description: '功能模块的安装、升级与版本管理。', required: false, jump_path: '/system/applications' },
            { id: 'imp_personal', name: '个人资料', description: '个人资料设置、语言主题偏好及任务中心。', required: false, jump_path: '/personal/profile' },
          ]
        }
      ]
    }
  ];

  const ENHANCED_CHECKLIST = [
    {
      id: 'infrastructure_phase',
      name: '第一阶段：制造基建建模 (工厂与仓库)',
      items: [
        { 
          id: 'factory_data', 
          name: '建立工厂数据', 
          required: true, 
          description: '在“工厂数据”中定义工作中心、车间与产线建模', 
          completed: false, 
          jump_path: '/apps/master-data/factory/work-centers',
          subItems: [
            { name: '厂区管理', description: '定义工厂的地理位置、厂区分布与基本信息', required: false, jump_path: '/apps/master-data/factory/plants', check_key: 'factory_plants' },
            { name: '车间管理', description: '划分工厂内部的生产车间，建立物理生产区域', required: true, jump_path: '/apps/master-data/factory/workshops', check_key: 'factory_workshops' },
            { name: '产线管理', description: '配置具体的生产线，支持多产线并行作业', required: true, jump_path: '/apps/master-data/factory/production-lines', check_key: 'factory_lines' },
            { name: '工位管理', description: '定义产线上的最小作业单元（工位），实现精细化报工', required: true, jump_path: '/apps/master-data/factory/workstations', check_key: 'factory_stations' },
            { name: '工作中心', description: '聚合生产资源（人员/设备），作为排程与成本核算的核心单元', required: true, jump_path: '/apps/master-data/factory/work-centers', check_key: 'factory_work_centers' },
            { name: '工作小组', description: '管理车间班组人员分配，支持计件工资与效率统计', required: true, jump_path: '/apps/master-data/factory/work-groups', check_key: 'factory_work_groups' },
          ]
        },
        { 
          id: 'warehouse_data', 
          name: '规划仓库数据', 
          required: true, 
          description: '在“仓库数据”中划分物理仓库、库位与逻辑仓储关系', 
          completed: false, 
          jump_path: '/apps/master-data/warehouse/warehouses',
          subItems: [
            { name: '仓库管理', description: '定义物理仓库，如原材料仓、成品仓等', required: true, jump_path: '/apps/master-data/warehouse/warehouses', check_key: 'warehouse_main' },
            { name: '库区管理', description: '在仓库内划分逻辑库区，方便物料归类存放', required: false, jump_path: '/apps/master-data/warehouse/storage-areas', check_key: 'warehouse_areas' },
            { name: '库位管理', description: '定义精确的货位坐标，实现扫码精准上下架', required: false, jump_path: '/apps/master-data/warehouse/storage-locations', check_key: 'warehouse_locations' },
          ]
        },
      ]
    },
    {
      id: 'modeling_phase',
      name: '第二阶段：核心资源定义 (物料与伙伴)',
      items: [
        { 
          id: 'material_data', 
          name: '完善物料数据', 
          required: true, 
          description: '在“物料数据”中录入产品主文件、分类及关键属性', 
          completed: false, 
          jump_path: '/apps/master-data/materials',
          subItems: [
            { name: '物料管理', description: '录入物料主文件，定义编码、名称及基本属性', required: true, jump_path: '/apps/master-data/materials', check_key: 'material_main' },
            { name: '变体属性', description: '定义物料的规格属性（如颜色、尺寸），支持多 SKU 管理', required: false, jump_path: '/apps/master-data/materials/variant-attributes', check_key: 'material_variants' },
            { name: '批次规则', description: '设置物料的批次生成规则，支持先进先出与质量追溯', required: false, jump_path: '/apps/master-data/materials/batch-rules', check_key: 'material_batch_rules' },
            { name: '序列号规则', description: '定义唯一序列号规则，实现单品级的精准追踪', required: false, jump_path: '/apps/master-data/materials/serial-rules', check_key: 'material_serial_rules' },
          ]
        },
        { 
          id: 'partner_data', 
          name: '录入业务伙伴', 
          required: true, 
          description: '在“业务伙伴”中建立客户档案与供应商合格名录', 
          completed: false, 
          jump_path: '/apps/master-data/supply-chain/customers',
          subItems: [
            { name: '客户管理', description: '维护客户档案，配置账期、信用额度与收货地址', required: true, jump_path: '/apps/master-data/supply-chain/customers', check_key: 'partner_customers' },
            { name: '供应商管理', description: '建立合格供应商库，管理采购单价与交期可靠性', required: true, jump_path: '/apps/master-data/supply-chain/suppliers', check_key: 'partner_suppliers' },
          ]
        },
      ]
    },
    {
      id: 'process_phase',
      name: '第三阶段：生产工艺模型 (BOM 与路线)',
      items: [
        { 
          id: 'bom_config', 
          name: '导入工艺数据 (BOM)', 
          required: true, 
          description: '在“工艺数据”中确立物料清单，作为成本与计划的核心', 
          completed: false, 
          jump_path: '/apps/master-data/process/engineering-bom',
          subItems: [
            { name: '物料清单BOM', description: '构建产品结构的数字孪生，定义父项与子项的组成关系', required: true, jump_path: '/apps/master-data/process/engineering-bom', check_key: 'process_bom' },
          ]
        },
        { 
          id: 'process_routing', 
          name: '配置工艺数据 (路线)', 
          required: true, 
          description: '在“工艺数据”中规划生产工序、工时标准与工序流转', 
          completed: false, 
          jump_path: '/apps/master-data/process/routes',
          subItems: [
            { name: '工序管理', description: '定义标准生产工序，如切割、组装、检验等', required: true, jump_path: '/apps/master-data/process/operations', check_key: 'process_operations' },
            { name: '工艺路线', description: '串联工序流转顺序，配置标准工时与资源需求', required: true, jump_path: '/apps/master-data/process/routes', check_key: 'process_routes' },
            { name: '不良品项', description: '定义生产异常与质量缺陷分类，支撑报工时的质量统计', required: false, jump_path: '/apps/master-data/process/defect-types', check_key: 'process_defects' },
            { name: '标准操作SOP', description: '挂载图纸与作业指导书，确保车间操作规范化', required: false, jump_path: '/apps/master-data/process/sop', check_key: 'process_sop' },
          ]
        },
      ]
    },
    {
      id: 'validation_phase',
      name: '第四阶段：全链路闭环验证',
      items: [
        { id: 'first_order_run', name: '完成首笔业务试运行', required: true, description: '通过一笔完整的模拟订单（从销售下单开始）验证所有主数据的准确性与连通性', completed: false, jump_path: '/apps/kuaizhizao/sales-management/sales-orders' },
      ]
    }
  ];

  const allTabs = useMemo(() => [
    { code: 'implementer', name: '系统设定向导', icon: onboardingMenuIcon(ManufacturingIcons.package) },
    { code: 'system', name: '系统上线向导', icon: onboardingMenuIcon(ManufacturingIcons.compass) },
    ...ROLE_KEYS.filter(r => r.code !== 'implementer').map((r) => ({ code: r.code, name: r.name, icon: r.icon })),
  ], []);

  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('system');
  const [guideData, setGuideData] = useState<any>(null);
  const [completedItems, setCompletedItems] = useState<Set<string>>(new Set());
  const [systemGuideData, setSystemGuideData] = useState<any>(null);
  const [realCounts, setRealCounts] = useState<Record<string, number>>({});
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [currentDetailItem, setCurrentDetailItem] = useState<any>(null);

  // 实时存量补偿器：加入用户、订单统计
  useEffect(() => {
    const fetchRealCounts = async () => {
      try {
        const [
          customers, suppliers, materials, warehouses, storageAreas, storageLocations, boms, 
          plants, workshops, lines, stations, workCenters, workGroups, 
          defectTypes, operations, routes, sops,
          variantAttrs, batchRules, serialRules,
          users, sales, purchases
        ] = await Promise.all([
          customerApi.list().catch(() => null),
          supplierApi.list().catch(() => null),
          materialApi.list().catch(() => null),
          warehouseApi.list().catch(() => null),
          storageAreaApi.list().catch(() => null),
          storageLocationApi.list().catch(() => null),
          bomApi.getGroups().catch(() => null),
          plantApi.list().catch(() => null),
          workshopApi.list().catch(() => null),
          productionLineApi.list().catch(() => null),
          workstationApi.list().catch(() => null),
          workCenterApi.list().catch(() => null),
          workGroupApi.list().catch(() => null),
          defectTypeApi.list().catch(() => null),
          operationApi.list().catch(() => null),
          processRouteApi.list().catch(() => null),
          sopApi.list().catch(() => null),
          variantAttributeApi.list().catch(() => null),
          batchRuleApi.list().catch(() => null),
          serialRuleApi.list().catch(() => null),
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
        
        // 供应链
        counts['partner_customers'] = getCount(customers) ?? 0;
        counts['partner_suppliers'] = getCount(suppliers) ?? 0;
        counts['partner_data'] = (counts['partner_customers'] || 0) + (counts['partner_suppliers'] || 0);
        
        // 物料
        counts['material_main'] = getCount(materials) ?? 0;
        counts['material_variants'] = getCount(variantAttrs) ?? 0;
        counts['material_batch_rules'] = getCount(batchRules) ?? 0;
        counts['material_serial_rules'] = getCount(serialRules) ?? 0;
        counts['material_data'] = counts['material_main'];

        // 仓库
        counts['warehouse_main'] = getCount(warehouses) ?? 0;
        counts['warehouse_areas'] = getCount(storageAreas) ?? 0;
        counts['warehouse_locations'] = getCount(storageLocations) ?? 0;
        counts['warehouse_data'] = counts['warehouse_main'];

        // 工艺
        counts['process_bom'] = getCount(boms) ?? 0;
        counts['process_operations'] = getCount(operations) ?? 0;
        counts['process_routes'] = getCount(routes) ?? 0;
        counts['process_defects'] = getCount(defectTypes) ?? 0;
        counts['process_sop'] = getCount(sops) ?? 0;
        counts['bom_config'] = counts['process_bom'];
        counts['process_routing'] = counts['process_routes'];

        // 细化工厂子项
        counts['factory_plants'] = getCount(plants) ?? 0;
        counts['factory_workshops'] = getCount(workshops) ?? 0;
        counts['factory_lines'] = getCount(lines) ?? 0;
        counts['factory_stations'] = getCount(stations) ?? 0;
        counts['factory_work_centers'] = getCount(workCenters) ?? 0;
        counts['factory_work_groups'] = getCount(workGroups) ?? 0;

        // 汇总工厂数据：只要有一个有数据就算完成了“建立工厂数据”的初步
        counts['factory_data'] = (counts['factory_workshops'] || counts['factory_lines'] || counts['factory_stations']) ? 1 : 0;
        
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
    } else if (activeTab === 'implementer') {
      // Logic handled via renderImplementerTab
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
  
  const implementerChecklist = useMemo(() => {
    // 强制使用 IMPLEMENTER_ENHANCED_CHECKLIST 作为实施向导的骨架
    return IMPLEMENTER_ENHANCED_CHECKLIST.map((cat) => ({
      ...cat,
      items: cat.items.map((item) => {
        // 如果有子项，根据子项状态判断整体完成度（这里简化处理，手动勾选 group 也会记录）
        const hasSubItems = item.subItems && item.subItems.length > 0;
        let isGroupCompleted = completedItems.has(item.id);
        
        if (hasSubItems && !isGroupCompleted) {
          // 如果所有必填子项都已手动勾选或满足条件，则视为完成
          const requiredSubs = item.subItems!.filter(s => s.required);
          if (requiredSubs.length > 0) {
            isGroupCompleted = requiredSubs.every(s => completedItems.has(s.id));
          }
        }

        return {
          ...item,
          completed: isGroupCompleted
        };
      })
    }));
  }, [completedItems]);

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

  const impProgress = useMemo(() => {
    let impCompleted = 0;
    let impTotal = 0;
    implementerChecklist.forEach((cat: any) => {
      cat.items?.forEach((item: any) => {
        impTotal++;
        if (item.completed) impCompleted++;
      });
    });
    return impTotal > 0 ? Math.round((impCompleted / impTotal) * 100) : 0;
  }, [implementerChecklist]);



  /** 系统设定向导 (管理员专用) */
  const renderImplementerTab = () => {
    // 计算当前阶段
    const currentStep = implementerChecklist.findIndex((cat: any) => 
      (cat.items || []).some((item: any) => !item.completed)
    );
    const activeStep = currentStep === -1 ? implementerChecklist.length : currentStep;

    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <Card 
          style={{ borderRadius: token.borderRadiusLG, border: `1px solid ${token.colorBorderSecondary}`, overflow: 'hidden' }}
          styles={{ body: { padding: 0 } }}
        >
          {/* Header */}
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
                {onboardingMenuIcon(ManufacturingIcons.package)}
              </div>
              <div>
                <Typography.Title level={4} style={{ margin: 0 }}>
                  系统设定向导
                </Typography.Title>
                <Text type="secondary" style={{ fontSize: 14, marginTop: 4, display: 'flex', alignItems: 'center' }}>
                  {wizIcon(Target, 16, { marginRight: 6, flexShrink: 0 }, token.colorPrimary)}
                  {ROLE_MISSION_MAP[activeTab] || '核心使命：负责系统底层架构配置与全局参数设定，确保软件运行环境稳健。'}
                </Text>
              </div>
            </div>

            <Row gutter={16}>
              <Col xs={24} md={12}>
                <div style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)', padding: '16px', borderRadius: token.borderRadiusLG, border: `1px solid ${token.colorBorderSecondary}60`, height: '100%', backdropFilter: 'blur(8px)' }}>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                    {wizIcon(Archive, 14, { marginRight: 6, verticalAlign: 'middle', display: 'inline-block' })}
                    管理员核心职责
                  </Text>
                  <Text strong style={{ fontSize: 13, color: token.colorText }}>组织架构、账号权限、流程引擎、系统安全</Text>
                </div>
              </Col>
              <Col xs={24} md={12}>
                <div style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)', padding: '16px', borderRadius: token.borderRadiusLG, border: `1px solid ${token.colorBorderSecondary}60`, height: '100%', backdropFilter: 'blur(8px)' }}>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                    {wizIcon(FileSearch, 14, { marginRight: 6, verticalAlign: 'middle', display: 'inline-block' })}
                    交付验收标准
                  </Text>
                  <Text strong style={{ fontSize: 13, color: token.colorText }}>全员账号开通、核心流程走通、单据样式符合标准</Text>
                </div>
              </Col>
            </Row>
            
            <div style={{ marginTop: 16, display: 'flex', alignItems: 'flex-start' }}>
              {wizIcon(AlertCircle, 16, { marginTop: 4, marginRight: 8, flexShrink: 0 }, token.colorWarning)}
              <Text type="secondary" style={{ fontSize: 13 }}>
                <span style={{ color: token.colorWarning, fontWeight: 500 }}>专家提示：</span>
                作为系统管理员，您的配置决定了系统的“骨架”。请务必先行完成第一阶段的组织与权限设定，这是所有业务模块运行的前置条件。
                清单中标记为「必填」的子项表示若缺失，下游建单、过账或派工等环节容易出现校验失败；未标记项多为体验或扩展类配置。
              </Text>
            </div>
          </div>
          {/* List Section */}
          <div style={{ padding: '24px' }}>
            <Steps
              direction="vertical"
              size="small"
              className="onboarding-steps"
              current={activeStep}
              items={implementerChecklist.map((category: any, idx: number) => {
                const isCurrentStep = idx === activeStep;

                return {
                  title: (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                      <span style={{ 
                        fontSize: 14, 
                        fontWeight: 500,
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
                        const isCompleted = item.completed;
                        
                        return (
                          <List.Item
                            className="onboarding-list-item"
                            style={{
                              padding: '20px 24px',
                              marginBottom: 16,
                              borderRadius: token.borderRadiusLG,
                              border: `1px solid ${isCompleted ? 'rgba(82, 196, 26, 0.2)' : token.colorBorderSecondary}`,
                              background: isCompleted 
                                ? (isDark 
                                    ? 'linear-gradient(145deg, rgba(82, 196, 26, 0.05) 0%, rgba(0, 0, 0, 0) 100%)' 
                                    : 'linear-gradient(145deg, rgba(82, 196, 26, 0.04) 0%, rgba(255, 255, 255, 0.6) 100%)')
                                : token.colorBgContainer,
                            }}
                          >
                            <div style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 24 }}>
                              <div style={{ display: 'flex', flex: 1, gap: 16, alignItems: 'flex-start' }}>
                                <Checkbox 
                                  checked={isCompleted}
                                  onChange={() => handleItemToggle(item.id)}
                                  style={{ marginTop: 4 }}
                                />
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Text strong style={{ fontSize: 16, color: isCompleted ? token.colorSuccess : token.colorText }}>
                                      {item.name}
                                    </Text>
                                    {item.required && !isCompleted && (
                                      <Tag bordered={false} color="error" style={{ fontSize: 10, borderRadius: 4, paddingInline: 6 }}>核心必办</Tag>
                                    )}
                                  </div>
                                  <Text type="secondary" style={{ fontSize: 13, lineHeight: '1.6', maxWidth: 500 }}>{item.description}</Text>
                                </div>
                              </div>

                              {/* Right: Status & Action */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                                <div style={{ 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.015)',
                                  borderRadius: 14,
                                  border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)'}`,
                                  overflow: 'hidden'
                                }}>
                                  {(() => {
                                    let req = 0, opt = 0, done = 0;
                                    if (item.subItems && item.subItems.length > 0) {
                                      item.subItems.forEach((sub: any) => {
                                        if (sub.required) req++; else opt++;
                                        if (completedItems.has(sub.id) || realCounts[sub.id] > 0) done++;
                                      });
                                    } else {
                                      if (item.required) req = 1; else opt = 1;
                                      if (isCompleted) done = 1;
                                    }
                                    
                                    const StatItem = ({ label, value, subValue, icon: Icon, isError, iconColor, valueColor }: any) => (
                                      <div style={{ 
                                        padding: '8px 16px', 
                                        paddingRight: 24,
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: 12,
                                        minWidth: 120
                                      }}>
                                        <div style={{ 
                                          width: 32, 
                                          height: 32, 
                                          borderRadius: 10, 
                                          background: iconColor ? `${iconColor}1A` : (isDark ? 'rgba(255,255,255,0.08)' : '#fff'),
                                          boxShadow: !iconColor && !isDark ? '0 2px 4px rgba(0,0,0,0.02)' : 'none',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          color: iconColor || token.colorPrimary
                                        }}>
                                          <Icon size={16} strokeWidth={2.5} />
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                          <span style={{ fontSize: 10, color: token.colorTextSecondary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em' }}>{label}</span>
                                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                                            <span style={{ 
                                              fontSize: 18, 
                                              fontWeight: 700, 
                                              color: valueColor || (isError ? token.colorError : token.colorText), 
                                              fontFamily: 'Inter, system-ui, sans-serif' 
                                            }}>
                                              {value}
                                            </span>
                                            {subValue !== undefined && (
                                              <span style={{ fontSize: 12, color: token.colorTextTertiary, fontWeight: 500 }}>
                                                / {subValue}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    );

                                    return (
                                      <>
                                        <StatItem 
                                          label="进度 (必选)" 
                                          value={done} 
                                          subValue={req}
                                          isError={req > 0 && done === 0}
                                          iconColor="#EAB308"
                                          valueColor={done > 0 ? token.colorSuccess : (req > 0 ? token.colorError : undefined)}
                                          icon={Target} 
                                        />
                                        <div style={{ width: 1, height: 24, background: token.colorBorderSecondary, opacity: 0.3 }} />
                                        <StatItem 
                                          label="全部模块" 
                                          value={req + opt} 
                                          icon={Layers} 
                                          iconColor={isDark ? '#8b5cf6' : '#7c3aed'}
                                        />
                                      </>
                                    );
                                  })()}
                                </div>

                                {(item.jump_path || (item.subItems && item.subItems.length > 0)) && (
                                  <Button
                                    type={isCompleted ? 'default' : 'primary'}
                                    size="large"
                                    shape="round"
                                    icon={
                                      isCompleted
                                        ? wizIcon(CheckCircle2, 16, undefined, token.colorSuccess)
                                        : wizIcon(ArrowRight, 16)
                                    }
                                    onClick={() => {
                                      if (!isCompleted) {
                                        if (item.subItems) {
                                          setCurrentDetailItem(item);
                                          setDetailModalVisible(true);
                                        } else {
                                          navigate(item.jump_path);
                                        }
                                      }
                                    }}
                                    style={{ 
                                      borderRadius: 25, 
                                      paddingInline: 36,
                                      minWidth: 160,
                                      fontSize: 16, 
                                      height: 50,
                                      fontWeight: 600,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      ...(isCompleted
                                        ? {
                                            background: token.colorSuccessBg,
                                            border: `1px solid ${token.colorSuccessBorder}`,
                                            color: token.colorSuccess,
                                            boxShadow: 'none',
                                            cursor: 'default',
                                          }
                                        : {
                                            background: `linear-gradient(90deg, #1890ff 0%, #0070f3 100%)`,
                                            border: 'none',
                                            boxShadow: `0 6px 16px rgba(0, 112, 243, 0.3)`,
                                            color: '#fff',
                                          }),
                                    }}
                                  >
                                    {isCompleted ? '已完成' : '立即前往'}
                                  </Button>
                                )}
                              </div>
                            </div>
                          </List.Item>
                        );
                      }}
                    />
                  )
                };
              })}
            />
          </div>

          <div
            style={{
              padding: '16px 24px',
              borderTop: `1px solid ${token.colorBorderSecondary}`,
              background: token.colorSuccessBg,
              borderRadius: `0 0 ${token.borderRadiusLG}px ${token.borderRadiusLG}px`
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              {wizIcon(Zap, 16, { marginRight: 8, flexShrink: 0 }, token.colorSuccess)}
              <Text style={{ fontSize: 12, fontWeight: 600, color: token.colorSuccess, margin: 0 }}>
                管理员赋能与收益
              </Text>
            </div>
            <Text strong style={{ fontSize: 13, color: token.colorText, fontWeight: 500 }}>
              通过标准化的系统设定，您将建立起稳健的数字化底座，实现全流程的规范化管理与风险管控。
            </Text>
          </div>
        </Card>
      </div>
    );
  };

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
                {onboardingMenuIcon(ManufacturingIcons.compass)}
              </div>
              <div>
                <Typography.Title level={4} style={{ margin: 0 }}>
                  系统上线向导
                </Typography.Title>
                <Text type="secondary" style={{ fontSize: 14, marginTop: 4, display: 'flex', alignItems: 'center' }}>
                  {wizIcon(Target, 16, { marginRight: 6, flexShrink: 0 }, token.colorPrimary)}
                  {ROLE_MISSION_MAP[activeTab] || '核心使命：建立工厂数字孪生底座，确保业务数据标准化。'}
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
                <span style={{ color: token.colorWarning, fontWeight: 500 }}>实施建议：</span>
                系统上线是数字化转期的关键里程碑。请按照引导顺序逐步完成基础数据建模，这是后续业务全链路跑通的先决条件。
              </Text>
            </div>
          </div>

          {/* 清单部分 */}
          <div style={{ padding: '24px' }}>
            <Steps
              direction="vertical"
              size="small"
              className="onboarding-steps"
              current={activeStep}
              items={systemChecklist.map((category: any, idx: number) => {
                const isCurrentStep = idx === activeStep;

                return {
                  title: (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                      <span style={{ 
                        fontSize: 14, 
                        fontWeight: 500,
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
                        // 智能存量匹配
                        const getSmartCount = () => {
                          if (realCounts[item.id] !== undefined) return realCounts[item.id];
                          const name = item.name || '';
                          if (name.includes('单据') || name.includes('订单')) return realCounts['order_data'] || 0;
                          if (name.includes('用户') || name.includes('人员')) return realCounts['user_data'] || 0;
                          if (name.includes('客户') || name.includes('供应商')) return realCounts['partner_data'] || 0;
                          if (name.includes('物料') || name.includes('产品')) return realCounts['material_data'] || 0;
                          if (name.includes('仓库') || name.includes('库位')) return realCounts['warehouse_data'] || 0;
                          if (name.includes('BOM') || name.includes('清单')) return realCounts['bom_config'] || 0;
                          if (name.includes('工作中心') || name.includes('产线')) return realCounts['work_center_config'] || 0;
                          if (name.includes('工艺') || name.includes('路线')) return realCounts['process_routing'] || 0;
                          return 0;
                        };

                        const realCount = getSmartCount();
                        const isCompleted = realCount > 0 || item.completed === true || completedItems.has(item.id);
                        const enhanced = ENHANCED_MISSION_GUIDE[item.id] || ENHANCED_MISSION_GUIDE[item.check_key || ''];
                        
                        return (
                          <List.Item
                            className="onboarding-list-item"
                            style={{
                              padding: '20px 24px',
                              marginBottom: 16,
                              borderRadius: token.borderRadiusLG,
                              border: `1px solid ${isCompleted ? 'rgba(82, 196, 26, 0.2)' : token.colorBorderSecondary}`,
                              background: isCompleted 
                                ? (isDark 
                                    ? 'linear-gradient(145deg, rgba(82, 196, 26, 0.05) 0%, rgba(0, 0, 0, 0) 100%)' 
                                    : 'linear-gradient(145deg, rgba(82, 196, 26, 0.04) 0%, rgba(255, 255, 255, 0.6) 100%)')
                                : token.colorBgContainer,
                            }}
                          >
                            <div style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 24 }}>
                              {/* Left: Info */}
                              <div style={{ display: 'flex', flex: 1, gap: 16, alignItems: 'flex-start' }}>
                                <Checkbox 
                                  checked={isCompleted}
                                  onChange={(e) => handleItemToggle(item.id)}
                                  style={{ marginTop: 4 }}
                                />
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Text strong style={{ fontSize: 16, color: isCompleted ? token.colorSuccess : token.colorText }}>
                                      {item.name}
                                    </Text>
                                    {item.required && !isCompleted && (
                                      <Tag bordered={false} color="error" style={{ fontSize: 10, borderRadius: 4, paddingInline: 6 }}>核心必办</Tag>
                                    )}
                                  </div>
                                  <Text type="secondary" style={{ fontSize: 13, lineHeight: '1.6', maxWidth: 500 }}>{item.description}</Text>
                                  
                                  {(enhanced?.dependency || enhanced?.tip) && (
                                    <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                      {enhanced?.dependency && (
                                        <Text type="danger" style={{ fontSize: 12, display: 'flex', alignItems: 'center' }}>
                                          {wizIcon(CalendarClock, 12, { marginRight: 6 })} 前置要求：{enhanced.dependency}
                                        </Text>
                                      )}
                                      {enhanced?.tip && (
                                        <Text type="warning" style={{ fontSize: 12, display: 'flex', alignItems: 'center' }}>
                                          {wizIcon(AlertCircle, 12, { marginRight: 6 })} 专家建议：{enhanced.tip}
                                        </Text>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Right: Status & Action */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                                <div style={{ 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.015)',
                                  borderRadius: 14,
                                  border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)'}`,
                                  overflow: 'hidden'
                                }}>
                                  {(() => {
                                    let req = 0, opt = 0, done = 0;
                                    if (item.subItems && item.subItems.length > 0) {
                                      item.subItems.forEach((sub: any) => {
                                        if (sub.required) req++; else opt++;
                                        if (realCounts[sub.check_key] > 0) done++;
                                      });
                                    } else {
                                      if (item.required) req = 1; else opt = 1;
                                      if (realCounts[item.id] > 0) done = 1;
                                    }
                                    
                                    const StatItem = ({ label, value, subValue, icon: Icon, isError, iconColor, valueColor }: any) => (
                                      <div style={{ 
                                        padding: '8px 16px', 
                                        paddingRight: 24,
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: 12,
                                        minWidth: 120
                                      }}>
                                        <div style={{ 
                                          width: 32, 
                                          height: 32, 
                                          borderRadius: 10, 
                                          background: iconColor ? `${iconColor}1A` : (isDark ? 'rgba(255,255,255,0.08)' : '#fff'),
                                          boxShadow: !iconColor && !isDark ? '0 2px 4px rgba(0,0,0,0.02)' : 'none',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          color: iconColor || token.colorPrimary
                                        }}>
                                          <Icon size={16} strokeWidth={2.5} />
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                          <span style={{ fontSize: 10, color: token.colorTextSecondary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em' }}>{label}</span>
                                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                                            <span style={{ 
                                              fontSize: 18, 
                                              fontWeight: 700, 
                                              color: valueColor || (isError ? token.colorError : token.colorText), 
                                              fontFamily: 'Inter, system-ui, sans-serif' 
                                            }}>
                                              {value}
                                            </span>
                                            {subValue !== undefined && (
                                              <span style={{ fontSize: 12, color: token.colorTextTertiary, fontWeight: 500 }}>
                                                / {subValue}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    );

                                    return (
                                      <>
                                        <StatItem 
                                          label="进度 (必选)" 
                                          value={done} 
                                          subValue={req}
                                          isError={req > 0 && done === 0}
                                          iconColor="#EAB308"
                                          valueColor={done > 0 ? token.colorSuccess : (req > 0 ? token.colorError : undefined)}
                                          icon={Target} 
                                        />
                                        <div style={{ width: 1, height: 24, background: token.colorBorderSecondary, opacity: 0.3 }} />
                                        <StatItem 
                                          label="全部模块" 
                                          value={req + opt} 
                                          icon={Layers} 
                                          iconColor={isDark ? '#8b5cf6' : '#7c3aed'}
                                        />
                                      </>
                                    );
                                  })()}
                                </div>

                                {item.jump_path && (
                                  <Button
                                    type={isCompleted ? 'default' : 'primary'}
                                    size="large"
                                    shape="round"
                                    icon={isCompleted ? wizIcon(CheckCircle2, 16, undefined, token.colorSuccess) : wizIcon(ArrowRight, 16)}
                                    onClick={() => {
                                      if (!isCompleted) {
                                        if (item.subItems) {
                                          setCurrentDetailItem(item);
                                          setDetailModalVisible(true);
                                        } else {
                                          navigate(item.jump_path);
                                        }
                                      }
                                    }}
                                    style={{ 
                                      borderRadius: 25, 
                                      paddingInline: 36,
                                      minWidth: 160,
                                      fontSize: 16, 
                                      height: 50,
                                      fontWeight: 600,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      ...(isCompleted
                                        ? {
                                            background: token.colorSuccessBg,
                                            border: `1px solid ${token.colorSuccessBorder}`,
                                            color: token.colorSuccess,
                                            boxShadow: 'none',
                                            cursor: 'default',
                                          }
                                        : {
                                            background: `linear-gradient(90deg, #1890ff 0%, #0070f3 100%)`,
                                            border: 'none',
                                            boxShadow: `0 6px 16px rgba(0, 112, 243, 0.3)`,
                                            color: '#fff',
                                          }),
                                    }}
                                  >
                                    {isCompleted ? '已完成' : '立即前往'}
                                  </Button>
                                )}
                              </div>
                            </div>
                          </List.Item>
                        );
                      }}
                    />
                  ),
                };
              })}
            />
          </div>

          {ROLE_DETAILS_MAP[activeTab]?.value && (
            <div
              style={{
                padding: '16px 24px',
                borderTop: `1px solid ${token.colorBorderSecondary}`,
                background: token.colorSuccessBg,
                borderRadius: `0 0 ${token.borderRadiusLG}px ${token.borderRadiusLG}px`
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                {wizIcon(Zap, 16, { marginRight: 8, flexShrink: 0 }, token.colorSuccess)}
                <Text style={{ fontSize: 12, fontWeight: 600, color: token.colorSuccess, margin: 0 }}>
                  系统使用赋能与收益
                </Text>
              </div>
              <Text strong style={{ fontSize: 13, color: token.colorText, fontWeight: 500 }}>
                {ROLE_DETAILS_MAP[activeTab].value}
              </Text>
            </div>
          )}
        </Card>

        {sysProgress === 100 && (
          <Alert
            message={t('pages.system.onboardingWizard.systemComplete')}
            description={t('pages.system.onboardingWizard.systemCompleteDesc')}
            type="success"
            showIcon
            icon={wizIcon(CheckCircle2, 18)}
            style={{ marginTop: 16, borderRadius: token.borderRadiusLG }}
          />
        )}
      </div>
    );
  };

  /** 角色 Tab 内容 */
  const renderRoleTab = () => {
    if (activeTab === 'system') {
      return renderSystemTab();
    }
    if (activeTab === 'implementer') {
      return renderImplementerTab();
    }

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
                style={{ paddingTop: 8 }}
                dataSource={roleChecklistItems}
                renderItem={(item: any) => {
                  const isCompleted = completedItems.has(item.id) || item.completed === true;
                  return (
                    <List.Item
                      className="onboarding-list-item"
                      style={{
                        padding: '20px 24px',
                        marginBottom: 16,
                        borderRadius: token.borderRadiusLG,
                        border: `1px solid ${isCompleted ? token.colorBorder : token.colorBorderSecondary}`,
                        background: isCompleted 
                          ? (isDark ? 'rgba(255, 255, 255, 0.02)' : '#fafafa')
                          : token.colorBgContainer,
                      }}
                    >
                      <div style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 24 }}>
                        {/* Left: Info */}
                        <div style={{ display: 'flex', flex: 1, gap: 16, alignItems: 'flex-start' }}>
                          <Checkbox 
                            checked={isCompleted}
                            disabled={isCompleted}
                            style={{ marginTop: 4 }}
                            onChange={(e) => {
                              if (e.target.checked) {
                                handleItemToggle(item.id);
                                messageApi.success(`已标记完成: ${item.name}`);
                              }
                            }}
                          />
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <Text strong={item.required} style={{ fontSize: 16 }}>{item.name}</Text>
                              {item.required && <Tag bordered={false} color="error" style={{ fontSize: 10, borderRadius: 4, paddingInline: 6 }}>核心必办</Tag>}
                              {isCompleted && wizIcon(CheckCircle2, 16, { color: token.colorSuccess })}
                            </div>
                            <Text type="secondary" style={{ fontSize: 13, lineHeight: '1.6', maxWidth: 600 }}>
                              {item.description}
                            </Text>
                            <div style={{ marginTop: 4, opacity: 0.8 }}>
                              <Tag bordered={false} style={{ fontSize: 11, background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }}>
                                业务准则：确保数据录入的完整性与及时性
                              </Tag>
                            </div>
                          </div>
                        </div>

                        {/* Right: Action */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                          {item.jump_path && (
                            <Button
                              type={isCompleted ? 'default' : 'primary'}
                              size="middle"
                              shape="round"
                              icon={
                                isCompleted
                                  ? wizIcon(CheckCircle2, 16, undefined, token.colorSuccess)
                                  : wizIcon(PlayCircle, 16)
                              }
                              onClick={() => !isCompleted && navigate(item.jump_path)}
                              className={
                                isCompleted ? 'onboarding-completed-btn' : 'onboarding-action-btn'
                              }
                              style={{ 
                                borderRadius: token.borderRadiusLG, 
                                paddingInline: 24,
                                minWidth: 120,
                                fontSize: 14, 
                                height: 36,
                                fontWeight: 600,
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
                                      boxShadow: `0 4px 12px ${token.colorPrimary}40`,
                                      color: '#fff',
                                    }),
                              }}
                            >
                              {isCompleted ? '已完成' : '立即前往'}
                            </Button>
                          )}
                        </div>
                      </div>
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
                background: token.colorSuccessBg,
                borderRadius: `0 0 ${token.borderRadiusLG}px ${token.borderRadiusLG}px`
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                {wizIcon(Zap, 16, { marginRight: 8, flexShrink: 0 }, token.colorSuccess)}
                <Text style={{ fontSize: 12, fontWeight: 600, color: token.colorSuccess, margin: 0 }}>
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
                        {/* item.guide_id && (
                          <Button
                            type="primary"
                            ghost
                            size="small"
                            icon={wizIcon(PlayCircle, 14)}
                            onClick={() => runGuide(item.guide_id)}
                          >
                            开始引导
                          </Button>
                        ) */}
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
              border: `1px solid ${token.colorSuccessBorder}`,
              background: token.colorSuccessBg,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              {wizIcon(Zap, 16, { marginRight: 8, flexShrink: 0 }, token.colorSuccess)}
              <Text style={{ fontSize: 12, fontWeight: 600, color: token.colorSuccess, margin: 0 }}>
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
          padding: '8px 8px 8px 24px', 
          borderRadius: 32,
          border: `1px solid ${token.colorBorderSecondary}`,
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <Text strong style={{ fontSize: 14 }}>
              {activeTab === 'system' ? t('pages.system.onboardingWizard.systemProgress') : (activeTab === 'implementer' ? '设定进度' : t('pages.system.onboardingWizard.roleProgress'))}
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
            percent={activeTab === 'system' ? sysProgress : (activeTab === 'implementer' ? impProgress : progress)} 
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

      {/* 详细功能指引 Modal */}
      <Modal
        title={<span>{currentDetailItem?.name} - 功能详情清单</span>}
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            返回向导
          </Button>,
        ]}
        width={960}
        centered
        styles={{
          body: { padding: '0 24px 24px 0' },
        }}
      >
        <div style={{ paddingTop: 16, marginBottom: 16 }}>
          <Text type="secondary">
            完成以下各项核心子功能的配置与数据录入，即可完成“{currentDetailItem?.name}”阶段的任务。
          </Text>
        </div>
        <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
          <Table
            dataSource={currentDetailItem?.subItems || []}
            pagination={false}
            size="middle"
            rowKey="name"
            scroll={{ x: 'max-content' }}
            columns={[
              {
                title: '功能清单',
                dataIndex: 'name',
                key: 'name',
                width: 160,
                fixed: 'left',
                render: (text, record) => (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {(completedItems.has(record.id) || realCounts[record.id] > 0) && (
                      <CheckCircle2 size={14} color={token.colorSuccess} style={{ flexShrink: 0 }} />
                    )}
                    <Text strong>{text}</Text>
                  </div>
                ),
              },
              {
                title: '功能简介',
                dataIndex: 'description',
                key: 'description',
                render: (text) => (
                  <Text type="secondary" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
                    {text}
                  </Text>
                ),
              },
              {
                title: '是否必填',
                dataIndex: 'required',
                key: 'required',
                width: 96,
                align: 'center',
                render: (required) =>
                  required ? (
                    <Tag color="error" bordered={false} style={{ fontSize: 11 }}>
                      必填
                    </Tag>
                  ) : (
                    <Tag color="default" bordered={false} style={{ fontSize: 11 }}>
                      可选
                    </Tag>
                  ),
              },
              {
                title: '操作',
                key: 'action',
                width: 132,
                align: 'center',
                fixed: 'right',
                render: (_, record) => (
                  <Typography.Link
                    onClick={() => {
                      setDetailModalVisible(false);
                      navigate(record.jump_path);
                    }}
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    立即前往 {wizIcon(ArrowRight, 14)}
                  </Typography.Link>
                ),
              },
            ]}
          />
        </div>
      </Modal>
    </div>
  );
};

export default OnboardingWizardPage;
