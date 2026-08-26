/**
 * 采购到货预警
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { App, Button, Space, Tag } from 'antd';
import { ActionType, ProColumns, ProFormDatePicker, ProFormSelect, ProFormTextArea } from '@ant-design/pro-components';
import dayjs from 'dayjs';
import { rowActionKind, rowActionLabelKeep } from '../../../../../components/uni-action';
import { UniTable } from '../../../../../components/uni-table';
import { MarkerTag, StatusTag } from '../../../../../constants/statusBadges';
import { FormModalTemplate } from '../../../../../components/layout-templates';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { formatDateTime } from '../../../../../utils/format';
import {
  MaterialStackedCell,
  UniTableStackedPrimaryCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { UNI_TABLE_STATUS_BADGE_COLUMN_WIDTH } from '../../../../../utils/uniTableLayoutColumns';
import {
  PURCHASE_ARRIVAL_DELAY_REASONS,
  createPurchaseArrivalDelayReport,
  listPurchaseArrivalWarnings,
  submitPurchaseArrivalDelayReport,
  type PurchaseArrivalWarningRow,
} from '../../../services/purchase-arrival';
import { buildListPageHelpViewConfig } from '../../../../../components/page-help-wiki';
import {
  buildPurchaseArrivalProcessingStatusValueEnum,
  purchaseArrivalProcessingStatusLabel,
  resolvePurchaseArrivalProcessingStatusTagColor,
} from '../../../utils/purchaseArrivalPresentation';

const PURCHASE_ARRIVAL_WARNING_RESOURCE = 'kuaizhizao:purchase-arrival-warning';
const PURCHASE_ARRIVAL_DELAY_RESOURCE = 'kuaizhizao:purchase-arrival-delay';

const WARNING_LEVEL_COLOR: Record<string, 'default' | 'warning' | 'error'> = {
  normal: 'default',
  imminent: 'warning',
  overdue: 'error',
};

const PurchaseArrivalWarningsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const actionRef = useRef<ActionType>();
  const delayPerms = useResourcePermissions(PURCHASE_ARRIVAL_DELAY_RESOURCE);
  const [delayOpen, setDelayOpen] = useState(false);
  const [delayRow, setDelayRow] = useState<PurchaseArrivalWarningRow | null>(null);
  const [summary, setSummary] = useState({ normal: 0, imminent: 0, overdue: 0, total_open_lines: 0 });

  const delayReasonOptions = useMemo(
    () => PURCHASE_ARRIVAL_DELAY_REASONS.map((r) => ({ value: r.value, label: t(r.labelKey) })),
    [t],
  );

  const processingStatusEnum = useMemo(
    () => buildPurchaseArrivalProcessingStatusValueEnum(t),
    [t],
  );

  const processingStatusLabel = useCallback(
    (status?: PurchaseArrivalWarningRow['processing_status']) =>
      purchaseArrivalProcessingStatusLabel(t, status),
    [t],
  );

  const warningLevelEnum = useMemo(
    () => ({
      normal: { text: t('app.kuaizhizao.purchaseArrival.level.normal') },
      imminent: { text: t('app.kuaizhizao.purchaseArrival.level.imminent') },
      overdue: { text: t('app.kuaizhizao.purchaseArrival.level.overdue') },
    }),
    [t],
  );

  const columns: ProColumns<PurchaseArrivalWarningRow>[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.purchaseOrder.col.supplierAndOrder'),
        key: 'order_code',
        dataIndex: 'order_code',
        hideInSearch: true,
        ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
        fixed: 'left',
        render: (_, r) => (
          <UniTableStackedPrimaryCell
            primary={String(r.supplier_name ?? '')}
            secondary={String(r.order_code ?? '')}
            record={r as Record<string, unknown>}
            secondaryKeys={['order_code']}
          />
        ),
      },
      {
        title: t('app.kuaizhizao.purchaseOrder.col.orderCode'),
        dataIndex: 'order_code',
        hideInTable: true,
      },
      {
        title: t('app.kuaizhizao.purchaseOrder.col.supplier'),
        dataIndex: 'supplier_name',
        hideInTable: true,
      },
      {
        title: t('app.kuaizhizao.purchaseOrder.col.materialName'),
        key: 'material_display',
        dataIndex: 'material_name',
        ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
        render: (_, r) => (
          <MaterialStackedCell
            material_name={r.material_name}
            material_code={r.material_code}
            material_spec={r.material_spec}
          />
        ),
      },
      {
        title: t('app.kuaizhizao.purchaseOrder.col.materialCode'),
        dataIndex: 'material_code',
        hideInTable: true,
      },
      {
        title: t('app.kuaizhizao.purchaseArrival.col.requiredDate'),
        dataIndex: 'required_date',
        width: 120,
        render: (_, r) => (r.required_date ? formatDateTime(r.required_date, 'YYYY-MM-DD') : '-'),
      },
      {
        title: t('app.kuaizhizao.purchaseArrival.col.warningLevel'),
        dataIndex: 'warning_level',
        width: 100,
        valueType: 'select',
        valueEnum: warningLevelEnum,
        render: (_, r) => (
          <MarkerTag color={WARNING_LEVEL_COLOR[r.warning_level ?? 'normal'] ?? 'default'}>
            {warningLevelEnum[r.warning_level ?? 'normal']?.text ?? '-'}
          </MarkerTag>
        ),
      },
      {
        title: t('app.kuaizhizao.purchaseArrival.col.dayOffset'),
        dataIndex: 'day_offset',
        width: 100,
        hideInSearch: true,
        render: (_, r) => {
          if (r.warning_level === 'overdue') {
            return t('app.kuaizhizao.purchaseArrival.overdueDays', { days: r.overdue_days ?? 0 });
          }
          if (r.warning_level === 'imminent') {
            return t('app.kuaizhizao.purchaseArrival.remainingDays', { days: r.remaining_days ?? 0 });
          }
          return t('app.kuaizhizao.purchaseArrival.remainingDays', { days: r.remaining_days ?? 0 });
        },
      },
      {
        title: t('app.kuaizhizao.purchaseArrival.col.impactedAssembly'),
        dataIndex: 'impacted_assembly',
        ellipsis: true,
        width: 180,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.purchaseArrival.col.processingStatus'),
        dataIndex: 'processing_status',
        width: UNI_TABLE_STATUS_BADGE_COLUMN_WIDTH,
        uniTableKeepWidth: true,
        fixed: 'right',
        valueType: 'select',
        valueEnum: processingStatusEnum,
        render: (_, record) => (
          <StatusTag color={resolvePurchaseArrivalProcessingStatusTagColor(record.processing_status)}>
            {processingStatusLabel(record.processing_status)}
          </StatusTag>
        ),
      },
      {
        title: t('common.actions'),
        key: 'option',
        fixed: 'right',
        render: (_, record) => [
          delayPerms.canCreate && record.processing_status === 'unprocessed' ? (
            <Button
              key="delay"
              {...rowActionKind('create')}
              {...rowActionLabelKeep()}
              onClick={() => {
                setDelayRow(record);
                setDelayOpen(true);
              }}
            >
              {t('app.kuaizhizao.purchaseArrival.action.reportDelay')}
            </Button>
          ) : null,
          record.purchase_order_change_id ? (
            <Button
              key="change"
              {...rowActionKind('read')}
              {...rowActionLabelKeep()}
              onClick={() => navigate('/apps/kuaizhizao/purchase-management/purchase-order-changes')}
            >
              {t('app.kuaizhizao.purchaseArrival.action.viewChange')}
            </Button>
          ) : null,
        ],
      },
    ],
    [delayPerms.canCreate, navigate, processingStatusEnum, processingStatusLabel, t, warningLevelEnum],
  );

  return (
    <>
      <UniTable<PurchaseArrivalWarningRow>
        actionRef={actionRef}
        rowKey="id"
        columnPersistenceId="apps.kuaizhizao.pages.purchase-management.arrival-warnings-v4"
        viewTypes={['table', 'help']}
          helpViewConfig={buildListPageHelpViewConfig('kuaizhizao.purchaseArrivalWarnings')}
        headerTitle={t('app.kuaizhizao.menu.purchase-management.arrival-warnings')}
        toolBarRender={() => [
          <Space key="summary" wrap>
            <Tag>{t('app.kuaizhizao.purchaseArrival.summary.total', { count: summary.total_open_lines })}</Tag>
            <Tag color="error">{t('app.kuaizhizao.purchaseArrival.summary.overdue', { count: summary.overdue })}</Tag>
            <Tag color="warning">{t('app.kuaizhizao.purchaseArrival.summary.imminent', { count: summary.imminent })}</Tag>
          </Space>,
        ]}
        columns={columns}
        request={async (params, _sort, _filter, searchFormValues) => {
          const sf = { ...(searchFormValues ?? {}), ...(params ?? {}) } as Record<string, unknown>;
          const res = await listPurchaseArrivalWarnings({
            skip: ((params.current ?? 1) - 1) * (params.pageSize ?? 20),
            limit: params.pageSize ?? 20,
            warning_level: sf.warning_level as PurchaseArrivalWarningRow['warning_level'],
            order_code: String(sf.order_code ?? '').trim() || undefined,
            supplier_keyword: String(sf.supplier_name ?? '').trim() || undefined,
            material_keyword: String(sf.material_name ?? '').trim() || undefined,
            processing_status: sf.processing_status as PurchaseArrivalWarningRow['processing_status'],
          });
          setSummary(res.summary ?? summary);
          return { data: res.data ?? [], total: res.total ?? 0, success: true };
        }}
      />

      <FormModalTemplate
        title={t('app.kuaizhizao.purchaseArrival.delayModalTitle')}
        open={delayOpen}
        onOpenChange={setDelayOpen}
        initialValues={{
          estimated_arrival_date: delayRow?.required_date ? dayjs(delayRow.required_date).add(7, 'day') : dayjs().add(7, 'day'),
        }}
        onFinish={async (values) => {
          if (!delayRow?.purchase_order_item_id) return false;
          try {
            const created = await createPurchaseArrivalDelayReport({
              purchase_order_item_id: delayRow.purchase_order_item_id,
              delay_reason: values.delay_reason,
              estimated_arrival_date: dayjs(values.estimated_arrival_date).format('YYYY-MM-DD'),
              impact_description: values.impact_description,
            });
            let submitted = created;
            if (delayPerms.canAction?.('submit')) {
              submitted = await submitPurchaseArrivalDelayReport(created.id);
            }
            if (submitted.purchase_order_change_id) {
              messageApi.success(t('app.kuaizhizao.purchaseArrival.delayChangeGenerated'));
            } else {
              messageApi.success(t('app.kuaizhizao.purchaseArrival.delaySubmitted'));
            }
            setDelayOpen(false);
            actionRef.current?.reload();
            return true;
          } catch (e: any) {
            messageApi.error(e?.message || t('common.operationFailed'));
            return false;
          }
        }}
      >
        {delayRow ? (
          <Space orientation="vertical" style={{ width: '100%', marginBottom: 12 }}>
            <span>
              {delayRow.order_code} / {delayRow.material_name}
            </span>
            {delayRow.impacted_assembly ? (
              <span>
                {t('app.kuaizhizao.purchaseArrival.col.impactedAssembly')}：{delayRow.impacted_assembly}
              </span>
            ) : null}
          </Space>
        ) : null}
        <ProFormSelect
          name="delay_reason"
          label={t('app.kuaizhizao.purchaseArrival.field.delayReason')}
          rules={[{ required: true }]}
          options={delayReasonOptions}
        />
        <ProFormDatePicker
          name="estimated_arrival_date"
          label={t('app.kuaizhizao.purchaseArrival.field.estimatedArrivalDate')}
          rules={[{ required: true }]}
          fieldProps={{ style: { width: '100%' } }}
        />
        <ProFormTextArea
          name="impact_description"
          label={t('app.kuaizhizao.purchaseArrival.field.impactDescription')}
          fieldProps={{ rows: 3 }}
          extra={
            !delayRow?.impacted_assembly
              ? t('app.kuaizhizao.purchaseArrival.impactDescriptionHint')
              : undefined
          }
          rules={
            !delayRow?.impacted_assembly
              ? [{ required: true, message: t('app.kuaizhizao.purchaseArrival.impactDescriptionRequired') }]
              : undefined
          }
        />
      </FormModalTemplate>
    </>
  );
};

export default PurchaseArrivalWarningsPage;
