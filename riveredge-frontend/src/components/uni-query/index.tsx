/**
 * RiverEdge SaaS 多组织框架 - ProTable 查询条件保存插件
 *
 * 用于接管 ProTable 的搜索栏，将搜索条件在弹窗中展示
 */

import { useRef, useState, useEffect, useLayoutEffect, useCallback, useMemo, forwardRef, type CSSProperties, type MouseEventHandler, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { ActionType, ProFormInstance, ProColumns } from '@ant-design/pro-components';
import SafeProFormSelect from '../safe-pro-form-select';
import { ProForm, ProFormText, ProFormDatePicker, ProFormDateRangePicker } from '@ant-design/pro-components';
import { Button, Modal, Row, Col, AutoComplete, Input, Space, App, Typography, Dropdown, theme, Tabs, Tag, Divider } from 'antd';
import { SaveOutlined, DeleteOutlined, DownOutlined, EditOutlined, PushpinOutlined, PushpinFilled, MoreOutlined, ReloadOutlined, SearchOutlined, ShareAltOutlined, HolderOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import type { AutoCompleteProps } from 'antd';
import { filterByPinyinInitials } from '../../utils/pinyin';
import { useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSavedSearchList, createSavedSearch, deleteSavedSearchByUuid, updateSavedSearchByUuid, SavedSearch } from '../../services/savedSearch';
import { getToken } from '../../utils/auth';
import { useGlobalStore, useSavedSearchVersionStore } from '../../stores';
import { getSavedSearchOrder, setSavedSearchOrder } from '../../stores/savedSearchOrderStorage';
import { QuickFilters } from './QuickFilters';
import { AdvancedFilters } from './AdvancedFilters';
import type { FilterGroup, FilterConfigData } from './types';
import { convertFiltersToApiParams } from './filterUtils';
import {
  LEGACY_LIST_LIFECYCLE_FIELD,
  LIST_LIFECYCLE_STAGE_FIELD,
  arePinnedSearchParamsActive,
  commitListPageSearchParams,
  isRemotePinnedSearchRedundantWithBuiltinLifecycle,
} from '../../utils/listLifecycleStage';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/**
 * 可拖拽的列表项组件
 */
interface SortableListItemProps {
  id: number;
  children: (listeners: any) => React.ReactNode;
}

const SortableListItem: React.FC<SortableListItemProps> = ({ id, children }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      {children(listeners)}
    </div>
  );
};

type SimpleListProps<T> = {
  dataSource: T[];
  renderItem: (item: T, index: number) => ReactNode;
  size?: 'small' | 'middle' | 'large';
};

type SimpleListItemProps = {
  children?: ReactNode;
  actions?: ReactNode[];
  style?: CSSProperties;
  onMouseEnter?: MouseEventHandler<HTMLDivElement>;
  onMouseLeave?: MouseEventHandler<HTMLDivElement>;
};

type SimpleListItemMetaProps = {
  avatar?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  style?: CSSProperties;
};

const SimpleListBase = <T,>({ dataSource, renderItem }: SimpleListProps<T>) => (
  <div>
    {dataSource.map((item, index) => (
      <div key={(item as any)?.id ?? index}>{renderItem(item, index)}</div>
    ))}
  </div>
);

const SimpleListItem = ({ children, actions, style, onMouseEnter, onMouseLeave }: SimpleListItemProps) => (
  <div style={style} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
    <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    {actions?.length ? (
      <div style={{ display: 'flex', alignItems: 'center', columnGap: 4 }}>{actions}</div>
    ) : null}
  </div>
);

const SimpleListItemMeta = ({ avatar, title, description, style }: SimpleListItemMetaProps) => (
  <div style={{ display: 'flex', alignItems: 'center', width: '100%', ...style }}>
    {avatar ? <div style={{ marginRight: 8 }}>{avatar}</div> : null}
    <div style={{ flex: 1, minWidth: 0 }}>
      {title ? <div>{title}</div> : null}
      {description ? (
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {description}
        </Typography.Text>
      ) : null}
    </div>
  </div>
);

const List = Object.assign(SimpleListBase, {
  Item: Object.assign(SimpleListItem, {
    Meta: SimpleListItemMeta,
  }),
});

/**
 * 自动完成输入框组件属性
 */
interface AutoCompleteInputProps {
  /**
   * 占位符
   */
  placeholder?: string;
  /**
   * AutoComplete 配置对象（直接传递给 AutoComplete 组件）
   */
  autoCompleteConfig?: AutoCompleteProps;
  /**
   * 静态自动完成选项数组
   */
  autoCompleteOptions?: Array<{ label: string; value: string }>;
  /**
   * 自动完成 API 函数（异步获取选项）
   * @param keyword - 搜索关键词
   * @returns 选项数组
   */
  autoCompleteApi?: (keyword: string) => Promise<Array<{ label: string; value: string }>>;
  /**
   * 其他字段属性（包含 Form.Item 注入的 value 和 onChange）
   */
  fieldProps?: any;
  /**
   * 表单值（Form.Item 自动注入）
   */
  value?: string;
  /**
   * 表单 onChange（Form.Item 自动注入）
   */
  onChange?: (value: string) => void;
}

/**
 * 自动完成输入框组件
 * 
 * 封装了 Ant Design 的 AutoComplete 组件，支持静态选项和异步 API 获取选项
 * 
 * ⭐ 关键：使用 forwardRef 确保 ProForm.Item 能够正确注入 value 和 onChange
 */
const AutoCompleteInput = forwardRef<any, AutoCompleteInputProps>(({
  placeholder,
  autoCompleteConfig,
  autoCompleteOptions,
  autoCompleteApi,
  fieldProps,
  value: propValue, // ⭐ 关键：从 props 中获取 value（Form.Item 注入）
  onChange: propOnChange, // ⭐ 关键：从 props 中获取 onChange（Form.Item 注入）
}, ref) => {
  // ⭐ 最佳实践：统一状态管理
  const [options, setOptions] = useState<Array<{ label: string; value: string }>>(
    autoCompleteOptions || []
  );
  const [loading, setLoading] = useState(false);
  
  // ⭐ 最佳实践：使用 AbortController 处理请求取消
  const abortControllerRef = useRef<AbortController | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentSearchIdRef = useRef<number>(0);

  /**
   * 实时过滤静态选项（同步，立即响应）
   */
  const filterStaticOptions = useCallback((keyword: string) => {
    if (!autoCompleteOptions) {
      return [];
    }
    
    if (!keyword || keyword.trim() === '') {
      return autoCompleteOptions;
    }

    try {
      // 使用拼音工具函数进行过滤（支持拼音首字母匹配）
      return filterByPinyinInitials(autoCompleteOptions, keyword);
    } catch (error) {
      // 如果拼音库不可用，使用普通过滤
      const lowerKeyword = keyword.toLowerCase();
      return autoCompleteOptions.filter(
        (option) =>
          option.label.toLowerCase().includes(lowerKeyword) ||
          option.value.toLowerCase().includes(lowerKeyword)
      );
    }
  }, [autoCompleteOptions]);

  /**
   * 处理搜索（最佳实践：使用 AbortController + 防抖 + 请求ID）
   */
  const handleSearch = useCallback(
    (keyword: string) => {
      const trimmedKeyword = (keyword || '').trim();
      
      // ⭐ 最佳实践：取消之前的请求
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      
      // 清除之前的防抖定时器
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = null;
      }

      // 1. 静态选项：立即过滤（同步，实时响应）
      if (autoCompleteOptions && !autoCompleteApi) {
        const filtered = filterStaticOptions(trimmedKeyword);
        setOptions(filtered);
        setLoading(false);
        return;
      }

      // 2. API 调用：防抖处理（避免频繁请求）
      if (autoCompleteApi) {
        // 如果关键词为空，立即清空选项
        if (!trimmedKeyword) {
          setOptions([]);
          setLoading(false);
          return;
        }

        // ⭐ 最佳实践：生成新的搜索ID，用于防止竞态条件
        const searchId = ++currentSearchIdRef.current;
        
        // 设置加载状态（立即显示，提升用户体验）
        setLoading(true);

        // ⭐ 最佳实践：防抖处理，200ms 后执行 API 调用
        searchTimeoutRef.current = setTimeout(async () => {
          // 检查搜索ID是否仍然有效（防止竞态条件）
          if (searchId !== currentSearchIdRef.current) {
            setLoading(false);
            return;
          }

          // ⭐ 最佳实践：创建新的 AbortController
          const abortController = new AbortController();
          abortControllerRef.current = abortController;

          try {
            const apiOptions = await autoCompleteApi(trimmedKeyword);
            
            // ⭐ 最佳实践：检查请求是否被取消，以及搜索ID是否仍然有效
            if (abortController.signal.aborted || searchId !== currentSearchIdRef.current) {
              return;
            }
            
            // ⭐ 最佳实践：确保返回的是数组
            setOptions(Array.isArray(apiOptions) ? apiOptions : []);
          } catch (error: any) {
            // ⭐ 最佳实践：忽略被取消的请求错误
            if (error?.name === 'AbortError' || abortController.signal.aborted) {
              return;
            }
            
            // ⭐ 最佳实践：检查搜索ID是否仍然有效
            if (searchId !== currentSearchIdRef.current) {
              return;
            }
            
            // 其他错误：清空选项
            setOptions([]);
            console.error('AutoComplete API 调用失败:', error);
          } finally {
            // ⭐ 最佳实践：只有在搜索ID仍然有效时才更新加载状态
            if (searchId === currentSearchIdRef.current && !abortController.signal.aborted) {
              setLoading(false);
            }
            
            // 清理 AbortController
            if (abortControllerRef.current === abortController) {
              abortControllerRef.current = null;
            }
          }
        }, 200); // 防抖时间：200ms，平衡实时性和性能
      } else {
        // 没有配置自动完成，清空选项
        setOptions([]);
        setLoading(false);
      }
    },
    [autoCompleteApi, autoCompleteOptions, filterStaticOptions]
  );


  // ⚠️ 修复：使用 ref 跟踪选项是否已初始化，避免无限循环
  const optionsInitializedRef = useRef(false);
  const prevAutoCompleteOptionsRef = useRef(autoCompleteOptions);
  const prevAutoCompleteApiRef = useRef(autoCompleteApi);
  
  /**
   * 初始化：如果有静态选项，显示所有选项
   * ⚠️ 修复：只在配置实际变化时更新，避免无限循环
   */
  useEffect(() => {
    // 使用 JSON.stringify 进行深度比较，避免引用变化导致的无限循环
    const optionsChanged = JSON.stringify(prevAutoCompleteOptionsRef.current) !== JSON.stringify(autoCompleteOptions);
    const apiChanged = prevAutoCompleteApiRef.current !== autoCompleteApi;
    
    if (optionsChanged || apiChanged || !optionsInitializedRef.current) {
      prevAutoCompleteOptionsRef.current = autoCompleteOptions;
      prevAutoCompleteApiRef.current = autoCompleteApi;
      
      if (autoCompleteOptions && !autoCompleteApi) {
        // ⭐ 修复：初始化时显示所有选项，提升用户体验
        setOptions(autoCompleteOptions);
        optionsInitializedRef.current = true;
      } else if (!autoCompleteApi && !autoCompleteOptions) {
        // ⭐ 修复：如果没有配置，清空选项
        setOptions([]);
        optionsInitializedRef.current = true;
      } else {
        optionsInitializedRef.current = true;
      }
    }
  }, [autoCompleteOptions, autoCompleteApi]);

  /**
   * 清理资源（最佳实践：清理定时器和取消请求）
   */
  useEffect(() => {
    return () => {
      // 清理防抖定时器
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = null;
      }
      
      // 取消进行中的请求
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      
      // 更新搜索ID，使所有进行中的请求失效
      currentSearchIdRef.current = 0;
    };
  }, []);

  /**
   * 实时过滤选项（用于 filterOption，进一步提升实时性）
   */
  const filterOption = useMemo(() => {
    // 如果使用静态选项，提供实时过滤函数
    if (autoCompleteOptions && !autoCompleteApi) {
      return (inputValue: string, option?: { label: string; value: string }) => {
        if (!inputValue || !option) return true;
        const keyword = inputValue.toLowerCase();
        return (
          option.label.toLowerCase().includes(keyword) ||
          option.value.toLowerCase().includes(keyword) ||
          // 拼音首字母匹配
          (() => {
            try {
              const { matchPinyinInitials } = require('../../utils/pinyin');
              return matchPinyinInitials(option.label, inputValue) || 
                     matchPinyinInitials(option.value, inputValue);
            } catch {
              return false;
            }
          })()
        );
      };
    }
    return undefined; // API 调用时不使用 filterOption
  }, [autoCompleteOptions, autoCompleteApi]);

  // 合并配置：优先使用 autoCompleteConfig，然后使用我们的配置
  // ⭐ 重要：只传递 AutoComplete 支持的属性，过滤掉自定义属性
  const {
    autoCompleteApi: _autoCompleteApi,
    autoCompleteOptions: _autoCompleteOptions,
    autoComplete: _autoComplete,
    value: fieldValue, // 从 fieldProps 中提取 value（如果存在）
    onChange: fieldOnChange, // 从 fieldProps 中提取 onChange（如果存在）
    ...otherRestFieldProps
  } = fieldProps || {};
  
  // ⭐ 关键修复：优先使用 props 中的 value 和 onChange（Form.Item 直接注入）
  // 如果 props 中没有，则使用 fieldProps 中的（兼容性处理）
  // ⚠️ 注意：当 value 为 undefined 时，使用空字符串作为默认值，避免 AutoComplete 显示 undefined
  const value = propValue !== undefined ? propValue : (fieldValue !== undefined ? fieldValue : '');
  const onChange = propOnChange || fieldOnChange;
  
  // ⭐ 关键修复：处理 onChange 事件
  // AutoComplete 的 onChange 会在用户输入或选择选项时触发，需要更新表单值
  const handleChange = (selectedValue: string) => {
    // 调用表单的 onChange（更新表单值）
    if (onChange) {
      onChange(selectedValue);
    }
  };
  
  const mergedConfig: AutoCompleteProps = {
    placeholder,
    options: options || [], // ⭐ 修复：确保 options 始终是数组
    value, // ⭐ 关键：传递表单值
    onChange: handleChange, // ⭐ 关键：处理输入/选择时更新表单值
    onSearch: handleSearch, // 输入时实时触发，用于搜索选项（不影响表单值）
    loading,
    allowClear: true,
    defaultActiveFirstOption: true, // 默认激活第一个选项，提升体验
    filterOption: filterOption, // 实时过滤（仅静态选项，进一步提升实时性）
    // ⭐ 修复：不手动控制 open，让 AutoComplete 自动管理下拉框显示
    ...otherRestFieldProps, // fieldProps 中的其他属性（已过滤自定义属性和 value/onChange）
    ...autoCompleteConfig, // 用户自定义配置优先级最高（但 value 和 onChange 不会被覆盖）
  };

  return <AutoComplete {...mergedConfig} ref={ref} />;
});

