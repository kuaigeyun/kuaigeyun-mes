import React, { useMemo } from 'react';
import { Button, Descriptions, Space, Tag } from 'antd';
import type { ProDescriptionsItemProps } from '@ant-design/pro-components';
import type { TFunction } from 'i18next';
import type { NavigateFunction } from 'react-router-dom';
import {
  detailDrawerDescriptionItems,
} from '../../../../../components/layout-templates';
import { StatusTag } from '../../../../../constants/statusBadges';
import { formatDateTime } from '../../../../../utils/format';
import {
  resolveQualityExceptionStatusTagColor,
  resolveStandardProductionExceptionStatusTagColor,
} from '../../../utils/productionExceptionList';
import { buildInspectionDetailPath } from '../../quality-management/components/inspectionTemplateUtils';

const P = 'app.kuaizhizao.productionException';
const Q = `${P}.quality`;

export interface MaterialShortageExceptionDetailRecord {
  work_order_code?: string;
  material_code?: string;
  material_name?: string;
  required_quantity?: number;
  available_quantity?: number;
  shortage_quantity?: number;
  alert_level?: string;
  status?: string;
  suggested_action?: string;
  alternative_material_name?: string;
  handled_by_name?: string;
  handled_at?: string;
}

export interface DeliveryDelayExceptionDetailRecord {
  work_order_code?: string;
  planned_end_date?: string;
  actual_end_date?: string;
  delay_days?: number;
  delay_reason?: string;
  alert_level?: string;
  status?: string;
  suggested_action?: string;
  handled_by_name?: string;
  handled_at?: string;
  remarks?: string;
}

export interface QualityExceptionDetailRecord {
  exception_type?: string;
  work_order_code?: string;
  material_code?: string;
  material_name?: string;
  batch_no?: string;
  inspection_record_id?: number;
  inspection_source_type?: string;
  problem_description?: string;
  severity?: string;
  status?: string;
  root_cause?: string;
  corrective_action?: string;
  preventive_action?: string;
  responsible_person_name?: string;
  planned_completion_date?: string;
  actual_completion_date?: string;
  verification_result?: string;
  handled_by_name?: string;
  handled_at?: string;
  remarks?: string;
}

type LabelFns = {
  alertLevelLabel: (level?: string) => string;
  statusLabel: (status?: string) => string;
  suggestedActionLabel: (action?: string) => string;
};

type QualityLabelFns = LabelFns & {
  exceptionTypeLabel: (type?: string) => string;
  severityLabel: (severity?: string) => string;
};

function alertLevelTagColor(level?: string): string {
  if (level === 'critical') return 'red';
  if (level === 'high') return 'orange';
  if (level === 'medium') return 'gold';
  return 'default';
}

function severityTagColor(severity?: string): string {
  if (severity === 'critical') return 'red';
  if (severity === 'major') return 'orange';
  return 'default';
}

type DetailColumn<T extends Record<string, unknown>> = ProDescriptionsItemProps<T> & {
  hideInDescriptions?: boolean;
  showInDescriptions?: boolean;
};

function filterVisibleColumns<T extends Record<string, unknown>>(
  columns: DetailColumn<T>[],
  record: T,
): DetailColumn<T>[] {
  return columns.filter((col) => {
    if (col.hideInDescriptions) return false;
    if (col.showInDescriptions === true) return true;
    const dataIndex = col.dataIndex;
    const key = typeof dataIndex === 'string' ? dataIndex : undefined;
    if (!key) return true;
    const value = record[key];
    if (value == null) return false;
    if (typeof value === 'string') return value.trim() !== '';
    return true;
  });
}

function renderDescriptions<T extends Record<string, unknown>>(
  columns: DetailColumn<T>[],
  record: T,
  column = 2,
) {
  const visibleColumns = filterVisibleColumns(columns, record);
  return (
    <Descriptions
      column={column}
      size="small"
      items={detailDrawerDescriptionItems(visibleColumns, record)}
    />
  );
}

