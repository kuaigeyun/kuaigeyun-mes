import type { TFunction } from 'i18next';
import type { ProColumns } from '@ant-design/pro-components';
import React from 'react';
import { extractProTableSort } from '../../../utils/tableQueryKey';
import { parseSalesReportDateRange } from '../../kuaizhizao/services/reports';
import { formatDateTime } from '../../../utils/format';
import { formDateRangeFormItemProps } from '../../../utils/formDate';
import { resolveRdProjectListLifecycleParams } from './rdProjectLifecycle';
import {
  UniTableStackedPrimaryCell,
  UNI_TABLE_STACKED_AUDIT_COLUMN_DEFAULTS,
} from '../../../components/uni-table/stackedPrimaryColumn';

export const PLM_PHASE2_PINNED_STATUS_FIELD = 'status';
export const PLM_CHANGE_PINNED_STATUS_FIELD = 'status';

function pickString(search: Record<string, unknown> | null | undefined, key: string) {
  const v = search?.[key];
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function resolvePlmSort(sort?: Record<string, unknown>) {
  const { sortBy, sortOrder } = extractProTableSort(sort ?? {});
  if (!sortBy || !sortOrder) {
    return { sort_field: undefined, sort_order: undefined };
  }
  return {
    sort_field: sortBy,
    sort_order: sortOrder === 'desc' ? 'desc' : 'asc',
  };
}

function resolvePlmDateParams(searchFormValues?: Record<string, unknown> | null) {
  const s = searchFormValues ?? {};
  const { date_start: created_start_date, date_end: created_end_date } = parseSalesReportDateRange(s, [
    'created_at_range',
    'createdAtRange',
  ]);
  const { date_start: updated_start_date, date_end: updated_end_date } = parseSalesReportDateRange(s, [
    'updated_at_range',
    'updatedAtRange',
  ]);
  return { created_start_date, created_end_date, updated_start_date, updated_end_date };
}

function resolvePlmOperatorName(record: Record<string, unknown>, key: 'created' | 'updated'): string {
  const candidates =
    key === 'created'
      ? ['created_by_name', 'creator_name', 'created_user_name', 'createdByName', 'creatorName', 'author_name']
      : ['updated_by_name', 'updater_name', 'updated_user_name', 'updatedByName', 'updaterName'];
  for (const candidate of candidates) {
    const value = String(record[candidate] ?? '').trim();
    if (value) return value;
  }
  return '-';
}

function resolvePlmAuditTime(record: Record<string, unknown>, key: 'created' | 'updated'): string {
  const value =
    key === 'created'
      ? (record.created_at ?? record.createdAt)
      : (record.updated_at ?? record.updatedAt);
  if (!value) return '-';
  return formatDateTime(value as string | Date, 'YYYY-MM-DD HH:mm');
}

export function resolvePlmPreferredAudit(record: Record<string, unknown>): { operator: string; time: string } {
  const updatedOperator = resolvePlmOperatorName(record, 'updated');
  const updatedTime = resolvePlmAuditTime(record, 'updated');
  if (updatedOperator !== '-' && updatedTime !== '-') {
    return { operator: updatedOperator, time: updatedTime };
  }
  const createdOperator = resolvePlmOperatorName(record, 'created');
  const createdTime = resolvePlmAuditTime(record, 'created');
  if (createdOperator !== '-' && createdTime !== '-') {
    return { operator: createdOperator, time: createdTime };
  }
  if (updatedTime !== '-') {
    return { operator: updatedOperator, time: updatedTime };
  }
  return { operator: createdOperator, time: createdTime };
}

export function plmCodeTitleSearchColumns(options: {
  codeLabel: string;
  titleLabel: string;
  codeField: string;
  titleField: string;
  orders?: { code?: number; title?: number };
}): ProColumns[] {
  return [
    {
      title: options.codeLabel,
      dataIndex: options.codeField,
      hideInTable: true,
      order: options.orders?.code ?? 10,
      fieldProps: { allowClear: true },
    },
    {
      title: options.titleLabel,
      dataIndex: options.titleField,
      hideInTable: true,
      order: options.orders?.title ?? 11,
      fieldProps: { allowClear: true },
    },
  ];
}

/** 统一审计列：表内仅一列「更新时间」（操作人 + 时间堆叠）；搜索区保留创建/更新日期范围。 */
export function plmCreatedUpdatedColumns<T extends object>(t: TFunction): ProColumns<T>[] {
  return [
    {
      title: t('app.kuaiplm.common.columns.updatedAt'),
      dataIndex: 'updated_at',
      ...UNI_TABLE_STACKED_AUDIT_COLUMN_DEFAULTS,
      sorter: true,
      render: (_, row) => {
        const preferred = resolvePlmPreferredAudit(row as Record<string, unknown>);
        return React.createElement(UniTableStackedPrimaryCell, {
          primary: preferred.operator,
          secondary: preferred.time,
          secondaryCopyable: false,
          primaryBold: false,
        });
      },
    } as ProColumns<T>,
    {
      title: t('app.kuaiplm.common.columns.createdAt'),
      dataIndex: 'created_at_range',
      valueType: 'dateRange',
      hideInTable: true,
      order: 30,
      formItemProps: formDateRangeFormItemProps,
    },
    {
      title: t('app.kuaiplm.common.columns.updatedAt'),
      dataIndex: 'updated_at_range',
      valueType: 'dateRange',
      hideInTable: true,
      order: 31,
      formItemProps: formDateRangeFormItemProps,
    },
  ];
}

export function resolveRdProjectListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
  params?: Record<string, unknown> | null,
): Record<string, string | number | boolean | undefined> {
  const s = searchFormValues ?? {};
  const fuzzyKeyword = pickString(s, 'keyword');
  const { sort_field, sort_order } = resolvePlmSort(sort);
  const lifecycleParams = resolveRdProjectListLifecycleParams(searchFormValues, params);
  const dates = resolvePlmDateParams(s);

  const listParams: Record<string, string | number | boolean | undefined> = {
    sort_field,
    sort_order,
    project_type: pickString(s, 'project_type') ?? pickString(params ?? {}, 'project_type'),
    ...lifecycleParams,
    ...dates,
  };

  if (fuzzyKeyword) {
    listParams.keyword = fuzzyKeyword;
  } else {
    const projectCode = pickString(s, 'project_code');
    const projectName = pickString(s, 'project_name');
    if (projectCode) listParams.project_code = projectCode;
    if (projectName) listParams.project_name = projectName;
  }

  return listParams;
}

