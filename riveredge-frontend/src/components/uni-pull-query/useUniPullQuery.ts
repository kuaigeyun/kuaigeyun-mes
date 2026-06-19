import { useCallback, useMemo, useRef, useState } from 'react';
import type { UniPullQueryLoadParams, UseUniPullQueryOptions } from './types';

const DEFAULT_PAGE_SIZE = 20;

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
 * 上拉取单弹窗状态：分段范围/打开/搜索/分页/选中/加载/提交。
 */
export function useUniPullQuery<T extends object>(options: UseUniPullQueryOptions<T>) {
  const {
    rowKey,
    loadData,
    onConfirm,
    isRowDisabled,
    selectionType = 'radio',
    pageSize: defaultPageSize = DEFAULT_PAGE_SIZE,
    scopeOptions,
    defaultScope,
    onOpen,
    onClose,
  } = options;

  const resolvedDefaultScope =
    defaultScope ?? scopeOptions?.[0]?.value ?? 'all';

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [searchDraft, setSearchDraft] = useState('');
  const [appliedKeyword, setAppliedKeyword] = useState('');
  const [scope, setScope] = useState(resolvedDefaultScope);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [dataSource, setDataSource] = useState<T[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const fetchSeqRef = useRef(0);
  const hasScope = scopeOptions != null && scopeOptions.length > 0;

  const buildLoadParams = useCallback(
    (keyword: string, nextPage: number): UniPullQueryLoadParams => ({
      keyword,
      page: nextPage,
      pageSize: defaultPageSize,
      ...(hasScope ? { scope } : {}),
    }),
    [defaultPageSize, hasScope, scope],
  );

  const load = useCallback(
    async (params: UniPullQueryLoadParams) => {
      const seq = ++fetchSeqRef.current;
      setLoading(true);
      try {
        const result = await loadData(params);
        if (seq !== fetchSeqRef.current) {
          return;
        }
        setDataSource(result.data);
        setTotal(result.total);
      } catch {
        if (seq !== fetchSeqRef.current) {
          return;
        }
        setDataSource([]);
        setTotal(0);
      } finally {
        if (seq === fetchSeqRef.current) {
          setLoading(false);
        }
      }
    },
    [loadData],
  );

  const reloadCurrent = useCallback(() => {
    void load(buildLoadParams(appliedKeyword, page));
  }, [appliedKeyword, buildLoadParams, load, page]);

  const openModal = useCallback(() => {
    setSearchDraft('');
    setAppliedKeyword('');
    setScope(resolvedDefaultScope);
    setPage(1);
    setTotal(0);
    setSelectedRowKeys([]);
    setDataSource([]);
    setOpen(true);
    onOpen?.();
    void load({
      keyword: '',
      page: 1,
      pageSize: defaultPageSize,
      ...(hasScope ? { scope: resolvedDefaultScope } : {}),
    });
  }, [defaultPageSize, hasScope, load, onOpen, resolvedDefaultScope]);

  const closeModal = useCallback(() => {
    fetchSeqRef.current += 1;
    setOpen(false);
    onClose?.();
  }, [onClose]);

  const handleSearchApply = useCallback(
    (keyword: string) => {
      const normalized = keyword.trim();
      setSearchDraft(keyword);
      setAppliedKeyword(normalized);
      setPage(1);
      void load(buildLoadParams(normalized, 1));
    },
    [buildLoadParams, load],
  );

  const handleSearchClear = useCallback(() => {
    setSearchDraft('');
    setAppliedKeyword('');
    setPage(1);
    void load(buildLoadParams('', 1));
  }, [buildLoadParams, load]);

  const handleScopeChange = useCallback(
    (nextScope: string) => {
      setScope(nextScope);
      setPage(1);
      setSelectedRowKeys([]);
      void load({
        keyword: appliedKeyword,
        page: 1,
        pageSize: defaultPageSize,
        ...(hasScope ? { scope: nextScope } : {}),
      });
    },
    [appliedKeyword, defaultPageSize, hasScope, load],
  );

  const handlePageChange = useCallback(
    (nextPage: number) => {
      setPage(nextPage);
      void load(buildLoadParams(appliedKeyword, nextPage));
    },
    [appliedKeyword, buildLoadParams, load],
  );

  const handleSelectedRowKeysChange = useCallback((keys: React.Key[], rows: T[]) => {
    setSelectedRowKeys(keys);
    void rows;
  }, []);

  const selectedRows = useMemo(
    () =>
      dataSource.filter((row) => selectedRowKeys.includes(resolveRowKey(row, rowKey))),
    [dataSource, rowKey, selectedRowKeys],
  );

  const hasDisabledSelection = useMemo(
    () => selectedRows.some((row) => isRowDisabled?.(row)),
    [isRowDisabled, selectedRows],
  );

  const handleConfirm = useCallback(async () => {
    setConfirmLoading(true);
    try {
      await onConfirm(selectedRowKeys, selectedRows);
    } finally {
      setConfirmLoading(false);
    }
  }, [onConfirm, selectedRowKeys, selectedRows]);

  return {
    open,
    openModal,
    closeModal,
    loading,
    confirmLoading,
    searchDraft,
    setSearchDraft,
    appliedKeyword,
    scope,
    scopeOptions,
    handleScopeChange,
    page,
    pageSize: defaultPageSize,
    total,
    dataSource,
    selectedRowKeys,
    selectedRows,
    selectedCount: selectedRowKeys.length,
    reloadCurrent,
    handleSearchApply,
    handleSearchClear,
    handlePageChange,
    handleSelectedRowKeysChange,
    handleConfirm,
    selectionType,
    isRowDisabled,
    hasDisabledSelection,
  };
}