export function MaterialShortageExceptionDetailContent({
  record,
  t,
  alertLevelLabel,
  statusLabel,
  suggestedActionLabel,
}: {
  record: MaterialShortageExceptionDetailRecord;
  t: TFunction;
} & LabelFns) {
  const columns = useMemo<DetailColumn<MaterialShortageExceptionDetailRecord>[]>(
    () => [
      { title: t(`${P}.col.workOrderCode`), dataIndex: 'work_order_code', showInDescriptions: true },
      { title: t(`${P}.col.materialCode`), dataIndex: 'material_code', showInDescriptions: true },
      { title: t(`${P}.col.materialName`), dataIndex: 'material_name', showInDescriptions: true },
      { title: t(`${P}.col.requiredQty`), dataIndex: 'required_quantity', showInDescriptions: true },
      { title: t(`${P}.col.availableQty`), dataIndex: 'available_quantity', showInDescriptions: true },
      {
        title: t(`${P}.col.shortageQty`),
        dataIndex: 'shortage_quantity',
        showInDescriptions: true,
        render: (_, row) => (
          <span style={{ color: '#ff4d4f', fontWeight: 600 }}>{row.shortage_quantity ?? '-'}</span>
        ),
      },
      {
        title: t(`${P}.col.alertLevel`),
        dataIndex: 'alert_level',
        showInDescriptions: true,
        render: (_, row) => (
          <Tag color={alertLevelTagColor(row.alert_level)}>{alertLevelLabel(row.alert_level)}</Tag>
        ),
      },
      {
        title: t(`${P}.col.status`),
        dataIndex: 'status',
        showInDescriptions: true,
        render: (_, row) => (
          <StatusTag color={resolveStandardProductionExceptionStatusTagColor(row.status)}>
            {statusLabel(row.status)}
          </StatusTag>
        ),
      },
      {
        title: t(`${P}.col.suggestedAction`),
        dataIndex: 'suggested_action',
        showInDescriptions: true,
        render: (_, row) => suggestedActionLabel(row.suggested_action),
      },
      { title: t(`${P}.field.alternativeMaterial`), dataIndex: 'alternative_material_name' },
      { title: t(`${P}.field.handler`), dataIndex: 'handled_by_name' },
      {
        title: t(`${P}.field.handledAt`),
        dataIndex: 'handled_at',
        valueType: 'dateTime',
      },
    ],
    [alertLevelLabel, statusLabel, suggestedActionLabel, t],
  );

  return renderDescriptions(columns, record);
}

export function DeliveryDelayExceptionDetailContent({
  record,
  t,
  alertLevelLabel,
  statusLabel,
  suggestedActionLabel,
}: {
  record: DeliveryDelayExceptionDetailRecord;
  t: TFunction;
} & LabelFns) {
  const columns = useMemo<DetailColumn<DeliveryDelayExceptionDetailRecord>[]>(
    () => [
      { title: t(`${P}.col.workOrderCode`), dataIndex: 'work_order_code', showInDescriptions: true },
      {
        title: t(`${P}.col.plannedEndDate`),
        dataIndex: 'planned_end_date',
        showInDescriptions: true,
        render: (_, row) =>
          row.planned_end_date ? formatDateTime(row.planned_end_date, 'YYYY-MM-DD HH:mm') : '-',
      },
      {
        title: t(`${P}.field.actualEndDate`),
        dataIndex: 'actual_end_date',
        render: (_, row) =>
          row.actual_end_date ? formatDateTime(row.actual_end_date, 'YYYY-MM-DD HH:mm') : '-',
      },
      {
        title: t(`${P}.col.delayDays`),
        dataIndex: 'delay_days',
        showInDescriptions: true,
        render: (_, row) => (
          <span style={{ color: '#ff4d4f', fontWeight: 600 }}>
            {t(`${P}.label.daysUnit`, { count: row.delay_days ?? 0 })}
          </span>
        ),
      },
      { title: t(`${P}.col.delayReason`), dataIndex: 'delay_reason', showInDescriptions: true },
      {
        title: t(`${P}.col.alertLevel`),
        dataIndex: 'alert_level',
        showInDescriptions: true,
        render: (_, row) => (
          <Tag color={alertLevelTagColor(row.alert_level)}>{alertLevelLabel(row.alert_level)}</Tag>
        ),
      },
      {
        title: t(`${P}.col.status`),
        dataIndex: 'status',
        showInDescriptions: true,
        render: (_, row) => (
          <StatusTag color={resolveStandardProductionExceptionStatusTagColor(row.status)}>
            {statusLabel(row.status)}
          </StatusTag>
        ),
      },
      {
        title: t(`${P}.col.suggestedAction`),
        dataIndex: 'suggested_action',
        showInDescriptions: true,
        render: (_, row) => suggestedActionLabel(row.suggested_action),
      },
      { title: t(`${P}.field.handler`), dataIndex: 'handled_by_name' },
      {
        title: t(`${P}.field.handledAt`),
        dataIndex: 'handled_at',
        valueType: 'dateTime',
      },
      { title: t(`${P}.field.remarks`), dataIndex: 'remarks', span: 2 },
    ],
    [alertLevelLabel, statusLabel, suggestedActionLabel, t],
  );

  return renderDescriptions(columns, record);
}

