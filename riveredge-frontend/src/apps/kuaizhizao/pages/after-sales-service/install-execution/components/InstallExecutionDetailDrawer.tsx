/**
 * 安装执行单详情抽屉。
 */

import React, { useMemo } from 'react';
import { Empty, Table } from 'antd';
import { useTranslation } from 'react-i18next';
import type { ProDescriptionsItemProps } from '@ant-design/pro-components';
import { formatDateTimeBySiteSetting } from '../../../../../../utils/format';
import {
  formatInstallCostTotal,
  formatInstallStageLabel,
} from '../../../../components/InstallExecutionFormModal';
import InstallExecutionStageSteps from '../../../../components/InstallExecutionStageSteps';
import LineAttachmentsUpload from '../../../../components/LineAttachmentsUpload';
import type {
  InstallExecution,
  InstallExecutionCost,
  InstallExecutionStage,
  InstallExecutionTask,
} from '../../../../services/install-execution';
import {
  AFTER_SALES_INSTALL_STATUS_COLOR,
  renderAfterSalesStatusTag,
  renderAfterSalesTypeMarker,
} from '../../shared/afterSalesListPresentation';
import { LinkedDocumentCode } from '../../../../../../components/linked-document-code';
import { AfterSalesDocDetailDrawer } from '../../shared/AfterSalesDocDetailDrawer';

const PLACEHOLDER: InstallExecution = {
  id: 0,
  job_code: '',
  customer_id: 0,
  customer_name: '',
  supply_source: '',
  status: '',
};

export type InstallExecutionDetailDrawerProps = {
  open: boolean;
  onClose: () => void;
  record: InstallExecution | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  extra?: React.ReactNode;
  zIndex?: number;
};

