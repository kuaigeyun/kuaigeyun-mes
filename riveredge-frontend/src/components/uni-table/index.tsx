/**
 * 统一 ProTable 组件
 * 
 * 封装了所有表格的通用配置和功能，确保所有表格使用统一的格式。
 * 后续完善时，只需修改此组件，所有表格都会同步更新。
 */

import React, { useRef, useLayoutEffect, ReactNode, useState, useEffect } from 'react';
import { ProTable, ActionType, ProColumns, ProFormInstance, ProTableProps } from '@ant-design/pro-components';
import { Button, Space, Radio, Dropdown, MenuProps, App, Input, theme, Empty } from 'antd';
import { DownloadOutlined, UploadOutlined, PlusOutlined, EditOutlined, DeleteOutlined, TableOutlined, AppstoreOutlined, BarsOutlined, BarChartOutlined, DownOutlined, SearchOutlined } from '@ant-design/icons';
import { QuerySearchButton } from '../riveredge-query';
import { isPinyinKeyword, matchPinyinInitialsAsync } from '../../utils/pinyin';
// 内联的 useProTableSearch hook（简化实现）
const useProTableSearch = () => {
  const searchParamsRef = useRef<Record<string, any> | undefined>(undefined);
  const formRef = useRef<ProFormInstance>();
  const actionRef = useRef<ActionType>();

  return {
    searchParamsRef,
    formRef,
    actionRef,
  };
};
import { UniImport } from '../uni-import';

/**
 * 从 columns 自动生成导入配置
 * 
 * @param columns - 表格列定义
 * @param options - 配置选项
 * @returns 导入配置（表头、示例数据、字段映射、验证规则）
 */
function generateImportConfigFromColumns<T extends Record<string, any>>(
  columns: ProColumns<T>[],
  options?: {
    excludeFields?: string[]; // 排除的字段（如 id、created_at 等）
    includeFields?: string[]; // 只包含的字段（如果提供，只包含这些字段）
    fieldMap?: Record<string, string>; // 自定义字段映射
    fieldRules?: Record<string, { required?: boolean; validator?: (value: any) => boolean | string }>; // 自定义验证规则
  }
) {
  const {
    excludeFields = ['id', 'created_at', 'updated_at', 'deleted_at'],
    includeFields,
    fieldMap: customFieldMap = {},
    fieldRules: customFieldRules = {},
  } = options || {};

  const headers: string[] = [];
  const exampleRow: string[] = [];
  const fieldMap: Record<string, string> = { ...customFieldMap };
  const fieldRules: Record<string, { required?: boolean; validator?: (value: any) => boolean | string }> = { ...customFieldRules };

  // 过滤可导入的列
  const importableColumns = columns.filter((col) => {
    const dataIndex = col.dataIndex;
    if (!dataIndex) return false;
    
    const fieldName = Array.isArray(dataIndex) ? dataIndex.join('.') : String(dataIndex);
    
    // 排除字段
    if (excludeFields.includes(fieldName)) return false;
    
    // 如果指定了包含字段，只包含这些字段
    if (includeFields && !includeFields.includes(fieldName)) return false;
    
    // 排除隐藏的列（hideInTable）
    if (col.hideInTable) return false;
    
    // 排除操作列（通常没有 dataIndex 或 dataIndex 为 'option'）
    if (fieldName === 'option' || fieldName === 'action') return false;
    
    return true;
  });

  // 生成表头、示例数据和字段映射
  importableColumns.forEach((col) => {
    const dataIndex = col.dataIndex;
    const fieldName = Array.isArray(dataIndex) ? dataIndex.join('.') : String(dataIndex);
    const title = col.title as string || fieldName;
    
    // 生成表头（支持必填标识）
    // 检查是否必填：通过 required 属性或 fieldProps.required
    const isRequired = (col as any).required === true || 
                      ((col.fieldProps as any)?.required === true);
    const headerTitle = isRequired ? `*${title}` : title;
    headers.push(headerTitle);
    
    // 生成示例数据
    let exampleValue = '';
    if (col.valueType === 'select' || col.valueEnum) {
      // 枚举类型，使用第一个选项
      const valueEnum = col.valueEnum as any;
      if (valueEnum && typeof valueEnum === 'object') {
        const firstOption = Object.keys(valueEnum)[0];
        exampleValue = valueEnum[firstOption]?.text || firstOption || '';
      } else {
        exampleValue = '示例值';
      }
    } else if (col.valueType === 'date' || col.valueType === 'dateTime') {
      exampleValue = '2024-01-01';
    } else if (col.valueType === 'digit' || col.valueType === 'number') {
      exampleValue = '0';
    } else if (col.valueType === 'switch' || col.valueType === 'checkbox') {
      exampleValue = '是';
    } else {
      exampleValue = `示例${title}`;
    }
    exampleRow.push(exampleValue);
    
    // 生成字段映射（支持多种表头名称映射到同一个字段）
    const normalizedTitle = title.trim();
    const normalizedHeaderTitle = headerTitle.trim();
    
    // 支持多种映射方式
    fieldMap[normalizedTitle] = fieldName;
    fieldMap[normalizedHeaderTitle] = fieldName;
    fieldMap[fieldName] = fieldName; // 直接使用字段名也可以
    
    // 如果字段名和标题不同，也建立映射
    if (fieldName !== normalizedTitle) {
      fieldMap[fieldName] = fieldName;
    }
    
    // 生成验证规则
    if (!fieldRules[fieldName]) {
      fieldRules[fieldName] = {};
    }
    
    // 检查是否必填
    if (isRequired || (col as any).required === true) {
      fieldRules[fieldName].required = true;
    }
    
    // 添加类型验证
    if (col.valueType === 'digit' || col.valueType === 'number') {
      fieldRules[fieldName].validator = (value: any) => {
        if (value && isNaN(Number(value))) {
          return `${title}必须是数字`;
        }
        return true;
      };
    } else if (col.valueType === 'date' || col.valueType === 'dateTime') {
      fieldRules[fieldName].validator = (value: any) => {
        if (value && isNaN(new Date(value).getTime())) {
          return `${title}必须是有效的日期`;
        }
        return true;
      };
    }
  });

  return {
    headers,
    exampleRow,
    fieldMap,
    fieldRules,
  };
}

/**
 * 统一 ProTable 组件属性
 */
