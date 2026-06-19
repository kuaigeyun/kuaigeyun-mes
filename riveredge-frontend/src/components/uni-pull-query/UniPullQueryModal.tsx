import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Flex, Modal, Table, theme } from 'antd';
import { MODAL_CONFIG } from '../layout-templates/constants';
import { UniPullQueryFilterBar } from './UniPullQueryFilterBar';
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
 * 统一上拉取单弹窗：筛选栏 + 可选表格 + 分页 + 确认创建。
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
  width = MODAL_CONFIG.EXTRA_LARGE_WIDTH,
  zIndex,
  destroyOnHidden = true,
  alert,
  footerHint,
  tableScroll = { x: 1180, y: 360 },
}: UniPullQueryModalProps<T>) {
  const { t } = useTranslation();
  const { token } = theme.useToken();

  const resolvedSearchPlaceholder = String(
    searchPlaceholder ?? t('components.uniPullQuery.searchPlaceholder'),
  );
  const resolvedEmptyText = emptyText ?? t('components.uniPullQuery.empty');
  const resolvedEmptySearchText = emptySearchText ?? t('components.uniPullQuery.emptySearch');
  const resolvedOkText = okText ?? t('common.confirm');
  const resolvedCancelText = cancelText ?? t('common.cancel');
  const selectedCount = selectedRowKeys.length;

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
      <Table<T>
        rowKey={rowKey}
        loading={loading}
        size="small"
        columns={columns}
        dataSource={dataSource}
        locale={{
          emptyText: appliedKeyword.trim() ? resolvedEmptySearchText : resolvedEmptyText,
        }}
        rowSelection={{
          type: selectionType,
          selectedRowKeys,
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
          onChange: (nextPage) => onPageChange(nextPage),
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
