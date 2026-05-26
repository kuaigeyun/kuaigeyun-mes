import React from 'react';

export interface GanttTaskLabelProps {
  productName?: string;
  workOrderCode?: string;
}

/** 甘特图任务标签：第一行产品名，第二行工单号（小字） */
export const GanttTaskLabel: React.FC<GanttTaskLabelProps> = ({ productName, workOrderCode }) => {
  const primary = (productName || workOrderCode || '—').trim();
  const code = workOrderCode?.trim();

  return (
    <div className="gantt-task-label">
      <div className="gantt-task-label-primary" title={primary}>
        {primary}
      </div>
      {code && primary !== code ? (
        <div className="gantt-task-label-code" title={code}>
          {code}
        </div>
      ) : null}
    </div>
  );
};

export default GanttTaskLabel;