// 设置 displayName 以便调试
AutoCompleteInput.displayName = 'AutoCompleteInput';

/**
 * 查询搜索弹窗组件属性
 */
interface QuerySearchModalProps {
  /**
   * ProTable 的 columns
   */
  columns: ProColumns<any>[];
  /**
   * ProTable 的 formRef
   */
  formRef: React.MutableRefObject<ProFormInstance | undefined>;
  /**
   * ProTable 的 actionRef
   */
  actionRef: React.MutableRefObject<ActionType | undefined>;
  /**
   * 搜索弹窗是否可见
   */
  visible: boolean;
  /**
   * 关闭弹窗回调
   */
  onClose: () => void;
  /**
   * Modal 自定义样式
   */
  style?: React.CSSProperties;
  /**
   * 搜索参数存储 ref（可选，用于直接传递搜索参数）
   */
  searchParamsRef?: React.MutableRefObject<Record<string, any> | undefined>;
  /** searchParamsRef 提交后回调（UniTable 用于刷新钉住 Tab 激活态） */
  onSearchParamsApplied?: () => void;
}

const BUILTIN_LIFECYCLE_STAGE_SEARCH_PREFIX = '__builtin__:lifecycle-stage:';

const getColumnFieldName = (column: ProColumns<any>): string | null => {
  const dataIndex = column.dataIndex;
  if (typeof dataIndex === 'string') {
    return dataIndex;
  }
  if (Array.isArray(dataIndex) && dataIndex.length > 0) {
    return String(dataIndex[0]);
  }
  return null;
};

const LIFECYCLE_STAGE_BUILTIN_MIN_SCORE = 40;

function scoreLifecycleStageColumn(column: ProColumns<any>, field: string): number {
  const title = String(column.title ?? '');
  let score = 0;
  if (field === LIST_LIFECYCLE_STAGE_FIELD) score += 200;
  if (field === LEGACY_LIST_LIFECYCLE_FIELD) score += 150;
  if (field === 'ledger_source') score += 120;
  if (/^operation_type$/i.test(field)) score += 120;
  if (/生命周期/.test(title)) score += 100;
  if (/lifecycle|stage|state/i.test(field)) score += 60;
  if (/^status$/i.test(field)) score += 40;
  if (/operation[\s_-]*type|action[\s_-]*type/i.test(field)) score += 80;
  if (/阶段/.test(title)) score += 70;
  if (/状态/.test(title)) score += 50;
  if (/来源/.test(title)) score += 50;
  if (/操作类型|动作类型/.test(title)) score += 90;
  if (/operation\s*type|action\s*type/i.test(title)) score += 60;
  return score;
}

const getLifecycleStageCandidates = (columns: ProColumns<any>[]) => {
  const searchableColumns = columns.filter((column) => {
    if (column.hideInSearch) return false;
    if (column.valueType === 'option') return false;
    if (!column.valueEnum || typeof column.valueEnum !== 'object' || Array.isArray(column.valueEnum)) return false;
    return true;
  });

  const candidates: { field: string; valueEnum: Record<string, any>; score: number }[] = [];
  for (const column of searchableColumns) {
    const field = getColumnFieldName(column);
    if (!field) continue;

    const valueEnum = column.valueEnum as Record<string, any>;
    const values = Object.keys(valueEnum).filter((key) => key !== '');
    if (values.length === 0) continue;

    const score = scoreLifecycleStageColumn(column, field);
    if (score >= LIFECYCLE_STAGE_BUILTIN_MIN_SCORE) {
      candidates.push({ field, valueEnum, score });
    }
  }

  return candidates.sort((a, b) => b.score - a.score);
};

const createBuiltinLifecycleStageSearches = (
  columns: ProColumns<any>[],
  pagePath: string,
  userId: number | undefined,
  stageNameTemplate: (stage: string) => string,
): SavedSearch[] => {
  const lifecycles = getLifecycleStageCandidates(columns);
  if (lifecycles.length === 0) return [];

  const now = new Date().toISOString();
  let idSeq = 0;

  return lifecycles.flatMap((lifecycle) => {
    const stageValues = Object.keys(lifecycle.valueEnum).filter((key) => key !== '');
    return stageValues.map((stageValue) => {
      const enumItem = lifecycle.valueEnum[stageValue];
      const stageLabel =
        typeof enumItem === 'object' && enumItem !== null && 'text' in enumItem
          ? String((enumItem as any).text)
          : String(enumItem ?? stageValue);
      idSeq += 1;
      return {
        id: -idSeq,
        uuid: `${BUILTIN_LIFECYCLE_STAGE_SEARCH_PREFIX}${pagePath}:${lifecycle.field}:${encodeURIComponent(stageValue)}`,
        user_id: userId ?? 0,
        page_path: pagePath,
        name: stageNameTemplate(stageLabel),
        is_shared: true,
        is_pinned: true,
        search_params: {
          [lifecycle.field]: stageValue,
        },
        created_at: now,
        updated_at: now,
      };
    });
  });
};

const isBuiltinSavedSearch = (search: SavedSearch): boolean =>
  search.uuid.startsWith(BUILTIN_LIFECYCLE_STAGE_SEARCH_PREFIX);

const filterRemotePinnedSearches = (
  remoteItems: SavedSearch[],
  builtinSearches: SavedSearch[],
): SavedSearch[] => {
  const builtinStageValues = builtinSearches
    .map((s) => s.search_params?.[LIST_LIFECYCLE_STAGE_FIELD])
    .filter((v): v is string => v != null && String(v).trim() !== '');
  const builtinLedgerSources = builtinSearches
    .map((s) => s.search_params?.ledger_source)
    .filter((v): v is string => v != null && String(v).trim() !== '');

  return remoteItems.filter((item) => {
    const params = item.search_params;
    if (
      builtinStageValues.length > 0 &&
      isRemotePinnedSearchRedundantWithBuiltinLifecycle(params, builtinStageValues)
    ) {
      return false;
    }
    const remoteSrc = params?.ledger_source != null ? String(params.ledger_source).trim() : '';
    if (remoteSrc && builtinLedgerSources.includes(remoteSrc)) {
      return false;
    }
    return true;
  });
};

/**
 * 查询搜索弹窗组件
 */
