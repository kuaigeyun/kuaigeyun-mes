import type { TFunction } from 'i18next';
import type { ProColumns } from '@ant-design/pro-components';
import { extractProTableSort } from '../../../utils/tableQueryKey';
import { parseSalesReportDateRange } from '../../kuaizhizao/services/reports';
import { formatDateTime } from '../../../utils/format';
import { formDateRangeFormItemProps } from '../../../utils/formDate';
import { resolveRdProjectListLifecycleParams } from './rdProjectLifecycle';

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

export function plmCreatedUpdatedColumns<
  T extends { created_at?: string; updated_at?: string },
>(t: TFunction): ProColumns<T>[] {
  return [
    {
      title: t('app.kuaiplm.common.columns.createdAt'),
      dataIndex: 'created_at',
      width: 132,
      uniTableKeepWidth: true,
      sorter: true,
      hideInSearch: true,
      render: (_, row) => (row.created_at ? formatDateTime(row.created_at, 'YYYY-MM-DD HH:mm') : '-'),
    },
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
      dataIndex: 'updated_at',
      width: 132,
      uniTableKeepWidth: true,
      sorter: true,
      hideInSearch: true,
      render: (_, row) => (row.updated_at ? formatDateTime(row.updated_at, 'YYYY-MM-DD HH:mm') : '-'),
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
