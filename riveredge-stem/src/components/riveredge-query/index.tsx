/**
 * RiverEdge SaaS 多组织框架 - ProTable 查询条件保存插件
 *
 * 用于接管 ProTable 的搜索栏，将搜索条件在弹窗中展示
 */

import { useRef, useState, useEffect, useLayoutEffect, useCallback, useMemo, forwardRef } from 'react';
import type { ActionType, ProFormInstance, ProColumns } from '@ant-design/pro-components';
import { ProForm, ProFormText, ProFormSelect, ProFormDatePicker, ProFormDateRangePicker } from '@ant-design/pro-components';
import { Button, Modal, Row, Col, AutoComplete, Input, Space, App, List, Typography } from 'antd';
import { SaveOutlined, DeleteOutlined, ShareAltOutlined, UserOutlined, DownOutlined } from '@ant-design/icons';
import type { AutoCompleteProps } from 'antd';
import { filterByPinyinInitials } from '@/utils/pinyin';
import { useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSavedSearchList, createSavedSearch, deleteSavedSearch, SavedSearch } from '@/services/savedSearch';

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
  const [options, setOptions] = useState<Array<{ label: string; value: string }>>(
    autoCompleteOptions || []
  );
  const [loading, setLoading] = useState(false);
  const searchKeywordRef = useRef<string>(''); // 使用 ref 避免闭包问题
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastApiCallRef = useRef<string>('');

  /**
   * 实时过滤静态选项（同步，立即响应）
   */
  const filterStaticOptions = useCallback((keyword: string) => {
    if (!autoCompleteOptions || !keyword) {
      return autoCompleteOptions || [];
    }

    try {
      // 使用拼音工具函数进行过滤（支持拼音首字母匹配）
      return filterByPinyinInitials(autoCompleteOptions, keyword);
    } catch (error) {
      // 如果拼音库不可用，使用普通过滤
      return autoCompleteOptions.filter(
        (option) =>
          option.label.toLowerCase().includes(keyword.toLowerCase()) ||
          option.value.toLowerCase().includes(keyword.toLowerCase())
      );
    }
  }, [autoCompleteOptions]);

  /**
   * 处理搜索（优化：静态选项立即响应，API 调用防抖）
   */
  const handleSearch = useCallback(
    (keyword: string) => {
      const currentKeyword = keyword || '';
      searchKeywordRef.current = currentKeyword; // 更新 ref

      // 1. 静态选项：立即过滤（同步，实时响应）
      if (autoCompleteOptions && !autoCompleteApi) {
        const filtered = filterStaticOptions(currentKeyword);
        setOptions(filtered);
        return;
      }

      // 2. API 调用：防抖处理（避免频繁请求）
      if (autoCompleteApi) {
        // 清除之前的定时器
        if (searchTimeoutRef.current) {
          clearTimeout(searchTimeoutRef.current);
          searchTimeoutRef.current = null;
        }

        // 如果关键词为空，立即清空选项
        if (!currentKeyword) {
          setOptions([]);
          setLoading(false);
          lastApiCallRef.current = '';
          return;
        }

        // 如果关键词太短（少于2个字符），不发起请求，但显示空选项
        if (currentKeyword.length < 2) {
          setOptions([]);
          setLoading(false);
          return;
        }

        // 如果关键词与上次相同，不重复请求
        if (lastApiCallRef.current === currentKeyword) {
          return;
        }

        // 设置加载状态（立即显示，提升用户体验）
        setLoading(true);

        // 防抖：100ms 后执行 API 调用（缩短防抖时间，提升实时性）
        searchTimeoutRef.current = setTimeout(async () => {
          const keywordAtCallTime = searchKeywordRef.current; // 使用 ref 获取最新值
          
          // 再次检查关键词是否仍然匹配（防止竞态条件）
          if (keywordAtCallTime !== currentKeyword) {
            return; // 关键词已变化，忽略此次请求
          }

          try {
            lastApiCallRef.current = currentKeyword;
            const apiOptions = await autoCompleteApi(currentKeyword);
            
            // 确保返回的是最新的搜索结果（防止竞态条件）
            if (searchKeywordRef.current === currentKeyword) {
              setOptions(apiOptions);
            }
          } catch (error) {
            // 确保错误时也更新状态（防止竞态条件）
            if (searchKeywordRef.current === currentKeyword) {
              setOptions([]);
            }
          } finally {
            // 确保加载状态正确更新（防止竞态条件）
            if (searchKeywordRef.current === currentKeyword) {
              setLoading(false);
            }
          }
        }, 100); // 缩短防抖时间到 100ms，提升实时性
      } else if (!currentKeyword) {
        // 清空关键词时，清空选项
        setOptions([]);
      }
    },
    [autoCompleteApi, autoCompleteOptions, filterStaticOptions]
  );


  /**
   * 初始化：如果有静态选项，显示所有选项
   */
  useEffect(() => {
    if (autoCompleteOptions && !autoCompleteApi) {
      setOptions(autoCompleteOptions);
    }
  }, [autoCompleteOptions, autoCompleteApi]);

  /**
   * 清理定时器
   */
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
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
    options,
    value, // ⭐ 关键：传递表单值
    onChange: handleChange, // ⭐ 关键：处理输入/选择时更新表单值
    onSearch: handleSearch, // 输入时实时触发，用于搜索选项（不影响表单值）
    loading,
    allowClear: true,
    defaultActiveFirstOption: true, // 默认激活第一个选项，提升体验
    filterOption: filterOption, // 实时过滤（仅静态选项，进一步提升实时性）
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
  
  // 获取当前页面路径
  const pagePath = location.pathname;
  
  // 保存搜索条件弹窗状态
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveIsShared, setSaveIsShared] = useState(false);
  
  // 获取已保存的搜索条件列表
  const { data: savedSearchesData } = useQuery({
    queryKey: ['savedSearches', pagePath],
    queryFn: () => getSavedSearchList(pagePath, true),
    enabled: visible, // 只在弹窗打开时获取
  });
  
  const savedSearches = savedSearchesData?.items || [];
  
  // 分离个人和共享搜索条件
  const personalSearches = savedSearches.filter((item) => !item.is_shared);
  const sharedSearches = savedSearches.filter((item) => item.is_shared);
  
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
    mutationFn: deleteSavedSearch,
    onSuccess: () => {
      messageApi.success('搜索条件已删除');
      queryClient.invalidateQueries({ queryKey: ['savedSearches', pagePath] });
    },
    onError: (error: any) => {
      messageApi.error(error?.message || '删除失败');
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
   * 处理搜索
   */
  const handleSearch = async () => {
    try {
      // ⭐ 修复：使用 getFieldsValue() 获取所有字段值，而不是 validateFields()
      // validateFields() 只会返回通过验证的字段，如果字段为空或未填写，可能返回 undefined
      // getFieldsValue() 会返回所有字段的值（包括空值）
      const values = searchFormRef.current?.getFieldsValue() || {};
      
      // 过滤掉空值（undefined、null、空字符串），只保留有值的字段
      const filteredValues: Record<string, any> = {};
      Object.keys(values).forEach((key) => {
        const value = values[key];
        // 保留非空值（包括 0、false 等有效值）
        if (value !== undefined && value !== null && value !== '') {
          filteredValues[key] = value;
        }
      });
      
      // ⭐ 关键修复：同时使用两种方式确保搜索参数传递
      // 方式1：设置到 ProTable 的表单（用于表单值读取）
      if (formRef.current) {
        // 直接设置搜索值，不清空（避免清空导致值丢失）
        // 只设置有值的字段，保留其他字段的现有值
        formRef.current.setFieldsValue(filteredValues);
      }
      
      // 方式2：存储到 searchParamsRef（用于直接传递搜索参数，避免表单值更新时机问题）
      if (searchParamsRef) {
        searchParamsRef.current = filteredValues;
      }
      
      // 关闭弹窗
      onClose();
      
      // ⭐ 关键修复：使用 requestAnimationFrame + setTimeout 确保表单值已更新后再触发 reload
      // setFieldsValue 是异步的，需要等待表单值更新完成
      requestAnimationFrame(() => {
        setTimeout(() => {
          // 触发 ProTable 重新查询（使用 resetPageIndex: false 保持当前页码）
          actionRef.current?.reload(false);
        }, 150); // 等待 150ms 确保表单值已更新
      });
    } catch (error) {
      // 静默处理错误，避免影响用户体验
    }
  };

  /**
   * 处理重置
   */
  const handleReset = () => {
    searchFormRef.current?.resetFields();
    if (formRef.current) {
      formRef.current.resetFields();
    }
    // ⭐ 关键修复：清空 searchParamsRef
    if (searchParamsRef) {
      searchParamsRef.current = undefined;
    }
    actionRef.current?.reload();
  };
  
  /**
   * 处理保存搜索条件
   */
  const handleSaveSearch = () => {
    const values = searchFormRef.current?.getFieldsValue() || {};
    const filteredValues: Record<string, any> = {};
    Object.keys(values).forEach((key) => {
      const value = values[key];
      if (value !== undefined && value !== null && value !== '') {
        filteredValues[key] = value;
      }
    });
    
    if (Object.keys(filteredValues).length === 0) {
      messageApi.warning('请先设置搜索条件');
      return;
    }
    
    setSaveModalVisible(true);
  };
  
  /**
   * 确认保存搜索条件
   */
  const handleConfirmSave = () => {
    if (!saveName.trim()) {
      messageApi.warning('请输入搜索条件名称');
      return;
    }
    
    const values = searchFormRef.current?.getFieldsValue() || {};
    const filteredValues: Record<string, any> = {};
    Object.keys(values).forEach((key) => {
      const value = values[key];
      if (value !== undefined && value !== null && value !== '') {
        filteredValues[key] = value;
      }
    });
    
    createSavedSearchMutation.mutate({
      page_path: pagePath,
      name: saveName.trim(),
      is_shared: saveIsShared,
      search_params: filteredValues,
    });
  };
  
  /**
   * 加载已保存的搜索条件
   */
  const handleLoadSavedSearch = (savedSearch: SavedSearch) => {
    // 设置搜索表单值
    searchFormRef.current?.setFieldsValue(savedSearch.search_params);
    
    // 同时设置到 ProTable 表单和 searchParamsRef
    if (formRef.current) {
      formRef.current.setFieldsValue(savedSearch.search_params);
    }
    if (searchParamsRef) {
      searchParamsRef.current = savedSearch.search_params;
    }
    
    // 不关闭弹窗，让用户可以看到已加载的条件
  };
  
  /**
   * 删除已保存的搜索条件
   */
  const handleDeleteSavedSearch = (e: React.MouseEvent, searchId: number) => {
    e.stopPropagation(); // 阻止事件冒泡
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个搜索条件吗？',
      onOk: () => {
        deleteSavedSearchMutation.mutate(searchId);
      },
    });
  };

  /**
   * 弹窗打开时，同步 ProTable 表单的值到搜索表单，并聚焦搜索按钮
   */
  useEffect(() => {
    if (visible && formRef.current) {
      const currentValues = formRef.current.getFieldsValue();
      // 延迟设置，确保表单已初始化
      setTimeout(() => {
        searchFormRef.current?.setFieldsValue(currentValues);
        // 聚焦搜索按钮
        if (searchButtonRef.current) {
          searchButtonRef.current.focus();
        }
      }, 100);
    }
  }, [visible, formRef]);

  const searchableColumns = getSearchableColumns();

  return (
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
            <Button icon={<SaveOutlined />} onClick={handleSaveSearch}>
              保存搜索条件
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
        <div style={{ flex: '1', paddingLeft: 16, paddingRight: 16, borderRight: '1px solid #f0f0f0' }}>
          <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 16 }}>
            <ShareAltOutlined style={{ marginRight: 8 }} />
            共享搜索条件
          </Typography.Title>
          {sharedSearches.length > 0 ? (
            <List
              size="small"
              dataSource={sharedSearches}
              renderItem={(item) => (
                <List.Item
                  style={{ cursor: 'pointer', padding: '8px 12px' }}
                  onClick={() => handleLoadSavedSearch(item)}
                  actions={[
                    <Button
                      key="delete"
                      type="text"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSavedSearch(e, item.id);
                      }}
                    />,
                  ]}
                >
                  <List.Item.Meta
                    title={item.name}
                    description={
                      <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
                        {new Date(item.updated_at).toLocaleDateString()}
                      </Typography.Text>
                    }
                  />
                </List.Item>
              )}
            />
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
              暂无共享搜索条件
            </div>
          )}
        </div>
        
        {/* 右侧：个人搜索条件 */}
        <div style={{ flex: '1', paddingLeft: 16 }}>
          <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 16 }}>
            <UserOutlined style={{ marginRight: 8 }} />
            个人搜索条件
          </Typography.Title>
          {personalSearches.length > 0 ? (
            <List
              size="small"
              dataSource={personalSearches}
              renderItem={(item) => (
                <List.Item
                  style={{ cursor: 'pointer', padding: '8px 12px' }}
                  onClick={() => handleLoadSavedSearch(item)}
                  actions={[
                    <Button
                      key="delete"
                      type="text"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSavedSearch(e, item.id);
                      }}
                    />,
                  ]}
                >
                  <List.Item.Meta
                    title={item.name}
                    description={
                      <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
                        {new Date(item.updated_at).toLocaleDateString()}
                      </Typography.Text>
                    }
                  />
                </List.Item>
              )}
            />
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
              暂无个人搜索条件
            </div>
          )}
        </div>
      </div>
      
      {/* 保存搜索条件弹窗 */}
      <Modal
        title="保存搜索条件"
        open={saveModalVisible}
        onCancel={() => {
          setSaveModalVisible(false);
          setSaveName('');
          setSaveIsShared(false);
        }}
        onOk={handleConfirmSave}
        confirmLoading={createSavedSearchMutation.isPending}
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
        </Space>
      </Modal>
    </Modal>
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
      <Button
        ref={buttonRef}
        onClick={handleOpen}
        type="primary"
        ghost
      >
        高级搜索
        <DownOutlined style={{ marginLeft: 4 }} />
      </Button>
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
