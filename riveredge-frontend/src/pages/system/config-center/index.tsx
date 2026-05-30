/**
 * 统一配置中心
 *
 * 提供「参数设置」「审核设置」「流程设置」「业务自动化」「消息提醒」五个功能 Tab。
 * 每个 Tab 内部按业务模块（销售、计划、采购、生产、质量、设备、仓储）组织。
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Form, Card, Button, Space, Layout, Menu, InputNumber, ColorPicker, Typography, Spin, Switch, Select, theme, Modal, Descriptions } from 'antd';
import { SaveOutlined, ReloadOutlined, SettingOutlined, AuditOutlined, ControlOutlined, BellOutlined } from '@ant-design/icons';
import type { ProFormInstance } from '@ant-design/pro-components';
import { ProFormSelect, ProFormDependency } from '@ant-design/pro-components';
import { useSearchParams } from 'react-router-dom';
import { MultiTabListPageTemplate } from '../../../components/layout-templates';
import { UniTable } from '../../../components/uni-table';
import { FormModalTemplate } from '../../../components/layout-templates';
import { renderRowActionsOverflow } from '../../../utils/renderRowActionsOverflow';
import {
  getBusinessConfig,
  getBusinessConfigSchema,
  batchUpdateProcessParameters,
} from '../../../services/businessConfig';
import { getMessageConfigList, type MessageConfig } from '../../../services/messageConfig';
import { getMessageTemplateList, type MessageTemplate } from '../../../services/messageTemplate';
import {
  getApprovalProcessList,
  setAuditSwitchActive,
  type ApprovalProcess,
} from '../../../services/approvalProcess';
import { getUserList, type User } from '../../../services/user';
import {
  PARAMETER_CATEGORIES,
  AUDIT_CATEGORIES,
  FLOW_CATEGORIES,
  AUTOMATION_CATEGORIES,
  type ConfigCategory,
} from './configTree';
import { TRIAL_RUN_MODE_QUERY_KEY } from '../../../hooks/useTrialRunMode';
import { WorkOrderScoreProfilesPanel } from './WorkOrderScoreProfilesPanel';
import { qualityApi } from '../../../apps/kuaizhizao/services/quality-execution';

import type { Color } from 'antd/es/color-picker';

const { Sider, Content } = Layout;
const { Text, Paragraph } = Typography;
const { useToken } = theme;

export const PARAM_GUIDANCE_I18N_KEY_MAP: Record<string, string> = {
  'work_order.material_shortage_block_level': 'pages.system.configCenter.param.work_order_material_shortage_block_level_guide',
  'purchase.tolerance_percentage': 'pages.system.configCenter.param.purchase_tolerance_percentage_guide',
};

export function getParamGuidanceI18nKey(paramKey: string): string | undefined {
  return PARAM_GUIDANCE_I18N_KEY_MAP[paramKey];
}

/** 质检参数：上级环节/模块关闭时禁用子项（与后端 validate_quality_business_parameters 一致） */
export function isQualityParamDisabled(paramKey: string, values: Record<string, any> | undefined): boolean {
  if (!values) return false;
  const incoming = values['quality.incoming_inspection'] !== false;
  const iqcStage = values['quality_stage.iqc_enabled'] !== false;
  const process = values['quality.process_inspection'] !== false;
  const ipqcStage = values['quality_stage.ipqc_enabled'] !== false;
  const finished = values['quality.finished_inspection'] !== false;
  const fqcStage = values['quality_stage.fqc_enabled'] !== false;
  const oqcStage = values['quality_stage.oqc_enabled'] !== false;

  if (
    paramKey === 'quality.require_incoming_inspection_for_receipt'
    || paramKey === 'quality.auto_create_iqc_on_purchase_receipt'
  ) {
    return !(incoming && iqcStage);
  }
  if (paramKey === 'quality.auto_create_ipqc_on_reporting') {
    return !(process && ipqcStage);
  }
  if (paramKey === 'quality.auto_create_fqc_on_last_reporting') {
    return !(finished && fqcStage);
  }
  if (
    paramKey === 'quality.auto_create_oqc_on_shipment_notice_notify'
    || paramKey === 'quality.auto_create_oqc_on_sales_delivery'
  ) {
    return !oqcStage;
  }
  return false;
}

/** 从 business_config 提取 parameters 下的值到扁平 key */
function flattenBusinessParams(parameters: Record<string, Record<string, any>>): Record<string, any> {
  const flat: Record<string, any> = {};
  if (!parameters) return flat;
  for (const [cat, params] of Object.entries(parameters)) {
    if (!params || typeof params !== 'object') continue;
    for (const [key, value] of Object.entries(params)) {
      flat[`${cat}.${key}`] = value;
    }
  }
  return flat;
}

/** 将扁平 form 值转回 business_config parameters 结构 */
function toBusinessParams(flat: Record<string, any>, bizParamKeys: string[]): Record<string, Record<string, any>> {
  const params: Record<string, Record<string, any>> = {};
  for (const key of bizParamKeys) {
    if (flat[key] === undefined) continue;
    const dot = key.indexOf('.');
    const cat = dot > 0 ? key.slice(0, dot) : key;
    const paramKey = dot > 0 ? key.slice(dot + 1) : key;
    if (!params[cat]) params[cat] = {};
    params[cat][paramKey] = flat[key];
  }
  return params;
}

const BUSINESS_CONFIG_QUERY_KEY = ['businessConfig'] as const;
const BUSINESS_CONFIG_SCHEMA_QUERY_KEY = ['businessConfigSchema'] as const;
const APPROVAL_PROCESS_LIST_QUERY_KEY = ['approvalProcessListForConfigCenter'] as const;

