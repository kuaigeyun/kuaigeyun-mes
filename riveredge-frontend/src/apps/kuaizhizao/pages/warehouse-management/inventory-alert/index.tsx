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
import { ActionType, ProColumns, ProFormText, ProFormDigit, ProFormTextArea, ProFormSelect, ProFormSwitch } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, message, Popconfirm, Typography } from 'antd';
import { EyeOutlined, EditOutlined, DeleteOutlined, CheckCircleOutlined, CloseCircleOutlined, WarningOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import {
  MaterialStackedCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { UniBatchButton } from '../../../../../components/uni-batch';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import {
  inventoryAlertBatchIgnoreAllowed,
  inventoryAlertBatchResolveAllowed,
} from '../../../../../hooks/useDocumentCapabilities';
import { FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG, MultiTabListPageTemplate, type StatCard } from '../../../../../components/layout-templates';
import { rowActionKind, rowActionLabelKeep } from '../../../../../components/uni-action';
import { inventoryAlertApi } from '../../../services/inventory-alert';
import { getInventoryAlertLifecycle } from '../../../utils/inventoryAlertLifecycle';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { mapAttachmentsToUploadList, normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { formatDateTime } from '../../../../../utils/format';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';

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
  warehouse_id?: number;
  warehouse_name?: string;
  threshold_type?: string;
  threshold_value?: number;
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
  const [alertSelectedRowKeys, setAlertSelectedRowKeys] = useState<React.Key[]>([]);
  const [ruleSelectedRowKeys, setRuleSelectedRowKeys] = useState<React.Key[]>([]);
  const tableRowsRef = useRef<InventoryAlert[]>([]);
  const [alertListVersion, setAlertListVersion] = useState(0);
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
  const [currentAlert, setCurrentAlert] = useState<InventoryAlert | null>(null);

  // 当前编辑的规则ID
  const [currentRuleId, setCurrentRuleId] = useState<number | null>(null);
  const [currentAlertId, setCurrentAlertId] = useState<number | null>(null);

  const selectedAlertsForBatch = useMemo(
    () =>
      alertSelectedRowKeys
        .map((key) => tableRowsRef.current.find((row) => String(row.id) === String(key)))
        .filter((row): row is InventoryAlert => row != null),
    [alertSelectedRowKeys, alertListVersion],
  );

  // 统计信息
  const [statistics, setStatistics] = useState<any>(null);

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
    setRuleModalVisible(true);
    setPendingRuleFormValues({
      is_enabled: true,
      threshold_type: 'quantity',
    });
  };
  useNewShortcut(activeTabKey === 'rules' ? handleCreateRule : undefined);
  const createRuleButtonLabel = useMemo(
    () => withSingleNewShortcutHint(t('app.kuaizhizao.inventoryAlert.createRuleButton')),
    [t],
  );

  /**
   * 处理编辑预警规则
   */
  const handleEditRule = async (record: InventoryAlertRule) => {
    try {
      setCurrentRuleId(record.id!);
      setRuleModalVisible(true);
      const detail = await inventoryAlertApi.getRule(record.id!.toString());
      setPendingRuleFormValues({
        name: detail.name,
        alert_type: detail.alert_type,
        material_id: detail.material_id,
        material_code: detail.material_code,
        material_name: detail.material_name,
        warehouse_id: detail.warehouse_id,
        warehouse_name: detail.warehouse_name,
        threshold_type: detail.threshold_type,
        threshold_value: detail.threshold_value,
        is_enabled: detail.is_enabled,
        notify_users: detail.notify_users,
        notify_roles: detail.notify_roles,
        remarks: detail.remarks,
        attachments: mapAttachmentsToUploadList(detail.attachments),
      });
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaizhizao.inventoryAlert.msgGetRuleFailed'));
    }
  };

  /**
   * 处理提交预警规则
   */
  const handleRuleSubmit = async (values: any) => {
    try {
      if (currentRuleId) {
        await inventoryAlertApi.updateRule(currentRuleId.toString(), {
          name: values.name,
          threshold_type: values.threshold_type,
          threshold_value: values.threshold_value,
          is_enabled: values.is_enabled,
          notify_users: values.notify_users,
          notify_roles: values.notify_roles,
          remarks: values.remarks,
          attachments: normalizeDocumentAttachments(values.attachments),
        });
        messageApi.success(t('app.kuaizhizao.inventoryAlert.msgRuleUpdateSuccess'));
      } else {
        await inventoryAlertApi.createRule({
          name: values.name,
          alert_type: values.alert_type,
          material_id: values.material_id,
          material_code: values.material_code,
          material_name: values.material_name,
          warehouse_id: values.warehouse_id,
          warehouse_name: values.warehouse_name,
          threshold_type: values.threshold_type,
          threshold_value: values.threshold_value,
          is_enabled: values.is_enabled,
          notify_users: values.notify_users,
          notify_roles: values.notify_roles,
          remarks: values.remarks,
          attachments: normalizeDocumentAttachments(values.attachments),
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
    try {
      const detail = await inventoryAlertApi.get(record.id!.toString());
      setCurrentAlert(detail);
      setDetailDrawerVisible(true);
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaizhizao.inventoryAlert.msgGetDetailFailed'));
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

  const handleBatchHandleAlerts = async (status: 'resolved' | 'ignored') => {
    if (!alertSelectedRowKeys.length) {
      messageApi.warning(t('app.kuaizhizao.warehouseCommon.selectAtLeastOne'));
      return;
    }
    let successCount = 0;
    for (const key of alertSelectedRowKeys) {
      try {
        await inventoryAlertApi.handle(String(key), { status });
        successCount += 1;
      } catch {
        // continue processing remaining rows
      }
    }
    if (successCount > 0) {
      messageApi.success(t('app.kuaizhizao.warehouseCommon.batchHandleSuccess', { count: successCount }));
      setAlertSelectedRowKeys([]);
      invalidateMenuBadgeCounts();
      alertActionRef.current?.reload();
      loadStatistics();
      return;
    }
    messageApi.error(t('app.kuaizhizao.warehouseCommon.batchHandleFailed'));
  };

  const handleBatchDeleteRules = async (keys: React.Key[]) => {
    let successCount = 0;
    for (const key of keys) {
      try {
        await inventoryAlertApi.deleteRule(String(key));
        successCount += 1;
      } catch {
        // continue processing remaining rows
      }
    }
    if (successCount > 0) {
      messageApi.success(t('app.kuaizhizao.warehouseCommon.batchDeleteSuccess', { count: successCount }));
      setRuleSelectedRowKeys([]);
      invalidateMenuBadgeCounts();
      ruleActionRef.current?.reload();
      return;
    }
    messageApi.error(t('app.kuaizhizao.warehouseCommon.batchDeleteFailed'));
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
      width: 160,
    },
    {
      title: t('app.kuaizhizao.warehouseCommon.colUpdatedAt'),
      dataIndex: 'updated_at',
      width: 168,
      hideInSearch: true,
      render: (_, r) => (r.updated_at ? formatDateTime(r.updated_at, 'YYYY-MM-DD HH:mm:ss') : '-'),
    },
    {
      title: t('app.kuaizhizao.warehouseCommon.colLifecycle'),
      dataIndex: 'lifecycle_stage',
      fixed: 'right',
      align: 'left',
      hideInSearch: true,
      render: (_, record) => {
        const lifecycle = getInventoryAlertLifecycle(record as Record<string, unknown>);
        return (
          <UniLifecycle
            percent={lifecycle.percent}
            stageName={lifecycle.stageName}
            status={lifecycle.status}
            subStages={lifecycle.subStages}
            showLabel
            size="small"
            showCircleTooltip={false}
          />
        );
      },
    },
    {
      title: t('app.kuaizhizao.warehouseCommon.colActions'),
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button {...rowActionKind('read')} onClick={() => handleDetail(record)} />
          {record.status === 'pending' && (
            <Button {...rowActionKind('execute')} {...rowActionLabelKeep()} onClick={() => handleAlert(record)}>
              {t('app.kuaizhizao.warehouseCommon.handle')}
            </Button>
          )}
        </Space>
      ),
    },
  ], [t, alertTypeEnum, alertLevelEnum, alertStatusEnum]);

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
    },
    {
      title: t('app.kuaizhizao.inventoryAlert.colEnabled'),
      dataIndex: 'is_enabled',
      width: 100,
      valueEnum: enabledEnum,
    },
    {
      title: t('app.kuaizhizao.warehouseCommon.colUpdatedAt'),
      dataIndex: 'updated_at',
      width: 168,
      hideInSearch: true,
      render: (_, r) => (r.updated_at ? formatDateTime(r.updated_at, 'YYYY-MM-DD HH:mm:ss') : '-'),
    },
    {
      title: t('app.kuaizhizao.warehouseCommon.colActions'),
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button {...rowActionKind('update')} onClick={() => handleEditRule(record)} />
          <Popconfirm
            title={t('app.kuaizhizao.inventoryAlert.deleteRuleConfirm')}
            onConfirm={() => handleDeleteRule(record)}
            okText={t('app.kuaizhizao.warehouseCommon.confirm')}
            cancelText={t('app.kuaizhizao.warehouseCommon.cancel')}
          >
            <Button {...rowActionKind('delete')} />
          </Popconfirm>
        </Space>
      ),
    },
  ], [t, alertTypeEnum, thresholdTypeEnum, enabledEnum]);

  const detailColumns = useMemo(() => [
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
                enableRowSelection
                selectedRowKeys={alertSelectedRowKeys}
                onRowSelectionChange={setAlertSelectedRowKeys}
                toolBarActionsAfterBatch={[
                  <UniBatchButton
                    key="batch-resolved"
                    selectedRowKeys={alertSelectedRowKeys}
                    icon={<CheckCircleOutlined />}
                    disabled={
                      selectedAlertsForBatch.length > 0 &&
                      !inventoryAlertBatchResolveAllowed(selectedAlertsForBatch, alertPerms.canUpdate)
                    }
                    onAction={() => void handleBatchHandleAlerts('resolved')}
                  >
                    {t('app.kuaizhizao.warehouseCommon.batchMarkResolved')}
                  </UniBatchButton>,
                  <UniBatchButton
                    key="batch-ignored"
                    selectedRowKeys={alertSelectedRowKeys}
                    icon={<CloseCircleOutlined />}
                    disabled={
                      selectedAlertsForBatch.length > 0 &&
                      !inventoryAlertBatchIgnoreAllowed(selectedAlertsForBatch, alertPerms.canUpdate)
                    }
                    onAction={() => void handleBatchHandleAlerts('ignored')}
                  >
                    {t('app.kuaizhizao.warehouseCommon.batchMarkIgnored')}
                  </UniBatchButton>,
                ]}
                request={async (params) => {
                  try {
                    const pageSize = params.pageSize || 20;
                    const skip = (params.current! - 1) * pageSize;
                    const result = await inventoryAlertApi.list({
                      skip,
                      limit: pageSize,
                      alert_type: params.alert_type,
                      status: params.status,
                      alert_level: params.alert_level,
                      material_id: params.material_id,
                      warehouse_id: params.warehouse_id,
                    });
                    const rows = Array.isArray(result) ? result : [];
                    tableRowsRef.current = rows as InventoryAlert[];
                    setAlertListVersion((v) => v + 1);
                    const total = rows.length < pageSize ? skip + rows.length : skip + rows.length + 1;
                    return {
                      data: rows,
                      success: true,
                      total,
                    };
                  } catch {
                    return {
                      data: [],
                      success: false,
                      total: 0,
                    };
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
                showCreateButton
                createButtonText={createRuleButtonLabel}
                onCreate={handleCreateRule}
                enableRowSelection
                selectedRowKeys={ruleSelectedRowKeys}
                onRowSelectionChange={setRuleSelectedRowKeys}
                showDeleteButton
                onDelete={handleBatchDeleteRules}
                deleteConfirmTitle={(count) =>
                  t('app.kuaizhizao.inventoryAlert.deleteConfirmRules', { count })
                }
                request={async (params) => {
                  try {
                    const pageSize = params.pageSize || 20;
                    const skip = (params.current! - 1) * pageSize;
                    const result = await inventoryAlertApi.listRules({
                      skip,
                      limit: pageSize,
                      alert_type: params.alert_type,
                      is_enabled: params.is_enabled,
                    });
                    const rows = Array.isArray(result) ? result : [];
                    const total = rows.length < pageSize ? skip + rows.length : skip + rows.length + 1;
                    return {
                      data: rows,
                      success: true,
                      total,
                    };
                  } catch {
                    return {
                      data: [],
                      success: false,
                      total: 0,
                    };
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
      >
        <ProFormText
          name="name"
          label={t('app.kuaizhizao.inventoryAlert.formRuleName')}
          placeholder={t('app.kuaizhizao.inventoryAlert.formRuleNamePlaceholder')}
          rules={[{ required: true, message: t('app.kuaizhizao.inventoryAlert.formRuleNameRequired') }]}
        />
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
        />
        <ProFormText
          name="material_id"
          label={t('app.kuaizhizao.inventoryAlert.formMaterialId')}
          placeholder={t('app.kuaizhizao.inventoryAlert.formMaterialIdPlaceholder')}
        />
        <ProFormText
          name="material_code"
          label={t('app.kuaizhizao.warehouseReports.colMaterialCode')}
          placeholder={t('app.kuaizhizao.inventoryAlert.formMaterialCodePlaceholder')}
        />
        <ProFormText
          name="material_name"
          label={t('app.kuaizhizao.warehouseReports.colMaterialName')}
          placeholder={t('app.kuaizhizao.inventoryAlert.formMaterialNamePlaceholder')}
        />
        <ProFormText
          name="warehouse_id"
          label={t('app.kuaizhizao.inventoryAlert.formWarehouseId')}
          placeholder={t('app.kuaizhizao.inventoryAlert.formWarehouseIdPlaceholder')}
        />
        <ProFormText
          name="warehouse_name"
          label={t('app.kuaizhizao.inventoryAlert.formWarehouseName')}
          placeholder={t('app.kuaizhizao.inventoryAlert.formWarehouseNamePlaceholder')}
        />
        <ProFormSelect
          name="threshold_type"
          label={t('app.kuaizhizao.inventoryAlert.formThresholdType')}
          options={[
            { label: t('app.kuaizhizao.inventoryAlert.thresholdTypeQuantity'), value: 'quantity' },
            { label: t('app.kuaizhizao.inventoryAlert.thresholdTypePercentage'), value: 'percentage' },
            { label: t('app.kuaizhizao.inventoryAlert.thresholdTypeDays'), value: 'days' },
          ]}
          rules={[{ required: true, message: t('app.kuaizhizao.inventoryAlert.formThresholdTypeRequired') }]}
        />
        <ProFormDigit
          name="threshold_value"
          label={t('app.kuaizhizao.inventoryAlert.formThresholdValue')}
          placeholder={t('app.kuaizhizao.inventoryAlert.formThresholdValuePlaceholder')}
          rules={[{ required: true, message: t('app.kuaizhizao.inventoryAlert.formThresholdValueRequired') }]}
          min={0}
          fieldProps={{ precision: 2 }}
        />
        <ProFormSwitch
          name="is_enabled"
          label={t('app.kuaizhizao.inventoryAlert.formIsEnabled')}
        />
        <DocumentAttachmentsField category="inventory_alert_rule_attachments" />
        <ProFormTextArea
          name="remarks"
          label={t('app.kuaizhizao.warehouseCommon.colRemarks')}
          placeholder={t('app.kuaizhizao.warehouseCommon.placeholderRemarks')}
          fieldProps={{ rows: 3 }}
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
        title={t('app.kuaizhizao.inventoryAlert.detailTitle')}
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setCurrentAlert(null);
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        dataSource={currentAlert || {}}
        columns={detailColumns}
      />
    </>
  );
};

export default InventoryAlertPage;
