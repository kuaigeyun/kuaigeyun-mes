import React from 'react';
import { Button, Space, Tooltip, Typography } from 'antd';
import { PartitionOutlined, QuestionCircleOutlined, ReloadOutlined, ScheduleOutlined, ThunderboltOutlined } from '@ant-design/icons';
import type { GanttTaskLevel, ViewMode } from '../../../../components/GanttSchedulingChart/types';

interface SchedulingGanttToolbarProps {
  ganttTaskLevel: GanttTaskLevel;
  ganttViewMode: ViewMode;
  ganttWorkOrderCount: number;
  resourceViewStats: { workCenterCount: number; equipmentCount: number; taskCount: number };
  optimizing: boolean;
  scenarioLoading: boolean;
  onRefresh: () => void;
  onAutoSchedule: () => void;
  onOptimize: () => void;
  onLocalReschedule: () => void;
  onOpenScenario: () => void;
  onTaskLevelChange: (level: GanttTaskLevel) => void;
  onViewModeChange: (mode: ViewMode) => void;
}

export interface SchedulingGanttToolbarNodes {
  title: React.ReactNode;
  extra: React.ReactNode;
}

function buildSchedulingGanttToolbar({
  ganttTaskLevel,
  ganttViewMode,
  ganttWorkOrderCount,
  resourceViewStats,
  optimizing,
  scenarioLoading,
  onRefresh,
  onAutoSchedule,
  onOptimize,
  onLocalReschedule,
  onOpenScenario,
  onTaskLevelChange,
  onViewModeChange,
}: SchedulingGanttToolbarProps): SchedulingGanttToolbarNodes {
  const title = (
    <Space>
      <ReloadOutlined onClick={onRefresh} style={{ cursor: 'pointer' }} />
      甘特图排产
      <Tooltip title="建议点击 UniTab 右上角全屏按钮，扩大排产可操作区域（甘特拖拽与资源调度更顺畅）">
        <QuestionCircleOutlined style={{ color: '#8c8c8c', cursor: 'help' }} />
      </Tooltip>
      <Typography.Text type="secondary">
        {ganttTaskLevel === 'operation'
          ? `设备视角｜工作中心 ${resourceViewStats.workCenterCount}｜设备 ${resourceViewStats.equipmentCount}｜任务 ${resourceViewStats.taskCount}`
          : `工单视角｜工单 ${ganttWorkOrderCount}`}
      </Typography.Text>
      <Button type="primary" icon={<ScheduleOutlined />} size="small" onClick={onAutoSchedule}>
        智能排产
      </Button>
      <Button icon={<ThunderboltOutlined />} size="small" loading={optimizing} onClick={onOptimize}>
        优化排产
      </Button>
      <Button icon={<PartitionOutlined />} size="small" onClick={onLocalReschedule}>
        局部重排
      </Button>
      <Button size="small" onClick={onOpenScenario} loading={scenarioLoading}>
        场景沙盘
      </Button>
    </Space>
  );

  const extra = (
    <Space>
      <span>视角：</span>
      <Space.Compact>
        <Button
          type={ganttTaskLevel === 'operation' ? 'primary' : 'default'}
          size="small"
          onClick={() => onTaskLevelChange('operation')}
        >
          设备视角
        </Button>
        <Button
          type={ganttTaskLevel === 'work_order' ? 'primary' : 'default'}
          size="small"
          onClick={() => onTaskLevelChange('work_order')}
        >
          工单视角
        </Button>
      </Space.Compact>
      <span style={{ marginLeft: 8 }}>视图：</span>
      <Space.Compact>
        <Button type={ganttViewMode === 'day' ? 'primary' : 'default'} size="small" onClick={() => onViewModeChange('day')}>
          日
        </Button>
        <Button type={ganttViewMode === 'week' ? 'primary' : 'default'} size="small" onClick={() => onViewModeChange('week')}>
          周
        </Button>
        <Button type={ganttViewMode === 'month' ? 'primary' : 'default'} size="small" onClick={() => onViewModeChange('month')}>
          月
        </Button>
      </Space.Compact>
    </Space>
  );

  return { title, extra };
}

export default buildSchedulingGanttToolbar;
