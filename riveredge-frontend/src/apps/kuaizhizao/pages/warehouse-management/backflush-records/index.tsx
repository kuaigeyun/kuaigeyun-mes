/**
 * 物料倒冲记录页面
 *
 * 查看报工触发的物料倒冲记录，支持按工单、物料、状态筛选，失败记录可重试。
 */

import React, { useMemo, useRef } from 'react';
import type { ProColumns } from '@ant-design/pro-components';
import { App, Button } from 'antd';
import { useTranslation } from 'react-i18next';
import { warehouseApi } from '../../../services/production';
import { UniTable } from '../../../../../components/uni-table';
import {
  MaterialStackedCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { getBackflushRecordLifecycle } from '../../../utils/backflushRecordLifecycle';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { rowActionKind, rowActionLabelKeep } from '../../../../../components/uni-action';

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
}

const BackflushRecordsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message, modal } = App.useApp();
  const actionRef = useRef<any>(null);

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
        valueEnum: {
          pending: { text: t('app.kuaizhizao.warehouseCommon.statusPending') },
          completed: { text: t('app.kuaizhizao.warehouseCommon.statusCompleted') },
          failed: { text: t('app.kuaizhizao.backflushRecords.statusFailed') },
          cancelled: { text: t('app.kuaizhizao.warehouseCommon.statusCancelled') },
        },
      },
      {
        title: t('app.kuaizhizao.warehouseCommon.colLifecycle'),
        dataIndex: 'lifecycle_stage',
        fixed: 'right',
        align: 'left',
        hideInSearch: true,
        render: (_, record) => {
          const lifecycle = getBackflushRecordLifecycle(record as unknown as Record<string, unknown>);
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
        title: t('app.kuaizhizao.backflushRecords.colErrorMessage'),
        dataIndex: 'error_message',
        width: 180,
        ellipsis: true,
        render: (_, record) => record.error_message || '-',
      },
      {
        title: t('app.kuaizhizao.warehouseCommon.colCreatedAt'),
        dataIndex: 'created_at',
        width: 170,
        valueType: 'dateTime',
      },
      {
        title: t('app.kuaizhizao.warehouseCommon.colActions'),
        valueType: 'option',
        width: 90,
        fixed: 'right',
        render: (_, record) =>
          record.status === 'failed' ? (
            <Button {...rowActionKind('execute')} {...rowActionLabelKeep()} onClick={() => handleRetry(record)}>
              {t('app.kuaizhizao.backflushRecords.retry')}
            </Button>
          ) : null,
      },
    ],
    [t]
  );

  const fetchRecords = async (params: any) => {
    try {
      const res = await warehouseApi.backflushRecords.list({
        work_order_code: params?.work_order_code,
        material_code: params?.material_code,
        status: params?.status,
        skip: ((params?.current || 1) - 1) * (params?.pageSize || 20),
        limit: params?.pageSize || 20,
      });
      return {
        data: res?.items || [],
        total: res?.total || 0,
        success: true,
      };
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
        columns={columns}
        columnPersistenceId="apps.kuaizhizao.pages.warehouse-management.backflush-records"
        request={fetchRecords}
        rowKey="id"
        search={{ labelWidth: 'auto' }}
        pagination={{ defaultPageSize: 20, showSizeChanger: true }}
        scroll={{ x: 1480 }}
      />
    </ListPageTemplate>
  );
};

export default BackflushRecordsPage;