export const InstallExecutionDetailDrawer: React.FC<InstallExecutionDetailDrawerProps> = ({
  open,
  onClose,
  record,
  loading,
  error,
  onRetry,
  extra,
  zIndex,
}) => {
  const { t } = useTranslation();

  const columns = useMemo(
    () =>
      [
        { title: t('app.kuaizhizao.installExecution.field.jobCode'), dataIndex: 'job_code' },
        { title: t('app.kuaizhizao.installExecution.field.customerName'), dataIndex: 'customer_name' },
        {
          title: t('app.kuaizhizao.installExecution.field.supplySource'),
          dataIndex: 'supply_source',
          render: (_, row) => renderAfterSalesTypeMarker(row.supply_source),
        },
        { title: t('app.kuaizhizao.installExecution.field.ownerName'), dataIndex: 'owner_name' },
        {
          title: t('app.kuaizhizao.installExecution.field.salesOrder'),
          dataIndex: 'sales_order_code',
          render: (_, row) => (
            <LinkedDocumentCode
              documentType="sales_order"
              documentId={row.sales_order_id}
              code={row.sales_order_code}
            />
          ),
        },
        {
          title: t('app.kuaizhizao.installExecution.field.salesDelivery'),
          dataIndex: 'sales_delivery_code',
          render: (_, row) => (
            <LinkedDocumentCode
              documentType="sales_delivery"
              documentId={row.sales_delivery_id}
              code={row.sales_delivery_code}
            />
          ),
        },
        {
          title: t('app.kuaizhizao.installExecution.field.siteAddress'),
          dataIndex: 'site_address',
          span: 3,
        },
        {
          title: t('app.kuaizhizao.installExecution.field.totalCost'),
          dataIndex: 'total_cost_amount',
          render: (_, row) => formatInstallCostTotal(row.total_cost_amount),
        },
        {
          title: t('app.kuaizhizao.installExecution.field.startedAt'),
          dataIndex: 'started_at',
          valueType: 'dateTime',
        },
        {
          title: t('app.kuaizhizao.installExecution.field.status'),
          dataIndex: 'status',
          render: (_, row) => renderAfterSalesStatusTag(row.status, AFTER_SALES_INSTALL_STATUS_COLOR),
        },
        {
          title: t('app.kuaizhizao.installExecution.field.notes'),
          dataIndex: 'notes',
          span: 3,
        },
      ] as ProDescriptionsItemProps<InstallExecution>[],
    [t],
  );

  const stages = record?.stages ?? [];
  const tasks = record?.tasks ?? [];
  const costs = record?.costs ?? [];
  const code = String(record?.job_code ?? '').trim();
  const title = `${t('app.kuaizhizao.installExecution.detailTitle')}${code ? ` - ${code}` : ''}`;

  return (
    <AfterSalesDocDetailDrawer
      open={open}
      onClose={onClose}
      title={title}
      record={record}
      placeholder={PLACEHOLDER}
      columns={columns}
      loading={loading}
      error={error}
      onRetry={onRetry}
      extra={extra}
      zIndex={zIndex}
      traceDocumentType="install_execution"
      collaborationTitle={t('app.kuaizhizao.installExecution.section.stages')}
      collaboration={
        <>
          <InstallExecutionStageSteps stages={stages} style={{ marginBottom: 12 }} />
          {stages.length > 0 ? (
            <Table<InstallExecutionStage>
              size="small"
              pagination={false}
              rowKey={(row) => String(row.id ?? row.stage_key)}
              dataSource={stages}
              columns={[
                { title: t('app.kuaizhizao.installExecution.stageName'), dataIndex: 'stage_name' },
                { title: t('app.kuaizhizao.installExecution.stageStatus'), dataIndex: 'status' },
                {
                  title: t('app.kuaizhizao.installExecution.stagePlannedAt'),
                  dataIndex: 'planned_at',
                  render: (value) => (value ? formatDateTimeBySiteSetting(String(value)) : '-'),
                },
                {
                  title: t('app.kuaizhizao.installExecution.stageActualAt'),
                  dataIndex: 'actual_at',
                  render: (value) => (value ? formatDateTimeBySiteSetting(String(value)) : '-'),
                },
                { title: t('app.kuaizhizao.installExecution.stageNotes'), dataIndex: 'notes' },
              ]}
            />
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={t('app.kuaizhizao.installExecution.advanceNoStages')}
            />
          )}
        </>
      }
      linesTitle={t('app.kuaizhizao.installExecution.tasksSection')}
      lines={
        tasks.length > 0 ? (
          <Table<InstallExecutionTask>
            size="small"
            pagination={false}
            rowKey={(row) => String(row.id ?? `${row.stage_key}-${row.task_title}`)}
            dataSource={tasks}
            columns={[
              { title: t('app.kuaizhizao.installExecution.taskTitle'), dataIndex: 'task_title' },
              {
                title: t('app.kuaizhizao.installExecution.taskStage'),
                dataIndex: 'stage_name',
                render: (_, row) => formatInstallStageLabel(row.stage_key, row.stage_name ?? undefined),
              },
              { title: t('app.kuaizhizao.installExecution.taskExecutor'), dataIndex: 'executor_name' },
              { title: t('app.kuaizhizao.installExecution.taskStatus'), dataIndex: 'status' },
              {
                title: t('app.kuaizhizao.installExecution.taskPlannedAt'),
                dataIndex: 'planned_at',
                render: (value) => (value ? formatDateTimeBySiteSetting(String(value)) : '-'),
              },
              {
                title: t('app.kuaizhizao.installExecution.taskActualAt'),
                dataIndex: 'actual_at',
                render: (value) => (value ? formatDateTimeBySiteSetting(String(value)) : '-'),
              },
              {
                title: t('app.kuaizhizao.installExecution.taskPhotos'),
                dataIndex: 'attachments',
                render: (_, row) => (
                  <LineAttachmentsUpload
                    value={row.attachments}
                    category="install_execution_task_attachments"
                    readOnly
                  />
                ),
              },
              { title: t('app.kuaizhizao.installExecution.taskNotes'), dataIndex: 'notes' },
            ]}
          />
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={t('app.kuaizhizao.afterSalesService.common.itemsEmpty')}
          />
        )
      }
      supplementaryTitle={t('app.kuaizhizao.installExecution.section.costs')}
      supplementary={
        costs.length > 0 ? (
          <Table<InstallExecutionCost>
            size="small"
            pagination={false}
            rowKey={(row) => String(row.id ?? `${row.cost_type}-${row.occurred_at}`)}
            dataSource={costs}
            columns={[
              { title: t('app.kuaizhizao.installExecution.costType'), dataIndex: 'cost_type' },
              {
                title: t('app.kuaizhizao.installExecution.costAmount'),
                dataIndex: 'amount',
                align: 'right',
                render: (value) => formatInstallCostTotal(value as string | number),
              },
              {
                title: t('app.kuaizhizao.installExecution.costOccurredAt'),
                dataIndex: 'occurred_at',
                render: (value) => (value ? formatDateTimeBySiteSetting(String(value)) : '-'),
              },
              { title: t('app.kuaizhizao.installExecution.costDescription'), dataIndex: 'description' },
            ]}
          />
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={t('app.kuaizhizao.afterSalesService.common.itemsEmpty')}
          />
        )
      }
    />
  );
};