export const QuerySearchModal: React.FC<QuerySearchModalProps> = ({
  columns,
  formRef,
  actionRef,
  visible,
  onClose,
  searchParamsRef,
  onSearchParamsApplied,
}) => {
  const { t } = useTranslation();
  const searchFormRef = useRef<ProFormInstance>();
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  const { message: messageApi } = App.useApp();
  const queryClient = useQueryClient();
  const currentUser = useGlobalStore((s) => s.currentUser);
  const { token } = theme.useToken();
  
  // 获取当前页面路径
  const pagePath = location.pathname;
  
  // 判断是否是自己的搜索条件
  const isOwnSearch = (search: SavedSearch) => {
    if (isBuiltinSavedSearch(search)) {
      return false;
    }
    return currentUser && search.user_id === currentUser.id;
  };
  
  // 保存搜索条件弹窗状态
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveIsShared, setSaveIsShared] = useState(false);
  const [saveIsPinned, setSaveIsPinned] = useState(false);
  const [editingSearch, setEditingSearch] = useState<SavedSearch | null>(null);
  
  // 筛选功能状态
  const [quickFilters, setQuickFilters] = useState<Record<string, any[]>>({});
  const [filterGroups, setFilterGroups] = useState<FilterGroup[]>([]);
  const [activeTab, setActiveTab] = useState<'search' | 'filter'>('search');
  
  // 帮助弹窗状态
  const [helpModalVisible, setHelpModalVisible] = useState(false);
  
  // 检查是否有 Token（只有登录用户才能获取保存的搜索条件）
  const hasToken = !!getToken();
  
  // 获取已保存的搜索条件列表
  // 注意：所有用户（包括普通用户、组织管理员、平台管理用户、平台超级管理员）都可以使用 saved-searches API
  const { data: savedSearchesData } = useQuery({
    queryKey: ['savedSearches', pagePath],
    queryFn: () => getSavedSearchList(pagePath, true),
    // 只要弹窗打开且有 Token 就可以获取数据
    enabled: visible && hasToken,
    // ⚠️ 修复：401 错误时静默失败，不抛出错误，避免触发全局错误处理
    retry: (failureCount, error: any) => {
      // 如果是 401 错误，不重试
      if (error?.response?.status === 401) {
        return false;
      }
      // 其他错误最多重试 1 次
      return failureCount < 1;
    },
    // ⚠️ 修复：401 错误时不抛出错误，静默失败
    throwOnError: false,
  });
  
  const builtinLifecycleStageSearches = useMemo(
    () =>
      createBuiltinLifecycleStageSearches(
        columns,
        pagePath,
        currentUser?.id,
        (stage) => stage,
      ),
    [columns, pagePath, currentUser?.id],
  );

  const savedSearches = useMemo(() => {
    const remoteItems = filterRemotePinnedSearches(
      (savedSearchesData?.items || []).filter((item) => !isBuiltinSavedSearch(item)),
      builtinLifecycleStageSearches,
    );
    if (builtinLifecycleStageSearches.length === 0) {
      return remoteItems;
    }
    return [...builtinLifecycleStageSearches, ...remoteItems];
  }, [savedSearchesData?.items, builtinLifecycleStageSearches]);
  
  // 拖拽排序状态（用于实时更新UI）
  const [personalOrder, setPersonalOrder] = useState<number[]>([]);
  const [sharedOrder, setSharedOrder] = useState<number[]>([]);
  
  // 初始化排序后的列表（使用 useMemo 避免状态更新循环）
  const [personalSearches, sharedSearches] = useMemo(() => {
    const personal = savedSearches.filter((item) => !item.is_shared);
    const shared = savedSearches.filter((item) => item.is_shared);
    
    // 从状态或localStorage恢复排序
    let orderedPersonal = personal;
    let orderedShared = shared;

    // 使用状态中的排序，如果状态为空则从localStorage读取
    const currentPersonalOrder = personalOrder.length > 0 ? personalOrder : getSavedSearchOrder(pagePath, 'personal');
    const currentSharedOrder = sharedOrder.length > 0 ? sharedOrder : getSavedSearchOrder(pagePath, 'shared');
    
    if (currentPersonalOrder.length > 0) {
      try {
        const ordered = currentPersonalOrder
          .map((id) => personal.find((item) => item.id === id))
          .filter((item): item is SavedSearch => item !== undefined);
        const unordered = personal.filter((item) => !currentPersonalOrder.includes(item.id));
        orderedPersonal = [...ordered, ...unordered];
      } catch {
        orderedPersonal = personal;
      }
    }
    
    if (currentSharedOrder.length > 0) {
      try {
        const ordered = currentSharedOrder
          .map((id) => shared.find((item) => item.id === id))
          .filter((item): item is SavedSearch => item !== undefined);
        const unordered = shared.filter((item) => !currentSharedOrder.includes(item.id));
        orderedShared = [...ordered, ...unordered];
      } catch {
        orderedShared = shared;
      }
    }

    return [orderedPersonal, orderedShared];
  }, [savedSearches, pagePath, personalOrder, sharedOrder]);
  
  // 拖拽传感器配置
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  
  // 处理共享搜索条件拖拽结束
  const handleSharedDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = sharedSearches.findIndex((item) => item.id === active.id);
      const newIndex = sharedSearches.findIndex((item) => item.id === over.id);
      const newOrder = arrayMove(sharedSearches.map(item => item.id), oldIndex, newIndex);

      setSharedOrder(newOrder);
      setSavedSearchOrder(pagePath, 'shared', newOrder);
      useSavedSearchVersionStore.getState().incrementVersion(pagePath);
    }
  }, [pagePath, sharedSearches]);
  
  // 处理个人搜索条件拖拽结束
  const handlePersonalDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = personalSearches.findIndex((item) => item.id === active.id);
      const newIndex = personalSearches.findIndex((item) => item.id === over.id);
      const newOrder = arrayMove(personalSearches.map(item => item.id), oldIndex, newIndex);

      setPersonalOrder(newOrder);
      setSavedSearchOrder(pagePath, 'personal', newOrder);
      useSavedSearchVersionStore.getState().incrementVersion(pagePath);
    }
  }, [pagePath, personalSearches]);
  
  // 创建保存搜索条件 mutation
  const createSavedSearchMutation = useMutation({
    mutationFn: createSavedSearch,
    onSuccess: () => {
      messageApi.success(t('components.uniQuery.saveSuccess'));
      setSaveModalVisible(false);
      setSaveName('');
      setSaveIsShared(false);
      queryClient.invalidateQueries({ queryKey: ['savedSearches', pagePath] });
    },
    onError: (error: any) => {
      messageApi.error(error?.message || t('components.uniQuery.saveFailed'));
    },
  });
  
  // 删除保存搜索条件 mutation
  const deleteSavedSearchMutation = useMutation({
    mutationFn: deleteSavedSearchByUuid,
    onSuccess: () => {
      messageApi.success(t('components.uniQuery.deleteSuccess'));
      queryClient.invalidateQueries({ queryKey: ['savedSearches', pagePath] });
    },
    onError: (error: any) => {
      messageApi.error(error?.message || t('components.uniQuery.deleteFailed'));
    },
  });
  
  // 更新保存搜索条件 mutation
  const updateSavedSearchMutation = useMutation({
    mutationFn: ({ uuid, data }: { uuid: string; data: any }) => updateSavedSearchByUuid(uuid, data),
    onSuccess: () => {
      messageApi.success(t('components.uniQuery.updateSuccess'));
      setSaveModalVisible(false);
      setSaveName('');
      setSaveIsShared(false);
      setSaveIsPinned(false);
      setEditingSearch(null);
      queryClient.invalidateQueries({ queryKey: ['savedSearches', pagePath] });
    },
    onError: (error: any) => {
      messageApi.error(error?.message || t('components.uniQuery.updateFailed'));
    },
  });

  /**
   * 获取可搜索的列
   */
  const getSearchableColumns = () => {
    return columns.filter((col) => {
      // 排除隐藏搜索的列
      if (col.hideInSearch) {
        return false;
      }
      // 排除操作列
      if (col.valueType === 'option') {
        return false;
      }
      return true;
    });
  };

  /**   * 根据列类型渲染表单项
   */
  const renderFormItem = (column: ProColumns<any>) => {
    const { dataIndex, title, valueType, valueEnum, fieldProps } = column;
    
    // 检查是否启用自动完成功能（在函数开头统一声明，避免重复声明）
    // 支持三种配置方式：
    // 1. fieldProps.autoComplete: 直接配置 AutoComplete 的 options 或 onSearch
    // 2. fieldProps.autoCompleteOptions: 自动完成选项数组
    // 3. fieldProps.autoCompleteApi: 自动完成 API 函数（异步获取选项）
    const autoCompleteConfig = (fieldProps as any)?.autoComplete;
    const autoCompleteOptions = (fieldProps as any)?.autoCompleteOptions;
    const autoCompleteApi = (fieldProps as any)?.autoCompleteApi;
    const hasAutoComplete = autoCompleteConfig || autoCompleteOptions || autoCompleteApi;

    // 文本输入框（支持自动完成）
    if (!valueType || valueType === 'text') {
      // 如果配置了自动完成，使用 ProForm.Item + AutoCompleteInput
      if (hasAutoComplete) {
        // ⭐ 关键修复：直接使用 ProForm.Item，它会通过 forwardRef 自动将 value 和 onChange 注入到子组件
        // AutoCompleteInput 已经使用 forwardRef，能够正确接收 value 和 onChange
        return (
          <ProForm.Item
            key={dataIndex as string}
            name={dataIndex as string}
            label={title as string}
          >
            <AutoCompleteInput
              placeholder={t('components.uniQuery.enterPlaceholder', { title: typeof title === 'string' ? title : '' })}
              autoCompleteConfig={autoCompleteConfig}
              autoCompleteOptions={autoCompleteOptions}
              autoCompleteApi={autoCompleteApi}
              fieldProps={fieldProps}
              // ⭐ 注意：value 和 onChange 会由 ProForm.Item 通过 forwardRef 自动注入到 props 中
            />
          </ProForm.Item>
        );
      }
      
      // 普通文本输入框
      return (
        <ProFormText
          key={dataIndex as string}
          name={dataIndex as string}
          label={title as string}
          placeholder={t('components.uniQuery.enterPlaceholder', { title: typeof title === 'string' ? title : '' })}
          fieldProps={fieldProps as any}
        />
      );
    }

    // 选择框（valueEnum / options / request）
    if (valueType === 'select') {
      const requestFn = (column as ProColumns<any>).request;
      const options = (fieldProps as any)?.options;
      return (
        <SafeProFormSelect
          key={dataIndex as string}
          name={dataIndex as string}
          label={title as string}
          placeholder={t('components.uniQuery.selectPlaceholder', { title: typeof title === 'string' ? title : '' })}
          valueEnum={valueEnum}
          request={requestFn}
          options={options}
          fieldProps={fieldProps as any}
        />
      );
    }

    // 日期选择器
    if (valueType === 'date') {
      return (
        <ProFormDatePicker
          key={dataIndex as string}
          name={dataIndex as string}
          label={title as string}
          placeholder={t('components.uniQuery.selectPlaceholder', { title: typeof title === 'string' ? title : '' })}
          fieldProps={fieldProps as any}
        />
      );
    }

    // 日期范围选择器
    if (valueType === 'dateRange') {
      return (
        <ProFormDateRangePicker
          key={dataIndex as string}
          name={dataIndex as string}
          label={title as string}
          placeholder={[t('components.uniQuery.dateRangeStart', { title: typeof title === 'string' ? title : '' }), t('components.uniQuery.dateRangeEnd', { title: typeof title === 'string' ? title : '' })]}
          fieldProps={fieldProps as any}
        />
      );
    }

    // 默认使用文本输入框（支持自动完成）
    // 注意：autoCompleteConfig、autoCompleteOptions、autoCompleteApi 已在函数开头声明
    if (hasAutoComplete) {
      return (
        <ProForm.Item
          key={dataIndex as string}
          name={dataIndex as string}
          label={title as string}
        >
          <AutoCompleteInput
            placeholder={t('components.uniQuery.enterPlaceholder', { title: typeof title === 'string' ? title : '' })}
            autoCompleteConfig={autoCompleteConfig}
            autoCompleteOptions={autoCompleteOptions}
            autoCompleteApi={autoCompleteApi}
            fieldProps={fieldProps}
          />
        </ProForm.Item>
      );
    }
    
    return (
      <ProFormText
        key={dataIndex as string}
        name={dataIndex as string}
        label={title as string}
        placeholder={`请输入${title as string}`}
        fieldProps={fieldProps as any}
      />
    );
  };

  /**
   * 统一过滤空值的工具函数（最佳实践）
   */
  const filterEmptyValues = useCallback((values: Record<string, any>): Record<string, any> => {
    const filtered: Record<string, any> = {};
    Object.keys(values).forEach((key) => {
      const value = values[key];
      // ⭐ 最佳实践：统一过滤逻辑，排除空值
      if (
        value !== undefined && 
        value !== null && 
        value !== '' &&
        !(Array.isArray(value) && value.length === 0)
      ) {
        filtered[key] = value;
      }
    });
    return filtered;
  }, []);

  /**
   * 处理搜索（最佳实践：统一参数传递，优化时序处理）
   */
  const handleSearch = useCallback(async () => {
    try {
      // ⭐ 最佳实践：使用 getFieldsValue() 获取所有字段值
      const values = searchFormRef.current?.getFieldsValue() || {};
      
      // ⭐ 最佳实践：使用统一的过滤函数
      const filteredValues = filterEmptyValues(values);
      
      // ⭐ 筛选功能：合并筛选条件到搜索参数
      const filterConfig: FilterConfigData = {
        groups: filterGroups,
        quickFilters,
      };
      const filterParams = convertFiltersToApiParams(filterConfig, columns);
      
      // 合并搜索参数和筛选参数
      const finalSearchParams = {
        ...filteredValues,
        ...filterParams,
      };
      
      // 调试日志（开发环境）
      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 高级搜索 - 设置搜索参数:', {
          quickFilters,
          filterGroups,
          filterParams,
          finalSearchParams,
          hasSearchParamsRef: !!searchParamsRef,
        });
      }
      
      // ⭐ 最佳实践：统一设置搜索参数到所有需要的地方
      // 1. 设置到 ProTable 的表单（用于表单值读取）
      if (formRef.current) {
        formRef.current.setFieldsValue(finalSearchParams);
      }
      
      // 2. 存储到 searchParamsRef（用于直接传递搜索参数）
      // ⚠️ 修复：始终设置 searchParamsRef.current，即使 filteredValues 是空对象
      // 这样可以确保 handleRequest 能够正确获取搜索参数，避免时序问题
      if (searchParamsRef) {
        commitListPageSearchParams(searchParamsRef, finalSearchParams, onSearchParamsApplied);
        
        // 调试日志：确认 searchParamsRef 已设置
        if (process.env.NODE_ENV === 'development') {
          console.log('🔍 高级搜索 - searchParamsRef 已设置:', {
            searchParamsRef: searchParamsRef.current,
            finalSearchParams,
          });
        }
      } else {
        // 调试日志：searchParamsRef 不存在
        if (process.env.NODE_ENV === 'development') {
          console.warn('⚠️ 高级搜索 - searchParamsRef 不存在！');
        }
      }
      
      // 关闭弹窗
      onClose();
      
      // ⭐ 最佳实践：使用 Promise 确保表单值已更新后再触发 reload
      await new Promise<void>((resolve) => {
        // 使用 requestAnimationFrame 确保 DOM 更新完成
        requestAnimationFrame(() => {
          // 使用 setTimeout 确保表单值已更新
          setTimeout(() => {
            resolve();
          }, 100); // 减少等待时间到 100ms
        });
      });
      
      // ⭐ 最佳实践：触发 ProTable 重新查询
      // ⚠️ 修复：在 reload 之前再次确认 searchParamsRef.current 的值
      if (process.env.NODE_ENV === 'development' && searchParamsRef) {
        console.log('🔍 高级搜索 - reload 前的 searchParamsRef:', searchParamsRef.current);
      }
      
      if (actionRef.current) {
        actionRef.current.reload(false);
      }
    } catch (error) {
      // ⭐ 最佳实践：错误处理
      console.error('搜索处理失败:', error);
      messageApi.error(t('components.uniQuery.searchFailed'));
    }
  }, [formRef, searchParamsRef, actionRef, onClose, filterEmptyValues, messageApi, columns, quickFilters, filterGroups, onSearchParamsApplied]);

  /**
   * 处理重置（最佳实践：统一清空所有搜索相关状态）
   */
  const handleReset = useCallback(async () => {
    try {
      // ⭐ 最佳实践：清空搜索表单
      searchFormRef.current?.resetFields();
      
      // ⭐ 最佳实践：清空 ProTable 表单
      if (formRef.current) {
        formRef.current.resetFields();
      }
      
      // ⭐ 最佳实践：清空 searchParamsRef
      if (searchParamsRef) {
        commitListPageSearchParams(searchParamsRef, undefined, onSearchParamsApplied);
      }
      
      // ⭐ 筛选功能：清空筛选条件
      setQuickFilters({});
      setFilterGroups([]);
      
      // ⭐ 最佳实践：等待表单重置完成后再触发 reload
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          setTimeout(() => {
            resolve();
          }, 50);
        });
      });
      
      // ⭐ 最佳实践：触发 ProTable 重新查询
      if (actionRef.current) {
        actionRef.current.reload();
      }
    } catch (error) {
      console.error('重置失败:', error);
    }
  }, [formRef, searchParamsRef, actionRef, onSearchParamsApplied]);

  /**
   * 处理保存搜索条件（最佳实践：统一空值过滤）
   */
  const handleSaveSearch = useCallback(() => {
    const values = searchFormRef.current?.getFieldsValue() || {};
    const filteredValues = filterEmptyValues(values);
    
    // ⭐ 检查是否有搜索条件或筛选条件
    const hasSearchValues = Object.keys(filteredValues).length > 0;
    const hasQuickFilters = Object.keys(quickFilters).length > 0;
    const hasFilterGroups = filterGroups.length > 0;
    
    // 如果既没有字段搜索值，也没有筛选条件，则提示
    if (!hasSearchValues && !hasQuickFilters && !hasFilterGroups) {
      messageApi.warning(t('components.uniQuery.setConditionsFirst'));
      return;
    }
    
    // 打开保存弹窗
    setSaveModalVisible(true);
  }, [filterEmptyValues, messageApi, quickFilters, filterGroups]);
  
  /**
   * 确认保存搜索条件（最佳实践：统一空值过滤，包含筛选条件）
   */
  const handleConfirmSave = useCallback(() => {
    if (!saveName.trim()) {
      messageApi.warning(t('components.uniQuery.enterName'));
      return;
    }
    
    const values = searchFormRef.current?.getFieldsValue() || {};
    const filteredValues = filterEmptyValues(values);
    
    // ⭐ 筛选功能：合并筛选条件到搜索参数
    const filterConfig: FilterConfigData = {
      groups: filterGroups,
      quickFilters,
    };
    const filterParams = convertFiltersToApiParams(filterConfig, columns);
    
    // 合并搜索参数和筛选参数
    const finalSearchParams = {
      ...filteredValues,
      ...filterParams,
      // 保存筛选配置（用于恢复）
      _filterConfig: {
        groups: filterGroups,
        quickFilters,
      },
    };
    
    if (editingSearch) {
      // 更新现有搜索条件
      updateSavedSearchMutation.mutate({
        uuid: editingSearch.uuid,
        data: {
          name: saveName.trim(),
          is_shared: saveIsShared,
          is_pinned: saveIsPinned,
          search_params: finalSearchParams,
        },
      });
    } else {
      // 创建新搜索条件
      createSavedSearchMutation.mutate({
        page_path: pagePath,
        name: saveName.trim(),
        is_shared: saveIsShared,
        is_pinned: saveIsPinned,
        search_params: finalSearchParams,
      });
    }
  }, [saveName, saveIsShared, saveIsPinned, editingSearch, pagePath, filterEmptyValues, messageApi, updateSavedSearchMutation, createSavedSearchMutation, filterGroups, quickFilters, columns]);
  
  /**
   * 加载已保存的搜索条件
   */
  /**
   * 加载搜索条件到表单（最佳实践：统一清空和设置逻辑，不执行搜索，用于编辑）
   */
  const handleLoadSavedSearchToForm = useCallback(async (savedSearch: SavedSearch) => {
    try {
      // ⭐ 最佳实践：获取所有可搜索的列
      const searchableColumns = getSearchableColumns();
      const allFieldNames = searchableColumns
        .map((col) => col.dataIndex)
        .filter((name): name is string => typeof name === 'string');
      
      // ⭐ 最佳实践：创建空值对象，清空所有字段
      const emptyValues: Record<string, any> = {};
      allFieldNames.forEach((name) => {
        emptyValues[name] = undefined;
      });
      
      // ⭐ 最佳实践：统一清空所有表单
      searchFormRef.current?.setFieldsValue(emptyValues);
      if (formRef.current) {
        formRef.current.setFieldsValue(emptyValues);
      }
      if (searchParamsRef) {
        searchParamsRef.current = undefined;
      }
      
      // ⭐ 最佳实践：等待清空完成
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          setTimeout(() => {
            resolve();
          }, 50);
        });
      });
      
      // ⭐ 最佳实践：使用统一的过滤函数
      const filteredParams = filterEmptyValues(savedSearch.search_params);
      
      // ⭐ 筛选功能：恢复筛选配置
      const savedFilterConfig = savedSearch.search_params?._filterConfig;
      if (savedFilterConfig) {
        if (savedFilterConfig.groups) {
          setFilterGroups(savedFilterConfig.groups);
        }
        if (savedFilterConfig.quickFilters) {
          setQuickFilters(savedFilterConfig.quickFilters);
        }
        // 切换到筛选标签页
        setActiveTab('filter');
      }
      
      // ⭐ 最佳实践：设置到搜索表单和 ProTable 表单（不设置 searchParamsRef，不触发搜索）
      // 排除 _filterConfig，因为它不是搜索参数
      const searchParamsWithoutFilterConfig = { ...filteredParams };
      delete searchParamsWithoutFilterConfig._filterConfig;
      searchFormRef.current?.setFieldsValue(searchParamsWithoutFilterConfig);
      if (formRef.current) {
        formRef.current.setFieldsValue(searchParamsWithoutFilterConfig);
      }
      
      // 不关闭弹窗，让用户可以看到已加载的条件并可以修改
    } catch (error) {
      console.error('加载搜索条件失败:', error);
      messageApi.error(t('components.uniQuery.loadFailed'));
    }
  }, [getSearchableColumns, formRef, searchParamsRef, filterEmptyValues, messageApi]);

  /**
   * 应用搜索条件并执行搜索（最佳实践：统一清空和设置逻辑）
   */
  const handleApplySavedSearch = useCallback(async (savedSearch: SavedSearch) => {
    try {
      // ⭐ 最佳实践：获取所有可搜索的列
      const searchableColumns = getSearchableColumns();
      const allFieldNames = searchableColumns
        .map((col) => col.dataIndex)
        .filter((name): name is string => typeof name === 'string');
      
      // ⭐ 最佳实践：创建空值对象，清空所有字段
      const emptyValues: Record<string, any> = {};
      allFieldNames.forEach((name) => {
        emptyValues[name] = undefined;
      });
      
      // ⭐ 最佳实践：统一清空所有表单
      searchFormRef.current?.setFieldsValue(emptyValues);
      if (formRef.current) {
        formRef.current.setFieldsValue(emptyValues);
      }
      if (searchParamsRef) {
        commitListPageSearchParams(searchParamsRef, undefined, onSearchParamsApplied);
      }
      
      // ⭐ 最佳实践：等待清空完成
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          setTimeout(() => {
            resolve();
          }, 50);
        });
      });
      
      // ⭐ 最佳实践：使用统一的过滤函数
      const filteredParams = filterEmptyValues(savedSearch.search_params);
      
      // ⭐ 筛选功能：恢复筛选配置
      const savedFilterConfig = savedSearch.search_params?._filterConfig;
      if (savedFilterConfig) {
        if (savedFilterConfig.groups) {
          setFilterGroups(savedFilterConfig.groups);
        }
        if (savedFilterConfig.quickFilters) {
          setQuickFilters(savedFilterConfig.quickFilters);
        }
      }
      
      const searchParamsWithoutFilterConfig = { ...filteredParams };
      delete searchParamsWithoutFilterConfig._filterConfig;
      searchFormRef.current?.setFieldsValue(searchParamsWithoutFilterConfig);
      if (formRef.current) {
        formRef.current.setFieldsValue(searchParamsWithoutFilterConfig);
      }
      commitListPageSearchParams(
        searchParamsRef,
        searchParamsWithoutFilterConfig,
        onSearchParamsApplied,
      );
      
      // ⭐ 最佳实践：等待表单值更新后再触发搜索
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          setTimeout(() => {
            resolve();
          }, 100);
        });
      });
      
      // ⭐ 关闭弹窗，让用户看到搜索结果
      onClose();
      
      // ⭐ 最佳实践：触发 ProTable 重新查询
      if (actionRef.current) {
        actionRef.current.reload(false);
      }
    } catch (error) {
      console.error('应用搜索条件失败:', error);
      messageApi.error(t('components.uniQuery.applyFailed'));
    }
  }, [getSearchableColumns, formRef, searchParamsRef, actionRef, filterEmptyValues, messageApi, onClose, onSearchParamsApplied]);
  
  /**
   * 删除已保存的搜索条件
   */
  const handleDeleteSavedSearch = (e: React.MouseEvent | React.KeyboardEvent, search: SavedSearch) => {
    if ('stopPropagation' in e) {
      e.stopPropagation(); // 阻止事件冒泡
    }
    
    // 检查是否是自己的条件
    if (!isOwnSearch(search)) {
      messageApi.warning(t('components.uniQuery.onlyDeleteOwn'));
      return;
    }
    
    Modal.confirm({
      title: t('components.uniQuery.deleteConfirm'),
      content: t('components.uniQuery.deleteConfirmContent'),
      onOk: () => {
        deleteSavedSearchMutation.mutate(search.uuid);
      },
    });
  };
  
  /**
   * 编辑已保存的搜索条件
   */
  const handleEditSavedSearch = (e: React.MouseEvent | React.KeyboardEvent, search: SavedSearch) => {
    if ('stopPropagation' in e) {
      e.stopPropagation(); // 阻止事件冒泡
    }
    // 设置编辑状态
    setEditingSearch(search);
    setSaveName(search.name);
    setSaveIsShared(search.is_shared);
    setSaveIsPinned(search.is_pinned);
    // 加载搜索条件到左侧表单（不打开保存弹窗）
    handleLoadSavedSearchToForm(search);
  };

  /**
   * 取消编辑
   */
  const handleCancelEdit = () => {
    setEditingSearch(null);
    setSaveName('');
    setSaveIsShared(false);
    setSaveIsPinned(false);
    // 清空表单
    handleReset();
  };
  
  /**
   * 切换钉住状态
   */
  const handleTogglePin = (e: React.MouseEvent, search: SavedSearch) => {
    if (isBuiltinSavedSearch(search)) {
      return;
    }
    e.stopPropagation(); // 阻止事件冒泡
    updateSavedSearchMutation.mutate({
      uuid: search.uuid,
      data: {
        is_pinned: !search.is_pinned,
      },
    });
  };

  // ⚠️ 修复：使用 ref 跟踪弹窗状态，避免重复设置导致无限循环
  const prevVisibleRef = useRef(false);
  const isCleaningUpRef = useRef(false);
  
  /**
   * 弹窗打开/关闭时的处理
   * ⚠️ 修复：完全移除 setFieldsValue 调用，避免无限循环
   * 用户可以在弹窗中手动输入搜索条件，或者从保存的搜索条件中加载
   */
  useEffect(() => {
    // 防止在清理过程中重复触发
    if (isCleaningUpRef.current) {
      return;
    }
    
    if (visible && !prevVisibleRef.current) {
      // 弹窗刚打开
      prevVisibleRef.current = true;
      isCleaningUpRef.current = false;
      
      // 聚焦搜索按钮（延迟执行，确保 DOM 已渲染）
      setTimeout(() => {
        if (searchButtonRef.current) {
          searchButtonRef.current.focus();
        }
      }, 100);
    } else if (!visible && prevVisibleRef.current) {
      // 弹窗关闭时，清除编辑状态
      isCleaningUpRef.current = true;
      prevVisibleRef.current = false;
      
      // 使用 setTimeout 延迟状态更新，避免在 useEffect 执行过程中触发新的更新
      setTimeout(() => {
        setEditingSearch(null);
        setSaveName('');
        setSaveIsShared(false);
        setSaveIsPinned(false);
        isCleaningUpRef.current = false;
      }, 0);
    }
  }, [visible]); // ⚠️ 修复：只依赖 visible，避免其他依赖导致无限循环

  const searchableColumns = getSearchableColumns();

  return (
    <>
      <style>{`
        .query-search-modal-wrap .ant-modal-body {
          max-height: calc(80vh - 120px) !important;
          overflow: hidden !important;
          display: flex !important;
          flex-direction: column !important;
        }
        .query-search-modal-wrap .ant-list-item-meta-title {
          margin-bottom: 0 !important;
        }
        .query-search-modal-wrap .ant-list-item-action > li {
          padding: 0 2px !important;
        }
        .query-search-modal-wrap .ant-list-item {
          border-radius: ${token.borderRadius}px !important;
        }
        .ant-list-item-meta-avatar {
          margin-right: 4px !important;
        }
        .ant-list-item-meta {
          width: 100% !important;
          flex: 1 !important;
          min-width: 0 !important;
        }
        .ant-list-item-meta-title {
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
          width: 100% !important;
        }
        .ant-list-item-action {
          margin-left: 0 !important;
          flex-shrink: 0 !important;
        }
      `}</style>
      <Modal
        title={t('components.uniQuery.searchConditions')}
        open={visible}
        onCancel={onClose}
        width={1400}
        centered={true}
        style={{
          maxHeight: '80vh',
        }}
        getContainer={() => document.body}
        mask={true}
        wrapClassName="query-search-modal-wrap"
        footer={null}
      >
      <div style={{ 
        display: 'flex', 
        minHeight: 400,
        maxHeight: 'calc(80vh - 120px)',
        overflow: 'hidden',
      }}>
        {/* 左侧：搜索表单 */}
        <div 
          style={{ 
            flex: '3', 
            paddingRight: 16, 
            borderRight: `1px solid ${token.colorBorder}`, 
            display: 'flex', 
            flexDirection: 'column',
            overflow: 'hidden',
            minHeight: 0,
          }}
          onKeyDown={(e) => {
            // 按回车时触发搜索
            if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
              const target = e.target as HTMLElement;
              // 如果焦点在输入框、文本域或下拉框中，不处理（允许默认行为）
              if (
                target.tagName === 'INPUT' || 
                target.tagName === 'TEXTAREA' || 
                target.closest('.ant-select') ||
                target.closest('.ant-picker')
              ) {
                return;
              }
              // 其他情况下（如按钮获得焦点时），触发搜索
              e.preventDefault();
              e.stopPropagation();
              handleSearch();
            }
          }}
        >
          {/* 编辑状态提示 */}
          {editingSearch && (
            <div style={{ 
              marginBottom: 16, 
              padding: '8px 12px', 
              backgroundColor: '#e6f7ff', 
              border: '1px solid #91d5ff',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <span style={{ color: '#1890ff', fontWeight: 500 }}>
                {t('components.uniQuery.editing')}{editingSearch.name}
              </span>
              <Button 
                type="text" 
                size="small"
                onClick={handleCancelEdit}
                style={{ color: '#1890ff' }}
              >
                {t('components.uniQuery.cancelEdit')}
              </Button>
            </div>
          )}
          
          {/* 搜索和筛选标签页 */}
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0 }}>
            <Tabs
              activeKey={activeTab}
              onChange={(key) => setActiveTab(key as 'search' | 'filter')}
              items={[
              {
                key: 'search',
                label: t('components.uniQuery.fieldSearch'),
                children: (
                  <ProForm
                    formRef={searchFormRef}
                    submitter={false}
                    style={{ padding: '0 8px' }}
                  >
                    <Row gutter={16}>
                      {searchableColumns.map((column, index) => {
                        const dataIndex = column.dataIndex;
                        const key = typeof dataIndex === 'string' 
                          ? dataIndex 
                          : Array.isArray(dataIndex) 
                            ? dataIndex.join('-') 
                            : `column-${index}`;
                        return (
                          <Col span={12} key={key}>
                            {renderFormItem(column)}
                          </Col>
                        );
                      })}
                    </Row>
                  </ProForm>
                ),
              },
              {
                key: 'filter',
                label: (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>{t('components.uniQuery.filterConditions')}</span>
                    <Button
                      type="text"
                      size="small"
                      icon={<QuestionCircleOutlined />}
                      onClick={(e) => {
                        e.stopPropagation();
                        setHelpModalVisible(true);
                      }}
                      style={{ 
                        padding: 0,
                        width: 16,
                        height: 16,
                        minWidth: 16,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: token.colorTextSecondary,
                      }}
                      title={t('components.uniQuery.useHelp')}
                    />
                  </span>
                ),
                children: (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* 快速筛选 */}
                    <QuickFilters
                      columns={columns}
                      quickFilters={quickFilters}
                      onChange={setQuickFilters}
                    />
                    
                    {/* 高级筛选 */}
                    <AdvancedFilters
                      columns={columns}
                      filterGroups={filterGroups}
                      onChange={setFilterGroups}
                    />
                  </div>
                ),
              },
            ]}
            />
          </div>
          
          {/* 搜索相关按钮（底部对齐） */}
          <div style={{ marginTop: 'auto', paddingTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button 
              icon={<SaveOutlined />} 
              onClick={handleSaveSearch}
              type={editingSearch ? 'primary' : 'default'}
            >
              {editingSearch ? t('components.uniQuery.updateSearch') : t('components.uniQuery.saveSearch')}
            </Button>
            <Button onClick={handleReset}>
              {t('components.uniQuery.reset')}
            </Button>
            <Button onClick={onClose}>
              {t('components.uniQuery.cancel')}
            </Button>
            <Button 
              type="primary" 
              onClick={handleSearch}
              ref={searchButtonRef}
            >
              {t('components.uniQuery.search')}
            </Button>
          </div>
        </div>
        
        {/* 中间：共享搜索条件 */}
        <div style={{ 
          flex: '1', 
          minWidth: '280px',
          maxWidth: '320px',
          paddingLeft: 16, 
          paddingRight: 16, 
          borderRight: `1px solid ${token.colorBorder}`, 
          display: 'flex', 
          flexDirection: 'column',
          overflow: 'hidden',
          minHeight: 0,
        }}>
          <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 16 }}>
            {t('components.uniQuery.sharedSearches')}
          </Typography.Title>
          {sharedSearches.length > 0 ? (
            <div style={{ 
              flex: 1, 
              overflowY: 'auto', 
              overflowX: 'hidden',
              minHeight: 0,
              paddingRight: 4,
            }}>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleSharedDragEnd}
              >
                <SortableContext
                  items={sharedSearches.map((item) => item.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <List
                    size="small"
                    dataSource={sharedSearches}
                    renderItem={(item) => (
                      <SortableListItem key={item.id} id={item.id}>
                        {(listeners) => (
                        <List.Item
                          key={item.id}
                  style={{ 
                    padding: '8px 12px',
                    border: `1px solid ${token.colorSuccessBorder}`,
                    borderRadius: token.borderRadius,
                    marginBottom: 8,
                    backgroundColor: token.colorSuccessBg,
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = token.colorSuccess;
                    e.currentTarget.style.backgroundColor = token.colorSuccessBgHover;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = token.colorSuccessBorder;
                    e.currentTarget.style.backgroundColor = token.colorSuccessBg;
                  }}
                  actions={[
                    <Button
                      key="search"
                      type="text"
                      size="small"
                      icon={<SearchOutlined />}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleApplySavedSearch(item);
                      }}
                      title={t('components.uniQuery.applySearch')}
                      style={{ marginRight: 0 }}
                    />,
                    <Button
                      key="pin"
                      type="text"
                      size="small"
                      icon={item.is_pinned ? <PushpinFilled /> : <PushpinOutlined />}
                      onClick={(e) => handleTogglePin(e, item)}
                      title={item.is_pinned ? t('components.uniQuery.unpin') : t('components.uniQuery.pin')}
                      style={{ marginRight: 0 }}
                      disabled={isBuiltinSavedSearch(item)}
                    />,
                    <Dropdown
                      key="more"
                      menu={{
                        items: [
                          ...(isBuiltinSavedSearch(item) ? [] : [{
                            key: 'edit',
                            label: t('components.uniQuery.edit'),
                            icon: <EditOutlined />,
                            onClick: (e) => {
                              e.domEvent.stopPropagation();
                              handleEditSavedSearch(e.domEvent, item);
                            },
                          }]),
                          // 如果是自己的公共条件，显示"转为个人"选项
                          ...(item.is_shared && isOwnSearch(item) ? [{
                            key: 'convert-to-personal',
                            label: t('components.uniQuery.convertToPersonal'),
                            icon: <EditOutlined />,
                            onClick: (e: any) => {
                              e.domEvent.stopPropagation();
                              updateSavedSearchMutation.mutate({
                                uuid: item.uuid,
                                data: {
                                  is_shared: false,
                                },
                              });
                            },
                          }] : []),
                          // 只有自己的条件才能删除
                          ...(isOwnSearch(item) ? [{
                            key: 'delete',
                            label: t('components.uniQuery.delete'),
                            icon: <DeleteOutlined />,
                            danger: true,
                            onClick: (e: any) => {
                              e.domEvent.stopPropagation();
                              handleDeleteSavedSearch(e.domEvent, item);
                            },
                          }] : []),
                        ],
                      }}
                      trigger={['click']}
                    >
                      <Button
                        type="text"
                        size="small"
                        icon={<MoreOutlined />}
                        onClick={(e) => e.stopPropagation()}
                        style={{ marginRight: 0 }}
                      />
                    </Dropdown>,
                  ]}
                >
                  <List.Item.Meta
                    avatar={
                      <HolderOutlined 
                        style={{ 
                          cursor: 'grab',
                          color: '#999',
                          fontSize: '16px',
                        }}
                        {...listeners}
                        onMouseDown={(e) => e.stopPropagation()}
                      />
                    }
                    title={
                      <div 
                        style={{ 
                          margin: 0,
                          padding: 0,
                          lineHeight: '1.5',
                          display: 'flex',
                          alignItems: 'center',
                          height: '100%',
                          cursor: 'pointer',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          flex: 1,
                          minWidth: 0,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLoadSavedSearchToForm(item);
                        }}
                        title={item.name}
                      >
                        {item.name}
                      </div>
                    }
                    style={{ 
                      margin: 0,
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      height: '100%',
                    }}
                  />
                        </List.Item>
                        )}
                      </SortableListItem>
                    )}
                  />
                </SortableContext>
              </DndContext>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
              {t('components.uniQuery.noSharedSearches')}
            </div>
          )}
        </div>
        
        {/* 右侧：个人搜索条件 */}
        <div style={{ 
          flex: '1', 
          minWidth: '280px',
          maxWidth: '320px',
          paddingLeft: 16, 
          display: 'flex', 
          flexDirection: 'column',
          overflow: 'hidden',
          minHeight: 0,
        }}>
          <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 16 }}>
            {t('components.uniQuery.personalSearches')}
          </Typography.Title>
          {personalSearches.length > 0 ? (
            <div style={{ 
              flex: 1, 
              overflowY: 'auto', 
              overflowX: 'hidden',
              minHeight: 0,
              paddingRight: 4,
            }}>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handlePersonalDragEnd}
              >
                <SortableContext
                  items={personalSearches.map((item) => item.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <List
                    size="small"
                    dataSource={personalSearches}
                    renderItem={(item) => (
                      <SortableListItem key={item.id} id={item.id}>
                        {(listeners) => (
                        <List.Item
                          key={item.id}
                  style={{ 
                    padding: '8px 12px',
                    border: `1px solid ${token.colorInfoBorder}`,
                    borderRadius: token.borderRadius,
                    marginBottom: 8,
                    backgroundColor: token.colorInfoBg,
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = token.colorInfo;
                    e.currentTarget.style.backgroundColor = token.colorInfoBgHover;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = token.colorInfoBorder;
                    e.currentTarget.style.backgroundColor = token.colorInfoBg;
                  }}
                  actions={[
                    <Button
                      key="search"
                      type="text"
                      size="small"
                      icon={<SearchOutlined />}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleApplySavedSearch(item);
                      }}
                      title={t('components.uniQuery.applySearch')}
                      style={{ marginRight: 0 }}
                    />,
                    <Button
                      key="pin"
                      type="text"
                      size="small"
                      icon={item.is_pinned ? <PushpinFilled /> : <PushpinOutlined />}
                      onClick={(e) => handleTogglePin(e, item)}
                      title={item.is_pinned ? t('components.uniQuery.unpin') : t('components.uniQuery.pin')}
                      style={{ marginRight: 0 }}
                      disabled={isBuiltinSavedSearch(item)}
                    />,
                    <Dropdown
                      key="more"
                      menu={{
                        items: [
                          ...(isBuiltinSavedSearch(item) ? [] : [{
                            key: 'edit',
                            label: t('components.uniQuery.edit'),
                            icon: <EditOutlined />,
                            onClick: (e) => {
                              e.domEvent.stopPropagation();
                              handleEditSavedSearch(e.domEvent, item);
                            },
                          }]),
                          // 如果是个人条件，显示"设为公共"选项
                          ...(!item.is_shared && isOwnSearch(item) ? [{
                            key: 'set-to-shared',
                            label: t('components.uniQuery.setToShared'),
                            icon: <ShareAltOutlined />,
                            onClick: (e: any) => {
                              e.domEvent.stopPropagation();
                              updateSavedSearchMutation.mutate({
                                uuid: item.uuid,
                                data: {
                                  is_shared: true,
                                },
                              });
                            },
                          }] : []),
                          // 如果是自己的公共条件，显示"转为个人"选项
                          ...(item.is_shared && isOwnSearch(item) ? [{
                            key: 'convert-to-personal',
                            label: t('components.uniQuery.convertToPersonal'),
                            icon: <EditOutlined />,
                            onClick: (e: any) => {
                              e.domEvent.stopPropagation();
                              updateSavedSearchMutation.mutate({
                                uuid: item.uuid,
                                data: {
                                  is_shared: false,
                                },
                              });
                            },
                          }] : []),
                          // 只有自己的条件才能删除
                          ...(isOwnSearch(item) ? [{
                            key: 'delete',
                            label: t('components.uniQuery.delete'),
                            icon: <DeleteOutlined />,
                            danger: true,
                            onClick: (e: any) => {
                              e.domEvent.stopPropagation();
                              handleDeleteSavedSearch(e.domEvent, item);
                            },
                          }] : []),
                        ],
                      }}
                      trigger={['click']}
                    >
                      <Button
                        type="text"
                        size="small"
                        icon={<MoreOutlined />}
                        onClick={(e) => e.stopPropagation()}
                        style={{ marginRight: 0 }}
                      />
                    </Dropdown>,
                  ]}
                >
                  <List.Item.Meta
                    avatar={
                      <HolderOutlined 
                        style={{ 
                          cursor: 'grab',
                          color: '#999',
                          fontSize: '16px',
                        }}
                        {...listeners}
                        onMouseDown={(e) => e.stopPropagation()}
                      />
                    }
                    title={
                      <div 
                        style={{ 
                          margin: 0,
                          padding: 0,
                          lineHeight: '1.5',
                          display: 'flex',
                          alignItems: 'center',
                          height: '100%',
                          cursor: 'pointer',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          flex: 1,
                          minWidth: 0,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLoadSavedSearchToForm(item);
                        }}
                        title={item.name}
                      >
                        {item.name}
                      </div>
                    }
                    style={{ 
                      margin: 0,
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      height: '100%',
                    }}
                  />
                        </List.Item>
                        )}
                      </SortableListItem>
                    )}
                  />
                </SortableContext>
              </DndContext>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
              {t('components.uniQuery.noPersonalSearches')}
            </div>
          )}
        </div>
      </div>
      </Modal>
      
      {/* 筛选条件使用帮助弹窗 */}
      <Modal
        title={t('components.uniQuery.filterHelpTitle')}
        open={helpModalVisible}
        onCancel={() => setHelpModalVisible(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setHelpModalVisible(false)}>
            {t('components.uniQuery.gotIt')}
          </Button>
        ]}
        width={700}
      >
        <div style={{ lineHeight: 1.8, color: token.colorText }}>
          {/* 快速筛选说明 */}
          <div style={{ 
            marginBottom: 24, 
            padding: '16px', 
            backgroundColor: token.colorSuccessBg, 
            borderRadius: token.borderRadius,
            border: `1px solid ${token.colorSuccessBorder}`,
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              marginBottom: 12,
            }}>
              <Tag color="success" style={{ marginRight: 8 }}>快速筛选</Tag>
              <h3 style={{ 
                margin: 0, 
                color: token.colorText, 
                fontSize: token.fontSizeLG,
                fontWeight: 600,
              }}>
                最简单的方式
              </h3>
            </div>
            <p style={{ 
              marginBottom: 12, 
              color: token.colorText,
              fontSize: token.fontSize,
            }}>
              就像在购物网站上选择商品分类一样，点击标签就能快速筛选数据。
            </p>
            <div style={{ 
              padding: '12px', 
              backgroundColor: token.colorBgContainer, 
              borderRadius: token.borderRadius,
              marginTop: 12,
            }}>
              <Typography.Text strong style={{ color: token.colorText, fontSize: token.fontSizeSM }}>
                如何使用：
              </Typography.Text>
              <ul style={{ 
                margin: '8px 0 0 0', 
                paddingLeft: 20, 
                color: token.colorTextSecondary,
                fontSize: token.fontSizeSM,
              }}>
                <li style={{ marginBottom: 4 }}>点击标签即可选中或取消选中</li>
                <li style={{ marginBottom: 4 }}>可以同时选择多个标签（比如同时选择<Tag color="processing" style={{ margin: '0 4px' }}>激活</Tag>和<Tag color="processing" style={{ margin: '0 4px' }}>待审核</Tag>）</li>
                <li>点击右上角的"清除全部"可以一键清空所有筛选</li>
              </ul>
            </div>
          </div>
          
          {/* 高级筛选说明 */}
          <div style={{ 
            marginBottom: 24, 
            padding: '16px', 
            backgroundColor: token.colorPrimaryBg, 
            borderRadius: token.borderRadius,
            border: `1px solid ${token.colorPrimaryBorder}`,
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              marginBottom: 12,
            }}>
              <Tag color="processing" style={{ marginRight: 8 }}>高级筛选</Tag>
              <h3 style={{ 
                margin: 0, 
                color: token.colorText, 
                fontSize: token.fontSizeLG,
                fontWeight: 600,
              }}>
                精确查找
              </h3>
            </div>
            <p style={{ 
              marginBottom: 16, 
              color: token.colorText,
              fontSize: token.fontSize,
            }}>
              当快速筛选无法满足需求时，可以使用高级筛选来精确控制查找条件。
            </p>
            
            {/* 操作步骤 */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center',
                marginBottom: 8,
              }}>
                <span style={{ 
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  backgroundColor: token.colorPrimary,
                  color: '#fff',
                  fontSize: token.fontSizeSM,
                  fontWeight: 600,
                  marginRight: 8,
                }}>1</span>
                <h4 style={{ 
                  margin: 0, 
                  color: token.colorText, 
                  fontSize: token.fontSize,
                  fontWeight: 500,
                }}>
                  添加筛选条件
                </h4>
              </div>
              <div style={{ 
                marginLeft: 32,
                padding: '12px',
                backgroundColor: token.colorBgContainer,
                borderRadius: token.borderRadius,
              }}>
                <ul style={{ 
                  margin: 0, 
                  paddingLeft: 20, 
                  color: token.colorTextSecondary,
                  fontSize: token.fontSizeSM,
                }}>
                  <li style={{ marginBottom: 4 }}>点击"添加条件组"按钮</li>
                  <li style={{ marginBottom: 4 }}>在条件组内点击"添加条件"按钮</li>
                  <li>每个条件需要选择：<strong style={{ color: token.colorText }}>字段</strong>、<strong style={{ color: token.colorText }}>操作符</strong>、<strong style={{ color: token.colorText }}>值</strong></li>
                </ul>
              </div>
            </div>
            
            {/* 操作符说明 */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center',
                marginBottom: 8,
              }}>
                <span style={{ 
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  backgroundColor: token.colorPrimary,
                  color: '#fff',
                  fontSize: token.fontSizeSM,
                  fontWeight: 600,
                  marginRight: 8,
                }}>2</span>
                <h4 style={{ 
                  margin: 0, 
                  color: token.colorText, 
                  fontSize: token.fontSize,
                  fontWeight: 500,
                }}>
                  操作符是什么意思？
                </h4>
              </div>
              <div style={{ 
                marginLeft: 32,
                padding: '12px',
                backgroundColor: token.colorBgContainer,
                borderRadius: token.borderRadius,
              }}>
                <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                  <div>
                    <Tag color="default" style={{ marginRight: 8 }}>等于</Tag>
                    <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>完全一样</Typography.Text>
                  </div>
                  <div>
                    <Tag color="default" style={{ marginRight: 8 }}>不等于</Tag>
                    <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>排除这个值</Typography.Text>
                  </div>
                  <div>
                    <Tag color="default" style={{ marginRight: 8 }}>包含</Tag>
                    <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>文字里包含（模糊查找）</Typography.Text>
                  </div>
                  <div>
                    <Tag color="default" style={{ marginRight: 8 }}>不包含</Tag>
                    <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>文字里不包含</Typography.Text>
                  </div>
                  <div>
                    <Tag color="default" style={{ marginRight: 8 }}>大于/小于</Tag>
                    <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>数字或日期比较</Typography.Text>
                  </div>
                  <div>
                    <Tag color="default" style={{ marginRight: 8 }}>为空/不为空</Tag>
                    <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>有没有填写</Typography.Text>
                  </div>
                </Space>
              </div>
            </div>
            
            {/* 逻辑说明 */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center',
                marginBottom: 8,
              }}>
                <span style={{ 
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  backgroundColor: token.colorPrimary,
                  color: '#fff',
                  fontSize: token.fontSizeSM,
                  fontWeight: 600,
                  marginRight: 8,
                }}>3</span>
                <h4 style={{ 
                  margin: 0, 
                  color: token.colorText, 
                  fontSize: token.fontSize,
                  fontWeight: 500,
                }}>
                  AND 和 OR 的区别
                </h4>
              </div>
              <div style={{ 
                marginLeft: 32,
                padding: '12px',
                backgroundColor: token.colorBgContainer,
                borderRadius: token.borderRadius,
              }}>
                <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                  <div style={{ 
                    padding: '12px',
                    backgroundColor: token.colorSuccessBg,
                    borderRadius: token.borderRadius,
                    border: `1px solid ${token.colorSuccessBorder}`,
                  }}>
                    <div style={{ marginBottom: 8 }}>
                      <Tag color="success" style={{ marginRight: 8 }}>AND（且）</Tag>
                      <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                        所有条件都要满足
                      </Typography.Text>
                    </div>
                    <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                      例如：状态 <Tag color="default" style={{ margin: '0 4px' }}>=</Tag> 激活 <Tag color="success" style={{ margin: '0 4px' }}>且</Tag> 创建时间 <Tag color="default" style={{ margin: '0 4px' }}>{'>'}</Tag> 2024-01-01
                      <br/>
                      <span style={{ fontSize: token.fontSizeSM * 0.9 }}>（必须同时满足这两个条件）</span>
                    </Typography.Text>
                  </div>
                  <div style={{ 
                    padding: '12px',
                    backgroundColor: token.colorWarningBg,
                    borderRadius: token.borderRadius,
                    border: `1px solid ${token.colorWarningBorder}`,
                  }}>
                    <div style={{ marginBottom: 8 }}>
                      <Tag color="warning" style={{ marginRight: 8 }}>OR（或）</Tag>
                      <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                        满足任意一个条件即可
                      </Typography.Text>
                    </div>
                    <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                      例如：名称 <Tag color="default" style={{ margin: '0 4px' }}>包含</Tag> "管理员" <Tag color="warning" style={{ margin: '0 4px' }}>或</Tag> 名称 <Tag color="default" style={{ margin: '0 4px' }}>包含</Tag> "系统"
                      <br/>
                      <span style={{ fontSize: token.fontSizeSM * 0.9 }}>（满足其中一个条件就可以）</span>
                    </Typography.Text>
                  </div>
                </Space>
              </div>
            </div>
          </div>
          
          <Divider titlePlacement="left" style={{ margin: '24px 0' }}>
            <Typography.Text strong>实际使用示例</Typography.Text>
          </Divider>
          
          {/* 使用场景 */}
          <div style={{ marginBottom: 24 }}>
            {/* 场景一 */}
            <div style={{ 
              marginBottom: 16,
              padding: '16px',
              backgroundColor: token.colorFillAlter,
              borderRadius: token.borderRadius,
              border: `1px solid ${token.colorBorderSecondary}`,
            }}>
              <div style={{ 
                display: 'flex',
                alignItems: 'center',
                marginBottom: 12,
              }}>
                <Tag color="blue" style={{ marginRight: 8 }}>示例一</Tag>
                <h4 style={{ 
                  margin: 0,
                  color: token.colorText,
                  fontSize: token.fontSize,
                  fontWeight: 600,
                }}>
                  查找特定状态的用户
                </h4>
              </div>
              <div style={{ 
                padding: '12px',
                backgroundColor: token.colorBgContainer,
                borderRadius: token.borderRadius,
              }}>
                <p style={{ 
                  margin: '0 0 8px 0',
                  color: token.colorText,
                  fontSize: token.fontSizeSM,
                }}>
                  <strong>我想找：</strong>状态为"激活"或"待审核"的用户
                </p>
                <p style={{ 
                  margin: 0,
                  color: token.colorTextSecondary,
                  fontSize: token.fontSizeSM,
                }}>
                  <strong>怎么做：</strong>在"快速筛选"区域，直接点击"激活"和"待审核"这两个标签就可以了！
                </p>
              </div>
            </div>
            
            {/* 场景二 */}
            <div style={{ 
              marginBottom: 16,
              padding: '16px',
              backgroundColor: token.colorFillAlter,
              borderRadius: token.borderRadius,
              border: `1px solid ${token.colorBorderSecondary}`,
            }}>
              <div style={{ 
                display: 'flex',
                alignItems: 'center',
                marginBottom: 12,
              }}>
                <Tag color="blue" style={{ marginRight: 8 }}>示例二</Tag>
                <h4 style={{ 
                  margin: 0,
                  color: token.colorText,
                  fontSize: token.fontSize,
                  fontWeight: 600,
                }}>
                  同时满足多个条件
                </h4>
              </div>
              <div style={{ 
                padding: '12px',
                backgroundColor: token.colorBgContainer,
                borderRadius: token.borderRadius,
              }}>
                <p style={{ 
                  margin: '0 0 8px 0',
                  color: token.colorText,
                  fontSize: token.fontSizeSM,
                }}>
                  <strong>我想找：</strong>创建时间在 2024 年 1 月之后，<strong>并且</strong>状态为"激活"的记录
                </p>
                <p style={{ 
                  margin: '0 0 8px 0',
                  color: token.colorTextSecondary,
                  fontSize: token.fontSizeSM,
                }}>
                  <strong>怎么做：</strong>
                </p>
                <ol style={{ 
                  margin: 0,
                  paddingLeft: 20,
                  color: token.colorTextSecondary,
                  fontSize: token.fontSizeSM,
                }}>
                  <li>点击"添加条件组"，逻辑选择"AND"</li>
                  <li>添加第一个条件：创建时间 {'>'} 2024-01-01</li>
                  <li>添加第二个条件：状态 = 激活</li>
                  <li>点击"搜索"按钮</li>
                </ol>
              </div>
            </div>
            
            {/* 场景三 */}
            <div style={{ 
              marginBottom: 0,
              padding: '16px',
              backgroundColor: token.colorFillAlter,
              borderRadius: token.borderRadius,
              border: `1px solid ${token.colorBorderSecondary}`,
            }}>
              <div style={{ 
                display: 'flex',
                alignItems: 'center',
                marginBottom: 12,
              }}>
                <Tag color="blue" style={{ marginRight: 8 }}>示例三</Tag>
                <h4 style={{ 
                  margin: 0,
                  color: token.colorText,
                  fontSize: token.fontSize,
                  fontWeight: 600,
                }}>
                  满足任意一个条件
                </h4>
              </div>
              <div style={{ 
                padding: '12px',
                backgroundColor: token.colorBgContainer,
                borderRadius: token.borderRadius,
              }}>
                <p style={{ 
                  margin: '0 0 8px 0',
                  color: token.colorText,
                  fontSize: token.fontSizeSM,
                }}>
                  <strong>我想找：</strong>名称包含"管理员"<strong>或者</strong>包含"系统"的角色
                </p>
                <p style={{ 
                  margin: '0 0 8px 0',
                  color: token.colorTextSecondary,
                  fontSize: token.fontSizeSM,
                }}>
                  <strong>怎么做：</strong>
                </p>
                <ol style={{ 
                  margin: 0,
                  paddingLeft: 20,
                  color: token.colorTextSecondary,
                  fontSize: token.fontSizeSM,
                }}>
                  <li>点击"添加条件组"，逻辑选择"OR"</li>
                  <li>添加第一个条件：名称 包含 "管理员"</li>
                  <li>添加第二个条件：名称 包含 "系统"</li>
                  <li>点击"搜索"按钮</li>
                </ol>
              </div>
            </div>
          </div>
          
          {/* 温馨提示 */}
          <div style={{ 
            padding: '16px', 
            backgroundColor: token.colorInfoBg, 
            borderRadius: token.borderRadius,
            border: `1px solid ${token.colorInfoBorder}`,
          }}>
            <div style={{ 
              display: 'flex',
              alignItems: 'flex-start',
            }}>
              <Tag color="processing" style={{ marginRight: 8, marginTop: 2 }}>提示</Tag>
              <div style={{ flex: 1 }}>
                <Typography.Text strong style={{ 
                  color: token.colorText, 
                  fontSize: token.fontSize,
                  display: 'block',
                  marginBottom: 8,
                }}>
                  温馨提示
                </Typography.Text>
                <ul style={{ 
                  margin: 0,
                  paddingLeft: 20,
                  color: token.colorInfo,
                  fontSize: token.fontSizeSM,
                }}>
                  <li>筛选条件会与上方的"字段搜索"一起生效</li>
                  <li>可以点击"保存搜索条件"按钮，把常用的筛选保存起来，下次直接使用</li>
                  <li>如果筛选没有结果，检查一下筛选值是否填写完整</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </Modal>
      
      {/* 保存搜索条件弹窗 */}
      <Modal
        title={editingSearch ? t('components.uniQuery.editSearch') : t('components.uniQuery.saveSearchModal')}
        open={saveModalVisible}
        onCancel={() => {
          setSaveModalVisible(false);
          setSaveName('');
          setSaveIsShared(false);
          setSaveIsPinned(false);
          setEditingSearch(null);
        }}
        onOk={handleConfirmSave}
        confirmLoading={createSavedSearchMutation.isPending || updateSavedSearchMutation.isPending}
      >
        <Space orientation="vertical" style={{ width: '100%' }}>
          <div>
            <label>{t('components.uniQuery.searchName')}</label>
            <Input
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder={t('components.uniQuery.searchNamePlaceholder')}
              style={{ marginTop: 8 }}
            />
          </div>
          <div>
            <label>
              <input
                type="checkbox"
                checked={saveIsShared}
                onChange={(e) => setSaveIsShared(e.target.checked)}
                style={{ marginRight: 8 }}
              />
              {t('components.uniQuery.shareToOthers')}
            </label>
          </div>
          <div>
            <label>
              <input
                type="checkbox"
                checked={saveIsPinned}
                onChange={(e) => setSaveIsPinned(e.target.checked)}
                style={{ marginRight: 8 }}
              />
              {t('components.uniQuery.pinToButton')}
            </label>
          </div>
        </Space>
      </Modal>
    </>
  );
};

