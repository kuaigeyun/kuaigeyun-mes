import type { ButtonProps, TableColumnsType, TableProps } from 'antd';
import type { ReactNode } from 'react';

export type UniPullQuerySelectionType = 'radio' | 'checkbox';

export interface UniPullQueryScopeOption {
  label: ReactNode;
  value: string;
}

export interface UniPullQueryLoadParams {
  keyword: string;
  page: number;
  pageSize: number;
  /** 分段范围，如 pullable / all */
  scope?: string;
}

export interface UniPullQueryLoadResult<T> {
  data: T[];
  total: number;
}

export interface UniPullQueryModalProps<T extends object> {
  open: boolean;
  title: ReactNode;
  onCancel: () => void;
  onOk: () => void | Promise<void>;

  rowKey: string | ((record: T) => React.Key);
  columns: TableColumnsType<T>;
  dataSource: T[];
  loading?: boolean;
  confirmLoading?: boolean;

  selectionType?: UniPullQuerySelectionType;
  selectedRowKeys: React.Key[];
  onSelectedRowKeysChange: (keys: React.Key[], rows: T[]) => void;
  isRowDisabled?: (record: T) => boolean;

  /** 搜索框草稿（输入中，未提交） */
  searchDraft: string;
  onSearchDraftChange: (value: string) => void;
  /** 提交搜索（Enter / 放大镜），通常重置到第 1 页 */
  onSearchApply: (keyword: string) => void;
  onSearchClear: () => void;
  /** 已生效的搜索关键词，用于空态文案 */
  appliedKeyword: string;
  searchPlaceholder?: ReactNode;

  emptyText?: ReactNode;
  emptySearchText?: ReactNode;

  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;

  /** 搜索框前分段：可加载单据 / 全部单据 */
  scopeOptions?: UniPullQueryScopeOption[];
  scope?: string;
  onScopeChange?: (scope: string) => void;

  /** 搜索框右侧扩展筛选 */
  filterExtra?: ReactNode;

  okText?: ReactNode;
  cancelText?: ReactNode;
  okButtonProps?: ButtonProps;
  width?: number;
  zIndex?: number;
  destroyOnHidden?: boolean;

  /** 表格下方提示（如重复下推警告） */
  alert?: ReactNode;
  /** 表格下方补充说明 */
  footerHint?: ReactNode;
  tableScroll?: TableProps<T>['scroll'];
}

export interface UseUniPullQueryOptions<T extends object> {
  rowKey: string | ((record: T) => React.Key);
  loadData: (params: UniPullQueryLoadParams) => Promise<UniPullQueryLoadResult<T>>;
  onConfirm: (selectedKeys: React.Key[], selectedRows: T[]) => Promise<void>;
  isRowDisabled?: (record: T) => boolean;
  selectionType?: UniPullQuerySelectionType;
  pageSize?: number;
  /** 分段选项；提供时默认 scope 为 defaultScope 或首项 */
  scopeOptions?: UniPullQueryScopeOption[];
  defaultScope?: string;
  onOpen?: () => void;
  onClose?: () => void;
}
