import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Flex, Modal, Table, theme } from 'antd';
import { MODAL_CONFIG } from '../layout-templates/constants';
import { UniPullQueryFilterBar } from './UniPullQueryFilterBar';
import {
  UniPullQuerySelectionBar,
  type UniPullQueryCrossPageMode,
} from './UniPullQuerySelectionBar';
import { defaultPullRowLabel } from './defaultPullRowLabel';
import type { UniPullQueryModalProps } from './types';

function resolveRowKey<T extends object>(
  record: T,
  rowKey: string | ((record: T) => React.Key),
): React.Key {
  if (typeof rowKey === 'function') {
    return rowKey(record);
  }
  return (record as Record<string, unknown>)[rowKey] as React.Key;
}

/**
 * 统一加载取单弹窗：筛选栏 + 可选表格 + 分页 + 确认创建。
 * 筛选区样式对齐 UniMaterialBatchPicker。
 */
export function UniPullQueryModal<T extends object>({
  open,
  title,
  onCancel,
  onOk,
  rowKey,
  columns,
  dataSource,
  loading = false,
  confirmLoading = false,
  selectionType = 'radio',
  selectedRowKeys,
  onSelectedRowKeysChange,
  isRowDisabled,
  searchDraft,
  onSearchDraftChange,
  onSearchApply,
  onSearchClear,
  appliedKeyword,
  searchPlaceholder,
  emptyText,
  emptySearchText,
  page,
  pageSize,
  total,
  onPageChange,
  scopeOptions,
  scope,
  onScopeChange,
  filterExtra,
  okText,
  cancelText,
  okButtonProps,
  width = MODAL_CONFIG.PULL_QUERY_WIDTH,
  zIndex,
  destroyOnHidden = true,
  afterOpenChange,
  alert,
  footerHint,
  tableScroll = { y: 360 },
  selectedRows,
  getRowLabel,
}: UniPullQueryModalProps<T>) {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const isMultiSelect = selectionType === 'checkbox';
  const [crossPageMode, setCrossPageMode] = useState<UniPullQueryCrossPageMode>('page');

  const resolvedSearchPlaceholder = String(
    searchPlaceholder ?? t('components.uniPullQuery.searchPlaceholder'),
  );
  const resolvedEmptyText = emptyText ?? t('components.uniPullQuery.empty');
  const resolvedEmptySearchText = emptySearchText ?? t('components.uniPullQuery.emptySearch');
  const resolvedOkText = okText ?? t('common.confirm');
  const resolvedCancelText = cancelText ?? t('common.cancel');
  const selectedCount = selectedRowKeys.length;
  const resolveLabel = getRowLabel ?? ((record: T) => defaultPullRowLabel(record));

  useEffect(() => {
    if (!open) setCrossPageMode('page');
  }, [open]);

  const previewItems = useMemo(() => {
    const rowByKey = new Map<React.Key, T>();
    for (const row of selectedRows ?? []) {
      rowByKey.set(resolveRowKey(row, rowKey), row);
    }
    for (const row of dataSource) {
      const key = resolveRowKey(row, rowKey);
      if (!rowByKey.has(key)) rowByKey.set(key, row);
    }
    const unlabeled = t('components.uniPullQuery.selectedUnlabeled');
    return selectedRowKeys.map((key) => {
      const row = rowByKey.get(key);
      const label = row ? String(resolveLabel(row) ?? '').trim() : '';
      return { key, label: label || unlabeled };
    });
  }, [dataSource, resolveLabel, rowKey, selectedRowKeys, selectedRows, t]);

  const handleRemoveSelected = useCallback(
    (key: React.Key) => {
      const nextKeys = selectedRowKeys.filter((item) => item !== key);
      const nextRows = (selectedRows ?? dataSource).filter((row) =>
        nextKeys.includes(resolveRowKey(row, rowKey)),
      );
      onSelectedRowKeysChange(nextKeys, nextRows);
    },
    [dataSource, onSelectedRowKeysChange, rowKey, selectedRowKeys, selectedRows],
  );

  const handleClearSelected = useCallback(() => {
    onSelectedRowKeysChange([], []);
  }, [onSelectedRowKeysChange]);

  const handleCrossPageModeChange = useCallback(
    (mode: UniPullQueryCrossPageMode) => {
      setCrossPageMode(mode);
      if (mode !== 'page') return;
      const pageKeys = new Set(dataSource.map((row) => resolveRowKey(row, rowKey)));
      const nextKeys = selectedRowKeys.filter((key) => pageKeys.has(key));
      if (nextKeys.length === selectedRowKeys.length) return;
      const nextRows = dataSource.filter((row) => nextKeys.includes(resolveRowKey(row, rowKey)));
      onSelectedRowKeysChange(nextKeys, nextRows);
    },
    [dataSource, onSelectedRowKeysChange, rowKey, selectedRowKeys],
  );

  const handlePageChange = useCallback(
    (nextPage: number) => {
      if (isMultiSelect && crossPageMode === 'page') {
        onSelectedRowKeysChange([], []);
      }
      onPageChange(nextPage);
    },
    [crossPageMode, isMultiSelect, onPageChange, onSelectedRowKeysChange],
  );

  const handleRowClick = useCallback(
    (record: T, event: React.MouseEvent<HTMLElement>) => {
      const target = event.target as HTMLElement;
      if (
        target.closest('.ant-checkbox-wrapper, .ant-checkbox, .ant-radio-wrapper, .ant-radio, button, a, input, textarea, select')
      ) {
        return;
      }
      if (isRowDisabled?.(record)) {
        return;
      }
      const key = resolveRowKey(record, rowKey);
      if (selectionType === 'radio') {
        onSelectedRowKeysChange([key], [record]);
        return;
      }
      const selected = selectedRowKeys.includes(key);
      const nextKeys = selected
        ? selectedRowKeys.filter((k) => k !== key)
        : [...selectedRowKeys, key];
      const nextRows = dataSource.filter((row) =>
        nextKeys.includes(resolveRowKey(row, rowKey)),
      );
      onSelectedRowKeysChange(nextKeys, nextRows);
    },
    [dataSource, isRowDisabled, onSelectedRowKeysChange, rowKey, selectedRowKeys, selectionType],
  );

  return (
    <Modal
      title={title}
      styles={{ header: { marginBottom: 0 }, body: { paddingTop: 12 } }}
      style={{ maxWidth: 'calc(100vw - 32px)' }}
      open={open}
      width={width}
      zIndex={zIndex}
      onCancel={onCancel}
      onOk={onOk}
      okText={resolvedOkText}
      cancelText={resolvedCancelText}
      okButtonProps={okButtonProps}
      confirmLoading={confirmLoading}
      destroyOnHidden={destroyOnHidden}
      afterOpenChange={afterOpenChange}
    >
      <UniPullQueryFilterBar
        searchDraft={searchDraft}
        onSearchDraftChange={onSearchDraftChange}
        onSearchApply={onSearchApply}
        onSearchClear={onSearchClear}
        searchPlaceholder={resolvedSearchPlaceholder}
        scopeOptions={scopeOptions}
        scope={scope}
        onScopeChange={onScopeChange}
        filterExtra={filterExtra}
      />
      <UniPullQuerySelectionBar
        showCrossPage={isMultiSelect}
        crossPageMode={crossPageMode}
        onCrossPageModeChange={handleCrossPageModeChange}
        items={previewItems}
        onRemove={handleRemoveSelected}
        onClear={handleClearSelected}
      />
      <Table<T>
        rowKey={rowKey}
        loading={loading}
        size="small"
        tableLayout="fixed"
        columns={columns}
        dataSource={dataSource}
        locale={{
          emptyText: appliedKeyword.trim() ? resolvedEmptySearchText : resolvedEmptyText,
        }}
        rowSelection={{
          type: selectionType,
          selectedRowKeys,
          preserveSelectedRowKeys: !isMultiSelect || crossPageMode === 'cross',
          onChange: (keys, rows) => {
            onSelectedRowKeysChange(keys, rows);
          },
          getCheckboxProps: (record) => ({
            disabled: isRowDisabled?.(record) ?? false,
          }),
        }}
        onRow={(record) => ({
          onClick: (event) => handleRowClick(record, event),
          style: { cursor: isRowDisabled?.(record) ? 'not-allowed' : 'pointer' },
        })}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: false,
          onChange: (nextPage) => handlePageChange(nextPage),
          showTotal: (tot) => (
            <Flex gap={16} align="center">
              <span style={{ color: token.colorTextSecondary, fontSize: 13 }}>
                {t('components.uniPullQuery.selectedCount', { count: selectedCount })}
              </span>
              <span style={{ color: token.colorTextSecondary, fontSize: 13 }}>
                {t('components.uniPullQuery.pageTotal', { total: tot })}
              </span>
            </Flex>
          ),
        }}
        scroll={tableScroll}
      />
      {footerHint ? <div style={{ marginTop: 12 }}>{footerHint}</div> : null}
      {alert ? <div style={{ marginTop: 12 }}>{alert}</div> : null}
    </Modal>
  );
}
