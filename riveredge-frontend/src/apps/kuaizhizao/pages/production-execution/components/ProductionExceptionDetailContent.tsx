import React, { useMemo } from 'react';
import { Descriptions } from 'antd';
import type { ProDescriptionsItemProps } from '@ant-design/pro-components';
import type { TFunction } from 'i18next';
import {
  detailDrawerDescriptionItems,
} from '../../../../../components/layout-templates';
import { alignDescriptionColumns } from '../../sales-management/shared/documentFieldAlignment';

const P = 'app.kuaizhizao.productionException';
const Q = `${P}.quality`;

export interface MaterialShortageExceptionDetailRecord {
  work_order_id?: number;
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
  [key: string]: unknown;
}

export interface DeliveryDelayExceptionDetailRecord {
  work_order_id?: number;
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
  [key: string]: unknown;
}

export interface QualityExceptionDetailRecord {
  exception_type?: string;
  work_order_id?: number;
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
  [key: string]: unknown;
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
  column = 3,
) {
  const visibleColumns = alignDescriptionColumns(filterVisibleColumns(columns, record));
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
}: {
  record: MaterialShortageExceptionDetailRecord;
  t: TFunction;
}) {
  const columns = useMemo<DetailColumn<MaterialShortageExceptionDetailRecord>[]>(
    () => [
      { title: t(`${P}.col.workOrderCode`), dataIndex: 'work_order_code', showInDescriptions: true },
      { title: t(`${P}.col.materialCode`), dataIndex: 'material_code', showInDescriptions: true },
      { title: t(`${P}.col.materialName`), dataIndex: 'material_name', showInDescriptions: true },
      { title: t(`${P}.field.alternativeMaterial`), dataIndex: 'alternative_material_name' },
      { title: t(`${P}.field.handler`), dataIndex: 'handled_by_name' },
      {
        title: t(`${P}.field.handledAt`),
        dataIndex: 'handled_at',
        valueType: 'dateTime',
      },
    ],
    [t],
  );

  return renderDescriptions(columns, record);
}

export function DeliveryDelayExceptionDetailContent({
  record,
  t,
}: {
  record: DeliveryDelayExceptionDetailRecord;
  t: TFunction;
}) {
  const columns = useMemo<DetailColumn<DeliveryDelayExceptionDetailRecord>[]>(
    () => [
      { title: t(`${P}.col.workOrderCode`), dataIndex: 'work_order_code', showInDescriptions: true },
      { title: t(`${P}.col.delayReason`), dataIndex: 'delay_reason', showInDescriptions: true },
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

  return renderDescriptions(columns, record);
}

export function QualityExceptionDetailBasicContent({
  record,
  t,
}: {
  record: QualityExceptionDetailRecord;
  t: TFunction;
}) {
  const basicColumns = useMemo<DetailColumn<QualityExceptionDetailRecord>[]>(
    () => [
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
    ],
    [t],
  );

  return renderDescriptions(basicColumns, record);
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
      {
        title: t(`${Q}.field.plannedCompletionDate`),
        dataIndex: 'planned_completion_date',
        valueType: 'dateTime',
      },
      {
        title: t(`${Q}.field.actualCompletionDate`),
        dataIndex: 'actual_completion_date',
        valueType: 'dateTime',
      },
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