/**
 * 查询搜索按钮组件属性
 */
interface QuerySearchButtonProps {
  /**
   * ProTable 的 columns
   */
  columns: ProColumns<any>[];
  /**
   * ProTable 的 formRef
   */
  formRef: React.MutableRefObject<ProFormInstance | undefined>;
  /**
   * ProTable 的 actionRef
   */
  actionRef: React.MutableRefObject<ActionType | undefined>;
  /**
   * 搜索参数存储 ref（可选，用于直接传递搜索参数）
   */
  searchParamsRef?: React.MutableRefObject<Record<string, any> | undefined>;
  /** 是否显示内置重置按钮（默认 true；被 UniSearch 包装时通常设为 false） */
  showReset?: boolean;
  /**
   * 若传入则「重置」走此回调（如 UniSearch 需同时清模糊词），否则走内置 handleReset
   */
  onReset?: () => void;
  /**
   * 由 UniTable 在每次全量重置时递增，用于刷新钉住条件激活态（searchParamsRef 为 ref，变更不触发子组件渲染）。
   */
  pinnedSearchUiEpoch?: number;
  /** searchParamsRef 提交后回调（UniTable 用于刷新钉住 Tab 激活态） */
  onSearchParamsApplied?: () => void;
}

/**
 * 查询搜索按钮组件
 */