export interface UniTableProps<T extends Record<string, any> = Record<string, any>> extends Omit<ProTableProps<T, any>, 'request'> {
  /**
   * 数据请求函数
   * 已内置排序参数处理，直接使用即可
   * 
   * @param params - 分页参数（current, pageSize）
   * @param sort - 排序参数
   * @param filter - 筛选参数
   * @param searchFormValues - 搜索表单值（从 searchParamsRef 或 formRef 获取）
   * @returns 数据响应
   */
  request: (
    params: any,
    sort: Record<string, 'ascend' | 'descend' | null>,
    filter: Record<string, React.ReactText[] | null>,
    searchFormValues?: Record<string, any>
  ) => Promise<{
    data: T[];
    success: boolean;
    total: number;
  }>;
  /**
   * 表格列定义
   */
  columns: ProColumns<T>[];
  /**
   * 表格标题（已废弃，使用 headerActions 替代）
   * @deprecated 使用 headerActions 替代
   */
  headerTitle?: string;
  /**
   * 头部操作按钮（显示在原来标题的位置）
   * 包括新建、修改、删除等按钮
   */
  headerActions?: ReactNode;
  /**
   * 行主键字段名（默认：'id'）
   */
  rowKey?: string;
  /**
   * 是否显示高级搜索按钮（默认：true）
   */
  showAdvancedSearch?: boolean;
  /**
   * 高级搜索按钮前的自定义按钮
   */
  beforeSearchButtons?: ReactNode;
  /**
   * 高级搜索按钮后的自定义按钮
   */
  afterSearchButtons?: ReactNode;
  /**
   * 是否启用行选择（默认：false）
   */
  enableRowSelection?: boolean;
  /**
   * 行选择变化回调
   */
  onRowSelectionChange?: (selectedRowKeys: React.Key[]) => void;
  /**
   * 是否启用行编辑（默认：false）
   */
  enableRowEdit?: boolean;
  /**
   * 行编辑保存回调
   */
  onRowEditSave?: (key: React.Key, row: T) => Promise<void>;
  /**
   * 行编辑删除回调
   */
  onRowEditDelete?: (key: React.Key, row: T) => Promise<void>;
  /**
   * 工具栏自定义按钮
   */
  toolBarActions?: ReactNode[];
  /**
   * 是否显示导入按钮（默认：true）
   */
  showImportButton?: boolean;
  /**
   * 导入按钮点击回调
   * @param data - 导入的数据（二维数组格式）
   */
  onImport?: (data: any[][]) => void;
  /**
   * 导入表头（可选，如果提供则自动填充第一行）
   * 如果不提供，将自动从 columns 中提取可导入的字段生成表头
   */
  importHeaders?: string[];
  /**
   * 导入示例数据（可选，如果提供则自动填充第二行作为示例）
   * 如果不提供，将自动从 columns 中提取字段生成示例数据
   */
  importExampleRow?: string[];
  /**
   * 导入字段映射配置（可选）
   * 用于将表头名称映射到字段名，如果不提供，将自动从 columns 中提取
   * 格式：{ '表头名称': '字段名' } 或 { '字段名': '表头名称' }
   */
  importFieldMap?: Record<string, string>;
  /**
   * 导入字段验证规则（可选）
   * 用于定义哪些字段是必填的，以及字段的验证规则
   * 格式：{ '字段名': { required: true, validator?: (value: any) => boolean } }
   */
  importFieldRules?: Record<string, { required?: boolean; validator?: (value: any) => boolean | string }>;
  /**
   * 是否自动从 columns 生成导入配置（默认：true）
   * 如果为 true，将自动从 columns 中提取可导入的字段生成表头、示例数据和字段映射
   */
  autoGenerateImportConfig?: boolean;
  /**
   * 是否显示导出按钮（默认：true）
   */
  showExportButton?: boolean;
  /**
   * 导出按钮点击回调
   * @param type - 导出类型：'selected' 导出选中、'currentPage' 导出本页、'all' 导出全部
   * @param selectedRowKeys - 选中的行键数组（仅当 type 为 'selected' 时有效）
   * @param currentPageData - 当前页数据（仅当 type 为 'currentPage' 时有效）
   */
  onExport?: (
    type: 'selected' | 'currentPage' | 'all',
    selectedRowKeys?: React.Key[],
    currentPageData?: T[]
  ) => void;
  /**
   * 是否显示新建按钮（默认：false）
   */
  showCreateButton?: boolean;
  /**
   * 新建按钮点击回调
   */
  onCreate?: () => void;
  /**
   * 是否显示修改按钮（默认：false）
   * 需要先选中一行才能点击
   */
  showEditButton?: boolean;
  /**
   * 修改按钮点击回调
   * @param selectedRowKeys - 选中的行键数组
   */
  onEdit?: (selectedRowKeys: React.Key[]) => void;
  /**
   * 是否显示删除按钮（默认：false）
   * 需要先选中一行才能点击
   */
  showDeleteButton?: boolean;
  /**
   * 删除按钮点击回调
   * @param selectedRowKeys - 选中的行键数组
   */
  onDelete?: (selectedRowKeys: React.Key[]) => void;
  /**
   * 默认分页大小（默认：20）
   */
  defaultPageSize?: number;
  /**
   * 是否显示快速跳转（默认：true）
   */
  showQuickJumper?: boolean;
  /**
   * 视图类型配置
   * 支持：'table' | 'card' | 'kanban' | 'stats'
   * 默认：['table', 'card', 'kanban', 'stats'] - 支持所有视图类型
   */
  viewTypes?: Array<'table' | 'card' | 'kanban' | 'stats'>;
  /**
   * 默认视图类型（默认：'table'）
   */
  defaultViewType?: 'table' | 'card' | 'kanban' | 'stats';
  /**
   * 视图切换回调
   */
  onViewTypeChange?: (viewType: 'table' | 'card' | 'kanban' | 'stats') => void;
  /**
   * 卡片视图配置（仅当 viewTypes 包含 'card' 时生效）
   */
  cardViewConfig?: {
    /**
     * 卡片渲染函数
     * @param item - 数据项
     * @param index - 索引
     */
    renderCard?: (item: T, index: number) => ReactNode;
    /**
     * 每行卡片数量（响应式，默认：[2, 3, 4]）
     */
    columns?: number | { xs?: number; sm?: number; md?: number; lg?: number; xl?: number; xxl?: number };
  };
  /**
   * 看板视图配置（仅当 viewTypes 包含 'kanban' 时生效）
   */
  kanbanViewConfig?: {
    /**
     * 状态字段名（用于分组，默认：'status'）
     */
    statusField?: string;
    /**
     * 状态分组配置
     * @example { 'pending': '待处理', 'processing': '处理中', 'completed': '已完成' }
     */
    statusGroups?: Record<string, { title: string; color?: string }>;
    /**
     * 卡片渲染函数
     * @param item - 数据项
     * @param status - 状态值
     */
    renderCard?: (item: T, status: string) => ReactNode;
  };
  /**
   * 统计视图配置（仅当 viewTypes 包含 'stats' 时生效）
   */
  statsViewConfig?: {
    /**
     * 统计指标配置
     */
    metrics?: Array<{
      key: string;
      label: string;
      value: (data: T[]) => number | string;
      formatter?: (value: number | string) => string;
    }>;
    /**
     * 图表配置
     */
    charts?: Array<{
      type: 'bar' | 'line' | 'pie' | 'area';
      title: string;
      data: (data: T[]) => any[];
      config?: any;
    }>;
  };
}

