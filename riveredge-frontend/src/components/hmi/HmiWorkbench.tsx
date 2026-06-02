import type { ReactNode } from 'react';
import { HMI_STATION_LAYOUT } from '../layout-templates/constants';

export type HmiWorkbenchProps = {
  metrics?: ReactNode;
  footer?: ReactNode;
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
};

/** 工位三栏 + KPI + 底栏布局壳 */
export function HmiWorkbench({ metrics, footer, left, center, right }: HmiWorkbenchProps) {
  return (
    <div className="hmi-workbench">
      {metrics}
      <div
        className="hmi-workbench__body"
        style={{ gap: HMI_STATION_LAYOUT.SECTION_GAP, padding: HMI_STATION_LAYOUT.PANEL_PADDING }}
      >
        {left}
        {center}
        <div className="hmi-workbench__right" style={{ gap: HMI_STATION_LAYOUT.SECTION_GAP }}>
          {right}
        </div>
      </div>
      {footer}
    </div>
  );
}
