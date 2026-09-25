import React, { useMemo, useState } from 'react';
import { Button, InputNumber, Popconfirm, Select, Space, Switch, Tooltip, Typography } from 'antd';
import { ThemedSegmented } from '../../../../../../components/themed-segmented';
import {
  LockOutlined,
  PushpinFilled,
  PushpinOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
  RollbackOutlined,
  SaveOutlined,
  SettingOutlined,
  UnlockOutlined,
} from '@ant-design/icons';
import type { TFunction } from 'i18next';
import type { ViewMode, GanttTaskLevel } from '../../../../components/GanttSchedulingChart/types';
import type { SchedulingResourceFilterValue, SchedulingWorkerResource } from '../schedulingResourceFilters';
import {
  buildSchedulingEquipmentTypeFilterOptions,
  buildSchedulingWorkerRoleFilterOptions,
} from '../schedulingResourceFilters';
import { ActionConfirmPopconfirm } from '../../../../../../components/action-confirm';

export interface SchedulingActionConfirm {
  title: string;
  description?: string;
  okText?: string;
}

export type SchedulingBoardMainView = 'gantt' | 'loadTable' | 'cardView';

interface SchedulingGanttToolbarProps {
  t: TFunction;
  boardMainView: SchedulingBoardMainView;
  onBoardMainViewChange: (view: SchedulingBoardMainView) => void;
  ganttViewMode: ViewMode;
  ganttTaskLevel: GanttTaskLevel;
  onGanttTaskLevelChange: (level: GanttTaskLevel) => void;
  pinnedResourceCount?: number;
  showPinnedOnly?: boolean;
  onShowPinnedOnlyChange?: (value: boolean) => void;
  onOpenPinManager?: () => void;
  equipmentTypeFilter: SchedulingResourceFilterValue;
  onEquipmentTypeFilterChange: (value: SchedulingResourceFilterValue) => void;
  workerRoleFilter: SchedulingResourceFilterValue;
  onWorkerRoleFilterChange: (value: SchedulingResourceFilterValue) => void;
  schedulingWorkers: SchedulingWorkerResource[];
  shiftDays: number;
  selectedWorkOrderCount: number;
  batchActionLoading: boolean;
  canUpdate?: boolean;
  draftMode?: boolean;
  draftPendingCount?: number;
  onDraftModeChange?: (enabled: boolean) => void;
  draftCloseConfirm?: SchedulingActionConfirm & { onConfirm: () => void };
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
  onAutoReschedule?: () => void;
  autoRescheduleConfirm?: SchedulingActionConfirm;
  autoRescheduleLoading?: boolean;
  onLocalReschedule?: () => void;
  localRescheduleConfirm?: SchedulingActionConfirm;
  onEditOperation?: () => void;
  canEditOperation?: boolean;
}

export interface SchedulingGanttToolbarNodes {
  toolbar: React.ReactNode;
}

function DraftModeSwitch({
  t,
  draftMode,
  draftPendingCount,
  draftCloseConfirm,
  onDraftModeChange,
}: {
  t: TFunction;
  draftMode: boolean;
  draftPendingCount: number;
  draftCloseConfirm?: SchedulingActionConfirm & { onConfirm: () => void };
  onDraftModeChange?: (enabled: boolean) => void;
}) {
  const [draftCloseOpen, setDraftCloseOpen] = useState(false);

  const handleDraftSwitch = (checked: boolean) => {
    if (!checked && draftPendingCount > 0 && draftCloseConfirm) {
      setDraftCloseOpen(true);
      return;
    }
    onDraftModeChange?.(checked);
  };

  return (
    <Space size={4} align="center">
      <Popconfirm
        open={draftCloseOpen}
        title={draftCloseConfirm?.title}
        description={draftCloseConfirm?.description}
        okText={draftCloseConfirm?.okText ?? t('common.confirm')}
        cancelText={t('common.cancel')}
        onConfirm={() => {
          draftCloseConfirm?.onConfirm();
          setDraftCloseOpen(false);
        }}
        onCancel={() => setDraftCloseOpen(false)}
      >
        <Switch size="small" checked={draftMode} onChange={handleDraftSwitch} />
      </Popconfirm>
      <Typography.Text type="secondary">{t('app.kuaizhizao.scheduling.ganttToolbar.draft')}</Typography.Text>
    </Space>
  );
}