/**
 * 统一 ProTable 组件
 */
export function UniTable<T extends Record<string, any> = Record<string, any>>({
  request,
  columns,
  headerTitle,
  headerActions,
  rowKey = 'id',
  showAdvancedSearch = false, // 默认不显示高级搜索，使用高级搜索来实现搜索
  beforeSearchButtons,
  afterSearchButtons,
  enableRowSelection = false,
  onRowSelectionChange,
  enableRowEdit = false,
  onRowEditSave,
  onRowEditDelete,
  toolBarActions = [],
  showImportButton = true,
  onImport,
  importHeaders,
  importExampleRow,
  importFieldMap,
  importFieldRules,
  autoGenerateImportConfig = true,
  showExportButton = true,
  onExport,
  showCreateButton = false,
  onCreate,
  showEditButton = false,
  onEdit,
  showDeleteButton = false,
  onDelete,
  defaultPageSize = 20,
  showQuickJumper = true,
  viewTypes = ['table', 'card', 'kanban', 'stats'],
  defaultViewType = 'table',
  onViewTypeChange,
  cardViewConfig,
  kanbanViewConfig,
  statsViewConfig,
  actionRef: externalActionRef,
  formRef: externalFormRef,
  ...restProps
}: UniTableProps<T>) {
  const { message } = App.useApp();
  const { token } = theme.useToken();
  // 导入弹窗状态
  const [importModalVisible, setImportModalVisible] = useState(false);
  
  // 预加载拼音库（组件挂载时）
  useEffect(() => {
    import('../../utils/pinyin').then(({ preloadPinyinLib }) => {
      preloadPinyinLib().catch((err: any) => {
        console.warn('预加载拼音库失败:', err);
      });
    });
  }, []);
  
  // 自动生成导入配置（如果启用且未手动提供）
  const autoImportConfig = React.useMemo(() => {
    if (!autoGenerateImportConfig || (importHeaders && importExampleRow)) {
      return null;
    }
    return generateImportConfigFromColumns(columns, {
      fieldMap: importFieldMap,
      fieldRules: importFieldRules,
    });
  }, [columns, autoGenerateImportConfig, importHeaders, importExampleRow, importFieldMap, importFieldRules]);
  
  // 使用自动生成的配置或手动提供的配置
  const finalImportHeaders = importHeaders || autoImportConfig?.headers;
  const finalImportExampleRow = importExampleRow || autoImportConfig?.exampleRow;
  const finalImportFieldMap = importFieldMap || autoImportConfig?.fieldMap || {};
  const finalImportFieldRules = importFieldRules || autoImportConfig?.fieldRules || {};
  
  // 视图类型状态
  const [currentViewType, setCurrentViewType] = useState<'table' | 'card' | 'kanban' | 'stats'>(defaultViewType);
  // 表格数据状态（用于其他视图）
  const [tableData, setTableData] = useState<T[]>([]);
  // ⭐ 关键：使用 useProTableSearch Hook 管理搜索参数
  const { searchParamsRef, formRef: hookFormRef, actionRef: hookActionRef } = useProTableSearch();
  // 模糊搜索关键词状态
  const [fuzzySearchKeyword, setFuzzySearchKeyword] = useState<string>('');
  // 防抖定时器引用
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const internalActionRef = useRef<ActionType>();
  const internalFormRef = useRef<ProFormInstance>();
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonContainerRef = useRef<HTMLDivElement>(null);
  const [tableScrollY, setTableScrollY] = useState<number | undefined>(undefined);
  
  /**
   * 动态计算表格滚动高度
   * 计算可用高度：窗口高度 - 表格容器顶部距离 - 表格头部和工具栏 - 分页器 - 标签栏 - 安全边距
   * 使用 ProTable 原生的 scroll.y 属性，只滚动表格行部分
   */
  useEffect(() => {
    const calculateTableHeight = () => {
      if (!containerRef.current) {
        setTableScrollY(undefined);
        return;
      }

      // 获取窗口高度
      const windowHeight = window.innerHeight;

      // 获取表格容器距离顶部的距离
      const tableContainerRect = containerRef.current.getBoundingClientRect();
      const tableTopOffset = tableContainerRect.top;

      // 获取标签栏高度
      const tabBar = document.querySelector('.uni-tabs-header') as HTMLElement;
      const tabBarHeight = tabBar?.offsetHeight || 0;

      // 计算表格头部和工具栏的高度（包括搜索栏、工具栏等）
      const tableHeaderHeight = 100; // 工具栏、搜索栏、按钮等
      const paginationHeight = 56; // 分页器高度
      const pagePadding = 16 * 2; // 页面容器的上下 padding（各16px）
      const bottomPadding = 16; // 底部额外的 padding
      const extraSpace = 0; // 额外的安全边距

      // 计算可用高度（减去标签栏高度、页面padding和底部padding）
      const availableHeight = windowHeight - tableTopOffset - tableHeaderHeight - paginationHeight - tabBarHeight - pagePadding - bottomPadding - extraSpace;

      // 只有当可用高度大于300px时才设置滚动高度，否则让表格自适应
      // 300px是考虑表头、工具栏等固定元素后的最小高度
      const minScrollHeight = 300;
      const scrollY = availableHeight > minScrollHeight ? Math.min(availableHeight, windowHeight * 0.8) : undefined;

      setTableScrollY(scrollY);
    };

    // 延迟计算，确保 DOM 已完全渲染
    const timer = setTimeout(calculateTableHeight, 100);

    // 初始计算
    calculateTableHeight();

    // 监听窗口大小变化
    window.addEventListener('resize', calculateTableHeight);

    // 使用 ResizeObserver 监听容器大小变化
    let resizeObserver: ResizeObserver | null = null;
    if (containerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        // 延迟计算，避免频繁触发
        setTimeout(calculateTableHeight, 50);
      });
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', calculateTableHeight);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, []);

  // 使用外部传入的 ref 或内部创建的 ref（优先使用外部传入的）
  const actionRef = externalActionRef || hookActionRef || internalActionRef;
  const formRef = externalFormRef || hookFormRef || internalFormRef;
  

  /**
   * 将按钮容器移动到 ant-pro-table 内部
   */
  useLayoutEffect(() => {
    // 移动搜索框到 ProTable 内部
    // 使用重试机制确保在 TwoColumnLayout 等复杂布局中也能正常工作
    const moveButtonContainer = () => {
      if (containerRef.current && buttonContainerRef.current) {
        const proTable = containerRef.current.querySelector('.ant-pro-table');
        if (proTable && buttonContainerRef.current.parentElement !== proTable) {
          proTable.insertBefore(buttonContainerRef.current, proTable.firstChild);
          return true; // 成功移动
        }
      }
      return false; // 未找到 ProTable 或已经移动
    };
    
    // 立即尝试移动
    if (moveButtonContainer()) {
      return;
    }
    
    // 如果立即移动失败，使用多次重试（适用于 TwoColumnLayout 等复杂布局）
    let retryCount = 0;
    const maxRetries = 10; // 最多重试 10 次
    const retryInterval = 50; // 每次重试间隔 50ms
    
    const retryTimer = setInterval(() => {
      retryCount++;
      if (moveButtonContainer() || retryCount >= maxRetries) {
        clearInterval(retryTimer);
      }
    }, retryInterval);
    
    return () => {
      clearInterval(retryTimer);
    };
  }, [currentViewType]); // 添加 currentViewType 作为依赖，确保视图切换时也能正确移动

  /**
   * 当视图类型是卡片/看板/统计视图时，确保数据已加载
   * 如果 tableData 为空且 actionRef 可用，主动触发数据加载
   */
  useEffect(() => {
    if (currentViewType !== 'table' && tableData.length === 0 && actionRef?.current) {
      // 延迟执行，确保组件完全初始化
      setTimeout(() => {
        actionRef.current?.reload();
      }, 100);
    }
  }, [currentViewType, tableData.length]);

  /**
   * 处理模糊搜索（带防抖）
   * 
   * 根据最佳实践：
   * 1. 使用防抖（300ms）来优化性能，避免频繁请求
   * 2. 搜索关键词存储到 searchParamsRef 中，作为 keyword 参数传递给后端
   * 3. 支持清除搜索，清除时重新加载数据
   */
  const handleFuzzySearch = (value: string) => {
    setFuzzySearchKeyword(value);
    
    // 清除之前的防抖定时器
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // 设置防抖定时器（300ms）
    debounceTimerRef.current = setTimeout(() => {
      // 更新搜索参数
      if (searchParamsRef.current) {
        searchParamsRef.current.keyword = value.trim() || undefined;
      } else {
        searchParamsRef.current = {
          keyword: value.trim() || undefined,
        };
      }
      
      // 触发表格重新加载
      if (actionRef?.current) {
        actionRef.current.reload();
      }
    }, 300);
  };

  /**
   * 清除模糊搜索
   */
  const handleClearFuzzySearch = () => {
    setFuzzySearchKeyword('');
    
    // 清除搜索参数
    if (searchParamsRef.current) {
      delete searchParamsRef.current.keyword;
    }
    
    // 触发表格重新加载
    if (actionRef?.current) {
      actionRef.current.reload();
    }
  };

  /**
   * 组件卸载时清除防抖定时器
   */
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  /**
   * 处理排序参数转换和搜索参数获取
   */
  const handleRequest = async (
    params: any,
    sort: Record<string, 'ascend' | 'descend' | null>,
    filter: Record<string, React.ReactText[] | null>
  ) => {
    // ⭐ 关键：获取搜索表单值（优先使用 searchParamsRef，避免表单值更新时机问题）
    const formValues = formRef.current?.getFieldsValue() || {};
    // ⚠️ 修复：优先使用 searchParamsRef.current，如果不存在则回退到 formValues
    // searchParamsRef.current 可能为空对象 {}（表示清空搜索条件），这是有效的
    // 只有当 searchParamsRef.current 是 undefined 时，才回退到 formValues
    const searchFormValues = searchParamsRef.current !== undefined ? searchParamsRef.current : formValues;
    
    // 调用用户提供的 request 函数，传递搜索表单值
    const result = await request(params, sort, filter, searchFormValues);
    
    // 支持拼音搜索：如果关键词是拼音格式，在前端对返回的数据进行二次过滤
    const keyword = searchFormValues?.keyword;
    if (keyword && isPinyinKeyword(keyword) && result.data && Array.isArray(result.data)) {
      const keywordUpper = keyword.toUpperCase();
      
      // 使用 Promise.all 进行异步拼音匹配
      const filteredDataPromises = result.data.map(async (record: any) => {
        // 遍历所有列，检查是否有匹配的字段
        for (const column of columns) {
          if (!column.dataIndex) continue;
          
          // 获取字段值（支持嵌套字段，如 'user.name'）
          const getFieldValue = (obj: any, path: string | string[] | number): any => {
            if (Array.isArray(path)) {
              return path.reduce((acc, key) => acc?.[key], obj);
            }
            if (typeof path === 'number') {
              return obj?.[path];
            }
            const keys = String(path).split('.');
            return keys.reduce((acc, key) => acc?.[key], obj);
          };
          
          const fieldValue = getFieldValue(record, column.dataIndex as string | string[] | number);
          if (!fieldValue) continue;
          
          // 将字段值转换为字符串进行匹配
          const valueStr = String(fieldValue);
          
          // 1. 文本匹配
          const textMatch = valueStr.toLowerCase().includes(keyword.toLowerCase());
          if (textMatch) return record;
          
          // 2. 拼音首字母匹配（异步）
          const pinyinMatch = await matchPinyinInitialsAsync(valueStr, keywordUpper);
          if (pinyinMatch) return record;
        }
        return null;
      });
      
      // 等待所有匹配完成
      const filteredResults = await Promise.all(filteredDataPromises);
      const filteredData = filteredResults.filter(item => item !== null);
      
      // 更新结果数据
      result.data = filteredData;
      // 更新总数（如果前端过滤，总数可能不准确，但至少显示过滤后的数量）
      if (result.total !== undefined) {
        result.total = filteredData.length;
      }
    }
    
    // 保存数据到 state（用于其他视图）
    if (result.data) {
      setTableData(result.data);
    }
    
    return result;
  };

  /**
   * 处理视图类型切换
   */
  const handleViewTypeChange = (viewType: 'table' | 'card' | 'kanban' | 'stats') => {
    setCurrentViewType(viewType);
    if (onViewTypeChange) {
      onViewTypeChange(viewType);
    }
  };

  /**
   * 构建视图切换按钮
   */
  const buildViewTypeButtons = () => {
    if (!viewTypes || viewTypes.length <= 1) {
      return null;
    }

    const viewTypeOptions = [
      { value: 'table', label: '表格', icon: TableOutlined },
      { value: 'card', label: '卡片', icon: AppstoreOutlined },
      { value: 'kanban', label: '看板', icon: BarsOutlined },
      { value: 'stats', label: '统计', icon: BarChartOutlined },
    ].filter(option => viewTypes.includes(option.value as any));

    return (
      <Radio.Group
        value={currentViewType}
        onChange={(e) => handleViewTypeChange(e.target.value)}
        buttonStyle="solid"
        style={{ marginLeft: 8 }}
      >
        {viewTypeOptions.map(option => {
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

  /**
   * 处理导入按钮点击
   */
  const handleImportClick = () => {
    setImportModalVisible(true);
  };

  /**
   * 处理导入确认
   */
  const handleImportConfirm = (data: any[][]) => {
    if (onImport) {
      // 如果提供了字段映射和验证规则，在调用 onImport 之前进行数据转换和验证
      // 注意：这里只是传递原始数据，具体的验证和转换应该在 onImport 回调中处理
      // 但我们可以将字段映射和验证规则作为额外参数传递（如果需要）
      onImport(data);
    } else {
      message.warning('请配置 onImport 回调函数来处理导入数据');
    }
  };

  // 存储选中的行键
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  /**
   * 构建头部操作按钮（显示在原来标题的位置）
   */


  // 构建左侧操作按钮（新建、修改、删除 + 自定义toolBarRender）
  const buildLeftActions = () => {
    const actions: ReactNode[] = [];

    // 如果提供了自定义 headerActions，直接使用
    if (headerActions) {
      return headerActions;
    }

    // 处理用户自定义的toolBarRender（当作左侧按钮）
    if (restProps.toolBarRender) {
      // 这里需要模拟toolBarRender的参数
      const mockAction = { reload: actionRef.current?.reload };
      const mockSelectedRowKeys = selectedRowKeys;
      const userResult = restProps.toolBarRender(mockAction, { selectedRowKeys: mockSelectedRowKeys });

      if (Array.isArray(userResult)) {
        actions.push(...userResult);
      } else if (userResult) {
        actions.push(userResult);
      }
    }

    // 新建按钮
    if (showCreateButton && onCreate) {
      actions.push(
        <Button
          key="create"
          type="primary"
          icon={<PlusOutlined />}
          onClick={onCreate}
        >
          新建
        </Button>
      );
    }

    // 修改按钮（需要选中一行）
    if (showEditButton && onEdit) {
      actions.push(
        <Button
          key="edit"
          icon={<EditOutlined />}
          onClick={() => {
            if (selectedRowKeys.length === 1) {
              onEdit(selectedRowKeys);
            }
          }}
          disabled={selectedRowKeys.length !== 1}
        >
          修改
        </Button>
      );
    }

    // 删除按钮（需要选中至少一行）
    if (showDeleteButton && onDelete) {
      actions.push(
        <Button
          key="delete"
          danger
          icon={<DeleteOutlined />}
          onClick={() => {
            if (selectedRowKeys.length > 0) {
              onDelete(selectedRowKeys);
            }
          }}
          disabled={selectedRowKeys.length === 0}
        >
          删除
        </Button>
      );
    }

    return actions.length > 0 ? <Space>{actions}</Space> : undefined;
  };

  // 构建右侧工具栏按钮（导入、导出）
  const buildRightActions = () => {
    const actions: ReactNode[] = [];

    // 导入按钮（使用 success 绿色系，filled 样式，无框线，淡色）
    // 参考 Material Design、Ant Design、Figma 等主流设计系统：
    // - 导入/上传操作使用绿色（success）表示正向操作
    // - filled 样式：使用填充背景色，无边框，淡色版本
    if (showImportButton) {
      actions.push(
        <Button
          key="import"
          icon={<UploadOutlined />}
          onClick={handleImportClick}
          style={{
            backgroundColor: token.colorSuccessBg || token.colorFillTertiary,
            border: 'none',
            color: token.colorSuccess,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = token.colorSuccessBgHover || token.colorFillSecondary;
            e.currentTarget.style.color = token.colorSuccessHover || token.colorSuccess;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = token.colorSuccessBg || token.colorFillTertiary;
            e.currentTarget.style.color = token.colorSuccess;
          }}
        >
          导入
        </Button>
      );
    }

    // 导出按钮（下拉菜单）
    if (showExportButton && onExport) {
      // 构建导出菜单项
      const exportMenuItems: MenuProps['items'] = [
        {
          key: 'selected',
          label: '导出选中',
          icon: <DownloadOutlined />,
          disabled: !selectedRowKeys || selectedRowKeys.length === 0,
        },
        {
          key: 'currentPage',
          label: '导出本页',
          icon: <DownloadOutlined />,
        },
        {
          key: 'all',
          label: '导出全部',
          icon: <DownloadOutlined />,
        },
      ];

      // 处理导出菜单点击
      const handleExportMenuClick: MenuProps['onClick'] = ({ key }) => {
        if (!onExport) {
          message.warning('请配置 onExport 回调函数来处理导出数据');
          return;
        }
        
        switch (key) {
          case 'selected':
            onExport('selected', selectedRowKeys || []);
            break;
          case 'currentPage':
            // 获取当前页数据
            onExport('currentPage', undefined, tableData);
            break;
          case 'all':
            onExport('all');
            break;
        }
      };

      actions.push(
        <Dropdown
          key="export"
          menu={{ items: exportMenuItems, onClick: handleExportMenuClick }}
          trigger={['click']}
        >
          <Button 
            icon={<DownloadOutlined />}
            style={{
              backgroundColor: token.colorPrimaryBg || token.colorFillTertiary,
              border: 'none',
              color: token.colorPrimary,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = token.colorPrimaryBgHover || token.colorFillSecondary;
              e.currentTarget.style.color = token.colorPrimaryHover || token.colorPrimary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = token.colorPrimaryBg || token.colorFillTertiary;
              e.currentTarget.style.color = token.colorPrimary;
            }}
          >
            导出
            <DownOutlined style={{ marginLeft: 4, fontSize: '12px' }} />
          </Button>
        </Dropdown>
      );
    }

    return actions.length > 0 ? <Space>{actions}</Space> : undefined;
  };

  const buildHeaderActions = () => {
    return buildLeftActions();
  };

  /**
   * 处理行选择变化
   */
  const handleRowSelectionChange = (keys: React.Key[]) => {
    setSelectedRowKeys(keys);
    if (onRowSelectionChange) {
      onRowSelectionChange(keys);
    }
  };

  /**
   * 构建工具栏按钮（仅自定义按钮，导入导出已移至右侧工具栏）
   */
  const buildToolBarActions = (selectedRowKeys?: React.Key[]) => {
    // 只返回自定义工具栏按钮
    return toolBarActions && toolBarActions.length > 0 ? toolBarActions : [];
  };

  return (
    <>
      <style>{`
        /* 统一 UniTable 容器样式，确保所有页面间距一致 */
        .uni-table-container {
          position: relative;
          padding: 0;
          margin: 0;
          width: 100%;
        }
        .uni-table-pro-table {
          margin: 0 !important;
          padding: 0 !important;
        }
        .uni-table-pro-table .ant-pro-table {
          margin: 0 !important;
        }
        .uni-table-pro-table .ant-pro-card {
          box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.03), 0 1px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px 0 rgba(0, 0, 0, 0.02) !important;
          border-radius: ${token.borderRadius}px !important;
        }
        .uni-table-pro-table .ant-pro-table-list-toolbar {
          padding: 16px 0 !important;
          margin: 0 !important;
        }
        .uni-table-pro-table .ant-pro-table-list-toolbar-container {
          padding: 0 !important;
          margin: 0 !important;
        }
        .uni-table-pro-table .ant-pro-table-list-toolbar-title {
          margin: 0 !important;
        }
        .uni-table-pro-table .ant-pro-table-list-toolbar-extra {
          margin: 0 !important;
        }
        .uni-table-pro-table .ant-pro-table-list-toolbar-extra-line {
          margin: 0 !important;
        }
        .uni-table-pro-table .ant-table-wrapper {
          margin: 0 !important;
          width: 100% !important;
          overflow-x: auto !important;
        }
        .uni-table-pro-table .ant-table {
          width: 100% !important;
          min-width: 100% !important;
        }
        .uni-table-pro-table .ant-table-container {
          width: 100% !important;
          overflow-x: auto !important;
        }
        .uni-table-pro-table .ant-pro-table-list-toolbar-container {
          padding-bottom: 0px !important;
        }
        /* 统一三个组件的风格：模糊搜索框、高级搜索按钮、重置按钮 */
        /* 1. 模糊搜索框 - 去除框线，使用背景色区分 */
        .uni-table-fuzzy-search .ant-input-affix-wrapper,
        .uni-table-fuzzy-search .ant-input-search-button {
          height: 32px !important;
        }
        /* 搜索框整体：使用主题背景色和边框色，统一圆角 - 最高优先级 */
        /* 边框颜色与高级搜索按钮容器一致（使用 token.colorBorder） */
        html body .uni-table-fuzzy-search.ant-input-search,
        html body .uni-table-fuzzy-search .ant-input-group-wrapper,
        html body .uni-table-fuzzy-search .ant-input-group,
        html body .uni-table-fuzzy-search .ant-input-search.ant-input-search,
        html body .pro-table-button-container .uni-table-fuzzy-search,
        html body .pro-table-button-container .uni-table-fuzzy-search .ant-input-group-wrapper,
        html body .pro-table-button-container .uni-table-fuzzy-search .ant-input-affix-wrapper {
          border: 1px solid ${token.colorBorder} !important;
          border-radius: ${token.borderRadius}px !important;
          overflow: hidden !important;
          background-color: ${token.colorBgContainer} !important;
          box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.03), 0 1px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px 0 rgba(0, 0, 0, 0.02) !important;
        }
        /* 深色模式下的搜索框样式 - 边框颜色与高级搜索按钮容器一致 */
        html[data-theme="dark"] body .uni-table-fuzzy-search.ant-input-search,
        html[data-theme="dark"] body .uni-table-fuzzy-search .ant-input-group-wrapper,
        html[data-theme="dark"] body .uni-table-fuzzy-search .ant-input-group,
        html[data-theme="dark"] body .uni-table-fuzzy-search .ant-input-search.ant-input-search,
        html[data-theme="dark"] body .pro-table-button-container .uni-table-fuzzy-search,
        html[data-theme="dark"] body .pro-table-button-container .uni-table-fuzzy-search .ant-input-group-wrapper,
        html[data-theme="dark"] body .pro-table-button-container .uni-table-fuzzy-search .ant-input-affix-wrapper {
          border: 1px solid ${token.colorBorder} !important;
          background-color: ${token.colorBgContainer} !important;
          box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.15), 0 1px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px 0 rgba(0, 0, 0, 0.1) !important;
        }
        /* 隐藏搜索按钮和图标 - 实时搜索不需要 */
        html body .uni-table-fuzzy-search .ant-input-search-button,
        html body .uni-table-fuzzy-search .ant-input-group-addon,
        html body .pro-table-button-container .uni-table-fuzzy-search .ant-input-search-button,
        html body .pro-table-button-container .uni-table-fuzzy-search .ant-input-group-addon,
        html body .uni-table-fuzzy-search .anticon-search,
        html body .pro-table-button-container .uni-table-fuzzy-search .anticon-search,
        html body .uni-table-fuzzy-search .ant-input-suffix .anticon,
        html body .pro-table-button-container .uni-table-fuzzy-search .ant-input-suffix .anticon,
        html body .uni-table-fuzzy-search .ant-input-group .ant-input-group-addon,
        html body .pro-table-button-container .uni-table-fuzzy-search .ant-input-group .ant-input-group-addon {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          width: 0 !important;
          height: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        /* 输入框内部：透明背景，主题色文字（边框在外层容器上） */
        html body .uni-table-fuzzy-search .ant-input-affix-wrapper .ant-input,
        html body .pro-table-button-container .uni-table-fuzzy-search .ant-input-affix-wrapper .ant-input {
          background-color: transparent !important;
        }
        html body .uni-table-fuzzy-search .ant-input,
        html body .pro-table-button-container .uni-table-fuzzy-search .ant-input {
          color: var(--ant-colorText) !important;
          background-color: transparent !important;
        }
        html body .uni-table-fuzzy-search .ant-input::placeholder,
        html body .pro-table-button-container .uni-table-fuzzy-search .ant-input::placeholder {
          color: var(--ant-colorTextPlaceholder) !important;
          opacity: 0.5 !important;
        }
        /* 去掉获取焦点后的蓝色边框 - 仅针对模糊搜索框 */
        html body .uni-table-fuzzy-search.ant-input-search:focus,
        html body .uni-table-fuzzy-search .ant-input-group-wrapper:focus,
        html body .uni-table-fuzzy-search .ant-input-group:focus,
        html body .uni-table-fuzzy-search .ant-input-affix-wrapper:focus,
        html body .uni-table-fuzzy-search .ant-input-affix-wrapper-focused,
        html body .pro-table-button-container .uni-table-fuzzy-search .ant-input-group-wrapper:focus,
        html body .pro-table-button-container .uni-table-fuzzy-search .ant-input-affix-wrapper:focus,
        html body .pro-table-button-container .uni-table-fuzzy-search .ant-input-affix-wrapper-focused {
          border-color: var(--ant-colorBorder) !important;
          box-shadow: none !important;
          outline: none !important;
        }
        /* 深色模式下的优化 */
        html[data-theme="dark"] body .uni-table-fuzzy-search .ant-input-group-wrapper,
        html[data-theme="dark"] body .pro-table-button-container .uni-table-fuzzy-search .ant-input-group-wrapper {
          background-color: var(--ant-colorBgContainer) !important;
          border-color: var(--ant-colorBorder) !important;
        }
        html[data-theme="dark"] body .uni-table-fuzzy-search .ant-input,
        html[data-theme="dark"] body .pro-table-button-container .uni-table-fuzzy-search .ant-input {
          color: var(--ant-colorText) !important;
          background-color: transparent !important;
        }
        html[data-theme="dark"] body .uni-table-fuzzy-search .ant-input::placeholder,
        html[data-theme="dark"] body .pro-table-button-container .uni-table-fuzzy-search .ant-input::placeholder {
          color: var(--ant-colorTextPlaceholder) !important;
          opacity: 0.5 !important;
        }
        /* 统一按钮阴影：高级搜索按钮、重置按钮、钉住的条件、视图按钮 */
        /* 高级搜索和重置按钮（QuerySearchButton 组件内的按钮） */
        .pro-table-button-container .ant-btn[type="text"]:not(.ant-btn-dangerous):not(.ant-radio-button-wrapper) {
          box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.03), 0 1px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px 0 rgba(0, 0, 0, 0.02) !important;
          border-radius: ${token.borderRadius}px !important;
        }
        /* 钉住的条件容器（包含多个按钮的 div） */
        .pro-table-button-container > div > div[style*="borderRadius"] {
          box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.03), 0 1px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px 0 rgba(0, 0, 0, 0.02) !important;
        }
        /* 视图切换按钮组 */
        .pro-table-button-container .ant-radio-group {
          box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.03), 0 1px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px 0 rgba(0, 0, 0, 0.02) !important;
          border-radius: ${token.borderRadius}px !important;
        }
      `}</style>
      <div 
        ref={containerRef} 
        className="uni-table-container"
        style={{ 
          position: 'relative',
          padding: 0,
          margin: 0,
          width: '100%',
        }}
      >
      {/* 按钮容器（会被移动到 ant-pro-table 内部） */}
      {/* 模糊搜索框始终显示，其他按钮根据条件显示 */}
      <div
        ref={buttonContainerRef}
        className="pro-table-button-container"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {beforeSearchButtons}
          {/* 模糊搜索框 - 去掉放大镜按钮，高度与高级搜索按钮一致（32px） */}
          <Input
            className="uni-table-fuzzy-search"
            placeholder="模糊搜索"
            allowClear
            value={fuzzySearchKeyword}
            onChange={(e) => handleFuzzySearch(e.target.value)}
            onPressEnter={(e) => handleFuzzySearch((e.target as HTMLInputElement).value)}
            style={{
              width: 160,
              height: '32px',
            }}
          />
          {showAdvancedSearch && (
            <QuerySearchButton
              columns={columns}
              formRef={formRef as React.MutableRefObject<ProFormInstance>}
              actionRef={actionRef as React.MutableRefObject<ActionType>}
              searchParamsRef={searchParamsRef}
            />
          )}
          {afterSearchButtons}
        </div>
        {/* 视图切换按钮（右侧） */}
        {(viewTypes && viewTypes.length > 1) && buildViewTypeButtons()}
      </div>

      {/* ProTable 始终渲染（用于数据加载），但根据视图类型决定是否显示 */}
      <div style={{ display: currentViewType === 'table' ? 'block' : 'none' }}>
        <ProTable<T>
          headerTitle={buildHeaderActions() || headerTitle || undefined}
          actionRef={actionRef}
          formRef={formRef}
          columns={columns}
          request={handleRequest}
          rowKey={rowKey}
          search={false}
          className="uni-table-pro-table"
          style={{ margin: 0, padding: 0 }}
          toolbar={{
            // 合并自定义 actions 和用户传入的 actions
            actions: [
              ...(buildRightActions() ? [buildRightActions()] : []),
              ...(restProps.toolbar?.actions 
                ? (Array.isArray(restProps.toolbar.actions) 
                    ? restProps.toolbar.actions 
                    : [restProps.toolbar.actions])
                : []),
            ],
            // 恢复 ProTable 原生的密度和列设置功能
            options: {
              density: true,
              setting: true,
              reload: true,
              fullScreen: true,
              // 如果用户传入了 toolbar.options，则合并用户配置
              ...(restProps.toolbar?.options || {}),
            },
          }}
        rowSelection={
          enableRowSelection
            ? {
                type: 'checkbox',
                onChange: handleRowSelectionChange,
              }
            : undefined
        }
        editable={
          enableRowEdit
            ? {
                type: 'multiple',
                onSave: onRowEditSave as any,
                onDelete: onRowEditDelete as any,
              }
            : undefined
        }
        toolBarRender={(_action, { selectedRowKeys: toolBarSelectedRowKeys }) => {
          // 同步工具栏的选中行键到 state（用于头部按钮状态）
          if (toolBarSelectedRowKeys) {
            // 使用 useEffect 或直接在这里更新，但要注意避免无限循环
            // 这里使用浅比较，避免不必要的更新
            const currentKeys = selectedRowKeys;
            const newKeys = toolBarSelectedRowKeys;
            if (currentKeys.length !== newKeys.length || 
                currentKeys.some((key, index) => key !== newKeys[index])) {
              setSelectedRowKeys(newKeys);
            }
          }

          // 只返回系统按钮（导入导出），用户自定义按钮在headerTitle中处理
          const rightActions = buildRightActions();
          return rightActions ? [rightActions] : [];
        }}
        pagination={{
          defaultPageSize,
          showSizeChanger: true,
          showQuickJumper,
          pageSizeOptions: ['10', '20', '50', '100'],
        }}
        scroll={{
          x: 'max-content', // 水平滚动：当内容宽度超过容器时显示滚动条
          y: tableScrollY || undefined, // 垂直滚动：只有在明确需要时才显示滚动条
        }}
        {...(() => {
          // 过滤掉toolBarRender和search，避免重复渲染和DOM警告
          // toolBarRender 已经在左侧处理了
          // search 中的 showAdvancedSearch 会传递到DOM，导致React警告
          const { toolBarRender, search, ...otherProps } = restProps;
          return otherProps;
        })()}
        />
      </div>

      {/* 卡片视图 */}
      {currentViewType === 'card' && viewTypes.includes('card') && (
        <div style={{ padding: '16px', minHeight: '400px' }}>
          {cardViewConfig?.renderCard ? (
            tableData.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                {tableData.map((item, index) => cardViewConfig.renderCard!(item, index))}
              </div>
            ) : (
              <Empty 
                description="暂无应用数据" 
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                style={{ marginTop: '60px' }}
              />
            )
          ) : (
            <div style={{ 
              textAlign: 'center', 
              padding: '60px 20px', 
              color: '#999',
              background: '#fafafa',
              borderRadius: '4px',
              border: '1px dashed #d9d9d9'
            }}>
              <AppstoreOutlined style={{ fontSize: '48px', marginBottom: '16px', color: '#d9d9d9' }} />
              <div style={{ fontSize: '16px', marginBottom: '8px' }}>卡片视图</div>
              <div style={{ fontSize: '14px', color: '#999' }}>
                请配置 <code>cardViewConfig.renderCard</code> 来自定义卡片渲染
              </div>
            </div>
          )}
        </div>
      )}

      {/* 看板视图 */}
      {currentViewType === 'kanban' && viewTypes.includes('kanban') && (
        <div style={{ padding: '16px', minHeight: '400px' }}>
          {kanbanViewConfig?.renderCard && kanbanViewConfig.statusGroups ? (
            <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', minHeight: '400px' }}>
              {Object.entries(kanbanViewConfig.statusGroups).map(([status, config]) => {
                const statusData = tableData.filter(item => (item as any)[kanbanViewConfig?.statusField || 'status'] === status);
                return (
                  <div 
                    key={status} 
                    style={{ 
                      flex: '0 0 300px', 
                      border: '1px solid #d9d9d9', 
                      borderRadius: '4px', 
                      padding: '16px',
                      background: '#fafafa',
                      minHeight: '400px'
                    }}
                  >
                    <div style={{ 
                      fontSize: '16px', 
                      fontWeight: 'bold', 
                      marginBottom: '16px',
                      paddingBottom: '12px',
                      borderBottom: '2px solid #d9d9d9'
                    }}>
                      {config.title}
                      <span style={{ 
                        marginLeft: '8px', 
                        fontSize: '12px', 
                        color: '#999',
                        fontWeight: 'normal'
                      }}>
                        ({statusData.length})
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {statusData.map((item) => kanbanViewConfig.renderCard!(item, status))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ 
              textAlign: 'center', 
              padding: '60px 20px', 
              color: '#999',
              background: '#fafafa',
              borderRadius: '4px',
              border: '1px dashed #d9d9d9'
            }}>
              <BarsOutlined style={{ fontSize: '48px', marginBottom: '16px', color: '#d9d9d9' }} />
              <div style={{ fontSize: '16px', marginBottom: '8px' }}>看板视图</div>
              <div style={{ fontSize: '14px', color: '#999' }}>
                请配置 <code>kanbanViewConfig</code> 来启用看板视图
              </div>
            </div>
          )}
        </div>
      )}

      {/* 统计视图 */}
      {currentViewType === 'stats' && viewTypes.includes('stats') && (
        <div style={{ padding: '16px', minHeight: '400px' }}>
          {statsViewConfig?.metrics ? (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                {statsViewConfig.metrics.map((metric) => (
                  <div 
                    key={metric.key} 
                    style={{ 
                      padding: '20px', 
                      border: '1px solid #d9d9d9', 
                      borderRadius: '4px',
                      background: '#fff',
                      textAlign: 'center'
                    }}
                  >
                    <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>{metric.label}</div>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#1890ff' }}>
                      {metric.formatter ? metric.formatter(metric.value(tableData)) : metric.value(tableData)}
                    </div>
                  </div>
                ))}
              </div>
              {statsViewConfig.charts && statsViewConfig.charts.length > 0 && (
                <div style={{ marginTop: '24px' }}>
                  {/* TODO: 实现图表渲染 */}
                  <div style={{ textAlign: 'center', padding: '40px', color: '#999', border: '1px dashed #d9d9d9', borderRadius: '4px' }}>
                    图表功能开发中...
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ 
              textAlign: 'center', 
              padding: '60px 20px', 
              color: '#999',
              background: '#fafafa',
              borderRadius: '4px',
              border: '1px dashed #d9d9d9'
            }}>
              <BarChartOutlined style={{ fontSize: '48px', marginBottom: '16px', color: '#d9d9d9' }} />
              <div style={{ fontSize: '16px', marginBottom: '8px' }}>统计视图</div>
              <div style={{ fontSize: '14px', color: '#999' }}>
                请配置 <code>statsViewConfig.metrics</code> 来启用统计视图
              </div>
            </div>
          )}
        </div>
      )}

      {/* 导入弹窗 */}
      {showImportButton && (
        <UniImport
          visible={importModalVisible}
          onCancel={() => setImportModalVisible(false)}
          onConfirm={handleImportConfirm}
          headers={finalImportHeaders}
          exampleRow={finalImportExampleRow}
        />
      )}
      </div>
    </>
  );
}

export default UniTable;

// 导出工具函数，供其他组件使用
export { generateImportConfigFromColumns };

