/**
 * RiverEdge SaaS 多组织框架 - ProTable 查询条件保存插件
 *
 * 用于接管 ProTable 的搜索栏，将搜索条件在弹窗中展示
 */

import { useRef, useState, useEffect, useLayoutEffect, useCallback, useMemo, forwardRef } from 'react';
import type { ActionType, ProFormInstance, ProColumns } from '@ant-design/pro-components';
import { ProForm, ProFormText, ProFormSelect, ProFormDatePicker, ProFormDateRangePicker } from '@ant-design/pro-components';
import { Button, Modal, Row, Col, AutoComplete, Input, Space, App, List, Typography, Dropdown, MenuProps, theme } from 'antd';
import { SaveOutlined, DeleteOutlined, DownOutlined, EditOutlined, PushpinOutlined, PushpinFilled, MoreOutlined, ReloadOutlined, SearchOutlined, ShareAltOutlined, HolderOutlined } from '@ant-design/icons';
import type { AutoCompleteProps } from 'antd';
import { filterByPinyinInitials } from '../../utils/pinyin';
import { useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSavedSearchList, createSavedSearch, deleteSavedSearchByUuid, updateSavedSearchByUuid, SavedSearch } from '../../services/savedSearch';
import { getToken, getUserInfo } from '../../utils/auth';
import { useGlobalStore } from '../../stores';
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
              const { matchPinyinInitials } = require('@/utils/pinyin');
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
}

/**
 * 查询搜索弹窗组件
 */