/** 审核开关定义：与后端识别的 code 对应，并关联到具体业务模块 ID */
const AUDIT_SWITCH_ITEMS: Array<{ code: string; labelKey: string; descKey: string; categoryId: string }> = [
  { code: 'sales_forecast', labelKey: 'pages.system.configCenter.auditSwitch.sales_forecast.label', descKey: 'pages.system.configCenter.auditSwitch.sales_forecast.desc', categoryId: 'sales' },
  { code: 'sales_order', labelKey: 'pages.system.configCenter.auditSwitch.sales_order.label', descKey: 'pages.system.configCenter.auditSwitch.sales_order.desc', categoryId: 'sales' },
  { code: 'quotation', labelKey: 'pages.system.configCenter.auditSwitch.quotation.label', descKey: 'pages.system.configCenter.auditSwitch.quotation.desc', categoryId: 'sales' },
  { code: 'sales_delivery', labelKey: 'pages.system.configCenter.auditSwitch.sales_delivery.label', descKey: 'pages.system.configCenter.auditSwitch.sales_delivery.desc', categoryId: 'sales' },
  { code: 'sales_return', labelKey: 'pages.system.configCenter.auditSwitch.sales_return.label', descKey: 'pages.system.configCenter.auditSwitch.sales_return.desc', categoryId: 'sales' },
  { code: 'purchase_request', labelKey: 'pages.system.configCenter.auditSwitch.purchase_request.label', descKey: 'pages.system.configCenter.auditSwitch.purchase_request.desc', categoryId: 'procurement' },
  { code: 'purchase_order', labelKey: 'pages.system.configCenter.auditSwitch.purchase_order.label', descKey: 'pages.system.configCenter.auditSwitch.purchase_order.desc', categoryId: 'procurement' },
  { code: 'purchase_return', labelKey: 'pages.system.configCenter.auditSwitch.purchase_return.label', descKey: 'pages.system.configCenter.auditSwitch.purchase_return.desc', categoryId: 'procurement' },
  { code: 'demand', labelKey: 'pages.system.configCenter.auditSwitch.demand.label', descKey: 'pages.system.configCenter.auditSwitch.demand.desc', categoryId: 'planning' },
  { code: 'production_plan', labelKey: 'pages.system.configCenter.auditSwitch.production_plan.label', descKey: 'pages.system.configCenter.auditSwitch.production_plan.desc', categoryId: 'planning' },
  { code: 'incoming_inspection', labelKey: 'pages.system.configCenter.auditSwitch.incoming_inspection.label', descKey: 'pages.system.configCenter.auditSwitch.incoming_inspection.desc', categoryId: 'quality' },
  { code: 'process_inspection', labelKey: 'pages.system.configCenter.auditSwitch.process_inspection.label', descKey: 'pages.system.configCenter.auditSwitch.process_inspection.desc', categoryId: 'quality' },
  { code: 'finished_goods_inspection', labelKey: 'pages.system.configCenter.auditSwitch.finished_goods_inspection.label', descKey: 'pages.system.configCenter.auditSwitch.finished_goods_inspection.desc', categoryId: 'quality' },
  { code: 'production_picking', labelKey: 'pages.system.configCenter.auditSwitch.production_picking.label', descKey: 'pages.system.configCenter.auditSwitch.production_picking.desc', categoryId: 'production' },
  { code: 'production_return', labelKey: 'pages.system.configCenter.auditSwitch.production_return.label', descKey: 'pages.system.configCenter.auditSwitch.production_return.desc', categoryId: 'production' },
  { code: 'reporting_record', labelKey: 'pages.system.configCenter.auditSwitch.reporting_record.label', descKey: 'pages.system.configCenter.auditSwitch.reporting_record.desc', categoryId: 'production' },
  { code: 'purchase_receipt', labelKey: 'pages.system.configCenter.auditSwitch.purchase_receipt.label', descKey: 'pages.system.configCenter.auditSwitch.purchase_receipt.desc', categoryId: 'warehouse' },
  { code: 'finished_goods_receipt', labelKey: 'pages.system.configCenter.auditSwitch.finished_goods_receipt.label', descKey: 'pages.system.configCenter.auditSwitch.finished_goods_receipt.desc', categoryId: 'warehouse' },
  { code: 'other_inbound', labelKey: 'pages.system.configCenter.auditSwitch.other_inbound.label', descKey: 'pages.system.configCenter.auditSwitch.other_inbound.desc', categoryId: 'warehouse' },
  { code: 'other_outbound', labelKey: 'pages.system.configCenter.auditSwitch.other_outbound.label', descKey: 'pages.system.configCenter.auditSwitch.other_outbound.desc', categoryId: 'warehouse' },
  { code: 'material_borrow', labelKey: 'pages.system.configCenter.auditSwitch.material_borrow.label', descKey: 'pages.system.configCenter.auditSwitch.material_borrow.desc', categoryId: 'warehouse' },
  { code: 'material_return', labelKey: 'pages.system.configCenter.auditSwitch.material_return.label', descKey: 'pages.system.configCenter.auditSwitch.material_return.desc', categoryId: 'warehouse' },
];

const NOTIFICATION_DOCUMENT_OPTIONS = [
  { value: 'sales_order', labelKey: 'pages.system.configCenter.notification.document.sales_order', fallback: '销售订单' },
  { value: 'quotation', labelKey: 'pages.system.configCenter.notification.document.quotation', fallback: '报价单' },
  { value: 'purchase_order', labelKey: 'pages.system.configCenter.notification.document.purchase_order', fallback: '采购订单' },
  { value: 'work_order', labelKey: 'pages.system.configCenter.notification.document.work_order', fallback: '工单' },
  { value: 'quality_inspection', labelKey: 'pages.system.configCenter.notification.document.quality_inspection', fallback: '质检单' },
  { value: 'quality_exception', labelKey: 'pages.system.configCenter.notification.document.quality_exception', fallback: '质量异常单' },
  { value: 'equipment_fault', labelKey: 'pages.system.configCenter.notification.document.equipment_fault', fallback: '设备故障单' },
  { value: 'maintenance_order', labelKey: 'pages.system.configCenter.notification.document.maintenance_order', fallback: '维保工单' },
  { value: 'shipment_notice', labelKey: 'pages.system.configCenter.notification.document.shipment_notice', fallback: '发货通知' },
  { value: 'inbound', labelKey: 'pages.system.configCenter.notification.document.inbound', fallback: '入库单' },
  { value: 'outbound', labelKey: 'pages.system.configCenter.notification.document.outbound', fallback: '出库单' },
];

