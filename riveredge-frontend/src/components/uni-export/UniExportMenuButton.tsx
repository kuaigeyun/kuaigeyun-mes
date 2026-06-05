/**
 * 列表工具栏「导出」下拉（选中 / 本页 / 全部），与 UniTable 3.2 行为一致。
 */

import React from 'react';
import { Button, Dropdown, Tooltip } from 'antd';
import type { MenuProps } from 'antd';
import type { ButtonProps } from 'antd';
import { DownloadOutlined, DownOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

export type UniExportScope = 'selected' | 'currentPage' | 'all';

export interface UniExportMenuButtonProps<T extends Record<string, any> = Record<string, any>> {
  onExport: (
    type: UniExportScope,
    selectedRowKeys?: React.Key[],
    currentPageData?: T[],
  ) => void;
  selectedRowKeys: React.Key[];
  /** 当前表格数据（本页导出用） */
  tableData: T[];
  size?: ButtonProps['size'];
  /** 是否展示「导出选中」，默认 true */
  showSelected?: boolean;
  showCurrentPage?: boolean;
  showAll?: boolean;
  /** 仅图标（窄屏/工具栏宽度不足） */
  iconOnly?: boolean;
  /** 按钮主文案（不传则使用 i18n components.uniTable.export） */
  buttonText?: string;
}

export function UniExportMenuButton<T extends Record<string, any> = Record<string, any>>({
  onExport,
  selectedRowKeys,
  tableData,
  size,
  showSelected = true,
  showCurrentPage = true,
  showAll = true,
  iconOnly = false,
  buttonText,
}: UniExportMenuButtonProps<T>) {
  const { t } = useTranslation();
  const exportLabel = buttonText ?? t('components.uniTable.export');
  const items: MenuProps['items'] = [];
  if (showSelected) {
    items.push({
      key: 'selected',
      label: t('components.uniTable.exportSelected'),
      disabled: selectedRowKeys.length === 0,
      onClick: () => onExport('selected', selectedRowKeys, tableData),
    });
  }
  if (showCurrentPage) {
    items.push({
      key: 'currentPage',
      label: t('components.uniTable.exportCurrentPage'),
      onClick: () => onExport('currentPage', undefined, tableData),
    });
  }
  if (showAll) {
    items.push({
      key: 'all',
      label: t('components.uniTable.exportAll'),
      onClick: () => onExport('all'),
    });
  }

  if (items.length === 0) return null;

  const trigger = (
    <Button icon={<DownloadOutlined />} size={size} aria-label={exportLabel}>
      {iconOnly ? null : (
        <>
          {exportLabel}
          <DownOutlined style={{ fontSize: 10, marginInlineStart: 2, opacity: 0.65 }} />
        </>
      )}
    </Button>
  );

  return (
    <Dropdown
      menu={{ items }}
      placement="bottomRight"
      trigger={['hover', 'click']}
      mouseEnterDelay={0.05}
      mouseLeaveDelay={0.2}
    >
      {iconOnly ? <Tooltip title={exportLabel}>{trigger}</Tooltip> : trigger}
    </Dropdown>
  );
}