export const QuerySearchModal: React.FC<QuerySearchModalProps> = ({
  columns,
  formRef,
  actionRef,
  visible,
  onClose,
  style,
  searchParamsRef,
}) => {
  const searchFormRef = useRef<ProFormInstance>();
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  const { message: messageApi } = App.useApp();
  const queryClient = useQueryClient();
  const { currentUser } = useGlobalStore();
  const { token } = theme.useToken();
  
  // 获取当前页面路径
  const pagePath = location.pathname;
  
  // 判断是否是自己的搜索条件
  const isOwnSearch = (search: SavedSearch) => {
    return currentUser && search.user_id === currentUser.id;
  };
  
  // 保存搜索条件弹窗状态
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveIsShared, setSaveIsShared] = useState(false);
  const [saveIsPinned, setSaveIsPinned] = useState(false);
  const [editingSearch, setEditingSearch] = useState<SavedSearch | null>(null);
  
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
  
  const savedSearches = savedSearchesData?.items || [];
  
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
    const currentPersonalOrder = personalOrder.length > 0 ? personalOrder :
      (() => {
    const personalOrderKey = `saved_search_order_personal_${pagePath}`;
        const stored = localStorage.getItem(personalOrderKey);
        return stored ? JSON.parse(stored) as number[] : [];
      })();

    const currentSharedOrder = sharedOrder.length > 0 ? sharedOrder :
      (() => {
    const sharedOrderKey = `saved_search_order_shared_${pagePath}`;
        const stored = localStorage.getItem(sharedOrderKey);
        return stored ? JSON.parse(stored) as number[] : [];
      })();
    
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

      // 更新状态（触发重新计算）
      setSharedOrder(newOrder);
        
        // 保存排序到 localStorage
        const orderKey = `saved_search_order_shared_${pagePath}`;
      localStorage.setItem(orderKey, JSON.stringify(newOrder));
    }
  }, [pagePath, sharedSearches]);
  
  // 处理个人搜索条件拖拽结束
  const handlePersonalDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = personalSearches.findIndex((item) => item.id === active.id);
      const newIndex = personalSearches.findIndex((item) => item.id === over.id);
      const newOrder = arrayMove(personalSearches.map(item => item.id), oldIndex, newIndex);

      // 更新状态（触发重新计算）
      setPersonalOrder(newOrder);
        
        // 保存排序到 localStorage
        const orderKey = `saved_search_order_personal_${pagePath}`;
      localStorage.setItem(orderKey, JSON.stringify(newOrder));
    }
  }, [pagePath, personalSearches]);
  
  // 创建保存搜索条件 mutation
  const createSavedSearchMutation = useMutation({
    mutationFn: createSavedSearch,
    onSuccess: () => {
      messageApi.success('搜索条件已保存');
      setSaveModalVisible(false);
      setSaveName('');
      setSaveIsShared(false);
      queryClient.invalidateQueries({ queryKey: ['savedSearches', pagePath] });
    },
    onError: (error: any) => {
      messageApi.error(error?.message || '保存失败');
    },
  });
  
  // 删除保存搜索条件 mutation
  const deleteSavedSearchMutation = useMutation({
    mutationFn: deleteSavedSearchByUuid,
    onSuccess: () => {
      messageApi.success('搜索条件已删除');
      queryClient.invalidateQueries({ queryKey: ['savedSearches', pagePath] });
    },
    onError: (error: any) => {
      messageApi.error(error?.message || '删除失败');
    },
  });
  
  // 更新保存搜索条件 mutation
  const updateSavedSearchMutation = useMutation({
    mutationFn: ({ uuid, data }: { uuid: string; data: any }) => updateSavedSearchByUuid(uuid, data),
    onSuccess: () => {
      messageApi.success('搜索条件已更新');
      setSaveModalVisible(false);
      setSaveName('');
      setSaveIsShared(false);
      setSaveIsPinned(false);
      setEditingSearch(null);
      queryClient.invalidateQueries({ queryKey: ['savedSearches', pagePath] });
    },
    onError: (error: any) => {
      messageApi.error(error?.message || '更新失败');
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

  /**
   * 根据列类型渲染表单项
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
              placeholder={`请输入${title as string}`}
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
          placeholder={`请输入${title as string}`}
          fieldProps={fieldProps}
        />
      );
    }

    // 选择框
    if (valueType === 'select' && valueEnum) {
      return (
        <ProFormSelect
          key={dataIndex as string}
          name={dataIndex as string}
          label={title as string}
          placeholder={`请选择${title as string}`}
          valueEnum={valueEnum}
          fieldProps={fieldProps}
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
          placeholder={`请选择${title as string}`}
          fieldProps={fieldProps}
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
          placeholder={[`开始${title as string}`, `结束${title as string}`]}
          fieldProps={fieldProps}
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
            placeholder={`请输入${title as string}`}
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
        fieldProps={fieldProps}
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
      
      // 调试日志（开发环境）
      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 高级搜索 - 设置搜索参数:', {
          values,
          filteredValues,
          hasSearchParamsRef: !!searchParamsRef,
        });
      }
      
      // ⭐ 最佳实践：统一设置搜索参数到所有需要的地方
      // 1. 设置到 ProTable 的表单（用于表单值读取）
      if (formRef.current) {
        formRef.current.setFieldsValue(filteredValues);
      }
      
      // 2. 存储到 searchParamsRef（用于直接传递搜索参数）
      // ⚠️ 修复：始终设置 searchParamsRef.current，即使 filteredValues 是空对象
      // 这样可以确保 handleRequest 能够正确获取搜索参数，避免时序问题
      if (searchParamsRef) {
        searchParamsRef.current = filteredValues;
        
        // 调试日志：确认 searchParamsRef 已设置
        if (process.env.NODE_ENV === 'development') {
          console.log('🔍 高级搜索 - searchParamsRef 已设置:', {
            searchParamsRef: searchParamsRef.current,
            filteredValues,
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
      messageApi.error('搜索失败，请稍后重试');
    }
  }, [formRef, searchParamsRef, actionRef, onClose, filterEmptyValues, messageApi]);

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
        searchParamsRef.current = undefined;
      }
      
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
  }, [formRef, searchParamsRef, actionRef]);

  /**
   * 处理保存搜索条件（最佳实践：统一空值过滤）
   */
  const handleSaveSearch = useCallback(() => {
    const values = searchFormRef.current?.getFieldsValue() || {};
    const filteredValues = filterEmptyValues(values);
    
    if (Object.keys(filteredValues).length === 0) {
      messageApi.warning('请先设置搜索条件');
      return;
    }
    
    // 打开保存弹窗
    setSaveModalVisible(true);
  }, [filterEmptyValues, messageApi]);
  
  /**
   * 确认保存搜索条件（最佳实践：统一空值过滤）
   */
  const handleConfirmSave = useCallback(() => {
    if (!saveName.trim()) {
      messageApi.warning('请输入搜索条件名称');
      return;
    }
    
    const values = searchFormRef.current?.getFieldsValue() || {};
    const filteredValues = filterEmptyValues(values);
    
    if (editingSearch) {
      // 更新现有搜索条件
      updateSavedSearchMutation.mutate({
        uuid: editingSearch.uuid,
        data: {
          name: saveName.trim(),
          is_shared: saveIsShared,
          is_pinned: saveIsPinned,
          search_params: filteredValues,
        },
      });
    } else {
      // 创建新搜索条件
      createSavedSearchMutation.mutate({
        page_path: pagePath,
        name: saveName.trim(),
        is_shared: saveIsShared,
        is_pinned: saveIsPinned,
        search_params: filteredValues,
      });
    }
  }, [saveName, saveIsShared, saveIsPinned, editingSearch, pagePath, filterEmptyValues, messageApi, updateSavedSearchMutation, createSavedSearchMutation]);
  
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
      
      // ⭐ 最佳实践：设置到搜索表单和 ProTable 表单（不设置 searchParamsRef，不触发搜索）
      searchFormRef.current?.setFieldsValue(filteredParams);
      if (formRef.current) {
        formRef.current.setFieldsValue(filteredParams);
      }
      
      // 不关闭弹窗，让用户可以看到已加载的条件并可以修改
    } catch (error) {
      console.error('加载搜索条件失败:', error);
      messageApi.error('加载搜索条件失败，请稍后重试');
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
      
      // ⭐ 最佳实践：设置到所有需要的地方
      searchFormRef.current?.setFieldsValue(filteredParams);
      if (formRef.current) {
        formRef.current.setFieldsValue(filteredParams);
      }
      if (searchParamsRef) {
        searchParamsRef.current = filteredParams;
      }
      
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
      messageApi.error('应用搜索条件失败，请稍后重试');
    }
  }, [getSearchableColumns, formRef, searchParamsRef, actionRef, filterEmptyValues, messageApi, onClose]);
  
  /**
   * 删除已保存的搜索条件
   */
  const handleDeleteSavedSearch = (e: React.MouseEvent | React.KeyboardEvent, search: SavedSearch) => {
    if ('stopPropagation' in e) {
      e.stopPropagation(); // 阻止事件冒泡
    }
    
    // 检查是否是自己的条件
    if (!isOwnSearch(search)) {
      messageApi.warning('只能删除自己创建的搜索条件');
      return;
    }
    
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个搜索条件吗？',
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
        .query-search-modal-wrap .ant-list-item-meta-title {
          margin-bottom: 0 !important;
        }
        .query-search-modal-wrap .ant-list-item-action > li {
          padding: 0 2px !important;
        }
        .ant-list-item {
          border-radius: 6px !important;
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
        title="搜索条件"
        open={visible}
        onCancel={onClose}
        width={1200}
        centered={false}
        style={style}
        getContainer={() => document.body}
        mask={true}
        wrapClassName="query-search-modal-wrap"
        footer={null}
      >
      <div style={{ display: 'flex', minHeight: 400 }}>
        {/* 左侧：搜索表单 */}
        <div 
          style={{ flex: '2', paddingRight: 16, borderRight: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column' }}
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
                正在编辑：{editingSearch.name}
              </span>
              <Button 
                type="text" 
                size="small"
                onClick={handleCancelEdit}
                style={{ color: '#1890ff' }}
              >
                取消编辑
              </Button>
            </div>
          )}
          
          <ProForm
            formRef={searchFormRef}
            submitter={false}
          >
            <Row gutter={16}>
              {searchableColumns.map((column) => (
                <Col span={12} key={column.dataIndex as string}>
                  {renderFormItem(column)}
                </Col>
              ))}
            </Row>
          </ProForm>
          
          {/* 搜索相关按钮（底部对齐） */}
          <div style={{ marginTop: 'auto', paddingTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button 
              icon={<SaveOutlined />} 
              onClick={handleSaveSearch}
              type={editingSearch ? 'primary' : 'default'}
            >
              {editingSearch ? '更新搜索条件' : '保存搜索条件'}
            </Button>
            <Button onClick={handleReset}>
              重置
            </Button>
            <Button onClick={onClose}>
              取消
            </Button>
            <Button 
              type="primary" 
              onClick={handleSearch}
              ref={searchButtonRef}
            >
              搜索
            </Button>
          </div>
        </div>
        
        {/* 中间：共享搜索条件 */}
        <div style={{ flex: '1', paddingLeft: 16, paddingRight: 16, borderRight: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column' }}>
          <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 16 }}>
            共享搜索条件
          </Typography.Title>
          {sharedSearches.length > 0 ? (
            <div style={{ 
              flex: 1, 
              overflowY: 'auto', 
              maxHeight: '400px',
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
                    borderRadius: '4px',
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
                      title="应用搜索"
                      style={{ marginRight: 0 }}
                    />,
                    <Button
                      key="pin"
                      type="text"
                      size="small"
                      icon={item.is_pinned ? <PushpinFilled /> : <PushpinOutlined />}
                      onClick={(e) => handleTogglePin(e, item)}
                      title={item.is_pinned ? '取消钉住' : '钉住'}
                      style={{ marginRight: 0 }}
                    />,
                    <Dropdown
                      key="more"
                      menu={{
                        items: [
                          {
                            key: 'edit',
                            label: '编辑',
                            icon: <EditOutlined />,
                            onClick: (e) => {
                              e.domEvent.stopPropagation();
                              handleEditSavedSearch(e.domEvent, item);
                            },
                          },
                          // 如果是自己的公共条件，显示"转为个人"选项
                          ...(item.is_shared && isOwnSearch(item) ? [{
                            key: 'convert-to-personal',
                            label: '转为个人',
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
                            label: '删除',
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
              暂无共享搜索条件
            </div>
          )}
        </div>
        
        {/* 右侧：个人搜索条件 */}
        <div style={{ flex: '1', paddingLeft: 16, display: 'flex', flexDirection: 'column' }}>
          <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 16 }}>
            个人搜索条件
          </Typography.Title>
          {personalSearches.length > 0 ? (
            <div style={{ 
              flex: 1, 
              overflowY: 'auto', 
              maxHeight: '400px',
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
                    borderRadius: '4px',
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
                      title="应用搜索"
                      style={{ marginRight: 0 }}
                    />,
                    <Button
                      key="pin"
                      type="text"
                      size="small"
                      icon={item.is_pinned ? <PushpinFilled /> : <PushpinOutlined />}
                      onClick={(e) => handleTogglePin(e, item)}
                      title={item.is_pinned ? '取消钉住' : '钉住'}
                      style={{ marginRight: 0 }}
                    />,
                    <Dropdown
                      key="more"
                      menu={{
                        items: [
                          {
                            key: 'edit',
                            label: '编辑',
                            icon: <EditOutlined />,
                            onClick: (e) => {
                              e.domEvent.stopPropagation();
                              handleEditSavedSearch(e.domEvent, item);
                            },
                          },
                          // 如果是个人条件，显示"设为公共"选项
                          ...(!item.is_shared && isOwnSearch(item) ? [{
                            key: 'set-to-shared',
                            label: '设为公共',
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
                            label: '转为个人',
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
                            label: '删除',
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
              暂无个人搜索条件
            </div>
          )}
        </div>
      </div>
      </Modal>
      
      {/* 保存搜索条件弹窗 */}
      <Modal
        title={editingSearch ? '编辑搜索条件' : '保存搜索条件'}
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
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <label>搜索条件名称：</label>
            <Input
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="请输入搜索条件名称"
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
              共享给其他用户
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
              钉住（显示在高级搜索按钮后面）
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
}

/**
 * 查询搜索按钮组件
 */
export const QuerySearchButton: React.FC<QuerySearchButtonProps> = ({
  columns,
  formRef,
  actionRef,
  searchParamsRef,
}) => {
  const location = useLocation();
  const { token } = theme.useToken();
  
  // 获取当前页面路径
  const pagePath = location.pathname;
  
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
  const pinnedSearches = useMemo(() => {
    const allPinned = (savedSearchesData?.items || []).filter((item) => item.is_pinned);

    if (allPinned.length === 0) {
      return [];
    }
    
    // 分离共享和个人钉住条件
    const sharedPinned = allPinned.filter((item) => item.is_shared);
    const personalPinned = allPinned.filter((item) => !item.is_shared);
    
    // 从 localStorage 获取排序
    const sharedOrderKey = `saved_search_order_shared_${pagePath}`;
    const personalOrderKey = `saved_search_order_personal_${pagePath}`;
    
    const sharedOrder = localStorage.getItem(sharedOrderKey);
    const personalOrder = localStorage.getItem(personalOrderKey);
    
    // 排序共享钉住条件
    let orderedShared: SavedSearch[] = [];
    if (sharedOrder) {
      try {
        const order = JSON.parse(sharedOrder) as number[];
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
    
    // 排序个人钉住条件
    let orderedPersonal: SavedSearch[] = [];
    if (personalOrder) {
      try {
        const order = JSON.parse(personalOrder) as number[];
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
  }, [savedSearchesData?.items, pagePath]);
  
  // ⭐ 限制显示的钉住条件数量，避免影响后面的视图组件
  const MAX_VISIBLE_PINNED = 5; // 最多显示 5 个钉住的条件
  const visiblePinnedSearches = pinnedSearches.slice(0, MAX_VISIBLE_PINNED);
  const morePinnedSearches = pinnedSearches.slice(MAX_VISIBLE_PINNED);

  /**
   * 判断搜索条件是否匹配（用于显示激活状态）
   * ⚠️ 修复：直接比较当前搜索参数，避免依赖变化导致的无限循环
   */
  const isSearchActive = useCallback((savedSearch: SavedSearch): boolean => {
    const currentParams = searchParamsRef?.current;
    if (!currentParams) {
      return false;
    }
    const savedParams = savedSearch.search_params || {};

    // 比较所有搜索参数
    const savedKeys = Object.keys(savedParams);
    if (savedKeys.length === 0) {
      return false;
    }

    // 检查所有保存的参数是否都在当前搜索参数中，且值匹配
    for (const key of savedKeys) {
      const savedValue = savedParams[key];
      const currentValue = currentParams[key];

      // 处理数组类型的值（如多选）
      if (Array.isArray(savedValue) && Array.isArray(currentValue)) {
        if (savedValue.length !== currentValue.length) {
          return false;
        }
        const sortedSaved = [...savedValue].sort();
        const sortedCurrent = [...currentValue].sort();
        if (JSON.stringify(sortedSaved) !== JSON.stringify(sortedCurrent)) {
          return false;
        }
      } else if (savedValue !== currentValue) {
        return false;
      }
    }

    return true;
  }, []); // ⚠️ 修复：移除依赖项，通过 useMemo 在外部控制重新计算

  // ⚠️ 修复：创建稳定的激活状态计算函数，避免无限循环
  const getSearchActiveState = useCallback((search: SavedSearch): boolean => {
    const currentParams = searchParamsRef?.current;
    if (!currentParams) {
      return false;
    }
    const savedParams = search.search_params || {};
    const savedKeys = Object.keys(savedParams);
    if (savedKeys.length === 0) {
      return false;
    }

    // 检查所有保存的参数是否都在当前搜索参数中，且值匹配
    for (const key of savedKeys) {
      const savedValue = savedParams[key];
      const currentValue = currentParams[key];

      // 处理数组类型的值（如多选）
      if (Array.isArray(savedValue) && Array.isArray(currentValue)) {
        if (savedValue.length !== currentValue.length) {
          return false;
        }
        const sortedSaved = [...savedValue].sort();
        const sortedCurrent = [...currentValue].sort();
        if (JSON.stringify(sortedSaved) !== JSON.stringify(sortedCurrent)) {
          return false;
        }
      } else if (savedValue !== currentValue) {
        return false;
      }
    }

    return true;
  }, []); // 空依赖数组，确保函数引用稳定

  // ⚠️ 修复：使用稳定的函数计算激活状态
  const pinnedSearchActiveStates = useMemo(() => {
    return visiblePinnedSearches.map(search => getSearchActiveState(search));
  }, [visiblePinnedSearches, getSearchActiveState]);
  
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
   * 加载钉住的搜索条件（最佳实践：统一清空和设置逻辑）
   */
  const handleLoadPinnedSearch = useCallback(async (search: SavedSearch) => {
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
      const filteredParams = filterEmptyValues(search.search_params);
      
      // ⭐ 最佳实践：设置到所有需要的地方
      if (formRef.current) {
        formRef.current.setFieldsValue(filteredParams);
      }
      if (searchParamsRef) {
        searchParamsRef.current = filteredParams;
      }
      
      // ⭐ 最佳实践：等待表单值更新后再触发搜索
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          setTimeout(() => {
            resolve();
          }, 100);
        });
      });
      
      // ⭐ 最佳实践：触发 ProTable 重新查询
      if (actionRef.current) {
        actionRef.current.reload(false);
      }
    } catch (error) {
      console.error('加载钉住的搜索条件失败:', error);
    }
  }, [getSearchableColumns, formRef, searchParamsRef, actionRef, filterEmptyValues]);

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
      searchParamsRef.current = undefined;
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

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: '32px', height: '32px' }}>
      <Button
          ref={buttonRef}
          onClick={handleOpen}
          type="text"
          style={{
            backgroundColor: token.colorFillTertiary,
            color: token.colorPrimary,
            height: '32px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = token.colorFillSecondary;
            e.currentTarget.style.color = token.colorPrimary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = token.colorFillTertiary;
            e.currentTarget.style.color = token.colorPrimary;
          }}
      >
        高级搜索
          <DownOutlined style={{ marginLeft: 4 }} />
      </Button>
        <Button
          onClick={handleReset}
          icon={<ReloadOutlined />}
          type="text"
          style={{
            backgroundColor: token.colorFillTertiary,
            color: token.colorTextSecondary,
            height: '32px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = token.colorFillSecondary;
            e.currentTarget.style.color = token.colorText;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = token.colorFillTertiary;
            e.currentTarget.style.color = token.colorTextSecondary;
          }}
        >
          重置
        </Button>
        {/* 显示钉住的搜索条件 - 使用 TAB 样式，与前面按钮大小一致 */}
        {pinnedSearches.length > 0 && (
          <div 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 0, 
              marginLeft: 8,
              borderRadius: '6px',
              border: `1px solid ${token.colorBorder}`,
              overflow: 'hidden',
              backgroundColor: token.colorBgContainer,
              height: '32px', // 与高级搜索按钮高度一致
            }}
          >
            {/* 显示前 N 个钉住的条件 - 使用 Button TAB 样式 */}
            {visiblePinnedSearches.map((search, index) => {
              const isActive = pinnedSearchActiveStates[index];
              return (
                <Button
                  key={search.id}
                  onClick={() => handleLoadPinnedSearch(search)}
                  type="text"
                  style={{ 
                    borderRadius: 0,
                    border: 'none',
                    borderRight: index < visiblePinnedSearches.length - 1 || morePinnedSearches.length > 0 ? `1px solid ${token.colorBorder}` : 'none',
                    height: '32px',
                    padding: '4px 15px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
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
            {/* 如果还有更多钉住的条件，显示"更多条件"下拉菜单 - 使用 Button TAB 样式 */}
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
                    borderRadius: 0,
                    border: 'none',
                    height: '32px',
                    padding: '4px 15px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
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
                  更多 ({morePinnedSearches.length})
                </Button>
              </Dropdown>
            )}
          </div>
        )}
      </div>
      <QuerySearchModal
        columns={columns}
        formRef={formRef}
        actionRef={actionRef}
        visible={visible}
        onClose={() => setVisible(false)}
        style={modalStyle}
        searchParamsRef={searchParamsRef}
      />
    </>
  );
};
