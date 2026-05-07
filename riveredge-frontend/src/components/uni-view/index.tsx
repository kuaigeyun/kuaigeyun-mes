/**
 * uni-view：列表视图切换（表格 / 明细 / 卡片 / 看板 / 甘特 / 统计 / 触屏 / 帮助及 customViews）。
 * 与 UniTable 的 viewTypes / currentViewType 约定一致，供唯一维护入口。
 */

import React from 'react';
import { Radio } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  TableOutlined,
  AppstoreOutlined,
  BarsOutlined,
  BarChartOutlined,
  TabletOutlined,
  QuestionCircleOutlined,
  UnorderedListOutlined,
  ProjectOutlined,
} from '@ant-design/icons';

export interface UniViewCustomItem {
  key: string;
  label: string;
  icon: React.ComponentType<any>;
}

export interface UniViewProps {
  viewTypes: string[];
  value: string;
  onChange: (next: string) => void;
  customViews?: UniViewCustomItem[];
  /** 与历史 UniTable 一致，给 Radio.Group 留左边距 */
  style?: React.CSSProperties;
  className?: string;
}

const UniView: React.FC<UniViewProps> = ({
  viewTypes,
  value,
  onChange,
  customViews,
  style,
  className,
}) => {
  const { t } = useTranslation();

  if (!viewTypes || viewTypes.length <= 1) {
    return null;
  }

  const builtinOptions = [
    { value: 'table', label: t('components.uniTable.viewTable'), icon: TableOutlined },
    { value: 'detailTable', label: t('components.uniTable.viewDetailTable'), icon: UnorderedListOutlined },
    { value: 'card', label: t('components.uniTable.viewCard'), icon: AppstoreOutlined },
    { value: 'kanban', label: t('components.uniTable.viewKanban'), icon: BarsOutlined },
    { value: 'gantt', label: t('components.uniTable.viewGantt'), icon: ProjectOutlined },
    { value: 'stats', label: t('components.uniTable.viewStats'), icon: BarChartOutlined },
    { value: 'touch', label: t('components.uniTable.viewTouch'), icon: TabletOutlined },
    { value: 'help', label: t('components.uniTable.viewHelp'), icon: QuestionCircleOutlined },
  ];
  const customOptions = (customViews ?? []).map((v) => ({
    value: v.key,
    label: v.label,
    icon: v.icon,
  }));
  const filtered = [...builtinOptions, ...customOptions].filter((option) =>
    viewTypes.includes(option.value),
  );
  const viewTypeOptions = [...filtered].sort(
    (a, b) => viewTypes.indexOf(a.value) - viewTypes.indexOf(b.value),
  );

  return (
    <Radio.Group
      className={className}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      buttonStyle="solid"
      style={{ marginLeft: 8, ...style }}
    >
      {viewTypeOptions.map((option) => {
        const IconComponent = option.icon;
        return (
          <Radio.Button key={option.value} value={option.value} title={option.label}>
            <IconComponent style={{ marginRight: 4, fontSize: '14px' }} />
            {option.label}
          </Radio.Button>
        );
      })}
    </Radio.Group>
  );
};

export default UniView;
