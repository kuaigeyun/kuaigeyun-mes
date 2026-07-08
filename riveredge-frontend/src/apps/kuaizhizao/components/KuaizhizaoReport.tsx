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
import { extractProTableSort } from '../../../utils/tableQueryKey';
import { resolveProductionReportApiParams } from '../utils/productionExecutionReportCore';

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
  dateRangeKeys?: string[];
  rowKey?: string | keyof T;
  statCards?: KuaizhizaoReportStatCards;
  children?: React.ReactNode;
  /** keyword 走后端时关闭客户端拼音过滤 */
  skipFuzzyPinyinClientFilter?: boolean;
  /** 完全自定义请求（覆盖自动路由） */
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
  dateRangeKeys,
  rowKey = 'id',
  statCards,
  children,
  skipFuzzyPinyinClientFilter = true,
  request: requestOverride,
}: KuaizhizaoReportProps<T>) {
  const domainHint = domainProp ?? inferDomainFromPersistenceId(columnPersistenceId);
  const route = useMemo(() => resolveReportRoute(reportType, domainHint), [reportType, domainHint]);
  const permissionResource =
    permissionResourceProp ?? permissionResourceFromPersistenceId(columnPersistenceId);
  const templateId = templateIdProp ?? route.templateId ?? 'queryTable';

  const defaultRequest = useCallback(
    async (
      params: Record<string, unknown>,
      sort?: Record<string, unknown>,
      _filter?: Record<string, unknown>,
      searchFormValues?: Record<string, unknown>,
    ) => {
      const productionParams =
        domainHint === 'production'
          ? resolveProductionReportApiParams(searchFormValues, sort)
          : {};
      const { sortBy, sortOrder } = extractProTableSort(sort ?? {});
      const order_by =
        productionParams.order_by ??
        (sortBy && sortOrder ? (sortOrder === 'desc' ? `-${sortBy}` : sortBy) : undefined);
      return fetchKuaizhizaoReport(reportType, params, searchFormValues, {
        domainHint,
        dateRangeKeys,
        order_by,
        keyword: productionParams.keyword,
        status: productionParams.status,
        order_code: productionParams.order_code,
        product_name: productionParams.product_name,
        supplier_name: productionParams.supplier_name,
        work_order_code: productionParams.work_order_code,
      }) as Promise<{ data: T[]; total: number; success: boolean; summary?: Record<string, number> }>;
    },
    [reportType, domainHint, dateRangeKeys],
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
    >
      {children}
    </UniReport>
  );
}

export default KuaizhizaoReport;
