import React, { Suspense, lazy } from 'react';
import type { LineConfig } from '@ant-design/plots';

const LazyLine = lazy(() =>
  import('@ant-design/charts').then(({ Line }) => ({
    default: Line,
  })),
);

export type ModuleTrendLineProps = LineConfig;

/** 模块看板趋势折线：默认贝塞尔曲线（shapeField=smooth） */
export function ModuleTrendLine({ shapeField = 'smooth', ...props }: ModuleTrendLineProps) {
  return (
    <Suspense fallback={null}>
      <LazyLine shapeField={shapeField} {...props} />
    </Suspense>
  );
}

export default ModuleTrendLine;
