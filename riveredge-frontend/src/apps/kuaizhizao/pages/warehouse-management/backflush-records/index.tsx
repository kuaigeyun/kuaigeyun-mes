/**
 * 物料倒冲记录页面
 *
 * 查看报工触发的物料倒冲记录，支持按工单、物料、状态筛选，失败记录可重试。
 */

import React, { useMemo, useRef, useState } from 'react';
import type { ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import { App, Button, Descriptions, Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import { warehouseApi } from '../../../services/production';
import { UniTable } from '../../../../../components/uni-table';
import {
  MaterialStackedCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { DetailDrawerTemplate, ListPageTemplate, detailDrawerDescriptionItems, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { renderRowActionsOverflow, rowActionKind, rowActionLabelKeep } from '../../../../../components/uni-action';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import { alignProColumns } from '../../sales-management/shared/documentFieldAlignment';
import { WAREHOUSE_DOC_LIST_FIELD_RANK } from '../shared/warehouseDocListFieldRank';
import { formatDateTime, formatQuantity } from '../../../../../utils/format';
import {
  WAREHOUSE_DOC_PINNED_STATUS_FIELD,
  buildBackflushRecordStatusValueEnum,
  normalizeWarehouseListResponse,
  resolveBackflushRecordListParams,
} from '../../../utils/warehouseListCore';

interface BackflushRecordItem {
  id: number;
  work_order_code: string;
  operation_code: string | null;
  report_id: number;
  report_quantity: number;
  material_code: string;
  material_name: string;
  material_unit: string | null;
  batch_no: string | null;
  warehouse_name: string | null;
  bom_quantity: number;
  backflush_quantity: number;
  status: string;
  error_message: string | null;
  created_at: string;
  updated_at?: string;
  created_by_name?: string;
  updated_by_name?: string;
  processed_by_name?: string;
}

const BackflushRecordsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message, modal } = App.useApp();
  const actionRef = useRef<any>(null);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailRecord, setDetailRecord] = useState<BackflushRecordItem | null>(null);

  const statusValueEnum = useMemo(() => buildBackflushRecordStatusValueEnum(t), [t]);

  const renderStatusTag = (status?: string) => {
    const key = String(status ?? '').trim();
    const label = statusValueEnum[key]?.text ?? (key || '-');
    let color: string | undefined;
    if (key === 'completed') color = 'success';
    else if (key === 'failed') color = 'error';
    else if (key === 'pending') color = 'processing';
    else if (key === 'cancelled') color = 'default';
    return <Tag color={color}>{label}</Tag>;
  };

  const handleDetail = async (record: BackflushRecordItem) => {
    setDetailDrawerVisible(true);
    setDetailLoading(true);
    setDetailRecord(null);
    try {
      const detailData = await warehouseApi.backflushRecords.get(String(record.id));
      setDetailRecord(detailData as BackflushRecordItem);
    } catch {
      message.error(t('app.kuaizhizao.warehouseCommon.detailLoadFailed', { noun: t('app.kuaizhizao.backflushRecords.headerTitle') }));
      setDetailDrawerVisible(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleRetry = (record: BackflushRecordItem) => {
    modal.confirm({
      title: t('app.kuaizhizao.backflushRecords.retryTitle'),
      content: t('app.kuaizhizao.backflushRecords.retryContent', { material: record.material_name }),
      onOk: async () => {
        try {
          const res = await warehouseApi.backflushRecords.retry(String(record.id));
          if (res?.success) {
            message.success(res?.message || t('app.kuaizhizao.backflushRecords.retrySuccess'));
            actionRef.current?.reload();
          } else {
            message.warning(res?.message || t('app.kuaizhizao.backflushRecords.retryFailed'));
          }
        } catch {
          message.error(t('app.kuaizhizao.backflushRecords.retryFailed'));
        }
      },
    });
  };

  const columns: ProColumns<BackflushRecordItem>[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.backflushRecords.colWorkOrderCode'),
        dataIndex: 'work_order_code',
        width: 130,
        fixed: 'left',
        copyable: true,
        sorter: true,
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
        title: t('app.kuaizhizao.batchInventoryQuery.colBatchNo'),
        dataIndex: 'batch_no',
        width: 100,
        render: (_, record) => record.batch_no || '-',
      },
      {
        title: t('app.kuaizhizao.backflushRecords.colReportQty'),
        dataIndex: 'report_quantity',
        width: 90,
        valueType: 'digit',
      },
      {
        title: t('app.kuaizhizao.backflushRecords.colBomQty'),
        dataIndex: 'bom_quantity',
        width: 90,
        valueType: 'digit',
      },
      {
        title: t('app.kuaizhizao.backflushRecords.colBackflushQty'),
        dataIndex: 'backflush_quantity',
        width: 100,
        valueType: 'digit',
        render: (_, record) => `${record.backflush_quantity} ${record.material_unit || ''}`,
      },
      {
        title: t('app.kuaizhizao.backflushRecords.colOutboundWarehouse'),
        dataIndex: 'warehouse_name',
        width: 120,
        render: (_, record) => record.warehouse_name || '-',
      },
      {
        title: t('app.kuaizhizao.warehouseCommon.colStatus'),
        dataIndex: 'status',
        hideInTable: true,
        valueEnum: buildBackflushRecordStatusValueEnum(t),
      },
      {
        title: t('app.kuaizhizao.backflushRecords.colErrorMessage'),
        dataIndex: 'error_message',
        width: 180,
        ellipsis: true,
        render: (_, record) => record.error_message || '-',
      },
      ...buildDocumentAuditColumns<BackflushRecordItem>(t),
      {
        title: t('app.kuaizhizao.warehouseCommon.colActions'),
        valueType: 'option',
        width: 120,
        fixed: 'right',
        render: (_, record) => {
          const actions = [
            <Button key="detail" {...rowActionKind('read')} onClick={() => handleDetail(record)} />,
          ];
          if (record.status === 'failed') {
            actions.push(
              <Button key="retry" {...rowActionKind('execute')} {...rowActionLabelKeep()} onClick={() => handleRetry(record)}>
                {t('app.kuaizhizao.backflushRecords.retry')}
              </Button>,
            );
          }
          return renderRowActionsOverflow(actions, { keyPrefix: `backflush-${record.id}` });
        },
      },
    ],
    [t, statusValueEnum]
  );

  const detailColumns: ProDescriptionsItemProps<BackflushRecordItem>[] = useMemo(
    () => [
      { title: t('app.kuaizhizao.backflushRecords.colWorkOrderCode'), dataIndex: 'work_order_code' },
      { title: t('app.kuaizhizao.backflushRecords.colOperationCode'), dataIndex: 'operation_code', render: (_, r) => r.operation_code || '-' },
      {
        title: t('app.kuaizhizao.warehouseCommon.colMaterial'),
        key: 'material',
        render: (_, r) => (
          <MaterialStackedCell material_name={r.material_name} material_code={r.material_code} />
        ),
      },
      {
        title: t('app.kuaizhizao.warehouseCommon.colStatus'),
        dataIndex: 'status',
        render: (_, r) => renderStatusTag(r.status),
      },
      { title: t('app.kuaizhizao.batchInventoryQuery.colBatchNo'), dataIndex: 'batch_no', render: (_, r) => r.batch_no || '-' },
      { title: t('app.kuaizhizao.backflushRecords.colReportQty'), dataIndex: 'report_quantity', render: (_, r) => formatQuantity(r.report_quantity) },
      { title: t('app.kuaizhizao.backflushRecords.colBomQty'), dataIndex: 'bom_quantity', render: (_, r) => formatQuantity(r.bom_quantity) },
      {
        title: t('app.kuaizhizao.backflushRecords.colBackflushQty'),
        key: 'backflush_quantity',
        render: (_, r) => `${formatQuantity(r.backflush_quantity)} ${r.material_unit || ''}`.trim(),
      },
      { title: t('app.kuaizhizao.backflushRecords.colOutboundWarehouse'), dataIndex: 'warehouse_name', render: (_, r) => r.warehouse_name || '-' },
      { title: t('app.kuaizhizao.backflushRecords.colErrorMessage'), dataIndex: 'error_message', span: 2, render: (_, r) => r.error_message || '-' },
      { title: t('app.kuaizhizao.warehouseCommon.colProcessedBy'), dataIndex: 'processed_by_name', render: (_, r) => r.processed_by_name || '-' },
      { title: t('app.kuaizhizao.warehouseCommon.colCreatedAt'), dataIndex: 'created_at', render: (_, r) => formatDateTime(r.created_at) },
      { title: t('app.kuaizhizao.warehouseCommon.colUpdatedAt'), dataIndex: 'updated_at', render: (_, r) => formatDateTime(r.updated_at) },
    ],
    [t, statusValueEnum]
  );

  const fetchRecords = async (params: any, sort: any, _filter: any, searchFormValues?: Record<string, unknown>) => {
    try {
      const listParams = resolveBackflushRecordListParams(searchFormValues, sort);
      const res = await warehouseApi.backflushRecords.list({
        ...listParams,
        skip: ((params?.current || 1) - 1) * (params?.pageSize || 20),
        limit: params?.pageSize || 20,
      });
      const { data, total } = normalizeWarehouseListResponse(res);
      return { data, total, success: true };
    } catch {
      message.error(t('app.kuaizhizao.warehouseCommon.queryFailed'));
      return { data: [], total: 0, success: false };
    }
  };

  return (
    <ListPageTemplate>
      <UniTable<BackflushRecordItem>
        headerTitle={t('app.kuaizhizao.backflushRecords.headerTitle')}
        actionRef={actionRef}
        columns={alignProColumns(columns, WAREHOUSE_DOC_LIST_FIELD_RANK)}
        columnPersistenceId="apps.kuaizhizao.pages.warehouse-management.backflush-records"
        request={fetchRecords}
        showAdvancedSearch
        pinnedTabsField={WAREHOUSE_DOC_PINNED_STATUS_FIELD}
        skipFuzzyPinyinClientFilter
        rowKey="id"
        search={{ labelWidth: 'auto' }}
        pagination={{ defaultPageSize: 20, showSizeChanger: true }}
        scroll={{ x: 1480 }}
      />

      <DetailDrawerTemplate
        title={`${t('app.kuaizhizao.batchingCenter.detailTitleBackflush')}${detailRecord?.work_order_code ? ` - ${detailRecord.work_order_code}` : ''}`}
        open={detailDrawerVisible}
        loading={detailLoading}
        onClose={() => {
          setDetailDrawerVisible(false);
          setDetailRecord(null);
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        basic={
          detailRecord ? (
            <Descriptions
              column={2}
              size="small"
              items={detailDrawerDescriptionItems(detailColumns, detailRecord)}
            />
          ) : undefined
        }
      />
    </ListPageTemplate>
  );
};

export default BackflushRecordsPage;
