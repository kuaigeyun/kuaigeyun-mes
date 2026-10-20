/**
 * P5-13b：@ant-design/charts 组件懒加载，避免业务页静态绑 charts chunk。
 * 加载失败时局部降级，勿把整页打进根 ErrorBoundary。
 */
import React, { Suspense, type ComponentType, type ReactNode } from 'react';
import { lazyWithRetry } from '../../utils/lazyWithRetry';
import ErrorBoundary from '../error-boundary';

function loadChartExport(
  pick: (m: typeof import('@ant-design/charts')) => ComponentType<any>,
) {
  return lazyWithRetry(() =>
    import('@ant-design/charts').then((m) => ({ default: pick(m) })),
  );
}

export const LazyArea = loadChartExport((m) => m.Area as ComponentType<any>);
export const LazyColumn = loadChartExport((m) => m.Column as ComponentType<any>);
export const LazyLine = loadChartExport((m) => m.Line as ComponentType<any>);
export const LazyPie = loadChartExport((m) => m.Pie as ComponentType<any>);
export const LazyScatter = loadChartExport((m) => m.Scatter as ComponentType<any>);
export const LazyBar = loadChartExport((m) => m.Bar as ComponentType<any>);
export const LazySankey = loadChartExport((m) => m.Sankey as ComponentType<any>);

export function ChartSuspense({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <ErrorBoundary fallback={fallback ?? <div style={{ minHeight: 80 }} />}>
      <Suspense fallback={fallback}>{children}</Suspense>
    </ErrorBoundary>
  );
}
