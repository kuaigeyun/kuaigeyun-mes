import type React from 'react';

export type SliderMarkConfig = string | { label: React.ReactNode; style?: React.CSSProperties };

/** 滑块刻度：首项左对齐、末项右对齐，中间仍居中于刻度点 */
export function buildEdgeAlignedSliderMarks(
  points: number[],
  labelFor: (value: number) => string,
): Record<number, SliderMarkConfig> {
  const lastIndex = points.length - 1;
  return Object.fromEntries(
    points.map((value, index) => {
      const label = labelFor(value);
      if (index === 0) {
        return [value, { label, style: { transform: 'translateX(0)', whiteSpace: 'nowrap' } }];
      }
      if (index === lastIndex) {
        return [value, { label, style: { transform: 'translateX(-100%)', whiteSpace: 'nowrap' } }];
      }
      return [value, { label, style: { whiteSpace: 'nowrap' } }];
    }),
  );
}
