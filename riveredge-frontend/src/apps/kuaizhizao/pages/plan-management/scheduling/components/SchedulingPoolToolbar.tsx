import React, { useMemo } from 'react';
import { Button, Checkbox, Input, Segmented, Space } from 'antd';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { PoolStatusFilter } from '../schedulingPoolUtils';
import { ActionConfirmPopconfirm } from '../../../../../../components/action-confirm';
import type { SchedulingActionConfirm } from './SchedulingGanttToolbar';

interface SchedulingPoolToolbarProps {
  keyword: string;
  statusFilter: PoolStatusFilter;
  selectedCount?: number;
  canUpdate?: boolean;
  actionLoading?: boolean;
  onKeywordChange: (value: string) => void;
  onStatusFilterChange: (value: PoolStatusFilter) => void;
  onSearch: () => void;
  onReset: () => void;
  onConfirmDelay?: () => void;
  onToException?: () => void;
  onApplyUnfreeze?: () => void;
  onRescheduleForward?: () => void;
  confirmDelayConfirm?: SchedulingActionConfirm;
  toExceptionConfirm?: SchedulingActionConfirm;
  applyUnfreezeConfirm?: SchedulingActionConfirm;
  rescheduleForwardConfirm?: SchedulingActionConfirm;
  overdueOnly?: boolean;
  onOverdueOnlyChange?: (value: boolean) => void;
}

function ConfirmToolbarButton({
  confirm,
  disabled,
  loading,
  onClick,
  children,
}: {
  confirm?: SchedulingActionConfirm;
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  if (!confirm) {
    return (
      <Button size="small" disabled={disabled} loading={loading} onClick={onClick}>
        {children}
      </Button>
    );
  }
  return (
    <ActionConfirmPopconfirm
      title={confirm.title}
      description={confirm.description}
      okText={confirm.okText}
      onConfirm={() => void onClick?.()}
    >
      <Button size="small" disabled={disabled} loading={loading} onClick={(e) => e.stopPropagation()}>
        {children}
      </Button>
    </ActionConfirmPopconfirm>
  );
}

const SchedulingPoolToolbar: React.FC<SchedulingPoolToolbarProps> = ({
  keyword,
  statusFilter,
  selectedCount = 0,
  canUpdate = false,
  actionLoading = false,
  onKeywordChange,
  onStatusFilterChange,
  onSearch,
  onReset,
  onConfirmDelay,
  onToException,
  onApplyUnfreeze,
  onRescheduleForward,
  confirmDelayConfirm,
  toExceptionConfirm,
  applyUnfreezeConfirm,
  rescheduleForwardConfirm,
  overdueOnly = false,
  onOverdueOnlyChange,
}) => {
  const { t } = useTranslation();

  const statusOptions = useMemo(
    () => [
      { label: t('app.kuaizhizao.scheduling.poolToolbar.statusAll'), value: 'all' as PoolStatusFilter },
      { label: t('app.kuaizhizao.scheduling.poolToolbar.statusDraft'), value: 'draft' as PoolStatusFilter },
      { label: t('app.kuaizhizao.scheduling.poolToolbar.statusReleased'), value: 'released' as PoolStatusFilter },
      { label: t('app.kuaizhizao.scheduling.poolToolbar.statusInProgress'), value: 'in_progress' as PoolStatusFilter },
    ],
    [t]
  );

  const actionDisabled = selectedCount === 0;

  return (
    <Space size={8} wrap={false} className="scheduling-pool-toolbar">
      <Segmented
        size="small"
        value={statusFilter}
        onChange={(v) => onStatusFilterChange(v as PoolStatusFilter)}
        options={statusOptions}
      />
      <Input
        size="small"
        allowClear
        placeholder={t('app.kuaizhizao.scheduling.poolToolbar.keywordPlaceholder')}
        prefix={<SearchOutlined />}
        value={keyword}
        onChange={(e) => onKeywordChange(e.target.value)}
        onPressEnter={onSearch}
        className="scheduling-pool-toolbar__keyword"
      />
      <Button size="small" type="primary" icon={<SearchOutlined />} onClick={onSearch}>
        {t('common.search')}
      </Button>
      <Button size="small" icon={<ReloadOutlined />} onClick={onReset}>
        {t('common.reset')}
      </Button>
      <Checkbox
        checked={overdueOnly}
        onChange={(e) => onOverdueOnlyChange?.(e.target.checked)}
      >
        {t('app.kuaizhizao.scheduling.poolToolbar.overdueOnly')}
      </Checkbox>
      {canUpdate ? (
        <>
          <ConfirmToolbarButton
            confirm={rescheduleForwardConfirm}
            disabled={actionDisabled}
            loading={actionLoading}
            onClick={onRescheduleForward}
          >
            {t('app.kuaizhizao.scheduling.poolToolbar.rescheduleForward')}
          </ConfirmToolbarButton>
          <ConfirmToolbarButton
            confirm={confirmDelayConfirm}
            disabled={actionDisabled}
            loading={actionLoading}
            onClick={onConfirmDelay}
          >
            {t('app.kuaizhizao.scheduling.poolToolbar.confirmDelay')}
          </ConfirmToolbarButton>
          <ConfirmToolbarButton
            confirm={toExceptionConfirm}
            disabled={actionDisabled}
            loading={actionLoading}
            onClick={onToException}
          >
            {t('app.kuaizhizao.scheduling.poolToolbar.toException')}
          </ConfirmToolbarButton>
          <ConfirmToolbarButton
            confirm={applyUnfreezeConfirm}
            disabled={actionDisabled}
            loading={actionLoading}
            onClick={onApplyUnfreeze}
          >
            {t('app.kuaizhizao.scheduling.poolToolbar.applyUnfreeze')}
          </ConfirmToolbarButton>
        </>
      ) : null}
    </Space>
  );
};

export default SchedulingPoolToolbar;
