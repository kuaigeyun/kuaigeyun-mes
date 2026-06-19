import React from 'react';
import { Flex, Input, theme } from 'antd';
import type { ReactNode } from 'react';
import { ThemedSegmented } from '../themed-segmented';
import type { UniPullQueryScopeOption } from './types';

export interface UniPullQueryFilterBarProps {
  searchDraft: string;
  onSearchDraftChange: (value: string) => void;
  onSearchApply: (value: string) => void;
  onSearchClear: () => void;
  searchPlaceholder?: string;
  scopeOptions?: UniPullQueryScopeOption[];
  scope?: string;
  onScopeChange?: (scope: string) => void;
  /** 搜索框右侧扩展筛选（如分类、来源类型） */
  filterExtra?: ReactNode;
}

/**
 * 上拉取单筛选栏，样式对齐 UniMaterialBatchPicker。
 */
export const UniPullQueryFilterBar: React.FC<UniPullQueryFilterBarProps> = ({
  searchDraft,
  onSearchDraftChange,
  onSearchApply,
  onSearchClear,
  searchPlaceholder,
  scopeOptions,
  scope,
  onScopeChange,
  filterExtra,
}) => {
  const { token } = theme.useToken();

  return (
    <div
      style={{
        padding: 12,
        marginBottom: 12,
        background: token.colorFillAlter,
        borderRadius: token.borderRadius,
        border: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      <Flex gap={8} align="center" style={{ width: '100%' }}>
        {scopeOptions && scopeOptions.length > 0 && scope != null && onScopeChange ? (
          <ThemedSegmented
            surfaceBackground
            value={scope}
            options={scopeOptions}
            onChange={(value) => onScopeChange(String(value))}
            style={{ flexShrink: 0 }}
          />
        ) : null}
        <Input.Search
          allowClear
          placeholder={searchPlaceholder}
          style={{ flex: 1, minWidth: 0 }}
          value={searchDraft}
          onChange={(e) => onSearchDraftChange(e.target.value)}
          onSearch={(value) => onSearchApply(value)}
          onClear={onSearchClear}
        />
        {filterExtra}
      </Flex>
    </div>
  );
};
