/**
 * 列表搜索唯一入口：模糊搜索 + 高级搜索（ProTable 联动）+ 重置。
 * 实现层仅在此处懒加载 uni-query 的 QuerySearchButton，UniTable 与其它页面勿直接引用 QuerySearchButton。
 */

import React, { Suspense, lazy } from 'react';
import { Button, Input, theme } from 'antd';
import type { ButtonProps } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { ActionType, ProColumns, ProFormInstance } from '@ant-design/pro-components';
import ErrorBoundary from '../error-boundary';
import { getUniToolbarControlShellStyle } from './toolbarChrome';

const LazyQuerySearchButton = lazy(() =>
  import('../uni-query').then((m) => ({ default: m.QuerySearchButton })),
);

/** 与 ProTable / UniTable 联用的高级搜索（懒加载 + 错误边界） */
export interface UniAdvancedSearchProps {
  columns: ProColumns<any>[];
  formRef: React.MutableRefObject<ProFormInstance | undefined>;
  actionRef: React.MutableRefObject<ActionType | undefined>;
  searchParamsRef?: React.MutableRefObject<Record<string, any> | undefined>;
  /** 与 UniTable 一致的全量重置（模糊词 + 表单 + 刷新）；传入后「重置」紧挨高级搜索按钮 */
  onReset?: () => void;
  /**
   * 由 UniTable 在 searchParamsRef 每次提交后递增，用于刷新钉住条件激活态。
   */
  pinnedSearchUiEpoch?: number;
  onSearchParamsApplied?: () => void;
}

export const UniAdvancedSearch: React.FC<UniAdvancedSearchProps> = ({
  columns,
  formRef,
  actionRef,
  searchParamsRef,
  onReset,
  pinnedSearchUiEpoch = 0,
  onSearchParamsApplied,
}) => {
  const { t } = useTranslation();

  return (
    <ErrorBoundary
      fallback={
        <span style={{ color: 'red', fontSize: '12px' }}>
          {t('components.uniSearch.searchError')}
        </span>
      }
    >
      <Suspense fallback={<span style={{ opacity: 0.6 }}>…</span>}>
        <LazyQuerySearchButton
          columns={columns}
          formRef={formRef}
          actionRef={actionRef}
          searchParamsRef={searchParamsRef}
          showReset={Boolean(onReset)}
          onReset={onReset}
          pinnedSearchUiEpoch={pinnedSearchUiEpoch}
          onSearchParamsApplied={onSearchParamsApplied}
        />
      </Suspense>
    </ErrorBoundary>
  );
};

export interface UniSearchProps {
  /** ProTable 左侧、模糊搜索前的扩展（如自定义按钮） */
  beforeSearch?: React.ReactNode;
  /**
   * 模糊搜索与高级搜索之间的插槽（如手机端将「新建」提到此处）
   */
  betweenFuzzyAndAdvanced?: React.ReactNode;
  /** 模糊搜索占位文案（默认走 i18n） */
  fuzzyPlaceholder?: string;
  /** 是否显示模糊搜索框 */
  showFuzzySearch?: boolean;
  fuzzyValue: string;
  onFuzzyChange: (value: string) => void;
  onFuzzyPressEnter?: (value: string) => void;
  onFuzzyFocus?: () => void;
  /**
   * 自定义高级搜索节点（少见；优先使用 advancedSearchTableProps 保持唯一实现源）
   */
  advancedSearch?: React.ReactNode;
  /**
   * 与 ProTable 联用时传入，由本组件内部渲染 UniAdvancedSearch（推荐，与 UniTable 默认一致）
   */
  advancedSearchTableProps?: UniAdvancedSearchProps;
  showAdvancedSearch?: boolean;
  /** 高级搜索后的扩展 */
  afterSearch?: React.ReactNode;
  /** 是否显示重置（清空关键词并刷新列表） */
  showReset?: boolean;
  onReset?: () => void;
  resetText?: string;
  isMobile?: boolean;
  toolBarButtonSize?: ButtonProps['size'];
  className?: string;
  style?: React.CSSProperties;
}

const UniSearch: React.FC<UniSearchProps> = ({
  beforeSearch,
  betweenFuzzyAndAdvanced,
  fuzzyPlaceholder,
  showFuzzySearch = true,
  fuzzyValue,
  onFuzzyChange,
  onFuzzyPressEnter,
  onFuzzyFocus,
  advancedSearch,
  advancedSearchTableProps,
  showAdvancedSearch = true,
  afterSearch,
  showReset = true,
  onReset,
  resetText,
  isMobile = false,
  toolBarButtonSize = 'middle',
  className,
  style,
}) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const placeholder = fuzzyPlaceholder ?? t('components.uniSearch.fuzzySearch');
  const resetLabel = resetText ?? t('components.uniSearch.reset');

  const canReset = Boolean(showReset && onReset);
  /** 默认高级搜索条内已带「重置」，不再在整条最右侧重复渲染 */
  const passInlineReset =
    canReset &&
    !isMobile &&
    showAdvancedSearch &&
    Boolean(advancedSearchTableProps) &&
    !advancedSearch;

  const resolvedAdvanced =
    advancedSearch ??
    (!isMobile && showAdvancedSearch && advancedSearchTableProps ? (
      <UniAdvancedSearch
        {...advancedSearchTableProps}
        onReset={passInlineReset ? onReset : undefined}
      />
    ) : null);

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: isMobile ? 'wrap' : 'nowrap',
        rowGap: 8,
        minWidth: 0,
        flex: '1 1 0',
        overflow: 'hidden',
        ...style,
      }}
    >
      {beforeSearch}
      {showFuzzySearch && (
        <Input
          className="uni-table-fuzzy-search uni-search-fuzzy-input"
          placeholder={placeholder}
          allowClear
          value={fuzzyValue}
          onFocus={onFuzzyFocus}
          onChange={(e) => onFuzzyChange(e.target.value)}
          onPressEnter={(e) =>
            onFuzzyPressEnter?.((e.target as HTMLInputElement).value)
          }
          style={{
            width: isMobile ? 'calc(100% - 100px)' : 160,
            flex: isMobile ? '1 1 auto' : '0 0 160px',
            ...getUniToolbarControlShellStyle(token),
          }}
        />
      )}
      {betweenFuzzyAndAdvanced}
      {!isMobile && showAdvancedSearch && resolvedAdvanced ? (
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center' }}>{resolvedAdvanced}</div>
      ) : null}
      {afterSearch}
      {!isMobile && canReset && !passInlineReset && (
        <Button
          type="default"
          icon={<ReloadOutlined />}
          size={toolBarButtonSize}
          onClick={onReset}
          className="uni-search-reset-btn"
        >
          {resetLabel}
        </Button>
      )}
    </div>
  );
};

export default UniSearch;

/** 需单独挂载高级搜索按钮（非完整 UniSearch 条）时使用 */
export { QuerySearchModal } from '../uni-query';