function buildSchedulingGanttToolbar({
  t,
  boardMainView,
  onBoardMainViewChange,
  ganttViewMode,
  ganttTaskLevel,
  onGanttTaskLevelChange,
  pinnedResourceCount = 0,
  showPinnedOnly = false,
  onShowPinnedOnlyChange,
  onOpenPinManager,
  equipmentTypeFilter,
  onEquipmentTypeFilterChange,
  workerRoleFilter,
  onWorkerRoleFilterChange,
  schedulingWorkers,
  shiftDays,
  selectedWorkOrderCount,
  batchActionLoading,
  canUpdate = true,
  draftMode = false,
  draftPendingCount = 0,
  onDraftModeChange,
  draftCloseConfirm,
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
  onAutoReschedule,
  autoRescheduleConfirm,
  autoRescheduleLoading = false,
  onLocalReschedule,
  localRescheduleConfirm,
  onEditOperation,
  canEditOperation = false,
}: SchedulingGanttToolbarProps): SchedulingGanttToolbarNodes {
  const equipmentTypeOptions = useMemo(() => buildSchedulingEquipmentTypeFilterOptions(t), [t]);
  const workerRoleOptions = useMemo(
    () => buildSchedulingWorkerRoleFilterOptions(schedulingWorkers, t),
    [schedulingWorkers, t]
  );

  const mainControls = (
    <Space align="center" size={[6, 0]} className="scheduling-gantt-toolbar__title">
      <ReloadOutlined onClick={onRefresh} className="scheduling-gantt-toolbar__icon-btn" />
      <Typography.Text strong>{t('app.kuaizhizao.scheduling.ganttToolbar.title')}</Typography.Text>
      <Tooltip title={t('app.kuaizhizao.scheduling.ganttToolbar.fullscreenTip')}>
        <QuestionCircleOutlined className="scheduling-gantt-toolbar__help-icon" />
      </Tooltip>
      {canUpdate ? (
        <>
          <Tooltip title={t('app.kuaizhizao.scheduling.ganttToolbar.draftTooltip')}>
            <DraftModeSwitch
              t={t}
              draftMode={draftMode}
              draftPendingCount={draftPendingCount}
              draftCloseConfirm={draftCloseConfirm}
              onDraftModeChange={onDraftModeChange}
            />
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
          {autoRescheduleConfirm ? (
            <ActionConfirmPopconfirm
              title={autoRescheduleConfirm.title}
              description={autoRescheduleConfirm.description}
              okText={autoRescheduleConfirm.okText}
              onConfirm={() => void onAutoReschedule?.()}
            >
              <Button
                size="small"
                disabled={selectedWorkOrderCount === 0}
                loading={autoRescheduleLoading}
                onClick={(e) => e.stopPropagation()}
              >
                {t('app.kuaizhizao.scheduling.ganttToolbar.autoReschedule')}
              </Button>
            </ActionConfirmPopconfirm>
          ) : (
            <Button
              size="small"
              disabled={selectedWorkOrderCount === 0}
              loading={autoRescheduleLoading}
              onClick={onAutoReschedule}
            >
              {t('app.kuaizhizao.scheduling.ganttToolbar.autoReschedule')}
            </Button>
          )}
          {localRescheduleConfirm ? (
            <ActionConfirmPopconfirm
              title={localRescheduleConfirm.title}
              description={localRescheduleConfirm.description}
              okText={localRescheduleConfirm.okText}
              onConfirm={() => void onLocalReschedule?.()}
            >
              <Button
                size="small"
                disabled={selectedWorkOrderCount === 0}
                loading={autoRescheduleLoading}
                onClick={(e) => e.stopPropagation()}
              >
                {t('app.kuaizhizao.scheduling.ganttToolbar.localReschedule')}
              </Button>
            </ActionConfirmPopconfirm>
          ) : onLocalReschedule ? (
            <Button
              size="small"
              disabled={selectedWorkOrderCount === 0}
              loading={autoRescheduleLoading}
              onClick={onLocalReschedule}
            >
              {t('app.kuaizhizao.scheduling.ganttToolbar.localReschedule')}
            </Button>
          ) : null}
          {canEditOperation ? (
            <Button size="small" onClick={onEditOperation}>
              {t('app.kuaizhizao.scheduling.ganttToolbar.editOperation')}
            </Button>
          ) : null}
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
      {ganttTaskLevel === 'station' || ganttTaskLevel === 'equipment' || ganttTaskLevel === 'worker' ? (
        <>
          <Tooltip title={t('app.kuaizhizao.scheduling.ganttToolbar.pinManagerTip')}>
            <Button
              size="small"
              icon={pinnedResourceCount > 0 ? <PushpinFilled /> : <PushpinOutlined />}
              onClick={onOpenPinManager}
            >
              {t('app.kuaizhizao.scheduling.ganttToolbar.pinManager')}
              {pinnedResourceCount > 0 ? ` (${pinnedResourceCount})` : ''}
            </Button>
          </Tooltip>
          <Tooltip title={t('app.kuaizhizao.scheduling.ganttToolbar.showPinnedOnlyTip')}>
            <Space size={4} align="center">
              <Switch
                size="small"
                checked={showPinnedOnly}
                disabled={pinnedResourceCount === 0}
                onChange={(checked) => onShowPinnedOnlyChange?.(checked)}
              />
              <Typography.Text type="secondary">
                {t('app.kuaizhizao.scheduling.ganttToolbar.showPinnedOnly')}
              </Typography.Text>
            </Space>
          </Tooltip>
        </>
      ) : null}
    </Space>
  );

  const filterControls = (
    <Space align="center" size={[6, 0]} className="scheduling-gantt-toolbar__extra">
      <span className="scheduling-gantt-toolbar__label">{t('app.kuaizhizao.scheduling.ganttToolbar.boardViewLabel')}</span>
      <ThemedSegmented
        size="small"
        surfaceBackground
        value={boardMainView}
        options={[
          { label: t('app.kuaizhizao.scheduling.ganttToolbar.boardViewGantt'), value: 'gantt' },
          { label: t('app.kuaizhizao.scheduling.ganttToolbar.boardViewCard'), value: 'cardView' },
          { label: t('app.kuaizhizao.scheduling.ganttToolbar.boardViewLoadTable'), value: 'loadTable' },
        ]}
        onChange={(value) => onBoardMainViewChange(value as SchedulingBoardMainView)}
      />
      <span className="scheduling-gantt-toolbar__label">{t('app.kuaizhizao.scheduling.ganttToolbar.resourceViewLabel')}</span>
      <ThemedSegmented
        size="small"
        surfaceBackground
        value={ganttTaskLevel}
        options={[
          { label: t('app.kuaizhizao.scheduling.ganttToolbar.resourceStation'), value: 'station' },
          { label: t('app.kuaizhizao.scheduling.ganttToolbar.resourceEquipment'), value: 'equipment' },
          { label: t('app.kuaizhizao.scheduling.ganttToolbar.resourceWorker'), value: 'worker' },
        ]}
        onChange={(value) => onGanttTaskLevelChange(value as GanttTaskLevel)}
      />
      {ganttTaskLevel === 'equipment' ? (
        <>
          <span className="scheduling-gantt-toolbar__label">{t('app.kuaizhizao.scheduling.ganttToolbar.equipmentTypeFilterLabel')}</span>
          <Select
            size="small"
            value={equipmentTypeFilter}
            options={equipmentTypeOptions}
            style={{ minWidth: 120 }}
            popupMatchSelectWidth={false}
            onChange={onEquipmentTypeFilterChange}
          />
        </>
      ) : null}
      {ganttTaskLevel === 'worker' ? (
        <>
          <span className="scheduling-gantt-toolbar__label">{t('app.kuaizhizao.scheduling.ganttToolbar.workerRoleFilterLabel')}</span>
          <Select
            size="small"
            value={workerRoleFilter}
            options={workerRoleOptions}
            style={{ minWidth: 120 }}
            popupMatchSelectWidth={false}
            onChange={onWorkerRoleFilterChange}
          />
        </>
      ) : null}
      {boardMainView === 'gantt' ? (
        <>
          <span className="scheduling-gantt-toolbar__label">{t('app.kuaizhizao.scheduling.ganttToolbar.viewLabel')}</span>
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
          <Button size="small" onClick={onScrollToToday}>
            {t('app.kuaizhizao.scheduling.ganttToolbar.today')}
          </Button>
        </>
      ) : boardMainView === 'loadTable' ? (
        <Tooltip title={t('app.kuaizhizao.scheduling.ganttToolbar.loadTableHint')}>
          <QuestionCircleOutlined className="scheduling-gantt-toolbar__help-icon" aria-label={t('app.kuaizhizao.scheduling.ganttToolbar.loadTableHint')} />
        </Tooltip>
      ) : null}
      {canUpdate ? (
        <Tooltip title={t('app.kuaizhizao.scheduling.ganttToolbar.settings')}>
          <Button
            size="small"
            icon={<SettingOutlined />}
            aria-label={t('app.kuaizhizao.scheduling.ganttToolbar.settings')}
            onClick={onOpenConfig}
          />
        </Tooltip>
      ) : null}
    </Space>
  );

  const toolbar = (
    <div className="scheduling-gantt-toolbar__bar">
      <div className="scheduling-gantt-toolbar__main">{mainControls}</div>
      <div className="scheduling-gantt-toolbar__filters">{filterControls}</div>
    </div>
  );

  return { toolbar };
}

export default buildSchedulingGanttToolbar;
