/**
 * 库存预警管理页面
 *
 * 提供库存预警的管理功能，包括预警规则配置、预警记录查看、预警处理等。
 *
 * Author: Luigi Lu
 * Date: 2026-01-15
 */

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { ActionType, ProColumns, ProDescriptionsItemProps, ProFormText, ProFormDigit, ProFormTextArea, ProFormSelect, ProFormSwitch, ProFormDependency } from '@ant-design/pro-components';
import { App, Button, Space, Popconfirm, Typography, Row, Col, Descriptions, Tag } from 'antd';
import { WarningOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import {
  MaterialStackedCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { FormModalTemplate, DetailDrawerTemplate, detailDrawerDescriptionItems, MODAL_CONFIG, DRAWER_CONFIG, MultiTabListPageTemplate, type StatCard } from '../../../../../components/layout-templates';
import { rowActionKind, rowActionLabelKeep } from '../../../../../components/uni-action';
import { inventoryAlertApi } from '../../../services/inventory-alert';
import { materialApi, materialGroupApi } from '../../../../master-data/services/material';
import { formatMaterialGroupLabel, type Material } from '../../../../master-data/types/material';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import { UniWarehouseSelect } from '../../../../../components/uni-warehouse-select';
import { formatDateTime, formatQuantity } from '../../../../../utils/format';

/** 从物料 defaults 读取最低/最高库存（与后端 InventoryThresholdResolver 对齐） */
function readMaterialStockThresholds(material?: Material | null): {
  safetyStock: number | null;
  maxStock: number | null;
} {
  const defaults = material?.defaults as Record<string, unknown> | undefined;
  if (!defaults || typeof defaults !== 'object') {
    return { safetyStock: null, maxStock: null };
  }
  const inv =
    defaults.inventory && typeof defaults.inventory === 'object'
      ? (defaults.inventory as Record<string, unknown>)
      : defaults;
  const toNum = (raw: unknown): number | null => {
    if (raw === null || raw === undefined || String(raw).trim() === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };
  return {
    safetyStock: toNum(inv.safetyStock ?? inv.safety_stock ?? inv.safety_stock_level),
    maxStock: toNum(inv.maxStock ?? inv.max_stock),
  };
}
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';
import {
  WAREHOUSE_DOC_PINNED_STATUS_FIELD,
  normalizeWarehouseListResponse,
  resolveInventoryAlertListParams,
  resolveInventoryAlertRuleListParams,
} from '../../../utils/warehouseListCore';
import { resolveListLifecycleStageFromSearch } from '../../../../../utils/listLifecycleStage';

interface InventoryAlert {
  id?: number;
  uuid?: string;
  alert_rule_id?: number;
  alert_type?: string;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  current_quantity?: number;
  threshold_value?: number;
  alert_level?: string;
  alert_message?: string;
  status?: string;
  handled_by?: number;
  handled_by_name?: string;
  handled_at?: string;
  handling_notes?: string;
  triggered_at?: string;
  resolved_at?: string;
  created_at?: string;
  updated_at?: string;
  capabilities?: {
    resolve?: { allowed?: boolean; reason?: string };
    ignore?: { allowed?: boolean; reason?: string };
  };
}

interface InventoryAlertRule {
  id?: number;
  uuid?: string;
  code?: string;
  name?: string;
  alert_type?: string;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  material_group_id?: number;
  material_group_name?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  threshold_type?: string;
  threshold_value?: number | null;
  inherit_material_threshold?: boolean;
  is_enabled?: boolean;
  notify_users?: number[];
  notify_roles?: number[];
  remarks?: string;
  created_at?: string;
  updated_at?: string;
}

const InventoryAlertPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const alertActionRef = useRef<ActionType>(null);
  const ruleActionRef = useRef<ActionType>(null);
  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  const alertPerms = useResourcePermissions('kuaizhizao:warehouse-management-inventory-alert');
  const [activeTabKey, setActiveTabKey] = useState<'alerts' | 'rules'>('alerts');

  // Modal 相关状态
  const [ruleModalVisible, setRuleModalVisible] = useState(false);
  const [handleModalVisible, setHandleModalVisible] = useState(false);
  const formRef = useRef<any>(null);
  const [pendingRuleFormValues, setPendingRuleFormValues] = useState<Record<string, any> | null>(null);
  const handleFormRef = useRef<any>(null);
  const [pendingHandleFormValues, setPendingHandleFormValues] = useState<Record<string, any> | null>(null);

  // Drawer 相关状态
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [currentAlert, setCurrentAlert] = useState<InventoryAlert | null>(null);

  // 当前编辑的规则ID
  const [currentRuleId, setCurrentRuleId] = useState<number | null>(null);
  const [currentAlertId, setCurrentAlertId] = useState<number | null>(null);
  /** 已选物料的主数据阈值，供「继承」时只读展示 */
  const [selectedMaterialThresholds, setSelectedMaterialThresholds] = useState<{
    safetyStock: number | null;
    maxStock: number | null;
  } | null>(null);

  // 统计信息
  const [statistics, setStatistics] = useState<any>(null);

  const loadMaterialThresholdPreview = async (material?: Material | null) => {
    if (!material?.id) {
      setSelectedMaterialThresholds(null);
      return;
    }
    let detail = material;
    const fromSelect = readMaterialStockThresholds(material);
    if (fromSelect.safetyStock == null && fromSelect.maxStock == null && material.uuid) {
      try {
        detail = await materialApi.get(material.uuid);
      } catch {
        detail = material;
      }
    } else if (fromSelect.safetyStock == null && fromSelect.maxStock == null) {
      try {
        const listed = await materialApi.list({ ids: [material.id], limit: 1 });
        detail = listed.items?.[0] ?? material;
      } catch {
        detail = material;
      }
    }
    setSelectedMaterialThresholds(readMaterialStockThresholds(detail));
  };

  /**
   * 加载统计信息
   */
  const loadStatistics = async () => {
    try {
      const stats = await inventoryAlertApi.getStatistics();
      setStatistics(stats);
    } catch (error) {
      // 忽略错误
    }
  };

  useEffect(() => {
    if (activeTabKey === 'alerts') {
      loadStatistics();
    }
  }, [activeTabKey]);

  const alertStatCards = useMemo<StatCard[] | undefined>(() => {
    if (activeTabKey !== 'alerts' || !statistics) return undefined;
    return [
      {
        title: t('app.kuaizhizao.inventoryAlert.statPendingAlerts'),
        value: statistics.pending_count || 0,
        prefix: <WarningOutlined />,
        valueStyle: { color: '#cf1322' },
      },
      {
        title: t('app.kuaizhizao.inventoryAlert.statLowStock'),
        value: statistics.by_type?.low_stock || 0,
        valueStyle: { color: '#cf1322' },
      },
      {
        title: t('app.kuaizhizao.inventoryAlert.statHighStock'),
        value: statistics.by_type?.high_stock || 0,
        valueStyle: { color: '#faad14' },
      },
      {
        title: t('app.kuaizhizao.inventoryAlert.statCriticalLevel'),
        value: statistics.by_level?.critical || 0,
        valueStyle: { color: '#cf1322' },
      },
    ];
  }, [activeTabKey, statistics, t]);

  /**
   * 处理新建预警规则
   */
  const handleCreateRule = () => {
    setCurrentRuleId(null);
    setSelectedMaterialThresholds(null);
    setRuleModalVisible(true);
    setPendingRuleFormValues({
      is_enabled: true,
      threshold_type: 'quantity',
      inherit_material_threshold: true,
      alert_type: 'low_stock',
    });
  };

  const handleRunCheck = async () => {
    try {
      const result = await inventoryAlertApi.runCheck();
      messageApi.success(
        t('app.kuaizhizao.inventoryAlert.msgCheckSuccess', {
          checked: result.checked_balances ?? 0,
          triggered: result.triggered_count ?? 0,
          resolved: result.resolved_count ?? 0,
        }),
      );
      invalidateMenuBadgeCounts();
      alertActionRef.current?.reload();
      loadStatistics();
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaizhizao.inventoryAlert.msgCheckFailed'));
    }
  };
  useNewShortcut(activeTabKey === 'rules' ? handleCreateRule : undefined);
  const createRuleButtonLabel = useMemo(
    () => withSingleNewShortcutHint(t('app.kuaizhizao.inventoryAlert.createRuleButton')),
    [t],
  );

  const ruleMaterialFallbackOption = useMemo(() => {
    const materialId = pendingRuleFormValues?.material_id;
    if (!materialId) return undefined;
    const code = pendingRuleFormValues?.material_code ?? '';
    const name = pendingRuleFormValues?.material_name ?? '';
    const label = [code, name].filter(Boolean).join(' - ') || String(materialId);
    return { value: Number(materialId), label };
  }, [pendingRuleFormValues]);

  /**
   * 处理编辑预警规则
   */
  const handleEditRule = async (record: InventoryAlertRule) => {
    try {
      setCurrentRuleId(record.id!);
      setSelectedMaterialThresholds(null);
      setRuleModalVisible(true);
      const detail = await inventoryAlertApi.getRule(record.id!.toString());
      setPendingRuleFormValues({
        name: detail.name,
        alert_type: detail.alert_type,
        material_group_id: detail.material_group_id,
        material_group_name: detail.material_group_name,
        material_id: detail.material_id,
        material_code: detail.material_code,
        material_name: detail.material_name,
        warehouse_id: detail.warehouse_id,
        warehouse_name: detail.warehouse_name,
        threshold_type: detail.threshold_type,
        threshold_value: detail.threshold_value,
        inherit_material_threshold: Boolean(detail.inherit_material_threshold),
        is_enabled: detail.is_enabled,
        notify_users: detail.notify_users,
        notify_roles: detail.notify_roles,
        remarks: detail.remarks,
      });
      if (detail.material_id) {
        void loadMaterialThresholdPreview({ id: Number(detail.material_id) } as Material);
      }
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaizhizao.inventoryAlert.msgGetRuleFailed'));
    }
  };

  /**
   * 处理提交预警规则
   */
  const handleRuleSubmit = async (values: any) => {
    try {
      const inherit = values.alert_type === 'expired' ? false : Boolean(values.inherit_material_threshold);
      const thresholdPayload = {
        threshold_type: inherit ? 'quantity' : values.threshold_type,
        threshold_value: inherit ? null : values.threshold_value,
        inherit_material_threshold: inherit,
      };
      if (currentRuleId) {
        await inventoryAlertApi.updateRule(currentRuleId.toString(), {
          name: values.name,
          ...thresholdPayload,
          is_enabled: values.is_enabled,
          notify_users: values.notify_users,
          notify_roles: values.notify_roles,
          remarks: values.remarks,
        });
        messageApi.success(t('app.kuaizhizao.inventoryAlert.msgRuleUpdateSuccess'));
      } else {
        await inventoryAlertApi.createRule({
          name: values.name,
          alert_type: values.alert_type,
          material_group_id: values.material_group_id,
          material_group_name: values.material_group_name,
          material_id: values.material_id,
          material_code: values.material_code,
          material_name: values.material_name,
          warehouse_id: values.warehouse_id,
          warehouse_name: values.warehouse_name,
          ...thresholdPayload,
          is_enabled: values.is_enabled,
          notify_users: values.notify_users,
          notify_roles: values.notify_roles,
          remarks: values.remarks,
        });
        messageApi.success(t('app.kuaizhizao.inventoryAlert.msgRuleCreateSuccess'));
      }
      setRuleModalVisible(false);
      setCurrentRuleId(null);
      setPendingRuleFormValues(null);
      formRef.current?.resetFields();
      invalidateMenuBadgeCounts();

      ruleActionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaizhizao.warehouseCommon.operationFailed'));
      throw error;
    }
  };

  /**
   * 处理删除预警规则
   */
  const handleDeleteRule = async (record: InventoryAlertRule) => {
    try {
      await inventoryAlertApi.deleteRule(record.id!.toString());
      messageApi.success(t('app.kuaizhizao.inventoryAlert.msgRuleDeleteSuccess'));
      invalidateMenuBadgeCounts();

      ruleActionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaizhizao.inventoryAlert.msgDeleteRuleFailed'));
    }
  };

  /**
   * 处理查看预警详情
   */
  const handleDetail = async (record: InventoryAlert) => {
    setDetailDrawerVisible(true);
    setDetailLoading(true);
    setCurrentAlert(null);
    try {
      const detail = await inventoryAlertApi.get(record.id!.toString());
      setCurrentAlert(detail);
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaizhizao.inventoryAlert.msgGetDetailFailed'));
      setDetailDrawerVisible(false);
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理预警
   */
  const handleAlert = async (record: InventoryAlert) => {
    setCurrentAlertId(record.id!);
    setHandleModalVisible(true);
    setPendingHandleFormValues({
      status: 'processing',
    });
  };

  /**
   * 处理提交预警处理
   */
  const handleAlertSubmit = async (values: any) => {
    try {
      if (!currentAlertId) {
        messageApi.error(t('app.kuaizhizao.inventoryAlert.msgAlertIdNotFound'));
        return;
      }

      await inventoryAlertApi.handle(currentAlertId.toString(), {
        status: values.status,
        handling_notes: values.handling_notes,
      });
      messageApi.success(t('app.kuaizhizao.inventoryAlert.msgHandleSuccess'));
      setHandleModalVisible(false);
      setCurrentAlertId(null);
      setPendingHandleFormValues(null);
      handleFormRef.current?.resetFields();
      invalidateMenuBadgeCounts();

      alertActionRef.current?.reload();
      loadStatistics();
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaizhizao.inventoryAlert.msgHandleFailed'));
      throw error;
    }
  };

  const alertTypeEnum = useMemo(() => ({
    low_stock: { text: t('app.kuaizhizao.inventoryAlert.alertTypeLowStock'), status: 'error' as const },
    high_stock: { text: t('app.kuaizhizao.inventoryAlert.alertTypeHighStock'), status: 'warning' as const },
    expired: { text: t('app.kuaizhizao.inventoryAlert.alertTypeExpired'), status: 'error' as const },
  }), [t]);

  const alertLevelEnum = useMemo(() => ({
    critical: { text: t('app.kuaizhizao.inventoryAlert.alertLevelCritical'), status: 'error' as const },
    warning: { text: t('app.kuaizhizao.inventoryAlert.alertLevelWarning'), status: 'warning' as const },
    info: { text: t('app.kuaizhizao.inventoryAlert.alertLevelInfo'), status: 'default' as const },
  }), [t]);

  const alertStatusEnum = useMemo(() => ({
    pending: { text: t('app.kuaizhizao.warehouseCommon.statusPending'), status: 'warning' as const },
    processing: { text: t('app.kuaizhizao.warehouseCommon.statusProcessing'), status: 'processing' as const },
    resolved: { text: t('app.kuaizhizao.warehouseCommon.statusResolved'), status: 'success' as const },
    ignored: { text: t('app.kuaizhizao.warehouseCommon.statusIgnored'), status: 'default' as const },
  }), [t]);

  const thresholdTypeEnum = useMemo(() => ({
    quantity: { text: t('app.kuaizhizao.inventoryAlert.thresholdTypeQuantity') },
    percentage: { text: t('app.kuaizhizao.inventoryAlert.thresholdTypePercentage') },
    days: { text: t('app.kuaizhizao.inventoryAlert.thresholdTypeDays') },
  }), [t]);

  const enabledEnum = useMemo(() => ({
    true: { text: t('app.kuaizhizao.warehouseCommon.enabled'), status: 'success' as const },
    false: { text: t('app.kuaizhizao.warehouseCommon.disabled'), status: 'default' as const },
  }), [t]);

  /**
   * 预警记录表格列定义
   */
  const alertColumns: ProColumns<InventoryAlert>[] = useMemo(() => [
    {
      title: t('app.kuaizhizao.inventoryAlert.colAlertType'),
      dataIndex: 'alert_type',
      width: 120,
      valueEnum: alertTypeEnum,
    },
    {
      title: t('app.kuaizhizao.warehouseCommon.colMaterial'),
      key: 'material_name',
      dataIndex: 'material_name',
      ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
      render: (_, r) => (
        <MaterialStackedCell material_name={r.material_name} material_code={r.material_code} />
      ),
    },
    { title: t('app.kuaizhizao.warehouseReports.colMaterialCode'), dataIndex: 'material_code', hideInTable: true },
    { title: t('app.kuaizhizao.warehouseReports.colMaterialName'), dataIndex: 'material_name', hideInTable: true },
    {
      title: t('app.kuaizhizao.warehouseReports.colWarehouse'),
      dataIndex: 'warehouse_name',
      width: 120,
      ellipsis: true,
    },
    {
      title: t('app.kuaizhizao.inventoryAlert.colCurrentQty'),
      dataIndex: 'current_quantity',
      width: 100,
      align: 'right',
    },
    {
      title: t('app.kuaizhizao.inventoryAlert.colThreshold'),
      dataIndex: 'threshold_value',
      width: 100,
      align: 'right',
    },
    {
      title: t('app.kuaizhizao.inventoryAlert.colAlertLevel'),
      dataIndex: 'alert_level',
      width: 100,
      valueEnum: alertLevelEnum,
    },
    {
      title: t('app.kuaizhizao.warehouseCommon.colStatus'),
      dataIndex: 'status',
      hideInTable: true,
      valueEnum: alertStatusEnum,
    },
    {
      title: t('app.kuaizhizao.inventoryAlert.colTriggeredAt'),
      dataIndex: 'triggered_at',
      valueType: 'dateTime',
      width: 132,
      uniTableKeepWidth: true,
      sorter: true,
      render: (_, r) => (r.triggered_at ? formatDateTime(r.triggered_at) : '-'),
    },
    ...buildDocumentAuditColumns<InventoryAlert>(t),
    {
      title: t('app.kuaizhizao.warehouseCommon.colActions'),
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button {...rowActionKind('read')} onClick={() => handleDetail(record)} />
          {record.capabilities?.resolve?.allowed && alertPerms.canUpdate && (
            <Button {...rowActionKind('execute')} {...rowActionLabelKeep()} onClick={() => handleAlert(record)}>
              {t('app.kuaizhizao.warehouseCommon.handle')}
            </Button>
          )}
        </Space>
      ),
    },
  ], [t, alertTypeEnum, alertLevelEnum, alertStatusEnum, alertPerms]);

  /**
   * 预警规则表格列定义
   */
  const ruleColumns: ProColumns<InventoryAlertRule>[] = useMemo(() => [
    {
      title: t('app.kuaizhizao.inventoryAlert.colRuleCode'),
      dataIndex: 'code',
      width: 150,
      ellipsis: true,
      fixed: 'left',
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.code ?? '') }} ellipsis>
          {r.code ?? '-'}
        </Typography.Text>
      ),
    },
    {
      title: t('app.kuaizhizao.inventoryAlert.colRuleName'),
      dataIndex: 'name',
      width: 150,
      ellipsis: true,
    },
    {
      title: t('app.kuaizhizao.inventoryAlert.colAlertType'),
      dataIndex: 'alert_type',
      width: 120,
      valueEnum: alertTypeEnum,
    },
    {
      title: t('app.master-data.materialForm.materialGroup'),
      dataIndex: 'material_group_name',
      width: 140,
      ellipsis: true,
      render: (_, r) => r.material_group_name || '-',
    },
    {
      title: t('app.kuaizhizao.warehouseCommon.colMaterial'),
      dataIndex: 'material_name',
      width: 150,
      ellipsis: true,
    },
    {
      title: t('app.kuaizhizao.warehouseReports.colWarehouse'),
      dataIndex: 'warehouse_name',
      width: 120,
      ellipsis: true,
    },
    {
      title: t('app.kuaizhizao.inventoryAlert.colThresholdSource'),
      dataIndex: 'inherit_material_threshold',
      width: 120,
      render: (_, r) =>
        r.inherit_material_threshold
          ? t('app.kuaizhizao.inventoryAlert.thresholdSourceInherit')
          : t('app.kuaizhizao.inventoryAlert.thresholdSourceCustom'),
    },
    {
      title: t('app.kuaizhizao.inventoryAlert.colThresholdType'),
      dataIndex: 'threshold_type',
      width: 100,
      valueEnum: thresholdTypeEnum,
    },
    {
      title: t('app.kuaizhizao.inventoryAlert.colThreshold'),
      dataIndex: 'threshold_value',
      width: 100,
      align: 'right',
      render: (_, r) =>
        r.inherit_material_threshold ? t('app.kuaizhizao.inventoryAlert.thresholdInheritLabel') : (r.threshold_value ?? '-'),
    },
    {
      title: t('app.kuaizhizao.inventoryAlert.colEnabled'),
      dataIndex: 'is_enabled',
      width: 100,
      valueEnum: enabledEnum,
    },
    ...buildDocumentAuditColumns<InventoryAlertRule>(t),
    {
      title: t('app.kuaizhizao.warehouseCommon.colActions'),
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          {alertPerms.canUpdate && (
            <Button {...rowActionKind('update')} onClick={() => handleEditRule(record)} />
          )}
          {alertPerms.canDelete && (
            <Popconfirm
              title={t('app.kuaizhizao.inventoryAlert.deleteRuleConfirm')}
              onConfirm={() => handleDeleteRule(record)}
              okText={t('app.kuaizhizao.warehouseCommon.confirm')}
              cancelText={t('app.kuaizhizao.warehouseCommon.cancel')}
            >
              <Button {...rowActionKind('delete')} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ], [t, alertTypeEnum, thresholdTypeEnum, enabledEnum, alertPerms]);

  const detailColumns: ProDescriptionsItemProps<InventoryAlert>[] = useMemo(() => [
    {
      title: t('app.kuaizhizao.inventoryAlert.colAlertType'),
      dataIndex: 'alert_type',
      valueEnum: alertTypeEnum,
    },
    {
      title: t('app.kuaizhizao.warehouseReports.colMaterialCode'),
      dataIndex: 'material_code',
    },
    {
      title: t('app.kuaizhizao.warehouseReports.colMaterialName'),
      dataIndex: 'material_name',
    },
    {
      title: t('app.kuaizhizao.warehouseReports.colWarehouse'),
      dataIndex: 'warehouse_name',
    },
    {
      title: t('app.kuaizhizao.inventoryAlert.colCurrentQty'),
      dataIndex: 'current_quantity',
    },
    {
      title: t('app.kuaizhizao.inventoryAlert.colThreshold'),
      dataIndex: 'threshold_value',
    },
    {
      title: t('app.kuaizhizao.inventoryAlert.colAlertLevel'),
      dataIndex: 'alert_level',
      valueEnum: alertLevelEnum,
    },
    {
      title: t('app.kuaizhizao.inventoryAlert.colAlertMessage'),
      dataIndex: 'alert_message',
    },
    {
      title: t('app.kuaizhizao.warehouseCommon.colStatus'),
      dataIndex: 'status',
      valueEnum: alertStatusEnum,
    },
    {
      title: t('app.kuaizhizao.inventoryAlert.colTriggeredAt'),
      dataIndex: 'triggered_at',
      valueType: 'dateTime' as const,
    },
    {
      title: t('app.kuaizhizao.inventoryAlert.colHandledBy'),
      dataIndex: 'handled_by_name',
    },
    {
      title: t('app.kuaizhizao.inventoryAlert.colHandledAt'),
      dataIndex: 'handled_at',
      valueType: 'dateTime' as const,
    },
    {
      title: t('app.kuaizhizao.inventoryAlert.formHandlingNotes'),
      dataIndex: 'handling_notes',
    },
  ], [t, alertTypeEnum, alertLevelEnum, alertStatusEnum]);

  return (
    <>
      <MultiTabListPageTemplate
        statCards={alertStatCards}
        activeTabKey={activeTabKey}
        onTabChange={(key) => {
          setActiveTabKey(key as 'alerts' | 'rules');
          invalidateMenuBadgeCounts();
        }}
        preserveMounted
        tabs={[
          {
            key: 'alerts',
            label: t('app.kuaizhizao.inventoryAlert.tabAlerts'),
            children: (
              <UniTable<InventoryAlert>
                actionRef={alertActionRef}
                rowKey="id"
                columns={alertColumns}
                columnPersistenceId="apps.kuaizhizao.pages.warehouse-management.inventory-alert"
                showAdvancedSearch
                pinnedTabsField={WAREHOUSE_DOC_PINNED_STATUS_FIELD}
                skipFuzzyPinyinClientFilter
                toolBarRender={() =>
                  alertPerms.canAction?.('execute')
                    ? [
                        <Button
                          key="run-check"
                          type="primary"
                          icon={<ReloadOutlined />}
                          onClick={() => void handleRunCheck()}
                        >
                          {t('app.kuaizhizao.inventoryAlert.runCheckButton')}
                        </Button>,
                      ]
                    : []
                }
                request={async (params, sort, _filter, searchFormValues) => {
                  try {
                    const pageSize = params.pageSize || 20;
                    const skip = (params.current! - 1) * pageSize;
                    const lifecycleStage = resolveListLifecycleStageFromSearch(searchFormValues, params);
                    const listParams = resolveInventoryAlertListParams(searchFormValues, sort);
                    const result = await inventoryAlertApi.list({
                      skip,
                      limit: pageSize,
                      ...listParams,
                      status: lifecycleStage ?? listParams.status,
                    });
                    const { data, total } = normalizeWarehouseListResponse(result);
                    return { data, success: true, total };
                  } catch {
                    return { data: [], success: false, total: 0 };
                  }
                }}
              />
            ),
          },
          {
            key: 'rules',
            label: t('app.kuaizhizao.inventoryAlert.tabRules'),
            children: (
              <UniTable<InventoryAlertRule>
                actionRef={ruleActionRef}
                rowKey="id"
                columns={ruleColumns}
                columnPersistenceId="apps.kuaizhizao.pages.warehouse-management.inventory-alert:2"
                showAdvancedSearch
                skipFuzzyPinyinClientFilter
                showCreateButton
                createButtonText={createRuleButtonLabel}
                onCreate={handleCreateRule}
                request={async (params, sort, _filter, searchFormValues) => {
                  try {
                    const pageSize = params.pageSize || 20;
                    const skip = (params.current! - 1) * pageSize;
                    const listParams = resolveInventoryAlertRuleListParams(searchFormValues, sort);
                    const result = await inventoryAlertApi.listRules({
                      skip,
                      limit: pageSize,
                      ...listParams,
                    });
                    const { data, total } = normalizeWarehouseListResponse(result);
                    return { data, success: true, total };
                  } catch {
                    return { data: [], success: false, total: 0 };
                  }
                }}
              />
            ),
          },
        ]}
      />

      {/* 预警规则Modal */}
      <FormModalTemplate
        title={currentRuleId ? t('app.kuaizhizao.inventoryAlert.modalEditRule') : t('app.kuaizhizao.inventoryAlert.modalCreateRule')}
        open={ruleModalVisible}
        onClose={() => {
          setRuleModalVisible(false);
          setCurrentRuleId(null);
          setPendingRuleFormValues(null);
          setSelectedMaterialThresholds(null);
          formRef.current?.resetFields();
        }}
        afterOpenChange={(open) => {
          if (open) {
            if (pendingRuleFormValues) {
              formRef.current?.setFieldsValue(pendingRuleFormValues);
            }
            return;
          }
          formRef.current?.resetFields?.();
          setPendingRuleFormValues(null);
        }}
        onFinish={handleRuleSubmit}
        formRef={formRef}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        layout="vertical"
        grid={false}
        isEdit={!!currentRuleId}
      >
        <ProFormText
          name="name"
          label={t('app.kuaizhizao.inventoryAlert.formRuleName')}
          placeholder={t('app.kuaizhizao.inventoryAlert.formRuleNamePlaceholder')}
          rules={[{ required: true, message: t('app.kuaizhizao.inventoryAlert.formRuleNameRequired') }]}
        />
        <Row gutter={16}>
          <Col span={12}>
            <ProFormSelect
              name="alert_type"
              label={t('app.kuaizhizao.inventoryAlert.formAlertType')}
              options={[
                { label: t('app.kuaizhizao.inventoryAlert.alertTypeLowStock'), value: 'low_stock' },
                { label: t('app.kuaizhizao.inventoryAlert.alertTypeHighStock'), value: 'high_stock' },
                { label: t('app.kuaizhizao.inventoryAlert.alertTypeExpired'), value: 'expired' },
              ]}
              rules={[{ required: true, message: t('app.kuaizhizao.inventoryAlert.formAlertTypeRequired') }]}
              disabled={!!currentRuleId}
              fieldProps={{
                onChange: (value: string) => {
                  if (value === 'expired') {
                    formRef.current?.setFieldsValue({
                      inherit_material_threshold: false,
                      threshold_type: 'days',
                    });
                  } else {
                    formRef.current?.setFieldsValue({
                      inherit_material_threshold: true,
                      threshold_type: 'quantity',
                      threshold_value: undefined,
                    });
                  }
                },
              }}
            />
          </Col>
          <Col span={12}>
            <ProFormSelect
              name="material_group_id"
              label={t('app.master-data.materialForm.materialGroup')}
              placeholder={t('app.master-data.materialForm.materialGroupPlaceholder')}
              disabled={!!currentRuleId}
              showSearch
              allowClear
              request={async () => {
                const groups = await materialGroupApi.list({ limit: 1000 });
                return (groups ?? []).map((g) => ({
                  label: formatMaterialGroupLabel(g),
                  value: g.id,
                }));
              }}
              fieldProps={{
                onChange: (value: number | undefined, option: { label?: string } | undefined) => {
                  formRef.current?.setFieldsValue({
                    material_group_name: value ? (option?.label ?? undefined) : undefined,
                  });
                },
              }}
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <UniMaterialSelect
              name="material_id"
              label={t('app.kuaizhizao.warehouseCommon.colMaterial')}
              placeholder={t('app.kuaizhizao.warehouseCommon.selectMaterial')}
              disabled={!!currentRuleId}
              showQuickCreate
              showAdvancedSearch
              fillMapping={{
                material_code: 'mainCode',
                material_name: 'name',
              }}
              fallbackOption={ruleMaterialFallbackOption}
              onChange={(_value, material) => {
                void loadMaterialThresholdPreview(material);
              }}
            />
          </Col>
          <Col span={12}>
            <UniWarehouseSelect
              name="warehouse_id"
              label={t('app.kuaizhizao.warehouseReports.colWarehouse')}
              placeholder={t('app.kuaizhizao.warehouseCommon.selectWarehouse')}
              disabled={!!currentRuleId}
              onChange={(_value, warehouse) => {
                formRef.current?.setFieldsValue({ warehouse_name: warehouse?.name ?? undefined });
              }}
            />
          </Col>
        </Row>
        <ProFormText name="material_code" hidden />
        <ProFormText name="material_name" hidden />
        <ProFormText name="material_group_name" hidden />
        <ProFormText name="warehouse_name" hidden />
        <ProFormDependency name={['alert_type']}>
          {({ alert_type }) =>
            alert_type === 'expired' ? null : (
              <ProFormSwitch
                name="inherit_material_threshold"
                label={t('app.kuaizhizao.inventoryAlert.formInheritMaterialThreshold')}
                extra={t('app.kuaizhizao.inventoryAlert.formInheritMaterialThresholdExtra')}
                fieldProps={{
                  onChange: (checked: boolean) => {
                    if (checked) {
                      formRef.current?.setFieldsValue({
                        threshold_type: 'quantity',
                        threshold_value: undefined,
                      });
                    }
                  },
                }}
              />
            )
          }
        </ProFormDependency>
        <ProFormDependency name={['alert_type', 'inherit_material_threshold', 'material_id']}>
          {({ alert_type, inherit_material_threshold, material_id }) => {
            const inherit = alert_type !== 'expired' && Boolean(inherit_material_threshold);
            const typeOptions =
              alert_type === 'expired'
                ? [{ label: t('app.kuaizhizao.inventoryAlert.thresholdTypeDays'), value: 'days' }]
                : [
                    { label: t('app.kuaizhizao.inventoryAlert.thresholdTypeQuantity'), value: 'quantity' },
                    { label: t('app.kuaizhizao.inventoryAlert.thresholdTypePercentage'), value: 'percentage' },
                  ];
            const previewValue =
              alert_type === 'high_stock'
                ? selectedMaterialThresholds?.maxStock
                : selectedMaterialThresholds?.safetyStock;
            const previewLabel =
              alert_type === 'high_stock'
                ? t('app.kuaizhizao.inventoryAlert.inheritPreviewMaxStock')
                : t('app.kuaizhizao.inventoryAlert.inheritPreviewSafetyStock');
            return (
              <Row gutter={16}>
                <Col span={12}>
                  <ProFormSelect
                    name="threshold_type"
                    label={t('app.kuaizhizao.inventoryAlert.formThresholdType')}
                    options={typeOptions}
                    disabled={inherit}
                    rules={
                      inherit
                        ? []
                        : [{ required: true, message: t('app.kuaizhizao.inventoryAlert.formThresholdTypeRequired') }]
                    }
                  />
                </Col>
                <Col span={12}>
                  {inherit ? (
                    <div>
                      <div style={{ marginBottom: 8 }}>
                        {t('app.kuaizhizao.inventoryAlert.formThresholdValue')}
                      </div>
                      {material_id ? (
                        previewValue != null ? (
                          <Typography.Text>
                            {previewLabel}: <Typography.Text strong>{formatQuantity(previewValue)}</Typography.Text>
                            <Typography.Text type="secondary" style={{ marginLeft: 8 }}>
                              ({t('app.kuaizhizao.inventoryAlert.thresholdInheritLabel')})
                            </Typography.Text>
                          </Typography.Text>
                        ) : (
                          <Typography.Text type="warning">
                            {t('app.kuaizhizao.inventoryAlert.inheritPreviewMaterialEmpty')}
                          </Typography.Text>
                        )
                      ) : (
                        <Typography.Text type="secondary">
                          {t('app.kuaizhizao.inventoryAlert.inheritPreviewByGroup')}
                        </Typography.Text>
                      )}
                    </div>
                  ) : (
                    <ProFormDigit
                      name="threshold_value"
                      label={t('app.kuaizhizao.inventoryAlert.formThresholdValue')}
                      placeholder={t('app.kuaizhizao.inventoryAlert.formThresholdValuePlaceholder')}
                      rules={[
                        { required: true, message: t('app.kuaizhizao.inventoryAlert.formThresholdValueRequired') },
                      ]}
                      min={0}
                      fieldProps={{ precision: 2 }}
                    />
                  )}
                </Col>
              </Row>
            );
          }}
        </ProFormDependency>
        <ProFormTextArea
          name="remarks"
          label={t('app.kuaizhizao.warehouseCommon.colRemarks')}
          placeholder={t('app.kuaizhizao.warehouseCommon.placeholderRemarks')}
          fieldProps={{ rows: 3 }}
        />
        <ProFormSwitch
          name="is_enabled"
          label={t('app.kuaizhizao.inventoryAlert.formIsEnabled')}
        />
      </FormModalTemplate>

      {/* 处理预警Modal */}
      <FormModalTemplate
        title={t('app.kuaizhizao.inventoryAlert.modalHandleAlert')}
        open={handleModalVisible}
        onClose={() => {
          setHandleModalVisible(false);
          setCurrentAlertId(null);
          setPendingHandleFormValues(null);
          handleFormRef.current?.resetFields();
        }}
        afterOpenChange={(open) => {
          if (open) {
            if (pendingHandleFormValues) {
              handleFormRef.current?.setFieldsValue(pendingHandleFormValues);
            }
            return;
          }
          handleFormRef.current?.resetFields?.();
          setPendingHandleFormValues(null);
        }}
        onFinish={handleAlertSubmit}
        formRef={handleFormRef}
        width={MODAL_CONFIG.STANDARD_WIDTH}
      >
        <ProFormSelect
          name="status"
          label={t('app.kuaizhizao.inventoryAlert.formHandleStatus')}
          options={[
            { label: t('app.kuaizhizao.warehouseCommon.statusProcessing'), value: 'processing' },
            { label: t('app.kuaizhizao.warehouseCommon.statusResolved'), value: 'resolved' },
            { label: t('app.kuaizhizao.warehouseCommon.statusIgnored'), value: 'ignored' },
          ]}
          rules={[{ required: true, message: t('app.kuaizhizao.inventoryAlert.formHandleStatusRequired') }]}
        />
        <ProFormTextArea
          name="handling_notes"
          label={t('app.kuaizhizao.inventoryAlert.formHandlingNotes')}
          placeholder={t('app.kuaizhizao.inventoryAlert.formHandlingNotesPlaceholder')}
          fieldProps={{ rows: 3 }}
        />
      </FormModalTemplate>

      {/* 详情Drawer */}
      <DetailDrawerTemplate
        title={`${t('app.kuaizhizao.inventoryAlert.detailTitle')}${currentAlert?.material_code ? ` - ${currentAlert.material_code}` : ''}`}
        open={detailDrawerVisible}
        loading={detailLoading}
        onClose={() => {
          setDetailDrawerVisible(false);
          setCurrentAlert(null);
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        basic={
          currentAlert ? (
            <Descriptions
              column={2}
              size="small"
              items={detailDrawerDescriptionItems(detailColumns, currentAlert)}
            />
          ) : undefined
        }
      />
    </>
  );
};

export default InventoryAlertPage;
