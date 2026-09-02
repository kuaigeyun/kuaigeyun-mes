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
import { DetailDrawerTemplate, ListPageTemplate,   useDetailDrawerDescriptionItems, detailDrawerBasicColumn, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { rowActionKind, rowActionLabelKeep } from '../../../../../components/uni-action';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import { alignDescriptionColumns, alignProColumns } from '../../sales-management/shared/documentFieldAlignment';
import { WAREHOUSE_DOC_LIST_FIELD_RANK } from '../shared/warehouseDocListFieldRank';
import { formatQuantity } from '../../../../../utils/format';
import { buildListPageHelpViewConfig } from '../../../../../components/page-help-wiki';
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
        width: 160,
        minWidth: 160,
        uniTableKeepWidth: true,
        resizable: false,
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
        minWidth: 100,
        uniTableKeepWidth: true,
        resizable: false,
        render: (_, record) => record.batch_no || '-',
      },
      {
        title: t('app.kuaizhizao.backflushRecords.colOutboundWarehouse'),
        dataIndex: 'warehouse_name',
        width: 140,
        minWidth: 140,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
        render: (_, record) => record.warehouse_name || '-',
      },
      {
        title: t('app.kuaizhizao.backflushRecords.colReportQty'),
        dataIndex: 'report_quantity',
        width: 90,
        minWidth: 90,
        uniTableKeepWidth: true,
        resizable: false,
        valueType: 'digit',
        render: (_, r) => formatQuantity(r.report_quantity),
      },
      {
        title: t('app.kuaizhizao.backflushRecords.colBomQty'),
        dataIndex: 'bom_quantity',
        width: 90,
        minWidth: 90,
        uniTableKeepWidth: true,
        resizable: false,
        valueType: 'digit',
        render: (_, r) => formatQuantity(r.bom_quantity),
      },
      {
        title: t('app.kuaizhizao.backflushRecords.colBackflushQty'),
        dataIndex: 'backflush_quantity',
        width: 110,
        minWidth: 110,
        uniTableKeepWidth: true,
        resizable: false,
        valueType: 'digit',
        render: (_, record) =>
          `${formatQuantity(record.backflush_quantity)} ${record.material_unit || ''}`.trim(),
      },
      {
        title: t('common.status'),
        dataIndex: 'status',
        hideInTable: true,
        valueEnum: buildBackflushRecordStatusValueEnum(t),
      },
      {
        title: t('app.kuaizhizao.backflushRecords.colErrorMessage'),
        dataIndex: 'error_message',
        minWidth: 200,
        uniTableRemainderFlex: true,
        uniTablePrimaryFlex: true,
        resizable: false,
        ellipsis: true,
        render: (_, record) => record.error_message || '-',
      },
      ...buildDocumentAuditColumns<BackflushRecordItem>(t),
      {
        title: t('common.actions'),
        key: 'option',
        fixed: 'right',
        hideInSearch: true,
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
          return actions;
        },
      },
    ],
    [t, statusValueEnum]
  );

  const detailColumns = useMemo(
    () => alignDescriptionColumns([
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
        title: t('common.status'),
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
      { title: t('app.kuaizhizao.backflushRecords.colErrorMessage'), dataIndex: 'error_message', span: 3, render: (_, r) => r.error_message || '-' },
      { title: t('app.kuaizhizao.warehouseCommon.colProcessedBy'), dataIndex: 'processed_by_name', render: (_, r) => r.processed_by_name || '-' },
      { title: t('common.createdAt'), dataIndex: 'created_at', valueType: 'dateTime' },
      { title: t('common.updatedAt'), dataIndex: 'updated_at', valueType: 'dateTime' },
    ]),
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

  const timeconfigBasicItems = useDetailDrawerDescriptionItems(
    detailColumns, detailRecord
  );

  return (
    <ListPageTemplate>
      <UniTable<BackflushRecordItem>
        viewTypes={['table', 'help']}
          helpViewConfig={buildListPageHelpViewConfig('kuaizhizao.backflushRecords')}
        headerTitle={t('app.kuaizhizao.backflushRecords.headerTitle')}
        actionRef={actionRef}
        columns={alignProColumns(columns, WAREHOUSE_DOC_LIST_FIELD_RANK)}
        columnPersistenceId="apps.kuaizhizao.pages.warehouse-management.backflush-records-width-v3"
        request={fetchRecords}
        showAdvancedSearch
        pinnedTabsField={WAREHOUSE_DOC_PINNED_STATUS_FIELD}
        skipFuzzyPinyinClientFilter
        rowKey="id"
        search={{ labelWidth: 'auto' }}
        pagination={{ defaultPageSize: 20, showSizeChanger: true }}
      />

      <DetailDrawerTemplate
        title={`${t('app.kuaizhizao.batchingCenter.detailTitleBackflush')}${detailRecord?.work_order_code ? ` - ${detailRecord.work_order_code}` : ''}`}
        open={detailDrawerVisible}
        loading={detailLoading}
        onClose={() => {
          setDetailDrawerVisible(false);
          setDetailRecord(null);
        }}
        size={DRAWER_CONFIG.HALF_WIDTH}
        basic={
          detailRecord ? (
            <Descriptions
              column={detailDrawerBasicColumn(false)}
              size="small"
              items={timeconfigBasicItems}
            />
          ) : undefined
        }
      />
    </ListPageTemplate>
  );
};

export default BackflushRecordsPage;
