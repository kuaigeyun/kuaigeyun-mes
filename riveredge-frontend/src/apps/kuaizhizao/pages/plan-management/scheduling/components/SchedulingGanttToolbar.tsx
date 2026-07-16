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
import type { TFunction } from 'i18next';
import type { ViewMode } from '../../../../components/GanttSchedulingChart/types';

interface SchedulingGanttToolbarProps {
  t: TFunction;
  ganttViewMode: ViewMode;
  shiftDays: number;
  selectedWorkOrderCount: number;
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
  aiTrigger?: React.ReactNode;
  onAutoReschedule?: () => void;
  onEditOperation?: () => void;
  autoRescheduleLoading?: boolean;
  canEditOperation?: boolean;
}

export interface SchedulingGanttToolbarNodes {
  title: React.ReactNode;
  extra: React.ReactNode;
}

function buildSchedulingGanttToolbar({
  t,
  ganttViewMode,
  shiftDays,
  selectedWorkOrderCount,
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
  aiTrigger,
  onAutoReschedule,
  onEditOperation,
  autoRescheduleLoading = false,
  canEditOperation = false,
}: SchedulingGanttToolbarProps): SchedulingGanttToolbarNodes {
  const title = (
    <Space wrap align="center" size={[8, 8]} className="scheduling-gantt-toolbar__title">
      {aiTrigger}
      <ReloadOutlined onClick={onRefresh} className="scheduling-gantt-toolbar__icon-btn" />
      <Typography.Text strong>{t('app.kuaizhizao.scheduling.ganttToolbar.title')}</Typography.Text>
      <Tooltip title={t('app.kuaizhizao.scheduling.ganttToolbar.fullscreenTip')}>
        <QuestionCircleOutlined className="scheduling-gantt-toolbar__help-icon" />
      </Tooltip>
      {canUpdate ? (
        <>
          <Tooltip title={t('app.kuaizhizao.scheduling.ganttToolbar.draftTooltip')}>
            <Space size={4} align="center">
              <Switch size="small" checked={draftMode} onChange={onDraftModeChange} />
              <Typography.Text type="secondary">{t('app.kuaizhizao.scheduling.ganttToolbar.draft')}</Typography.Text>
            </Space>
          </Tooltip>
          {draftMode ? (
            <>
              <Tooltip
                title={
                  draftPendingCount > 0
                    ? t('app.kuaizhizao.scheduling.ganttToolbar.applyChangesTooltip')
                    : t('app.kuaizhizao.scheduling.ganttToolbar.applyChangesTooltipEmpty')
                }
              >
                <Button
                  size="small"
                  type="primary"
                  icon={<SaveOutlined />}
                  disabled={draftPendingCount === 0}
                  onClick={onApplyDraft}
                >
                  {t('app.kuaizhizao.scheduling.ganttToolbar.applyChanges')}
                  {draftPendingCount > 0 ? ` (${draftPendingCount})` : ''}
                </Button>
              </Tooltip>
              <Button size="small" icon={<RollbackOutlined />} onClick={onUndoDraft}>
                {t('app.kuaizhizao.scheduling.ganttToolbar.undo')}
              </Button>
            </>
          ) : null}
          <Button
            size="small"
            disabled={selectedWorkOrderCount === 0}
            loading={autoRescheduleLoading}
            onClick={onAutoReschedule}
          >
            {t('app.kuaizhizao.scheduling.ganttToolbar.autoReschedule')}
          </Button>
          {canEditOperation ? (
            <Button size="small" onClick={onEditOperation}>
              {t('app.kuaizhizao.scheduling.ganttToolbar.editOperation')}
            </Button>
          ) : null}
          <Button size="small" icon={<SettingOutlined />} onClick={onOpenConfig}>
            {t('app.kuaizhizao.scheduling.ganttToolbar.settings')}
          </Button>
          <Button
            size="small"
            icon={<LockOutlined />}
            disabled={selectedWorkOrderCount === 0}
            loading={batchActionLoading}
            onClick={onBatchFreeze}
          >
            {t('app.kuaizhizao.scheduling.ganttToolbar.batchFreeze')}
          </Button>
          <Button
            size="small"
            icon={<UnlockOutlined />}
            disabled={selectedWorkOrderCount === 0}
            loading={batchActionLoading}
            onClick={onBatchUnfreeze}
          >
            {t('app.kuaizhizao.scheduling.ganttToolbar.batchUnfreeze')}
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
              {t('app.kuaizhizao.scheduling.ganttToolbar.shiftSelected')}
            </Button>
          </Space.Compact>
        </>
      ) : null}
    </Space>
  );

  const extra = (
    <Space align="center" className="scheduling-gantt-toolbar__extra">
      <Button size="small" onClick={onScrollToToday}>
        {t('app.kuaizhizao.scheduling.ganttToolbar.today')}
      </Button>
      <span>{t('app.kuaizhizao.scheduling.ganttToolbar.viewLabel')}</span>
      <Space.Compact>
        <Button type={ganttViewMode === 'day' ? 'primary' : 'default'} size="small" onClick={() => onViewModeChange('day')}>
          {t('app.kuaizhizao.scheduling.ganttToolbar.viewDay')}
        </Button>
        <Button type={ganttViewMode === 'week' ? 'primary' : 'default'} size="small" onClick={() => onViewModeChange('week')}>
          {t('app.kuaizhizao.scheduling.ganttToolbar.viewWeek')}
        </Button>
        <Button type={ganttViewMode === 'month' ? 'primary' : 'default'} size="small" onClick={() => onViewModeChange('month')}>
          {t('app.kuaizhizao.scheduling.ganttToolbar.viewMonth')}
        </Button>
      </Space.Compact>
    </Space>
  );

  return { title, extra };
}

export default buildSchedulingGanttToolbar;