export function QualityExceptionDetailBasicContent({
  record,
  t,
  exceptionTypeLabel,
  severityLabel,
  statusLabel,
  navigate,
  onCloseDrawer,
}: {
  record: QualityExceptionDetailRecord;
  t: TFunction;
  navigate: NavigateFunction;
  onCloseDrawer: () => void;
} & Pick<QualityLabelFns, 'exceptionTypeLabel' | 'severityLabel' | 'statusLabel'>) {
  const basicColumns = useMemo<DetailColumn<QualityExceptionDetailRecord>[]>(
    () => [
      {
        title: t(`${P}.col.exceptionType`),
        dataIndex: 'exception_type',
        showInDescriptions: true,
        render: (_, row) => exceptionTypeLabel(row.exception_type),
      },
      { title: t(`${P}.col.workOrderCode`), dataIndex: 'work_order_code', showInDescriptions: true },
      { title: t(`${P}.col.materialCode`), dataIndex: 'material_code', showInDescriptions: true },
      { title: t(`${P}.col.materialName`), dataIndex: 'material_name', showInDescriptions: true },
      { title: t(`${P}.col.batchNo`), dataIndex: 'batch_no' },
      {
        title: t(`${Q}.col.problemDescription`),
        dataIndex: 'problem_description',
        showInDescriptions: true,
        span: 2,
      },
      {
        title: t(`${Q}.col.severity`),
        dataIndex: 'severity',
        showInDescriptions: true,
        render: (_, row) => (
          <Tag color={severityTagColor(row.severity)}>{severityLabel(row.severity)}</Tag>
        ),
      },
      {
        title: t(`${P}.col.status`),
        dataIndex: 'status',
        showInDescriptions: true,
        render: (_, row) => (
          <StatusTag color={resolveQualityExceptionStatusTagColor(row.status)}>
            {statusLabel(row.status)}
          </StatusTag>
        ),
      },
    ],
    [exceptionTypeLabel, severityLabel, statusLabel, t],
  );

  return (
    <>
      {renderDescriptions(basicColumns, record)}
      {record.inspection_record_id ? (
        <Space wrap style={{ marginTop: 16 }}>
          <Button
            type="link"
            size="small"
            style={{ paddingInline: 0 }}
            onClick={() => {
              const path = buildInspectionDetailPath(
                record.inspection_source_type,
                record.inspection_record_id,
              );
              if (path) {
                onCloseDrawer();
                navigate(path);
              }
            }}
          >
            {t(`${Q}.action.viewSourceInspection`)}
          </Button>
          <Button
            type="link"
            size="small"
            style={{ paddingInline: 0 }}
            onClick={() => {
              onCloseDrawer();
              const q = new URLSearchParams();
              if (record.inspection_source_type === 'incoming_inspection') {
                q.set('incoming_inspection_id', String(record.inspection_record_id));
              } else if (record.inspection_source_type === 'process_inspection') {
                q.set('process_inspection_id', String(record.inspection_record_id));
              } else if (record.inspection_source_type === 'finished_goods_inspection') {
                q.set('finished_goods_inspection_id', String(record.inspection_record_id));
              }
              navigate(`/apps/kuaizhizao/quality-management/nonconforming-ledger?${q.toString()}`);
            }}
          >
            {t(`${Q}.action.viewNonconformingLedger`)}
          </Button>
        </Space>
      ) : null}
    </>
  );
}

export function QualityExceptionDetailHandlingContent({
  record,
  t,
}: {
  record: QualityExceptionDetailRecord;
  t: TFunction;
}) {
  const handlingColumns = useMemo<DetailColumn<QualityExceptionDetailRecord>[]>(
    () => [
      { title: t(`${Q}.field.rootCause`), dataIndex: 'root_cause', span: 2 },
      { title: t(`${Q}.field.correctiveAction`), dataIndex: 'corrective_action', span: 2 },
      { title: t(`${Q}.field.preventiveAction`), dataIndex: 'preventive_action', span: 2 },
      { title: t(`${P}.col.responsiblePerson`), dataIndex: 'responsible_person_name' },
      { title: t(`${Q}.field.plannedCompletionDate`), dataIndex: 'planned_completion_date' },
      { title: t(`${Q}.field.actualCompletionDate`), dataIndex: 'actual_completion_date' },
      { title: t(`${Q}.field.verificationResult`), dataIndex: 'verification_result', span: 2 },
      { title: t(`${P}.field.handler`), dataIndex: 'handled_by_name' },
      {
        title: t(`${P}.field.handledAt`),
        dataIndex: 'handled_at',
        valueType: 'dateTime',
      },
      { title: t(`${P}.field.remarks`), dataIndex: 'remarks', span: 2 },
    ],
    [t],
  );

  if (filterVisibleColumns(handlingColumns, record).length === 0) {
    return null;
  }

  return renderDescriptions(handlingColumns, record);
}

export function hasQualityExceptionHandlingInfo(record: QualityExceptionDetailRecord): boolean {
  return Boolean(
    record.root_cause
    || record.corrective_action
    || record.preventive_action
    || record.responsible_person_name
    || record.planned_completion_date
    || record.actual_completion_date
    || record.verification_result
    || record.handled_by_name
    || record.handled_at
    || record.remarks,
  );
}
