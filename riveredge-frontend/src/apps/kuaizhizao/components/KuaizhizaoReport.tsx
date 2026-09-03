/**
 * 快格智造模块报表唯一壳层（基于 UniReport）
 *
 * 用法：传入 title、reportType、columns、columnPersistenceId；
 * 未提供 request 时自动按 reportType 路由到后端报表 API。
 */
import React, { useCallback, useMemo } from 'react';
import type { ProColumns } from '@ant-design/pro-components';
import { UniReport } from '../../../components/uni-report';
import type { StatCard } from '../../../components/layout-templates';
import {
  fetchKuaizhizaoReport,
  inferDomainFromPersistenceId,
  permissionResourceFromPersistenceId,
  resolveReportRoute,
  type KuaizhizaoReportDomain,
  type KuaizhizaoReportStatCards,
} from '../utils/kuaizhizaoReportCore';

export type KuaizhizaoReportProps<T extends Record<string, unknown> = Record<string, unknown>> = {
  title: string;
  reportType: string;
  columns: ProColumns<T>[];
  /** 必填：列持久化 id，格式 apps.kuaizhizao.pages.{module}.reports.{PageName} */
  columnPersistenceId: string;
  domain?: KuaizhizaoReportDomain;
  permissionResource?: string;
  templateId?: string;
  summaryFields?: string[];
  rowKey?: string | keyof T;
  statCards?: KuaizhizaoReportStatCards;
  children?: React.ReactNode;
  /** 功能区：模糊搜索之前（报表视图切换） */
  beforeSearchButtons?: React.ReactNode;
  /** 并入 ProTable params；变更会重取 */
  params?: Record<string, unknown>;
  /** 期间筛选左侧文案 */
  periodFilterLabel?: React.ReactNode;
  /** keyword 走后端时关闭客户端拼音过滤 */
  skipFuzzyPinyinClientFilter?: boolean;
  /** 完全自定义请求（须走 createKuaizhizaoCustomReportRequest 或等价参数） */
  request?: (
    params: Record<string, unknown>,
    sort?: Record<string, unknown>,
    filter?: Record<string, unknown>,
    searchFormValues?: Record<string, unknown>,
  ) => Promise<{ data: T[]; total: number; success: boolean; summary?: Record<string, number> }>;
};

export function KuaizhizaoReport<T extends Record<string, unknown> = Record<string, unknown>>({
  title,
  reportType,
  columns,
  columnPersistenceId,
  domain: domainProp,
  permissionResource: permissionResourceProp,
  templateId: templateIdProp,
  summaryFields,
  rowKey = 'id',
  statCards,
  children,
  beforeSearchButtons,
  params: paramsProp,
  periodFilterLabel,
  skipFuzzyPinyinClientFilter = true,
  request: requestOverride,
}: KuaizhizaoReportProps<T>) {
  const domainHint = domainProp ?? inferDomainFromPersistenceId(columnPersistenceId);
  const route = useMemo(() => resolveReportRoute(reportType, domainHint), [reportType, domainHint]);
  const permissionResource =
    permissionResourceProp ?? permissionResourceFromPersistenceId(columnPersistenceId);
  const templateId = templateIdProp ?? route.templateId ?? 'queryTable';

  const tableParams = useMemo(
    () => ({ reportType, ...(paramsProp || {}) }),
    [paramsProp, reportType],
  );

  const defaultRequest = useCallback(
    async (
      params: Record<string, unknown>,
      sort?: Record<string, unknown>,
      _filter?: Record<string, unknown>,
      searchFormValues?: Record<string, unknown>,
    ) => {
      return fetchKuaizhizaoReport(reportType, params, searchFormValues, {
        domainHint,
        sort,
      }) as Promise<{ data: T[]; total: number; success: boolean; summary?: Record<string, number> }>;
    },
    [reportType, domainHint],
  );

  const exportDomain = route.api === 'plan' ? 'plans' : route.api;

  return (
    <UniReport<T>
      mode="page"
      title={title}
      templateId={templateId}
      columns={columns}
      columnPersistenceId={columnPersistenceId}
      permissionResource={permissionResource || undefined}
      exportConfig={{ domain: exportDomain, reportType: route.backendType }}
      summaryFields={summaryFields}
      rowKey={rowKey as string}
      statCards={statCards as StatCard[] | ((summary: Record<string, number>) => StatCard[])}
      request={requestOverride ?? defaultRequest}
      skipFuzzyPinyinClientFilter={skipFuzzyPinyinClientFilter}
      beforeSearchButtons={beforeSearchButtons}
      periodFilterLabel={periodFilterLabel}
      params={tableParams}
    >
      {children}
    </UniReport>
  );
}

export default KuaizhizaoReport;