export const QuerySearchButton: React.FC<QuerySearchButtonProps> = ({
  columns,
  formRef,
  actionRef,
  searchParamsRef,
  showReset = true,
  onReset: onResetProp,
  pinnedSearchUiEpoch = 0,
  onSearchParamsApplied,
}) => {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const { token } = theme.useToken();
  
  // 获取当前页面路径
  const pagePath = location.pathname;
  
  // ⭐ 排序更新触发器（用于响应弹窗中的拖拽排序）
  const [orderUpdateTrigger, setOrderUpdateTrigger] = useState(0);
  const savedSearchVersion = useSavedSearchVersionStore((s) => s.versions[pagePath] ?? 0);
  const prevVersionRef = useRef(0);
  useEffect(() => {
    if (savedSearchVersion > prevVersionRef.current) {
      prevVersionRef.current = savedSearchVersion;
      setOrderUpdateTrigger((prev) => prev + 1);
    }
  }, [savedSearchVersion]);
  
  // 检查是否有 Token（只有登录用户才能获取保存的搜索条件）
  const hasToken = !!getToken();
  
  // 获取已保存的搜索条件列表（只获取钉住的）
  // 注意：所有用户（包括普通用户、组织管理员、平台管理用户、平台超级管理员）都可以使用 saved-searches API
  const { data: savedSearchesData } = useQuery({
    queryKey: ['savedSearches', pagePath],
    queryFn: () => getSavedSearchList(pagePath, true),
    // 只要有 Token 就可以获取数据
    enabled: hasToken,
    // ⚠️ 修复：401 错误时静默失败，不抛出错误，避免触发全局错误处理
    retry: (failureCount, error: any) => {
      // 如果是 401 错误，不重试
      if (error?.response?.status === 401) {
        return false;
      }
      // 其他错误最多重试 1 次
      return failureCount < 1;
    },
    // ⚠️ 修复：401 错误时不抛出错误，静默失败
    throwOnError: false,
  });
  
  // ⭐ 获取钉住的条件，并按照拖拽后的排序显示（完全在 useMemo 中处理，避免状态更新循环）
  const builtinLifecycleStageSearches = useMemo(
    () =>
      createBuiltinLifecycleStageSearches(
        columns,
        pagePath,
        undefined,
        (stage) => stage,
      ),
    [columns, pagePath],
  );

  const pinnedSearches = useMemo(() => {
    const remoteItems = filterRemotePinnedSearches(
      (savedSearchesData?.items || []).filter((item) => !isBuiltinSavedSearch(item)),
      builtinLifecycleStageSearches,
    );
    const mergedItems = [...builtinLifecycleStageSearches, ...remoteItems];
    const allPinned = mergedItems.filter((item) => item.is_pinned);

    if (allPinned.length === 0) {
      return [];
    }
    
    // 分离共享和个人钉住条件
    const sharedPinned = allPinned.filter((item) => item.is_shared);
    const personalPinned = allPinned.filter((item) => !item.is_shared);
    
    const sharedOrderRaw = getSavedSearchOrder(pagePath, 'shared');
    const personalOrderRaw = getSavedSearchOrder(pagePath, 'personal');
    
    let orderedShared: SavedSearch[] = [];
    if (sharedOrderRaw.length > 0) {
      try {
        const order = sharedOrderRaw;
        const ordered = order
          .map((id) => sharedPinned.find((item) => item.id === id))
          .filter((item): item is SavedSearch => item !== undefined);
        const unordered = sharedPinned.filter((item) => !order.includes(item.id));
        orderedShared = [...ordered, ...unordered];
      } catch {
        orderedShared = sharedPinned;
      }
    } else {
      orderedShared = sharedPinned;
    }
    
    let orderedPersonal: SavedSearch[] = [];
    if (personalOrderRaw.length > 0) {
      try {
        const order = personalOrderRaw;
        const ordered = order
          .map((id) => personalPinned.find((item) => item.id === id))
          .filter((item): item is SavedSearch => item !== undefined);
        const unordered = personalPinned.filter((item) => !order.includes(item.id));
        orderedPersonal = [...ordered, ...unordered];
      } catch {
        orderedPersonal = personalPinned;
      }
    } else {
      orderedPersonal = personalPinned;
    }
    
    // 合并排序后的钉住条件（共享在前，个人在后）
    return [...orderedShared, ...orderedPersonal];
  }, [savedSearchesData?.items, pagePath, orderUpdateTrigger, builtinLifecycleStageSearches]);

  /** 钉住条件条可用宽度内能完整展示的数量（超出部分进「更多」），由测量层 + ResizeObserver 更新 */
  const [visiblePinCount, setVisiblePinCount] = useState(1);
  const [pinChipMaxWidth, setPinChipMaxWidth] = useState(150);
  /** 全部钉住条件可在可用宽度内自然排下（不撑满、不留中间空白） */
  const [pinAllFit, setPinAllFit] = useState(true);
  const querySearchRowRef = useRef<HTMLDivElement>(null);
  const pinnedSlotRef = useRef<HTMLDivElement>(null);
  const pinnedBoxRef = useRef<HTMLDivElement>(null);
  const measureLayerRef = useRef<HTMLDivElement>(null);
  const pinnedListKey = useMemo(() => pinnedSearches.map((s) => s.id).join('|'), [pinnedSearches]);

  const visiblePinnedSearches = useMemo(
    () => pinnedSearches.slice(0, Math.min(visiblePinCount, pinnedSearches.length)),
    [pinnedSearches, visiblePinCount],
  );
  const morePinnedSearches = useMemo(
    () => pinnedSearches.slice(visiblePinnedSearches.length),
    [pinnedSearches, visiblePinnedSearches.length],
  );

  const remeasurePinnedSplit = useCallback(() => {
    if (pinnedSearches.length === 0) {
      setVisiblePinCount(0);
      setPinAllFit(true);
      return;
    }
    const row = querySearchRowRef.current;
    const measure = measureLayerRef.current;
    const slot = pinnedSlotRef.current;
    const host = row?.parentElement;
    if (!row || !host || !measure) {
      return;
    }

    const gap = 8;
    let fixed = 0;
    Array.from(row.children).forEach((child) => {
      if (child !== slot) {
        fixed += (child as HTMLElement).offsetWidth;
      }
    });
    const gaps = Math.max(0, row.children.length - 1) * gap;
    const slotMargin = slot ? 16 : 0;
    const avail = host.clientWidth - fixed - gaps - slotMargin;
    if (avail <= 0) {
      return;
    }

    const chipEls = measure.querySelectorAll<HTMLElement>('[data-pin-chip-measure]');
    const moreEl = measure.querySelector<HTMLElement>('[data-pin-more-measure]');
    if (chipEls.length !== pinnedSearches.length || !moreEl) {
      return;
    }
    const widths = Array.from(chipEls).map((el) => el.offsetWidth);
    const moreW = moreEl.offsetWidth;
    const totalNatural = widths.reduce((sum, w) => sum + w, 0);

    if (totalNatural <= avail) {
      setVisiblePinCount(pinnedSearches.length);
      setPinChipMaxWidth(150);
      setPinAllFit(true);
      return;
    }

    let acc = 0;
    let best = 0;
    for (let i = 0; i < widths.length; i++) {
      const needMore = i < widths.length - 1;
      const rowWidth = acc + widths[i] + (needMore ? moreW : 0);
      if (rowWidth <= avail) {
        acc += widths[i];
        best = i + 1;
      } else {
        break;
      }
    }
    if (best === 0) {
      best = 1;
    }
    if (best > pinnedSearches.length) {
      best = pinnedSearches.length;
    }

    const needMoreBtn = best < pinnedSearches.length;
    const chipBudget = Math.max(0, avail - (needMoreBtn ? moreW : 0));
    const chipMax = Math.max(72, Math.min(150, Math.floor(chipBudget / best)));

    setVisiblePinCount(best);
    setPinChipMaxWidth(chipMax);
    setPinAllFit(false);
  }, [pinnedSearches]);

  useLayoutEffect(() => {
    remeasurePinnedSplit();
  }, [remeasurePinnedSplit, pinnedListKey, i18n.language]);

  useEffect(() => {
    const row = querySearchRowRef.current;
    const host = row?.parentElement;
    if (!host || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    let raf = 0;
    const ro = new ResizeObserver(() => {
      if (raf) {
        cancelAnimationFrame(raf);
      }
      raf = requestAnimationFrame(() => {
        remeasurePinnedSplit();
      });
    });
    ro.observe(host);
    return () => {
      ro.disconnect();
      if (raf) {
        cancelAnimationFrame(raf);
      }
    };
  }, [remeasurePinnedSplit, pinnedListKey]);
  /**
   * 修复：创建稳定的激活状态计算函数，避免无限循环
   */
  const getSearchActiveState = useCallback(
    (search: SavedSearch): boolean =>
      arePinnedSearchParamsActive(searchParamsRef?.current, search.search_params),
    [searchParamsRef, pinnedSearchUiEpoch],
  );

  // ⚠️ 修复：使用稳定的函数计算激活状态
  const pinnedSearchActiveStates = useMemo(() => {
    return visiblePinnedSearches.map(search => getSearchActiveState(search));
  }, [visiblePinnedSearches, getSearchActiveState, pinnedSearchUiEpoch]);
  
  // 获取所有可搜索的列
  const getSearchableColumns = () => {
    return columns.filter((col) => {
      // 排除隐藏搜索的列
      if (col.hideInSearch) {
        return false;
      }
      // 排除操作列
      if (col.valueType === 'option') {
        return false;
      }
      return true;
    });
  };
  
  /**
   * 统一过滤空值的工具函数（最佳实践）
   */
  const filterEmptyValues = useCallback((values: Record<string, any>): Record<string, any> => {
    const filtered: Record<string, any> = {};
    Object.keys(values).forEach((key) => {
      const value = values[key];
      // ⭐ 最佳实践：统一过滤逻辑，排除空值
      if (
        value !== undefined && 
        value !== null && 
        value !== '' &&
        !(Array.isArray(value) && value.length === 0)
      ) {
        filtered[key] = value;
      }
    });
    return filtered;
  }, []);

  /**
   * 加载钉住的搜索条件：一次性写入 searchParamsRef，避免先清空再写入导致 reload 读到空筛选。
   */
  const handleLoadPinnedSearch = useCallback(async (search: SavedSearch) => {
    try {
      const searchableColumns = getSearchableColumns();
      const allFieldNames = searchableColumns
        .map((col) => col.dataIndex)
        .filter((name): name is string => typeof name === 'string');

      const filteredParams = filterEmptyValues(search.search_params);
      const mergedFormValues: Record<string, unknown> = {};
      allFieldNames.forEach((name) => {
        mergedFormValues[name] = undefined;
      });
      Object.assign(mergedFormValues, filteredParams);

      if (formRef.current) {
        formRef.current.setFieldsValue(mergedFormValues);
      }
      commitListPageSearchParams(searchParamsRef, filteredParams, onSearchParamsApplied);

      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });

      actionRef.current?.reload?.();
    } catch (error) {
      console.error('加载钉住的搜索条件失败:', error);
    }
  }, [getSearchableColumns, formRef, searchParamsRef, actionRef, filterEmptyValues, onSearchParamsApplied]);

  /**
   * 重置所有筛选条件
   */
  const handleReset = () => {
    // 清空表单所有字段
    if (formRef.current) {
      formRef.current.resetFields();
    }
    // 清空搜索参数 ref
    if (searchParamsRef) {
      commitListPageSearchParams(searchParamsRef, undefined, onSearchParamsApplied);
    }
    // 重新加载表格数据
    if (actionRef.current) {
      actionRef.current.reload();
    }
  };

  const [visible, setVisible] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [modalStyle, setModalStyle] = useState<React.CSSProperties>({});

  /**
   * 计算 Modal 位置，使其在按钮下方弹出，并与按钮左对齐
   */
  const calculateModalPosition = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setModalStyle({
        top: `${rect.bottom + 8}px`,
        left: `${rect.left}px`,
        paddingBottom: 0,
        margin: 0,
        transform: 'none',
      });
    }
  }, []);

  /**
   * 打开弹窗时计算位置
   * 在设置 visible 之前先计算位置，确保 Modal 打开时就有正确的位置
   */
  const handleOpen = () => {
    // 先计算位置，再打开 Modal
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setModalStyle({
        top: `${rect.bottom + 8}px`,
        left: `${rect.left}px`,
        paddingBottom: 0,
        margin: 0,
        transform: 'none',
      });
    }
    // 使用 requestAnimationFrame 确保样式已应用后再打开 Modal
    requestAnimationFrame(() => {
      setVisible(true);
    });
  };

  /**
   * 窗口大小改变时重新计算位置
   */
  useEffect(() => {
    if (visible) {
      const handleResize = () => {
        calculateModalPosition();
      };
      window.addEventListener('resize', handleResize);
      window.addEventListener('scroll', handleResize, true);
      return () => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('scroll', handleResize, true);
      };
    }
  }, [visible, calculateModalPosition]);

  /**
   * Modal 打开时，确保位置已计算
   */
  useLayoutEffect(() => {
    if (visible && buttonRef.current && Object.keys(modalStyle).length === 0) {
      // 如果 Modal 已打开但位置未计算，立即计算
      calculateModalPosition();
    }
  }, [visible, modalStyle, calculateModalPosition]);

  /** 钉住标签 / 「更多」：去掉上下 padding 与过大行高，避免中文在 32px 高度内视觉上偏上 */
  const pinnedTabTextBtnLayout = useMemo(
    () => ({
      height: 32,
      padding: '0 15px',
      lineHeight: 1,
      display: 'inline-flex' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      boxSizing: 'border-box' as const,
    }),
    [],
  );

  return (
    <>
      <div
        ref={querySearchRowRef}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          minHeight: '32px',
          flexWrap: 'nowrap',
          width: '100%',
          minWidth: 0,
          overflow: 'hidden',
        }}
      >
      <Button
          ref={buttonRef}
          onClick={handleOpen}
          type="default"
          style={{ height: '32px', flexShrink: 0 }}
      >
        {t('components.uniQuery.advancedSearch')}
          <DownOutlined style={{ marginLeft: 4 }} />
      </Button>
        {showReset && (
          <Button
            className="uni-search-reset-btn"
            onClick={() => (onResetProp ? onResetProp() : handleReset())}
            icon={<ReloadOutlined />}
            type="default"
            style={{ height: '32px' }}
          >
            {t('components.uniQuery.reset')}
          </Button>
        )}
        {/* 钉住条件：按容器宽度动态拆分，宽度不足时收入「更多」下拉 */}
        {pinnedSearches.length > 0 && (
          <div
            ref={pinnedSlotRef}
            style={{
              flex: 1,
              minWidth: 0,
              margin: '0 8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
            }}
          >
            <div
              ref={pinnedBoxRef}
              className="uni-query-pinned-conditions"
              style={{
                position: 'relative',
                width: 'max-content',
                maxWidth: '100%',
                minWidth: 0,
                alignSelf: 'flex-start',
                borderRadius: token.borderRadius,
                border: `1px solid ${token.colorBorder}`,
                overflow: 'hidden',
                backgroundColor: token.colorBgContainer,
                height: '32px',
                boxShadow:
                  '0 1px 2px 0 rgba(0, 0, 0, 0.03), 0 1px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px 0 rgba(0, 0, 0, 0.02)',
              }}
            >
              {/* 离屏测量：与可见按钮同样式，用于计算可容纳条数 */}
              <div
                ref={measureLayerRef}
                aria-hidden
                style={{
                  position: 'absolute',
                  left: -99999,
                  top: 0,
                  display: 'flex',
                  alignItems: 'center',
                  visibility: 'hidden',
                  pointerEvents: 'none',
                  height: '32px',
                }}
              >
                {pinnedSearches.map((search, index) => (
                  <Button
                    key={`measure-${search.id}`}
                    type="text"
                    data-pin-chip-measure
                    tabIndex={-1}
                    style={{
                      ...pinnedTabTextBtnLayout,
                      borderRadius: 0,
                      border: 'none',
                      borderRight:
                        index < pinnedSearches.length - 1 || pinnedSearches.length > 0
                          ? `1px solid ${token.colorBorder}`
                          : 'none',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '150px',
                      backgroundColor: token.colorBgContainer,
                      color: token.colorText,
                    }}
                  >
                    {search.name}
                  </Button>
                ))}
                <Button
                  type="text"
                  icon={<DownOutlined />}
                  data-pin-more-measure
                  tabIndex={-1}
                  style={{
                    ...pinnedTabTextBtnLayout,
                    gap: 4,
                    borderRadius: 0,
                    border: 'none',
                    backgroundColor: token.colorBgContainer,
                    color: token.colorText,
                  }}
                >
                  {t('components.uniQuery.more')} ({Math.max(1, pinnedSearches.length - 1)})
                </Button>
              </div>
              <div
                style={{
                  display: 'inline-flex',
                  minWidth: 0,
                  overflow: 'hidden',
                  alignItems: 'center',
                  height: '32px',
                }}
              >
                {visiblePinnedSearches.map((search, index) => {
                  const isActive = pinnedSearchActiveStates[index];
                  return (
                    <Button
                      key={search.id}
                      onClick={() => handleLoadPinnedSearch(search)}
                      type="text"
                      style={{
                        ...pinnedTabTextBtnLayout,
                        borderRadius: 0,
                        border: 'none',
                        flexShrink: 0,
                        borderRight:
                          index < visiblePinnedSearches.length - 1 || morePinnedSearches.length > 0
                            ? `1px solid ${token.colorBorder}`
                            : 'none',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '150px',
                        backgroundColor: isActive ? token.colorPrimaryBg : token.colorBgContainer,
                        color: isActive ? token.colorPrimary : token.colorText,
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.backgroundColor = token.colorFillSecondary;
                          e.currentTarget.style.color = token.colorPrimary;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.backgroundColor = token.colorBgContainer;
                          e.currentTarget.style.color = token.colorText;
                        } else {
                          e.currentTarget.style.backgroundColor = token.colorPrimaryBg;
                          e.currentTarget.style.color = token.colorPrimary;
                        }
                      }}
                      title={search.name}
                    >
                      {search.name}
                    </Button>
                  );
                })}
                {morePinnedSearches.length > 0 && (
                  <Dropdown
                    menu={{
                      items: morePinnedSearches.map((search) => ({
                        key: search.id,
                        label: search.name,
                        onClick: () => handleLoadPinnedSearch(search),
                      })),
                    }}
                    trigger={['click']}
                  >
                    <Button
                      type="text"
                      icon={<DownOutlined />}
                      style={{
                        ...pinnedTabTextBtnLayout,
                        gap: 4,
                        borderRadius: 0,
                        border: 'none',
                        flexShrink: 0,
                        backgroundColor: token.colorBgContainer,
                        color: token.colorText,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = token.colorFillSecondary;
                        e.currentTarget.style.color = token.colorPrimary;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = token.colorBgContainer;
                        e.currentTarget.style.color = token.colorText;
                      }}
                    >
                      {t('components.uniQuery.more')} ({morePinnedSearches.length})
                    </Button>
                  </Dropdown>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      <QuerySearchModal
        columns={columns}
        formRef={formRef}
        actionRef={actionRef}
        visible={visible}
        onClose={() => setVisible(false)}
        searchParamsRef={searchParamsRef}
        onSearchParamsApplied={onSearchParamsApplied}
      />
    </>
  );
};
