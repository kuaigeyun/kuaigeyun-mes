import React from 'react';
import { Button, Input, Segmented, Space } from 'antd';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
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

const STATUS_OPTIONS: Array<{ label: string; value: PoolStatusFilter }> = [
  { label: '全部', value: 'all' },
  { label: '草稿', value: 'draft' },
  { label: '已下达', value: 'released' },
  { label: '生产中', value: 'in_progress' },
];

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
}) => (
  <Space size={8} wrap={false} className="scheduling-pool-toolbar">
    <Segmented
      size="small"
      value={statusFilter}
      onChange={(v) => onStatusFilterChange(v as PoolStatusFilter)}
      options={STATUS_OPTIONS}
    />
    <Input
      size="small"
      allowClear
      placeholder="工单编号/名称/产品"
      prefix={<SearchOutlined />}
      value={keyword}
      onChange={(e) => onKeywordChange(e.target.value)}
      onPressEnter={onSearch}
      className="scheduling-pool-toolbar__keyword"
    />
    <Button size="small" type="primary" icon={<SearchOutlined />} onClick={onSearch}>
      搜索
    </Button>
    <Button size="small" icon={<ReloadOutlined />} onClick={onReset}>
      重置
    </Button>
    {canUpdate ? (
      <>
        <Button size="small" disabled={selectedCount === 0} loading={actionLoading} onClick={onConfirmDelay}>
          延期确认
        </Button>
        <Button size="small" disabled={selectedCount === 0} loading={actionLoading} onClick={onToException}>
          转异常
        </Button>
        <Button size="small" disabled={selectedCount === 0} loading={actionLoading} onClick={onApplyUnfreeze}>
          解冻申请
        </Button>
      </>
    ) : null}
  </Space>
);

export default SchedulingPoolToolbar;