export function resolvePhase2RequirementListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
  options?: { projectId?: number },
): Record<string, string | number | boolean | undefined> {
  const s = searchFormValues ?? {};
  const fuzzyKeyword = pickString(s, 'keyword');
  const { sort_field, sort_order } = resolvePlmSort(sort);

  const listParams: Record<string, string | number | boolean | undefined> = {
    sort_field,
    sort_order,
    status: pickString(s, 'status'),
    priority: pickString(s, 'priority'),
    project_id: options?.projectId,
    ...resolvePlmDateParams(s),
  };

  if (fuzzyKeyword) {
    listParams.keyword = fuzzyKeyword;
  } else {
    const requirementCode = pickString(s, 'requirement_code');
    const title = pickString(s, 'title');
    if (requirementCode) listParams.requirement_code = requirementCode;
    if (title) listParams.title = title;
  }

  return listParams;
}

export function resolvePhase2DesignReviewListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
  options?: { projectId?: number },
): Record<string, string | number | boolean | undefined> {
  const s = searchFormValues ?? {};
  const fuzzyKeyword = pickString(s, 'keyword');
  const { sort_field, sort_order } = resolvePlmSort(sort);

  const listParams: Record<string, string | number | boolean | undefined> = {
    sort_field,
    sort_order,
    status: pickString(s, 'status'),
    project_id: options?.projectId,
    ...resolvePlmDateParams(s),
  };

  if (fuzzyKeyword) {
    listParams.keyword = fuzzyKeyword;
  } else {
    const reviewCode = pickString(s, 'review_code');
    const title = pickString(s, 'title');
    if (reviewCode) listParams.review_code = reviewCode;
    if (title) listParams.title = title;
  }

  return listParams;
}

export function resolvePhase2FmeaListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
  options?: { projectId?: number },
): Record<string, string | number | boolean | undefined> {
  const s = searchFormValues ?? {};
  const fuzzyKeyword = pickString(s, 'keyword');
  const { sort_field, sort_order } = resolvePlmSort(sort);

  const listParams: Record<string, string | number | boolean | undefined> = {
    sort_field,
    sort_order,
    status: pickString(s, 'status'),
    fmea_type: pickString(s, 'fmea_type'),
    project_id: options?.projectId,
    ...resolvePlmDateParams(s),
  };

  if (fuzzyKeyword) {
    listParams.keyword = fuzzyKeyword;
  } else {
    const fmeaCode = pickString(s, 'fmea_code');
    const title = pickString(s, 'title');
    if (fmeaCode) listParams.fmea_code = fmeaCode;
    if (title) listParams.title = title;
  }

  return listParams;
}

export function resolveChangeDeskListParams(
  searchFormValues?: Record<string, unknown> | null,
): Record<string, string | number | boolean | undefined> {
  const s = searchFormValues ?? {};
  const fuzzyKeyword = pickString(s, 'keyword');

  const listParams: Record<string, string | number | boolean | undefined> = {
    status: pickString(s, 'status'),
    ...resolvePlmDateParams(s),
  };

  if (fuzzyKeyword) {
    listParams.keyword = fuzzyKeyword;
  } else {
    const changeCode = pickString(s, 'change_code');
    const targetName = pickString(s, 'target_name');
    if (changeCode) listParams.change_code = changeCode;
    if (targetName) listParams.target_name = targetName;
  }

  return listParams;
}

/** 列表操作列：key=action 参与 GLOBAL_DOC_LIST_FIELD_RANK 排序，固定右侧。 */
export function plmListActionColumn<T extends object>(
  t: TFunction,
  render: ProColumns<T>['render'],
  width = 180,
): ProColumns<T> {
  return {
    title: t('common.actions'),
    key: 'action',
    valueType: 'option',
    width,
    fixed: 'right',
    hideInSearch: true,
    render,
  };
}

export function changeDeskSearchColumns(labels: {
  changeCode: string;
  targetName: string;
}): ProColumns[] {
  return [
    {
      title: labels.changeCode,
      dataIndex: 'change_code',
      hideInTable: true,
      order: 10,
      fieldProps: { allowClear: true },
    },
    {
      title: labels.targetName,
      dataIndex: 'target_name',
      hideInTable: true,
      order: 11,
      fieldProps: { allowClear: true },
    },
  ];
}