const NOTIFICATION_ACTION_OPTIONS: Record<string, Array<{ value: string; labelKey: string; fallback: string }>> = {
  sales_order: [
    { value: 'submitted', labelKey: 'pages.system.configCenter.notification.action.sales_order.submitted', fallback: '提交' },
    { value: 'approved', labelKey: 'pages.system.configCenter.notification.action.sales_order.approved', fallback: '审核通过' },
    { value: 'pushed_to_work_order', labelKey: 'pages.system.configCenter.notification.action.sales_order.pushed_to_work_order', fallback: '下推工单' },
    { value: 'delivery_delayed', labelKey: 'pages.system.configCenter.notification.action.sales_order.delivery_delayed', fallback: '交期延误' },
  ],
  quotation: [
    { value: 'submitted', labelKey: 'pages.system.configCenter.notification.action.quotation.submitted', fallback: '提交' },
    { value: 'approved', labelKey: 'pages.system.configCenter.notification.action.quotation.approved', fallback: '审核通过' },
    { value: 'customer_confirmed', labelKey: 'pages.system.configCenter.notification.action.quotation.customer_confirmed', fallback: '客户确认' },
    { value: 'converted_to_order', labelKey: 'pages.system.configCenter.notification.action.quotation.converted_to_order', fallback: '转销售订单' },
  ],
  purchase_order: [
    { value: 'submitted', labelKey: 'pages.system.configCenter.notification.action.purchase_order.submitted', fallback: '提交' },
    { value: 'approved', labelKey: 'pages.system.configCenter.notification.action.purchase_order.approved', fallback: '审核通过' },
    { value: 'pushed_to_receipt', labelKey: 'pages.system.configCenter.notification.action.purchase_order.pushed_to_receipt', fallback: '下推收货' },
    { value: 'delivery_delayed', labelKey: 'pages.system.configCenter.notification.action.purchase_order.delivery_delayed', fallback: '交期延误' },
  ],
  work_order: [
    { value: 'released', labelKey: 'pages.system.configCenter.notification.action.work_order.released', fallback: '下达' },
    { value: 'started', labelKey: 'pages.system.configCenter.notification.action.work_order.started', fallback: '开工' },
    { value: 'completed', labelKey: 'pages.system.configCenter.notification.action.work_order.completed', fallback: '完工' },
    { value: 'reworked', labelKey: 'pages.system.configCenter.notification.action.work_order.reworked', fallback: '转返工' },
  ],
  quality_inspection: [
    { value: 'submitted', labelKey: 'pages.system.configCenter.notification.action.quality_inspection.submitted', fallback: '提交' },
    { value: 'approved', labelKey: 'pages.system.configCenter.notification.action.quality_inspection.approved', fallback: '审核通过' },
    { value: 'rejected', labelKey: 'pages.system.configCenter.notification.action.quality_inspection.rejected', fallback: '驳回' },
    { value: 'abnormal_detected', labelKey: 'pages.system.configCenter.notification.action.quality_inspection.abnormal_detected', fallback: '检出异常' },
  ],
  quality_exception: [
    { value: 'created', labelKey: 'pages.system.configCenter.notification.action.quality_exception.created', fallback: '新建异常' },
    { value: 'assigned', labelKey: 'pages.system.configCenter.notification.action.quality_exception.assigned', fallback: '分派处理' },
    { value: 'closed', labelKey: 'pages.system.configCenter.notification.action.quality_exception.closed', fallback: '异常关闭' },
  ],
  equipment_fault: [
    { value: 'reported', labelKey: 'pages.system.configCenter.notification.action.equipment_fault.reported', fallback: '故障报修' },
    { value: 'assigned', labelKey: 'pages.system.configCenter.notification.action.equipment_fault.assigned', fallback: '派工维修' },
    { value: 'resolved', labelKey: 'pages.system.configCenter.notification.action.equipment_fault.resolved', fallback: '故障恢复' },
  ],
  maintenance_order: [
    { value: 'created', labelKey: 'pages.system.configCenter.notification.action.maintenance_order.created', fallback: '新建维保' },
    { value: 'started', labelKey: 'pages.system.configCenter.notification.action.maintenance_order.started', fallback: '开始维保' },
    { value: 'completed', labelKey: 'pages.system.configCenter.notification.action.maintenance_order.completed', fallback: '完成维保' },
  ],
  shipment_notice: [
    { value: 'submitted', labelKey: 'pages.system.configCenter.notification.action.shipment_notice.submitted', fallback: '提交' },
    { value: 'confirmed', labelKey: 'pages.system.configCenter.notification.action.shipment_notice.confirmed', fallback: '确认发货' },
    { value: 'delivery_delayed', labelKey: 'pages.system.configCenter.notification.action.shipment_notice.delivery_delayed', fallback: '发货延误' },
  ],
  inbound: [
    { value: 'submitted', labelKey: 'pages.system.configCenter.notification.action.inbound.submitted', fallback: '提交' },
    { value: 'confirmed', labelKey: 'pages.system.configCenter.notification.action.inbound.confirmed', fallback: '确认入库' },
  ],
  outbound: [
    { value: 'submitted', labelKey: 'pages.system.configCenter.notification.action.outbound.submitted', fallback: '提交' },
    { value: 'confirmed', labelKey: 'pages.system.configCenter.notification.action.outbound.confirmed', fallback: '确认出库' },
  ],
};

const ConfigCenterPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { message: messageApi } = App.useApp();
  const { token } = useToken();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const validTabs = useMemo(() => ['parameters', 'audit', 'automation', 'notification'], []);
  // 兼容历史链接：tab=flow 归并到 parameters
  const normalizedInitialTab = tabFromUrl === 'flow' ? 'parameters' : tabFromUrl;
  const initialTab = validTabs.includes(normalizedInitialTab || '') ? normalizedInitialTab! : 'parameters';
  const [activeMainTab, setActiveMainTab] = useState<string>(initialTab);

  const [form] = Form.useForm();
  const qualityFormValues = Form.useWatch([], form);
  const [saving, setSaving] = useState(false);
  const containerRef = useRef<any>(null);
  const [containerHeight, setContainerHeight] = useState<number>(400);

  // 为 4 个主 Tab 分别记录选中的侧边栏模块 ID
  const [selectedParamCat, setSelectedParamCat] = useState<string>(PARAMETER_CATEGORIES[0].id);
  const [selectedAuditCat, setSelectedAuditCat] = useState<string>(AUDIT_CATEGORIES[0].id);
  const [selectedAutoCat, setSelectedAutoCat] = useState<string>(AUTOMATION_CATEGORIES[0].id);
  const notificationFormRef = useRef<ProFormInstance>();
  const [notificationModalOpen, setNotificationModalOpen] = useState(false);
  const [notificationModalMode, setNotificationModalMode] = useState<'create' | 'edit'>('create');
  const [editingNotificationRuleId, setEditingNotificationRuleId] = useState<string | null>(null);
  const [notificationModalInitialValues, setNotificationModalInitialValues] = useState<Record<string, any>>({});

  const { data: bizRes, isLoading: configLoading, isFetching, refetch: refetchBusinessConfig } = useQuery({
    queryKey: BUSINESS_CONFIG_QUERY_KEY,
    queryFn: getBusinessConfig,
    staleTime: 60_000,
  });

  const { data: schemaRes } = useQuery({
    queryKey: BUSINESS_CONFIG_SCHEMA_QUERY_KEY,
    queryFn: getBusinessConfigSchema,
    staleTime: 300_000,
  });

  const { data: approvalProcessList, refetch: refetchApprovalProcessList } = useQuery({
    queryKey: APPROVAL_PROCESS_LIST_QUERY_KEY,
    queryFn: () => getApprovalProcessList({ limit: 500, for_audit_config: true }),
    staleTime: 30_000,
  });
  const { data: usersRes } = useQuery({
    queryKey: ['configCenterUsersForNotification'],
    queryFn: () => getUserList({ page: 1, page_size: 200, is_active: true }),
    staleTime: 300_000,
  });
  const { data: messageChannels = [] } = useQuery({
    queryKey: ['configCenterMessageChannels'],
    queryFn: () => getMessageConfigList({ skip: 0, limit: 500, is_active: true }),
    staleTime: 300_000,
  });
  const { data: messageTemplates = [] } = useQuery({
    queryKey: ['configCenterMessageTemplates'],
    queryFn: () => getMessageTemplateList({ skip: 0, limit: 500, is_active: true }),
    staleTime: 300_000,
  });

  const loading = configLoading && !bizRes;

  const approvalProcessByCode = useMemo(() => {
    const m = new Map<string, ApprovalProcess>();
    for (const p of approvalProcessList || []) {
      if (p.code) m.set(p.code, p);
    }
    return m;
  }, [approvalProcessList]);

  const parameterImplementation = schemaRes?.parameterImplementation || {};
  const userOptions = useMemo(
    () =>
      (usersRes?.items || []).map((u: User) => ({
        value: u.id,
        label: `${u.full_name || u.username}${u.department?.name ? (i18n.language?.startsWith('zh') ? `（${u.department.name}）` : ` (${u.department.name})`) : ''}`,
      })),
    [usersRes, i18n.language]
  );
  const BUILTIN_IN_APP_CHANNEL_UUID = '__builtin_internal_channel__';
  const channelOptions = useMemo(() => {
    const builtInName = t('pages.system.configCenter.notification.channel.inApp');
    const unknownLabel = t('pages.system.configCenter.notification.channel.unknown');
    const builtIn = {
      uuid: BUILTIN_IN_APP_CHANNEL_UUID,
      name: builtInName,
      code: 'IN_APP_DEFAULT',
      type: 'internal',
      is_active: true,
    } as Partial<MessageConfig>;
    const list = Array.isArray(messageChannels) ? messageChannels : [];
    const hasInternal = list.some((it: any) => it?.type === 'internal' || it?.code === 'IN_APP_DEFAULT');
    const merged = hasInternal ? list : [builtIn as MessageConfig, ...list];
    return merged.map((it: any) => ({
      value: String(it.uuid || it.code),
      label: String(it.name || it.code || unknownLabel),
      code: String(it.code || ''),
      type: String(it.type || ''),
    }));
  }, [messageChannels, t, i18n.language]);
  const templateOptions = useMemo(
    () =>
      (Array.isArray(messageTemplates) ? messageTemplates : []).map((it: MessageTemplate) => ({
        value: String(it.uuid),
        label: it.name || it.code,
        code: it.code,
      })),
    [messageTemplates]
  );
  const channelNameByKey = useMemo(() => {
    const m = new Map<string, string>();
    for (const ch of channelOptions) {
      m.set(String(ch.value), String(ch.label));
      if (ch.code) m.set(String(ch.code), String(ch.label));
    }
    return m;
  }, [channelOptions]);
  const templateNameByKey = useMemo(() => {
    const m = new Map<string, string>();
    for (const tp of templateOptions) {
      m.set(String(tp.value), String(tp.label));
      if (tp.code) m.set(String(tp.code), String(tp.label));
    }
    return m;
  }, [templateOptions]);

  const isImplementedParam = (sourcePath: string): boolean => {
    if (!sourcePath.startsWith('parameters.')) return true;
    const parts = sourcePath.replace('parameters.', '').split('.');
    if (parts.length !== 2) return true;
    const [categoryKey, parameterKey] = parts;
    const categoryImpl = parameterImplementation[categoryKey];
    if (!categoryImpl) return true;
    return categoryImpl[parameterKey] !== false;
  };
  const mergedParameterCategories = useMemo<ConfigCategory[]>(() => {
    // 将“参数设置 + 流程设置”在同一 Tab 内融合展示，按模块合并并按 key 去重。
    const fromFlow = PARAMETER_CATEGORIES.map((c) => ({ ...c, params: [] as typeof c.params }));
    const mergedByCat = new Map<string, ConfigCategory>();
    for (const c of fromFlow) mergedByCat.set(c.id, { ...c, params: [] });
    // 原参数
    for (const c of PARAMETER_CATEGORIES) {
      const target = mergedByCat.get(c.id) || { ...c, params: [] };
      const seen = new Set(target.params.map((p) => p.key));
      for (const p of c.params) {
        if (!seen.has(p.key)) {
          target.params.push(p);
          seen.add(p.key);
        }
      }
      mergedByCat.set(c.id, target);
    }
    // 流程参数（来自 configTree 的 FLOW_CATEGORIES）
    // 这里通过 schema 实际下发的 processRegistry 动态注入会更复杂；当前沿用静态树定义并做去重。
    for (const c of FLOW_CATEGORIES) {
      const target = mergedByCat.get(c.id) || { ...c, params: [] };
      const seen = new Set(target.params.map((p) => p.key));
      for (const p of c.params) {
        if (!seen.has(p.key)) {
          target.params.push(p);
          seen.add(p.key);
        }
      }
      mergedByCat.set(c.id, target);
    }
    return Array.from(mergedByCat.values());
  }, []);

  const renderText = (key: string | undefined, fallback?: string) => {
    if (!key) return fallback || '';
    if (i18n.exists(key)) return t(key);
    return fallback || key;
  };
  const notificationDocumentOptions = useMemo(
    () =>
      NOTIFICATION_DOCUMENT_OPTIONS.map((it) => ({
        value: it.value,
        label: renderText(it.labelKey, it.fallback),
      })),
    [t, i18n.language]
  );
  const getNotificationActionOptions = (documentCode: string) =>
    (NOTIFICATION_ACTION_OPTIONS[String(documentCode || '')] || []).map((it) => ({
      value: it.value,
      label: renderText(it.labelKey, it.fallback),
    }));
  const toArrayValue = (value: any): string[] => {
    if (Array.isArray(value)) return value.map(v => String(v));
    if (typeof value === 'string') return value.split(',').map(v => v.trim()).filter(Boolean);
    return [];
  };

  const getParamGuidance = (paramKey: string): string => {
    const key = getParamGuidanceI18nKey(paramKey);
    return key ? renderText(key, '') : '';
  };

  useEffect(() => {
    const tVal = searchParams.get('tab');
    const normalized = tVal === 'flow' ? 'parameters' : tVal;
    if (normalized && validTabs.includes(normalized) && activeMainTab !== normalized) setActiveMainTab(normalized);
    const moduleId = searchParams.get('module');
    if (moduleId) {
      setSelectedParamCat(moduleId);
      setSelectedAutoCat(moduleId);
    }
  }, [searchParams, activeMainTab, validTabs]);

  useEffect(() => {
    const updateHeight = () => {
      if (!containerRef.current) return;
      const top = containerRef.current.getBoundingClientRect().top;
      const next = Math.max(400, Math.floor(window.innerHeight - top - 16));
      setContainerHeight(next);
    };
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, [activeMainTab]);

  useEffect(() => {
    const initialValues = flattenBusinessParams(bizRes?.parameters || {});
    form.setFieldsValue(initialValues);
    void qualityApi.stageToggles.get().then((toggles) => {
      form.setFieldsValue({
        'quality_stage.iqc_enabled': toggles.iqc_enabled,
        'quality_stage.ipqc_enabled': toggles.ipqc_enabled,
        'quality_stage.fqc_enabled': toggles.fqc_enabled,
        'quality_stage.oqc_enabled': toggles.oqc_enabled,
      });
    }).catch(() => {});
  }, [bizRes, form]);

  const handleSave = async (categories: ConfigCategory[]) => {
    try {
      await form.validateFields();
      const values = form.getFieldsValue(true);
      setSaving(true);

      const bizKeys: string[] = [];
      for (const cat of categories) {
        for (const param of cat.params) {
          if (param.source === 'business_config' && isImplementedParam(param.sourcePath)) {
            bizKeys.push(param.key);
          }
        }
      }

      const bizParams = toBusinessParams(values, bizKeys);
      if (Object.keys(bizParams).length > 0) {
        await batchUpdateProcessParameters({ parameters: bizParams });
      }

      const stageFieldMap: Record<string, keyof import('../../../apps/kuaizhizao/services/quality-execution').QualityInspectionStageToggles> = {
        'quality_stage.iqc_enabled': 'iqc_enabled',
        'quality_stage.ipqc_enabled': 'ipqc_enabled',
        'quality_stage.fqc_enabled': 'fqc_enabled',
        'quality_stage.oqc_enabled': 'oqc_enabled',
      };
      const stageUpdate: Partial<import('../../../apps/kuaizhizao/services/quality-execution').QualityInspectionStageToggles> = {};
      for (const cat of categories) {
        for (const param of cat.params) {
          if (param.source !== 'quality_stage_toggle') continue;
          const apiKey = stageFieldMap[param.key];
          if (apiKey && param.key in values) {
            stageUpdate[apiKey] = Boolean(values[param.key]);
          }
        }
      }
      if (Object.keys(stageUpdate).length > 0) {
        await qualityApi.stageToggles.update(stageUpdate);
      }
      messageApi.success(t('pages.system.configCenter.saveSuccess'));
      await refetchBusinessConfig();
      await queryClient.invalidateQueries({ queryKey: TRIAL_RUN_MODE_QUERY_KEY });
    } catch (error: any) {
      if (!error?.errorFields) messageApi.error(error.message || t('pages.system.configCenter.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAuditProcess = async (code: string, checked: boolean) => {
    try {
      await setAuditSwitchActive(code, checked);
      await refetchApprovalProcessList();
      messageApi.success(t('pages.system.configCenter.auditSwitch.updateSuccess'));
    } catch (error: any) {
      messageApi.error(error?.message || t('pages.system.configCenter.auditSwitch.updateFailed'));
    }
  };

  const notificationRuleRows = useMemo(() => {
    const raw = bizRes?.parameters?.notifications;
    const list = Array.isArray(raw?.rules)
      ? raw.rules
      : raw
        ? [raw]
        : [];
    const getDocumentLabel = (code: string) => {
      const item = NOTIFICATION_DOCUMENT_OPTIONS.find((it) => it.value === code);
      return item ? renderText(item.labelKey, item.fallback) : (code || '-');
    };
    const getActionLabel = (documentCode: string, actionCode: string) => {
      const found = (NOTIFICATION_ACTION_OPTIONS[String(documentCode || '')] || []).find((it) => it.value === actionCode);
      if (found) return renderText(found.labelKey, found.fallback);
      return actionCode || '-';
    };
    const getScopeLabel = (code: string) => {
      const key = `pages.system.configCenter.notification.scope.${code}`;
      return i18n.exists(key) ? t(key) : code;
    };
    return list.map((rule: any, idx: number) => {
      const channelRefs = Array.isArray(rule?.channel_uuids)
        ? rule.channel_uuids
        : Array.isArray(rule?.channels)
          ? rule.channels
          : [];
      const channels = channelRefs.map((v: string) => channelNameByKey.get(String(v)) || String(v)).join(' + ') || '-';
      const scopes = (Array.isArray(rule?.recipient_scopes) ? rule.recipient_scopes : []).map((v: string) => getScopeLabel(v)).join(' + ');
      const users = (Array.isArray(rule?.recipient_user_ids) ? rule.recipient_user_ids : []).length;
      const recipients = [
        scopes,
        users > 0 ? t('pages.system.configCenter.notification.recipients.specifiedUsers', { count: users }) : '',
      ].filter(Boolean).join(' + ') || '-';
      const templateKey = String(rule?.template_uuid || rule?.template || '');
      const template = templateNameByKey.get(templateKey) || templateKey || '-';
      return {
        id: String(rule?.id || rule?.code || idx + 1),
        scene: rule?.scene_name || t('pages.system.configCenter.notification.scene.default'),
        document: getDocumentLabel(String(rule?.trigger_document || '')) || String(rule?.trigger_document || '-'),
        action: getActionLabel(String(rule?.trigger_document || ''), String(rule?.trigger_action || '')) || String(rule?.trigger_action || '-'),
        channels,
        recipients,
        template,
        enabled: rule?.enabled !== false,
        raw: rule,
      };
    });
  }, [bizRes, channelNameByKey, templateNameByKey, t, i18n, renderText]);

  const getExistingNotificationRules = () => {
    const raw = bizRes?.parameters?.notifications;
    if (Array.isArray(raw?.rules)) return raw.rules;
    if (raw) {
      return [{
        id: raw.id || `rule_${Date.now()}`,
        scene_name: raw.scene_name || t('pages.system.configCenter.notification.scene.default'),
        enabled: raw.enabled !== false,
        trigger_document: raw.trigger_document,
        trigger_action: raw.trigger_action,
        channels: raw.channels,
        recipient_scopes: raw.recipient_scopes,
        recipient_user_ids: raw.recipient_user_ids,
        template: raw.template,
      }];
    }
    return [];
  };

  const handleCreateNotificationRule = async (values: any) => {
    try {
      setSaving(true);
      const existingRules = getExistingNotificationRules();
      const newRule = {
        id: `rule_${Date.now()}`,
        scene_name: t('pages.system.configCenter.notification.scene.default'),
        enabled: true,
        trigger_document: values.trigger_document || '',
        trigger_action: values.trigger_action || '',
        channel_uuids: toArrayValue(values.channels).length > 0 ? toArrayValue(values.channels) : [BUILTIN_IN_APP_CHANNEL_UUID],
        channels: toArrayValue(values.channels).length > 0 ? toArrayValue(values.channels) : [BUILTIN_IN_APP_CHANNEL_UUID],
        recipient_scopes: toArrayValue(values.recipient_scopes),
        recipient_user_ids: toArrayValue(values.recipient_user_ids).map(v => Number(v)).filter(v => Number.isFinite(v)),
        template_uuid: values.template || '',
        template: values.template || '',
      };
      const allowedActions = (NOTIFICATION_ACTION_OPTIONS[String(newRule.trigger_document)] || []).map(it => it.value);
      if (!allowedActions.includes(String(newRule.trigger_action))) {
        throw new Error(t('pages.system.configCenter.notification.error.actionMismatch'));
      }
      const nextRules =
        notificationModalMode === 'edit' && editingNotificationRuleId
          ? existingRules.map((r: any) => (String(r?.id) === editingNotificationRuleId ? { ...r, ...newRule, id: editingNotificationRuleId } : r))
          : [...existingRules, newRule];
      await batchUpdateProcessParameters({
        parameters: {
          notifications: {
            rules: nextRules,
          },
        },
      });
      messageApi.success(
        notificationModalMode === 'edit'
          ? t('pages.system.configCenter.notification.message.updated')
          : t('pages.system.configCenter.notification.message.created')
      );
      setNotificationModalOpen(false);
      setNotificationModalMode('create');
      setEditingNotificationRuleId(null);
      await refetchBusinessConfig();
    } catch (error: any) {
      if (!error?.errorFields) messageApi.error(error.message || t('pages.system.configCenter.notification.message.createFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleEditNotificationRule = (row: any) => {
    setNotificationModalMode('edit');
    setEditingNotificationRuleId(String(row.id));
    setNotificationModalInitialValues({
      trigger_document: row.raw?.trigger_document,
      trigger_action: row.raw?.trigger_action,
      channels: Array.isArray(row.raw?.channel_uuids)
        ? row.raw.channel_uuids
        : (Array.isArray(row.raw?.channels) ? row.raw.channels : []),
      recipient_scopes: Array.isArray(row.raw?.recipient_scopes) ? row.raw.recipient_scopes : [],
      recipient_user_ids: Array.isArray(row.raw?.recipient_user_ids) ? row.raw.recipient_user_ids : [],
      template: row.raw?.template_uuid || row.raw?.template || undefined,
    });
    setNotificationModalOpen(true);
  };

  const handleViewNotificationRule = (row: any) => {
    Modal.info({
      title: t('pages.system.configCenter.notification.modal.detailTitle'),
      width: 720,
      content: (
        <Descriptions column={2} size="small">
          <Descriptions.Item label={t('pages.system.configCenter.notification.detail.scene')}>{row.scene}</Descriptions.Item>
          <Descriptions.Item label={t('pages.system.configCenter.notification.detail.status')}>
            {row.enabled ? t('pages.system.configCenter.notification.status.enabled') : t('pages.system.configCenter.notification.status.disabled')}
          </Descriptions.Item>
          <Descriptions.Item label={t('pages.system.configCenter.notification.detail.document')}>{row.document}</Descriptions.Item>
          <Descriptions.Item label={t('pages.system.configCenter.notification.detail.action')}>{row.action}</Descriptions.Item>
          <Descriptions.Item label={t('pages.system.configCenter.notification.detail.channels')} span={2}>{row.channels}</Descriptions.Item>
          <Descriptions.Item label={t('pages.system.configCenter.notification.detail.recipients')} span={2}>{row.recipients}</Descriptions.Item>
          <Descriptions.Item label={t('pages.system.configCenter.notification.detail.template')} span={2}>{row.template}</Descriptions.Item>
        </Descriptions>
      ),
    });
  };

  const handleDeleteNotificationRule = (row: any) => {
    Modal.confirm({
      title: t('pages.system.configCenter.notification.modal.deleteTitle'),
      content: t('pages.system.configCenter.notification.modal.deleteConfirm'),
      onOk: async () => {
        try {
          const existingRules = getExistingNotificationRules();
          const nextRules = existingRules.filter((r: any) => String(r?.id) !== String(row.id));
          await batchUpdateProcessParameters({
            parameters: {
              notifications: { rules: nextRules },
            },
          });
          messageApi.success(t('pages.system.configCenter.notification.message.deleted'));
          await refetchBusinessConfig();
        } catch (error: any) {
          messageApi.error(error?.message || t('pages.system.configCenter.notification.message.deleteFailed'));
        }
      },
    });
  };

  const renderNotificationTab = () => (
    <Layout style={{ minHeight: 400, height: '100%', minWidth: 0, background: 'transparent' }}>
      <Content style={{ padding: '14px 0 0 0', height: '100%', minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div className="config-center-scrollable-content">
          <div style={{ marginBottom: 16 }}>
            <Text strong style={{ fontSize: 16 }}>{t('pages.system.configCenter.notification.title')}</Text>
            <Paragraph type="secondary" style={{ marginTop: 4 }}>
              {t('pages.system.configCenter.notification.desc')}
            </Paragraph>
          </div>
          <Spin spinning={loading}>
            <div>
              <UniTable
                columnPersistenceId="pages.system.config-center"
                rowKey="id"
                pagination={false}
                search={false}
                options={false}
                showCreateButton
                createButtonText={t('pages.system.configCenter.notification.create')}
                onCreate={() => {
                  notificationFormRef.current?.resetFields?.();
                  setNotificationModalInitialValues({});
                  setNotificationModalMode('create');
                  setEditingNotificationRuleId(null);
                  setNotificationModalOpen(true);
                }}
                columns={[
                  { title: t('pages.system.configCenter.notification.column.scene'), dataIndex: 'scene', width: 180 },
                  { title: t('pages.system.configCenter.notification.column.document'), dataIndex: 'document', width: 120 },
                  { title: t('pages.system.configCenter.notification.column.template'), dataIndex: 'template', width: 220 },
                  { title: t('pages.system.configCenter.notification.column.action'), dataIndex: 'action', width: 140 },
                  { title: t('pages.system.configCenter.notification.column.channels'), dataIndex: 'channels', width: 180 },
                  { title: t('pages.system.configCenter.notification.column.recipients'), dataIndex: 'recipients', width: 220 },
                  { title: t('pages.system.configCenter.notification.column.status'), dataIndex: 'enabled', width: 90, render: (_: unknown, row: any) => (row.enabled ? t('pages.system.configCenter.notification.status.enabled') : t('pages.system.configCenter.notification.status.disabled')) },
                  {
                    title: t('pages.system.configCenter.notification.column.actions'),
                    width: 220,
                    render: (_: any, row: any) => {
                      const actions: React.ReactNode[] = [
                        <Button key="detail" type="link" size="small" onClick={() => handleViewNotificationRule(row)}>{t('pages.system.configCenter.notification.action.view')}</Button>,
                        <Button key="edit" type="link" size="small" onClick={() => handleEditNotificationRule(row)}>{t('pages.system.configCenter.notification.action.edit')}</Button>,
                        <Button key="delete" type="link" size="small" danger onClick={() => handleDeleteNotificationRule(row)}>{t('pages.system.configCenter.notification.action.delete')}</Button>,
                      ];
                      return renderRowActionsOverflow(actions, `notification-rule-${row.id}`);
                    },
                  },
                ]}
                request={async () => ({
                  data: notificationRuleRows,
                  success: true,
                  total: notificationRuleRows.length,
                })}
              />
            </div>
          </Spin>
        </div>
      </Content>
    </Layout>
  );

  // 通用 Tab 内容渲染器
  const renderTabContent = (
    categories: ConfigCategory[],
    selectedCatId: string,
    onSelectCat: (id: string) => void,
    icon: React.ReactNode,
    showAuditSection: boolean = false
  ) => {
    const currentCat = categories.find(c => c.id === selectedCatId) || categories[0];
    const auditSwitches = showAuditSection ? AUDIT_SWITCH_ITEMS.filter(it => it.categoryId === selectedCatId) : [];

    return (
      <Layout style={{ minHeight: 400, height: '100%', minWidth: 0, background: 'transparent' }}>
        <Sider
          width={200}
          className="config-center-category-sider"
          style={{ background: token.colorBgContainer, borderRadius: 8, padding: '16px 0' }}
        >
          <div style={{ padding: '0 16px 16px', borderBottom: `1px solid ${token.colorBorder}`, marginBottom: 8 }}>
            <Space>{icon}<Text strong>{t('pages.system.configCenter.categoryTitle')}</Text></Space>
          </div>
          <Menu
            selectedKeys={[selectedCatId]}
            mode="inline"
            style={{ border: 'none', background: 'transparent' }}
            items={categories.map(c => ({ key: c.id, label: renderText(c.nameKey, c.id) }))}
            onClick={({ key }) => onSelectCat(key)}
          />
        </Sider>
        <Content style={{ padding: '14px 0 0 24px', height: '100%', minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div className="config-center-scrollable-content">
            <div style={{ marginBottom: 16 }}>
              <Text strong style={{ fontSize: 16 }}>{renderText(currentCat.nameKey, currentCat.id)}</Text>
              {currentCat.descriptionKey && <Paragraph type="secondary" style={{ marginTop: 4 }}>{renderText(currentCat.descriptionKey, '')}</Paragraph>}
            </div>

            {showAuditSection && (
              <Card size="small" style={{ marginBottom: 16 }}>
                <Text strong>{t('pages.system.configCenter.auditSwitch.sectionTitle')}</Text>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 12, marginTop: 12 }}>
                  {auditSwitches.map(item => (
                    <Card key={item.code} size="small" bodyStyle={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div style={{ flex: 1, marginRight: 16 }}>
                        <Text strong>{renderText(item.labelKey, item.code)}</Text>
                        <Paragraph type="secondary" style={{ fontSize: 12, margin: 0 }}>{renderText(item.descKey, '')}</Paragraph>
                      </div>
                      <Switch checked={!!approvalProcessByCode.get(item.code)?.is_active} onChange={v => handleToggleAuditProcess(item.code, v)} />
                    </Card>
                  ))}
                  {auditSwitches.length === 0 && <Text type="secondary">{t('pages.system.configCenter.auditSwitch.empty')}</Text>}
                </div>
              </Card>
            )}

            {!showAuditSection && (
              <>
                <Spin spinning={loading}>
                  <Form
                    form={form}
                    layout="vertical"
                    onValuesChange={(changedValues) => {
                      if (
                        changedValues['quality.require_incoming_inspection_for_receipt'] === true
                        && !form.getFieldValue('quality.auto_create_iqc_on_purchase_receipt')
                      ) {
                        Modal.confirm({
                          title: t('pages.system.configCenter.quality.gateRecommendAutoIqcTitle'),
                          content: t('pages.system.configCenter.quality.gateRecommendAutoIqcContent'),
                          okText: t('pages.system.configCenter.quality.gateRecommendAutoIqcEnableBoth'),
                          cancelText: t('pages.system.configCenter.quality.gateRecommendAutoIqcSkip'),
                          onOk: () => form.setFieldValue('quality.auto_create_iqc_on_purchase_receipt', true),
                        });
                      }
                    }}
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 16 }}>
                      {currentCat.params
                        .filter((param) => param.source === 'quality_stage_toggle' || isImplementedParam(param.sourcePath))
                        .map(param => {
                        const implemented = isImplementedParam(param.sourcePath);
                        const switchDisabled = !implemented || isQualityParamDisabled(param.key, qualityFormValues);
                        return (
                          <Card key={param.key} size="small">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ flex: 1, marginRight: 16 }}>
                                <Text strong>{renderText(param.nameKey, param.key)}</Text>
                                <Paragraph type="secondary" style={{ fontSize: 12, margin: 0 }}>{renderText(param.descriptionKey, '')}</Paragraph>
                                {!!getParamGuidance(param.key) && <Paragraph type="secondary" style={{ fontSize: 12, marginTop: 4 }}>{getParamGuidance(param.key)}</Paragraph>}
                              </div>
                              <Form.Item
                                name={[param.key]}
                                noStyle
                                valuePropName={param.type === 'boolean' ? 'checked' : undefined}
                                getValueFromEvent={
                                  param.type === 'color'
                                    ? (c: Color) => (typeof c?.toHexString === 'function' ? c.toHexString() : c)
                                    : undefined
                                }
                              >
                                {param.type === 'boolean' ? <Switch disabled={switchDisabled} /> :
                                 param.type === 'number' ? <InputNumber size="middle" min={param.min} max={param.max} style={{ width: 120 }} disabled={!implemented} /> :
                                 param.type === 'select' ? <Select size="middle" options={param.selectOptions?.map(o => ({ value: o.value, label: renderText(o.labelKey, o.value) }))} style={{ minWidth: 160 }} disabled={!implemented} /> :
                                 param.type === 'color' ? <ColorPicker showText disabled={!implemented} /> : null}
                              </Form.Item>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  </Form>
                </Spin>

                {selectedCatId === 'planning' && (
                  <WorkOrderScoreProfilesPanel
                    scoreProfiles={bizRes?.parameters?.work_order?.score_profiles}
                    onSaved={refetchBusinessConfig}
                  />
                )}

                <Space style={{ marginTop: 24 }}>
                  <Button icon={<ReloadOutlined />} onClick={() => refetchBusinessConfig()} loading={isFetching}>{t('pages.system.configCenter.refresh')}</Button>
                  <Button type="primary" icon={<SaveOutlined />} onClick={() => handleSave(categories)} loading={saving}>{t('pages.system.configCenter.save')}</Button>
                </Space>
              </>
            )}
          </div>
        </Content>
      </Layout>
    );
  };

  return (
    <div className="config-center-page" ref={containerRef} style={{ height: containerHeight, minHeight: 400, borderRadius: 8, overflow: 'hidden' }}>
      <MultiTabListPageTemplate
        style={{ height: '100%' }}
        activeTabKey={activeMainTab}
        onTabChange={setActiveMainTab}
        tabs={[
          { key: 'parameters', label: <Space><SettingOutlined />{t('pages.system.configCenter.tabParameters')}</Space>, children: renderTabContent(mergedParameterCategories, selectedParamCat, setSelectedParamCat, <SettingOutlined />) },
          { key: 'audit', label: <Space><AuditOutlined />{t('pages.system.configCenter.tabAudit')}</Space>, children: renderTabContent(AUDIT_CATEGORIES, selectedAuditCat, setSelectedAuditCat, <AuditOutlined />, true) },
          { key: 'automation', label: <Space><ControlOutlined />{t('pages.system.configCenter.tabAutomation')}</Space>, children: renderTabContent(AUTOMATION_CATEGORIES, selectedAutoCat, setSelectedAutoCat, <ControlOutlined />) },
          { key: 'notification', label: <Space><BellOutlined />{t('pages.system.configCenter.notification.title')}</Space>, children: renderNotificationTab() },
        ]}
        padding={24}
      />

      <FormModalTemplate
        title={notificationModalMode === 'edit' ? t('pages.system.configCenter.notification.modal.editTitle') : t('pages.system.configCenter.notification.modal.createTitle')}
        open={notificationModalOpen}
        onClose={() => {
          setNotificationModalOpen(false);
          setNotificationModalMode('create');
          setEditingNotificationRuleId(null);
        }}
        onFinish={handleCreateNotificationRule}
        isEdit={notificationModalMode === 'edit'}
        formRef={notificationFormRef}
        width={860}
        layout="vertical"
        initialValues={notificationModalInitialValues}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
          <ProFormSelect
            name="trigger_document"
            label={t('pages.system.configCenter.notification.form.document')}
            rules={[{ required: true, message: t('pages.system.configCenter.notification.form.documentRequired') }]}
            options={notificationDocumentOptions}
          />
          <ProFormDependency name={['trigger_document']}>
            {({ trigger_document }) => (
              <ProFormSelect
                name="trigger_action"
                label={t('pages.system.configCenter.notification.form.action')}
                rules={[{ required: true, message: t('pages.system.configCenter.notification.form.actionRequired') }]}
                options={getNotificationActionOptions(String(trigger_document || ''))}
                fieldProps={{
                  placeholder: trigger_document
                    ? t('pages.system.configCenter.notification.form.actionPlaceholder')
                    : t('pages.system.configCenter.notification.form.selectDocumentFirst'),
                  disabled: !trigger_document,
                }}
              />
            )}
          </ProFormDependency>
          <ProFormDependency name={['trigger_document', 'trigger_action']}>
            {({ trigger_document, trigger_action }) => {
              const validValues = (NOTIFICATION_ACTION_OPTIONS[String(trigger_document || '')] || []).map(it => it.value);
              if (trigger_action && !validValues.includes(trigger_action)) {
                notificationFormRef.current?.setFieldValue?.('trigger_action', undefined);
              }
              return null;
            }}
          </ProFormDependency>
          <ProFormSelect
            name="template"
            label={t('pages.system.configCenter.notification.form.template')}
            options={templateOptions}
            initialValue={templateOptions[0]?.value}
          />
          <ProFormSelect
            name="channels"
            label={t('pages.system.configCenter.notification.form.channels')}
            mode="multiple"
            options={channelOptions}
            initialValue={[BUILTIN_IN_APP_CHANNEL_UUID]}
          />
          <ProFormSelect
            name="recipient_scopes"
            label={t('pages.system.configCenter.notification.form.roles')}
            mode="multiple"
            options={[
              { value: 'creator', label: t('pages.system.configCenter.notification.scope.creator') },
              { value: 'salesman', label: t('pages.system.configCenter.notification.scope.salesman') },
              { value: 'follower', label: t('pages.system.configCenter.notification.scope.follower') },
            ]}
            initialValue={['salesman', 'follower']}
          />
          <ProFormSelect
            name="recipient_user_ids"
            label={t('pages.system.configCenter.notification.form.specifiedUsers')}
            mode="multiple"
            options={userOptions}
            fieldProps={{ placeholder: t('pages.system.configCenter.notification.form.specifiedUsersPlaceholder') }}
          />
        </div>
      </FormModalTemplate>
    </div>
  );
};

export default ConfigCenterPage;
