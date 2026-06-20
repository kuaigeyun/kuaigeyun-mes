/**
 * 补货建议管理页面
 *
 * 提供补货建议的查看、生成和处理功能
 *
 * @author RiverEdge Team
 * @date 2026-01-17
 */

import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Descriptions } from 'antd';
import dayjs from 'dayjs';
import { ProForm, ProFormRadio, ProFormTextArea } from '@ant-design/pro-components';
import { ReloadOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import {
  MaterialStackedCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { detailDrawerDescriptionItems, DetailDrawerTemplate, DRAWER_CONFIG, ListPageTemplate } from '../../../../../components/layout-templates';
import { rowActionKind, rowActionLabelKeep } from '../../../../../components/uni-action';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { UniBatchButton } from '../../../../../components/uni-batch';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import {
  replenishmentBatchIgnoreAllowed,
  replenishmentBatchProcessAllowed,
} from '../../../../../hooks/useDocumentCapabilities';
import { warehouseApi } from '../../../services/production';
import { getReplenishmentSuggestionLifecycle } from '../../../utils/replenishmentSuggestionLifecycle';
import { formatDateTime } from '../../../../../utils/format';

interface ReplenishmentSuggestion {
  id?: number;
  tenant_id?: number;
  uuid?: string;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  current_quantity?: number;
  safety_stock?: number;
  min_stock?: number;
  max_stock?: number;
  suggested_quantity?: number;
  priority?: string;
  suggestion_type?: string;
  estimated_delivery_days?: number;
  suggested_order_date?: string;
  supplier_id?: number;
  supplier_name?: string;
  status?: string;
  processed_by?: number;
  processed_by_name?: string;
  processed_at?: string;
  processing_notes?: string;
  alert_id?: number;
  related_demand_id?: number;
  related_demand_code?: string;
  remarks?: string;
  created_at?: string;
  updated_at?: string;
  capabilities?: {
    process?: { allowed?: boolean; reason?: string };
    ignore?: { allowed?: boolean; reason?: string };
  };
}

const ReplenishmentSuggestionsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const tableRowsRef = useRef<ReplenishmentSuggestion[]>([]);
  const [listVersion, setListVersion] = useState(0);
  const replenishmentPerms = useResourcePermissions('kuaizhizao:warehouse-management-replenishment-suggestions');

  const selectedSuggestionsForBatch = useMemo(
    () =>
      selectedRowKeys
        .map((key) => tableRowsRef.current.find((row) => String(row.id) === String(key)))
        .filter((row): row is ReplenishmentSuggestion => row != null),
    [selectedRowKeys, listVersion],
  );

  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [suggestionDetail, setSuggestionDetail] = useState<ReplenishmentSuggestion | null>(null);

  const [processModalVisible, setProcessModalVisible] = useState(false);
  const [processSuggestion, setProcessSuggestion] = useState<ReplenishmentSuggestion | null>(null);
  const [processStatus, setProcessStatus] = useState<string>('processed');
  const [processNotes, setProcessNotes] = useState<string>('');

  const suggestionTypeLabel = (type?: string) => {
    const typeMap: Record<string, string> = {
      low_stock: t('app.kuaizhizao.replenishmentSuggestions.typeLowStock'),
      demand_based: t('app.kuaizhizao.replenishmentSuggestions.typeDemandBased'),
      seasonal: t('app.kuaizhizao.replenishmentSuggestions.typeSeasonal'),
    };
    return type ? typeMap[type] || type : '-';
  };

  const priorityConfig = (priority?: string) => {
    const priorityMap: Record<string, { text: string; color: string }> = {
      high: { text: t('app.kuaizhizao.warehouseCommon.priorityHigh'), color: 'error' },
      medium: { text: t('app.kuaizhizao.warehouseCommon.priorityMedium'), color: 'warning' },
      low: { text: t('app.kuaizhizao.warehouseCommon.priorityLow'), color: 'default' },
    };
    return priorityMap[priority || ''] || priorityMap.medium;
  };

  const statusConfig = (status?: string) => {
    const statusMap: Record<string, { text: string; color: string }> = {
      pending: { text: t('app.kuaizhizao.warehouseCommon.statusPending'), color: 'default' },
      processed: { text: t('app.kuaizhizao.replenishmentSuggestions.statusProcessed'), color: 'success' },
      ignored: { text: t('app.kuaizhizao.warehouseCommon.statusIgnored'), color: 'error' },
    };
    const key = status || '';
    return statusMap[key] || { text: key || '-', color: 'default' };
  };

  const columns: ProColumns<ReplenishmentSuggestion>[] = useMemo(() => [
    {
      title: t('app.kuaizhizao.warehouseCommon.colMaterial'),
      key: 'material_name',
      dataIndex: 'material_name',
      ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
      fixed: 'left',
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
      title: t('app.kuaizhizao.replenishmentSuggestions.colCurrentStock'),
      dataIndex: 'current_quantity',
      width: 100,
      align: 'right',
    },
    {
      title: t('app.kuaizhizao.replenishmentSuggestions.colSafetyStock'),
      dataIndex: 'safety_stock',
      width: 100,
      align: 'right',
    },
    {
      title: t('app.kuaizhizao.replenishmentSuggestions.colSuggestedQty'),
      dataIndex: 'suggested_quantity',
      width: 120,
      align: 'right',
      render: (_, record) => (
        <span style={{ fontWeight: 'bold', color: '#1890ff' }}>{record.suggested_quantity}</span>
      ),
    },
    {
      title: t('app.kuaizhizao.replenishmentSuggestions.colPriority'),
      dataIndex: 'priority',
      width: 100,
      render: (priority) => {
        const config = priorityConfig(String(priority ?? ''));
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: t('app.kuaizhizao.replenishmentSuggestions.colSuggestionType'),
      dataIndex: 'suggestion_type',
      width: 120,
      render: (type) => suggestionTypeLabel(String(type ?? '')),
    },
    {
      title: t('app.kuaizhizao.warehouseCommon.colStatus'),
      dataIndex: 'status',
      hideInTable: true,
      valueType: 'select',
      valueEnum: {
        pending: { text: t('app.kuaizhizao.warehouseCommon.statusPending') },
        processed: { text: t('app.kuaizhizao.replenishmentSuggestions.statusProcessed') },
        ignored: { text: t('app.kuaizhizao.warehouseCommon.statusIgnored') },
      },
    },
    {
      title: t('app.kuaizhizao.replenishmentSuggestions.colSuggestedOrderDate'),
      dataIndex: 'suggested_order_date',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: t('app.kuaizhizao.warehouseCommon.colCreatedAt'),
      dataIndex: 'created_at',
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
        const lifecycle = getReplenishmentSuggestionLifecycle(record as Record<string, unknown>);
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
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button {...rowActionKind('read')} onClick={() => handleDetail(record)} />
          {record.status === 'pending' && (
            <Button {...rowActionKind('execute')} {...rowActionLabelKeep()} onClick={() => handleProcess(record)}>
              {t('app.kuaizhizao.warehouseCommon.handle')}
            </Button>
          )}
        </Space>
      ),
    },
  ], [t]);

  const handleDetail = async (record: ReplenishmentSuggestion) => {
    try {
      const detail = await warehouseApi.replenishmentSuggestion.get(record.id!.toString());
      setSuggestionDetail(detail);
      setDetailDrawerVisible(true);
    } catch (error) {
      messageApi.error(t('app.kuaizhizao.replenishmentSuggestions.msgGetDetailFailed'));
    }
  };

  const handleProcess = (record: ReplenishmentSuggestion) => {
    setProcessSuggestion(record);
    setProcessStatus('processed');
    setProcessNotes('');
    setProcessModalVisible(true);
  };

  const handleProcessSubmit = async () => {
    if (!processSuggestion) return;

    try {
      await warehouseApi.replenishmentSuggestion.process(processSuggestion.id!.toString(), {
        status: processStatus,
        processing_notes: processNotes,
      });
      messageApi.success(t('app.kuaizhizao.replenishmentSuggestions.msgProcessSuccess'));
      setProcessModalVisible(false);
      setProcessSuggestion(null);
      invalidateMenuBadgeCounts();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaizhizao.replenishmentSuggestions.msgProcessFailed'));
    }
  };

  const handleGenerateFromAlerts = async () => {
    Modal.confirm({
      title: t('app.kuaizhizao.replenishmentSuggestions.msgGenerateTitle'),
      content: t('app.kuaizhizao.replenishmentSuggestions.msgGenerateContent'),
      onOk: async () => {
        try {
          await warehouseApi.replenishmentSuggestion.generateFromAlerts();
          messageApi.success(t('app.kuaizhizao.replenishmentSuggestions.msgGenerateSuccess'));
          invalidateMenuBadgeCounts();
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('app.kuaizhizao.replenishmentSuggestions.msgGenerateFailed'));
        }
      },
    });
  };

  const handleBatchProcess = async (status: 'processed' | 'ignored') => {
    if (!selectedRowKeys.length) {
      messageApi.warning(t('app.kuaizhizao.replenishmentSuggestions.msgSelectSuggestions'));
      return;
    }
    let successCount = 0;
    for (const key of selectedRowKeys) {
      try {
        await warehouseApi.replenishmentSuggestion.process(String(key), { status });
        successCount += 1;
      } catch {
        // keep processing remaining items
      }
    }
    if (successCount > 0) {
      messageApi.success(t('app.kuaizhizao.warehouseCommon.batchHandleSuccess', { count: successCount }));
      setSelectedRowKeys([]);
      invalidateMenuBadgeCounts();
      actionRef.current?.reload();
      return;
    }
    messageApi.error(t('app.kuaizhizao.warehouseCommon.batchHandleFailed'));
  };

  const detailColumns: ProDescriptionsItemProps<ReplenishmentSuggestion>[] = useMemo(() => [
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
      title: t('app.kuaizhizao.replenishmentSuggestions.colCurrentStock'),
      dataIndex: 'current_quantity',
    },
    {
      title: t('app.kuaizhizao.replenishmentSuggestions.colSafetyStock'),
      dataIndex: 'safety_stock',
    },
    {
      title: t('app.kuaizhizao.replenishmentSuggestions.colMinStock'),
      dataIndex: 'min_stock',
    },
    {
      title: t('app.kuaizhizao.replenishmentSuggestions.colMaxStock'),
      dataIndex: 'max_stock',
    },
    {
      title: t('app.kuaizhizao.replenishmentSuggestions.colSuggestedQty'),
      dataIndex: 'suggested_quantity',
      render: (_, record) => (
        <span style={{ fontWeight: 'bold', color: '#1890ff' }}>{record.suggested_quantity}</span>
      ),
    },
    {
      title: t('app.kuaizhizao.replenishmentSuggestions.colPriority'),
      dataIndex: 'priority',
      render: (_, record) => {
        const config = priorityConfig(record.priority);
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: t('app.kuaizhizao.replenishmentSuggestions.colSuggestionType'),
      dataIndex: 'suggestion_type',
      render: (_, record) => suggestionTypeLabel(record.suggestion_type),
    },
    {
      title: t('app.kuaizhizao.replenishmentSuggestions.colEstimatedDeliveryDays'),
      dataIndex: 'estimated_delivery_days',
    },
    {
      title: t('app.kuaizhizao.replenishmentSuggestions.colSuggestedOrderDate'),
      dataIndex: 'suggested_order_date',
      valueType: 'dateTime',
    },
    {
      title: t('app.kuaizhizao.replenishmentSuggestions.colSupplier'),
      dataIndex: 'supplier_name',
    },
    {
      title: t('app.kuaizhizao.warehouseCommon.colStatus'),
      dataIndex: 'status',
      render: (_, record) => {
        const config = statusConfig(record.status);
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: t('app.kuaizhizao.warehouseCommon.colRemarks'),
      dataIndex: 'remarks',
      span: 2,
      render: (text) => text || '-',
    },
  ], [t]);

  return (
    <>
      <ListPageTemplate
        statCards={[
          {
            title: t('app.kuaizhizao.replenishmentSuggestions.statPending'),
            value: 0,
            prefix: <ExclamationCircleOutlined />,
            valueStyle: { color: '#faad14' },
          },
          {
            title: t('app.kuaizhizao.replenishmentSuggestions.statHighPriority'),
            value: 0,
            suffix: t('app.kuaizhizao.replenishmentSuggestions.statUnit'),
            valueStyle: { color: '#f5222d' },
          },
          {
            title: t('app.kuaizhizao.replenishmentSuggestions.statProcessed'),
            value: 0,
            suffix: t('app.kuaizhizao.replenishmentSuggestions.statUnit'),
            valueStyle: { color: '#52c41a' },
          },
        ]}
      >
        <UniTable
          headerTitle={t('app.kuaizhizao.replenishmentSuggestions.headerTitle')}
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          columnPersistenceId="apps.kuaizhizao.pages.warehouse-management.replenishment-suggestions"
          showAdvancedSearch={true}
          request={async (params) => {
            try {
              const response = await warehouseApi.replenishmentSuggestion.list({
                skip: (params.current! - 1) * params.pageSize!,
                limit: params.pageSize,
                status: params.status,
                priority: params.priority,
                suggestion_type: params.suggestion_type,
                material_id: params.material_id,
                warehouse_id: params.warehouse_id,
              });
              const data = Array.isArray(response) ? response : response.data || [];
              tableRowsRef.current = data;
              setListVersion((v) => v + 1);
              return {
                data,
                success: true,
                total: Array.isArray(response) ? response.length : response.total || 0,
              };
            } catch (error) {
              messageApi.error(t('app.kuaizhizao.replenishmentSuggestions.msgListFailed'));
              return {
                data: [],
                success: false,
                total: 0,
              };
            }
          }}
          enableRowSelection
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={setSelectedRowKeys}
          toolBarActionsAfterBatch={[
            <UniBatchButton
              key="batch-processed"
              selectedRowKeys={selectedRowKeys}
              disabled={
                selectedSuggestionsForBatch.length > 0 &&
                !replenishmentBatchProcessAllowed(selectedSuggestionsForBatch, replenishmentPerms.canUpdate)
              }
              onAction={() => void handleBatchProcess('processed')}
            >
              {t('app.kuaizhizao.warehouseCommon.batchMarkProcessed')}
            </UniBatchButton>,
            <UniBatchButton
              key="batch-ignored"
              selectedRowKeys={selectedRowKeys}
              disabled={
                selectedSuggestionsForBatch.length > 0 &&
                !replenishmentBatchIgnoreAllowed(selectedSuggestionsForBatch, replenishmentPerms.canUpdate)
              }
              onAction={() => void handleBatchProcess('ignored')}
            >
              {t('app.kuaizhizao.warehouseCommon.batchMarkIgnored')}
            </UniBatchButton>,
          ]}
          toolBarRender={() => [
            <Button
              key="generate"
              type="primary"
              icon={<ReloadOutlined />}
              onClick={handleGenerateFromAlerts}
            >
              {t('app.kuaizhizao.replenishmentSuggestions.actionGenerateFromAlerts')}
            </Button>,
          ]}
          scroll={{ x: 1200 }}
        />
      </ListPageTemplate>

      <DetailDrawerTemplate
        title={
          suggestionDetail?.material_code
            ? t('app.kuaizhizao.replenishmentSuggestions.detailTitleWithCode', { code: suggestionDetail.material_code })
            : t('app.kuaizhizao.replenishmentSuggestions.detailTitle')
        }
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setSuggestionDetail(null);
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        basic={
          suggestionDetail ? (
            <Descriptions column={2} items={detailDrawerDescriptionItems(detailColumns, suggestionDetail)} />
          ) : undefined
        }
      />

      <Modal
        title={t('app.kuaizhizao.replenishmentSuggestions.modalProcess')}
        open={processModalVisible}
        onOk={handleProcessSubmit}
        onCancel={() => {
          setProcessModalVisible(false);
          setProcessSuggestion(null);
          setProcessNotes('');
        }}
        okText={t('app.kuaizhizao.warehouseCommon.confirm')}
        cancelText={t('app.kuaizhizao.warehouseCommon.cancel')}
      >
        <ProForm
          submitter={false}
          initialValues={{
            status: processStatus,
            notes: processNotes,
          }}
          onValuesChange={(changedValues) => {
            if (changedValues.status !== undefined) {
              setProcessStatus(changedValues.status);
            }
            if (changedValues.notes !== undefined) {
              setProcessNotes(changedValues.notes);
            }
          }}
        >
          <ProFormRadio.Group
            name="status"
            label={t('app.kuaizhizao.replenishmentSuggestions.formProcessStatus')}
            options={[
              { label: t('app.kuaizhizao.replenishmentSuggestions.statusProcessed'), value: 'processed' },
              { label: t('app.kuaizhizao.replenishmentSuggestions.formIgnore'), value: 'ignored' },
            ]}
          />
          <ProFormTextArea
            name="notes"
            label={t('app.kuaizhizao.replenishmentSuggestions.formProcessNotes')}
            placeholder={t('app.kuaizhizao.replenishmentSuggestions.formProcessNotesPlaceholder')}
            fieldProps={{
              rows: 4,
            }}
          />
        </ProForm>
      </Modal>
    </>
  );
};

export default ReplenishmentSuggestionsPage;
