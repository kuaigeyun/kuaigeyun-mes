import React, { useMemo } from 'react';
import { Button, Input, Segmented, Space } from 'antd';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { PoolStatusFilter } from '../schedulingPoolUtils';

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
        {t('app.kuaizhizao.scheduling.poolToolbar.search')}
      </Button>
      <Button size="small" icon={<ReloadOutlined />} onClick={onReset}>
        {t('app.kuaizhizao.scheduling.poolToolbar.reset')}
      </Button>
      {canUpdate ? (
        <>
          <Button size="small" disabled={selectedCount === 0} loading={actionLoading} onClick={onConfirmDelay}>
            {t('app.kuaizhizao.scheduling.poolToolbar.confirmDelay')}
          </Button>
          <Button size="small" disabled={selectedCount === 0} loading={actionLoading} onClick={onToException}>
            {t('app.kuaizhizao.scheduling.poolToolbar.toException')}
          </Button>
          <Button size="small" disabled={selectedCount === 0} loading={actionLoading} onClick={onApplyUnfreeze}>
            {t('app.kuaizhizao.scheduling.poolToolbar.applyUnfreeze')}
          </Button>
        </>
      ) : null}
    </Space>
  );
};

export default SchedulingPoolToolbar;
