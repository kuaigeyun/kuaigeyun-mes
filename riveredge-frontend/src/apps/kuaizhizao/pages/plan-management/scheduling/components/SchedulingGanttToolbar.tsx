import React from 'react';
import { Button, InputNumber, Space, Switch, Tooltip, Typography } from 'antd';
import {
  LockOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
  RollbackOutlined,
  SaveOutlined,
  SettingOutlined,
  UnlockOutlined,
} from '@ant-design/icons';
import type { ViewMode } from '../../../../components/GanttSchedulingChart/types';

interface SchedulingGanttToolbarProps {
  ganttViewMode: ViewMode;
  resourceViewStats: { stationCount: number; taskCount: number };
  shiftDays: number;
  selectedWorkOrderCount: number;
  selectedOperationCount: number;
  batchActionLoading: boolean;
  canUpdate?: boolean;
  draftMode?: boolean;
  draftPendingCount?: number;
  onDraftModeChange?: (enabled: boolean) => void;
  onApplyDraft?: () => void;
  onUndoDraft?: () => void;
  onRefresh: () => void;
  onOpenConfig: () => void;
  onBatchFreeze: () => void;
  onBatchUnfreeze: () => void;
  onBatchShift: (days: number) => void;
  onShiftDaysChange: (days: number) => void;
  onViewModeChange: (mode: ViewMode) => void;
  onScrollToToday: () => void;
}

export interface SchedulingGanttToolbarNodes {
  title: React.ReactNode;
  extra: React.ReactNode;
}

function buildSchedulingGanttToolbar({
  ganttViewMode,
  resourceViewStats,
  shiftDays,
  selectedWorkOrderCount,
  selectedOperationCount,
  batchActionLoading,
  canUpdate = true,
  draftMode = false,
  draftPendingCount = 0,
  onDraftModeChange,
  onApplyDraft,
  onUndoDraft,
  onRefresh,
  onOpenConfig,
  onBatchFreeze,
  onBatchUnfreeze,
  onBatchShift,
  onShiftDaysChange,
  onViewModeChange,
  onScrollToToday,
}: SchedulingGanttToolbarProps): SchedulingGanttToolbarNodes {
  const title = (
    <Space wrap>
      <ReloadOutlined onClick={onRefresh} style={{ cursor: 'pointer' }} />
      可视排产
      <Tooltip title="建议点击 UniTab 右上角全屏按钮，扩大排产可操作区域（甘特拖拽与资源调度更顺畅）">
        <QuestionCircleOutlined style={{ color: '#8c8c8c', cursor: 'help' }} />
      </Tooltip>
      <Typography.Text type="secondary">
        工位 {resourceViewStats.stationCount}｜工序 {resourceViewStats.taskCount}
        {selectedWorkOrderCount > 0
          ? `｜已选 ${selectedWorkOrderCount} 工单${selectedOperationCount > 0 ? ` / ${selectedOperationCount} 工序` : ''}`
          : ''}
      </Typography.Text>
      {canUpdate ? (
        <>
          <Tooltip title="开启后，仅甘特条拖拽调整会先暂存；从待排区排入并在弹窗点「更新」会立即保存">
            <Space size={4}>
              <Switch size="small" checked={draftMode} onChange={onDraftModeChange} />
              <Typography.Text type="secondary">暂存</Typography.Text>
            </Space>
          </Tooltip>
          {draftMode ? (
            <>
              <Tooltip
                title={
                  draftPendingCount > 0
                    ? '将暂存的拖拽调整校验后写入数据库'
                    : '暂无待保存的拖拽调整；从待排区排入的数据已在弹窗「更新」时保存'
                }
              >
                <Button
                  size="small"
                  type="primary"
                  icon={<SaveOutlined />}
                  disabled={draftPendingCount === 0}
                  onClick={onApplyDraft}
                >
                  应用更改{draftPendingCount > 0 ? ` (${draftPendingCount})` : ''}
                </Button>
              </Tooltip>
              <Button size="small" icon={<RollbackOutlined />} onClick={onUndoDraft}>
                撤销
              </Button>
            </>
          ) : null}
          <Button size="small" icon={<SettingOutlined />} onClick={onOpenConfig}>
            排产设置
          </Button>
          <Button
            size="small"
            icon={<LockOutlined />}
            disabled={selectedWorkOrderCount === 0}
            loading={batchActionLoading}
            onClick={onBatchFreeze}
          >
            批量冻结
          </Button>
          <Button
            size="small"
            icon={<UnlockOutlined />}
            disabled={selectedWorkOrderCount === 0}
            loading={batchActionLoading}
            onClick={onBatchUnfreeze}
          >
            批量解冻
          </Button>
          <Space.Compact>
            <InputNumber
              size="small"
              min={-30}
              max={30}
              value={shiftDays}
              onChange={(v) => onShiftDaysChange(Number(v ?? 0))}
              style={{ width: 72 }}
            />
            <Button
              size="small"
              disabled={selectedWorkOrderCount === 0 || shiftDays === 0}
              loading={batchActionLoading}
              onClick={() => onBatchShift(shiftDays)}
            >
              平移选中
            </Button>
          </Space.Compact>
        </>
      ) : null}
    </Space>
  );

  const extra = (
    <Space>
      <Button size="small" onClick={onScrollToToday}>
        今天
      </Button>
      <span>视图：</span>
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
