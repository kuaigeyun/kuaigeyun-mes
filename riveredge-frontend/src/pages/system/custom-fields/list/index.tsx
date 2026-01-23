/**
 * 自定义字段管理列表页面
 * 
 * 用于系统管理员查看和管理组织内的自定义字段。
 * 支持自定义字段的 CRUD 操作。
 * 
 * 采用左右结构：
 * - 左侧：功能页面列表（按模块分组）
 * - 右侧：选中页面的自定义字段列表和配置
 */

import React, { useRef, useState, useEffect } from 'react';
import { ActionType, ProColumns, ProDescriptions, ProForm, ProFormText, ProFormTextArea, ProFormSwitch, ProFormDigit, ProFormInstance, ProFormJsonSchema } from '@ant-design/pro-components';
import SafeProFormSelect from '../../../../components/safe-pro-form-select';
import { App, Popconfirm, Button, Tag, Space, message, Input, theme, Modal, Spin } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined, PlusOutlined, SearchOutlined, DatabaseOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import { FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG, PAGE_SPACING } from '../../../../components/layout-templates';
import {
  getCustomFieldList,
  getCustomFieldByUuid,
  createCustomField,
  updateCustomField,
  deleteCustomField,
  getCustomFieldPages,
  CustomField,
  CreateCustomFieldData,
  UpdateCustomFieldData,
  CustomFieldPageConfig,
} from '../../../../services/customField';

/**
 * 获取所有可用的表名选项（用于关联表名选择框）
 * 
 * @param pageConfigs - 页面配置列表
 */
const getTableNameOptions = (pageConfigs: CustomFieldPageConfig[]) => {
  // 去重，获取所有唯一的表名
  const tableMap = new Map<string, { label: string; value: string }>();
  pageConfigs.forEach(page => {
    if (!tableMap.has(page.tableName)) {
      tableMap.set(page.tableName, {
        label: `${page.tableNameLabel} (${page.tableName})`,
        value: page.tableName,
      });
    }
  });
  return Array.from(tableMap.values()).sort((a, b) => a.label.localeCompare(b.label));
};

/**
 * 获取表的常用字段选项（用于关联字段名选择框）
 * 
 * @param tableName - 表名（可选，如果提供则尝试从配置中获取特定字段）
 * @returns 字段选项列表
 */
const getTableFieldOptions = (tableName?: string): { label: string; value: string }[] => {
  // 如果没有提供表名，返回空数组
  if (!tableName) {
    return [];
  }

  // 通用字段列表（大多数表都有的字段）
  const commonFields = [
    { label: 'ID (id)', value: 'id' },
    { label: '名称 (name)', value: 'name' },
    { label: '代码 (code)', value: 'code' },
    { label: '标题 (title)', value: 'title' },
    { label: '标签 (label)', value: 'label' },
    { label: '描述 (description)', value: 'description' },
  ];

  // 如果提供了表名，尝试从配置中获取特定字段
  // 注意：这里需要传入pageConfigs，但由于是组件外部函数，暂时返回通用字段
  // 后续可以根据实际需求扩展

  return commonFields;
};


/**
 * 自定义字段管理列表页面组件
 */
const CustomFieldListPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const { token } = theme.useToken();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // 功能页面选择状态（左右结构）
  const [selectedPageCode, setSelectedPageCode] = useState<string | null>(null);
  const [pageSearchValue, setPageSearchValue] = useState<string>('');
  const [pageFieldCounts, setPageFieldCounts] = useState<Record<string, number>>({});
  
  // Modal 相关状态（创建/编辑字段）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentFieldUuid, setCurrentFieldUuid] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [fieldType, setFieldType] = useState<'text' | 'number' | 'date' | 'time' | 'datetime' | 'select' | 'multiselect' | 'textarea' | 'image' | 'file' | 'associated_object' | 'formula' | 'json'>('text');
  const [configForm, setConfigForm] = useState<Record<string, any>>({});
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailData, setDetailData] = useState<CustomField | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // 页面配置状态
  const [pageConfigs, setPageConfigs] = useState<CustomFieldPageConfig[]>([]);
  const [pageConfigsLoading, setPageConfigsLoading] = useState(true);
  
  /**
   * 加载页面配置列表
   */
  const loadPageConfigs = async () => {
    try {
      setPageConfigsLoading(true);
      console.log('🔍 开始加载自定义字段页面配置...');
      const pages = await getCustomFieldPages();
      console.log(`✅ 成功加载 ${pages.length} 个页面配置:`, pages.map(p => p.pageCode));
      setPageConfigs(pages);
      
      // 默认选中第一个页面（仅当没有选中页面时）
      if (pages.length > 0 && !selectedPageCode) {
        setSelectedPageCode(pages[0].pageCode);
      } else if (pages.length === 0) {
        console.warn('⚠️ 未发现任何自定义字段页面配置，请检查应用的 manifest.json 是否包含 custom_field_pages 配置');
        messageApi.warning('未发现任何页面配置，请检查应用配置');
      }
    } catch (error: any) {
      console.error('❌ 加载页面配置列表失败:', error);
      const errorMessage = error?.message || error?.error?.message || '加载页面配置失败';
      messageApi.error(`加载页面配置失败: ${errorMessage}`);
      // 即使失败也设置空数组，避免页面崩溃
      setPageConfigs([]);
    } finally {
      setPageConfigsLoading(false);
    }
  };
  
  // 初始化加载页面配置
  useEffect(() => {
    loadPageConfigs();
  }, []);
  
  /**
   * 获取过滤后的功能页面列表
   */
  const getFilteredPages = (): CustomFieldPageConfig[] => {
    if (!pageSearchValue) {
      return pageConfigs;
    }
    const searchLower = pageSearchValue.toLowerCase();
    return (pageConfigs || []).filter(
      page =>
        page.pageName.toLowerCase().includes(searchLower) ||
        page.pagePath.toLowerCase().includes(searchLower) ||
        page.tableName.toLowerCase().includes(searchLower)
    );
  };
  
  /**
   * 获取选中的页面配置
   */
  const getSelectedPageConfig = (): CustomFieldPageConfig | null => {
    if (!selectedPageCode) return null;
    return pageConfigs.find(page => page.pageCode === selectedPageCode) || null;
  };
  
  /**
   * 处理选择功能页面
   */
  const handleSelectPage = async (pageCode: string) => {
    setSelectedPageCode(pageCode);
    // 加载该页面的自定义字段列表
    actionRef.current?.reload();
    // 更新字段数量
    await updatePageFieldCounts();
  };
  
  /**
   * 更新各页面的字段数量
   */
  const updatePageFieldCounts = async () => {
    try {
      const counts: Record<string, number> = {};
      for (const page of pageConfigs) {
        try {
          const response = await getCustomFieldList({
            page: 1,
            page_size: 1,
            table_name: page.tableName,
          });
          counts[page.pageCode] = response.total || 0;
        } catch (error) {
          counts[page.pageCode] = 0;
        }
      }
      setPageFieldCounts(counts);
    } catch (error) {
      console.error('更新字段数量失败:', error);
    }
  };
  
  // 初始化时加载字段数量
  useEffect(() => {
    updatePageFieldCounts();
  }, []);

  /**
   * 处理新建字段
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentFieldUuid(null);
    setFieldType('text');
    setConfigForm({});
    setModalVisible(true);
    // 重置表单并设置默认值
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      table_name: selectedPage?.tableName || undefined, // 如果有选中的页面，自动填充表名
      field_type: 'text',
      is_required: false,
      is_searchable: true,
      is_sortable: true,
      sort_order: 0,
      is_active: true,
    });
  };

  /**
   * 处理编辑字段
   */
  const handleEdit = async (record: CustomField) => {
    try {
      setIsEdit(true);
      setCurrentFieldUuid(record.uuid);
      setFieldType(record.field_type);
      setConfigForm(record.config || {});
      setModalVisible(true);
      
      // 获取字段详情
      const detail = await getCustomFieldByUuid(record.uuid);
      formRef.current?.setFieldsValue({
        name: detail.name,
        code: detail.code,
        table_name: detail.table_name,
        field_type: detail.field_type,
        label: detail.label,
        placeholder: detail.placeholder,
        is_required: detail.is_required,
        is_searchable: detail.is_searchable,
        is_sortable: detail.is_sortable,
        sort_order: detail.sort_order,
        is_active: detail.is_active,
        // 配置字段
        default_value: detail.config?.default || '',
        max_length: detail.config?.maxLength || '',
        min_value: detail.config?.min || '',
        max_value: detail.config?.max || '',
        date_format: detail.config?.format || 'YYYY-MM-DD',
        time_format: detail.config?.format || 'HH:mm:ss',
        datetime_format: detail.config?.format || 'YYYY-MM-DD HH:mm:ss',
        textarea_rows: detail.config?.rows || 4,
        select_options: detail.config?.options ? JSON.stringify(detail.config.options, null, 2) : '',
        image_max_size: detail.config?.maxSize || '',
        image_allowed_types: detail.config?.allowedTypes ? detail.config.allowedTypes.join(',') : '',
        file_max_size: detail.config?.maxSize || '',
        file_allowed_types: detail.config?.allowedTypes ? detail.config.allowedTypes.join(',') : '',
        associated_table: detail.config?.associatedTable || '',
        associated_field: detail.config?.associatedField || '',
        formula_expression: detail.config?.expression || '',
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取字段详情失败');
    }
  };

  /**
   * 处理查看详情
   */
  const handleView = async (record: CustomField) => {
    try {
      setDetailLoading(true);
      setDrawerVisible(true);
      const detail = await getCustomFieldByUuid(record.uuid);
      setDetailData(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取字段详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理删除字段
   */
  const handleDelete = async (record: CustomField) => {
    try {
      await deleteCustomField(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
      // 更新字段数量
      updatePageFieldCounts();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理批量删除字段
   */
  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning('请先选择要删除的记录');
      return;
    }

    Modal.confirm({
      title: '确认批量删除',
      content: `确定要删除选中的 ${selectedRowKeys.length} 条记录吗？此操作不可恢复。`,
      okText: '确定',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          let successCount = 0;
          let failCount = 0;
          const errors: string[] = [];

          for (const key of selectedRowKeys) {
            try {
              await deleteCustomField(key.toString());
              successCount++;
            } catch (error: any) {
              failCount++;
              errors.push(error.message || '删除失败');
            }
          }

          if (successCount > 0) {
            messageApi.success(`成功删除 ${successCount} 条记录`);
          }
          if (failCount > 0) {
            messageApi.error(`删除失败 ${failCount} 条记录${errors.length > 0 ? '：' + errors.join('; ') : ''}`);
          }

          setSelectedRowKeys([]);
          actionRef.current?.reload();
          // 更新字段数量
          updatePageFieldCounts();
        } catch (error: any) {
          messageApi.error(error.message || '批量删除失败');
        }
      },
    });
  };

  /**
   * 处理提交表单（创建/更新字段）
   */
  const handleSubmit = async (values: any): Promise<void> => {
    try {
      setFormLoading(true);
      
      // 确保表名正确（新建时使用选中页面的表名）
      if (!isEdit && selectedPage) {
        values.table_name = selectedPage.tableName;
      }
      
      // 验证表名是否存在
      if (!values.table_name) {
        messageApi.error('关联表名不能为空，请先选择一个功能页面');
        return;
      }
      
      // 根据字段类型构建配置对象
      const config: Record<string, any> = {};
      
      if (fieldType === 'text') {
        if (values.default_value) config.default = values.default_value;
        if (values.max_length) config.maxLength = parseInt(values.max_length);
      } else if (fieldType === 'number') {
        if (values.default_value !== undefined && values.default_value !== '') {
          config.default = parseFloat(values.default_value);
        }
        if (values.min_value !== undefined && values.min_value !== '') {
          config.min = parseFloat(values.min_value);
        }
        if (values.max_value !== undefined && values.max_value !== '') {
          config.max = parseFloat(values.max_value);
        }
      } else if (fieldType === 'date') {
        if (values.default_value) config.default = values.default_value;
        if (values.date_format) config.format = values.date_format;
      } else if (fieldType === 'time') {
        if (values.default_value) config.default = values.default_value;
        if (values.time_format) config.format = values.time_format;
      } else if (fieldType === 'datetime') {
        if (values.default_value) config.default = values.default_value;
        if (values.datetime_format) config.format = values.datetime_format;
      } else if (fieldType === 'select') {
        if (values.select_options) {
          try {
            config.options = JSON.parse(values.select_options);
          } catch (e) {
            messageApi.error('选项 JSON 格式不正确');
            return;
          }
        }
      } else if (fieldType === 'multiselect') {
        if (values.select_options) {
          try {
            config.options = JSON.parse(values.select_options);
          } catch (e) {
            messageApi.error('选项 JSON 格式不正确');
            return;
          }
        }
      } else if (fieldType === 'image') {
        if (values.image_max_size) config.maxSize = parseInt(values.image_max_size);
        if (values.image_allowed_types) config.allowedTypes = values.image_allowed_types.split(',').map(t => t.trim());
      } else if (fieldType === 'file') {
        if (values.file_max_size) config.maxSize = parseInt(values.file_max_size);
        if (values.file_allowed_types) config.allowedTypes = values.file_allowed_types.split(',').map(t => t.trim());
      } else if (fieldType === 'associated_object') {
        if (values.associated_table) config.associatedTable = values.associated_table;
        if (values.associated_field) config.associatedField = values.associated_field;
      } else if (fieldType === 'formula') {
        if (values.formula_expression) config.expression = values.formula_expression;
      } else if (fieldType === 'textarea') {
        if (values.default_value) config.default = values.default_value;
        if (values.textarea_rows) config.rows = parseInt(values.textarea_rows);
      } else if (fieldType === 'json') {
        if (values.default_value) {
          try {
            config.default = JSON.parse(values.default_value);
          } catch (e) {
            messageApi.error('默认值 JSON 格式不正确');
            return;
          }
        }
      }
      
      // 移除配置相关字段
      const { 
        default_value, max_length, min_value, max_value, 
        date_format, time_format, datetime_format, 
        textarea_rows, select_options,
        image_max_size, image_allowed_types,
        file_max_size, file_allowed_types,
        associated_table, associated_field,
        formula_expression,
        ...fieldData 
      } = values;
      
      if (isEdit && currentFieldUuid) {
        await updateCustomField(currentFieldUuid, {
          ...fieldData,
          config: Object.keys(config).length > 0 ? config : undefined,
        } as UpdateCustomFieldData);
        messageApi.success('更新成功');
      } else {
        await createCustomField({
          ...fieldData,
          config: Object.keys(config).length > 0 ? config : undefined,
        } as CreateCustomFieldData);
        messageApi.success('创建成功');
      }
      
      setModalVisible(false);
      actionRef.current?.reload();
      // 更新字段数量
      updatePageFieldCounts();
    } catch (error: any) {
      messageApi.error(error.message || '操作失败');
      throw error;
    } finally {
      setFormLoading(false);
    }
  };

  /**
   * 根据字段类型渲染配置表单
   */
  const renderConfigFields = () => {
    switch (fieldType) {
      case 'text':
        return (
          <>
            <div style={{ gridColumn: 'span 1' }}>
              <ProFormText
                name="default_value"
                label="默认值"
                placeholder="请输入默认值（可选）"
              />
            </div>
            <div style={{ gridColumn: 'span 1' }}>
              <ProFormDigit
                name="max_length"
                label="最大长度"
                placeholder="请输入最大长度（可选）"
                fieldProps={{ min: 1 }}
              />
            </div>
          </>
        );
      case 'number':
        return (
          <>
            <div style={{ gridColumn: 'span 1' }}>
              <ProFormDigit
                name="default_value"
                label="默认值"
                placeholder="请输入默认值（可选）"
              />
            </div>
            <div style={{ gridColumn: 'span 1' }}>
              <ProFormDigit
                name="min_value"
                label="最小值"
                placeholder="最小值（可选）"
              />
            </div>
            <div style={{ gridColumn: 'span 1' }}>
              <ProFormDigit
                name="max_value"
                label="最大值"
                placeholder="最大值（可选）"
              />
            </div>
          </>
        );
      case 'date':
        return (
          <>
            <div style={{ gridColumn: 'span 1' }}>
              <ProFormText
                name="default_value"
                label="默认值"
                placeholder="请输入默认日期，例如：2025-01-01（可选）"
              />
            </div>
            <div style={{ gridColumn: 'span 1' }}>
              <ProFormText
                name="date_format"
                label="日期格式"
                placeholder="例如：YYYY-MM-DD"
                initialValue="YYYY-MM-DD"
                extra="支持的格式：YYYY-MM-DD、YYYY/MM/DD、YYYY年MM月DD日等"
              />
            </div>
          </>
        );
      case 'time':
        return (
          <>
            <div style={{ gridColumn: 'span 1' }}>
              <ProFormText
                name="default_value"
                label="默认值"
                placeholder="请输入默认时间，例如：14:30:00（可选）"
              />
            </div>
            <div style={{ gridColumn: 'span 1' }}>
              <ProFormText
                name="time_format"
                label="时间格式"
                placeholder="例如：HH:mm:ss"
                initialValue="HH:mm:ss"
                extra="支持的格式：HH:mm:ss、HH:mm等"
              />
            </div>
          </>
        );
      case 'datetime':
        return (
          <>
            <div style={{ gridColumn: 'span 1' }}>
              <ProFormText
                name="default_value"
                label="默认值"
                placeholder="请输入默认日期时间，例如：2025-01-01 14:30:00（可选）"
              />
            </div>
            <div style={{ gridColumn: 'span 1' }}>
              <ProFormText
                name="datetime_format"
                label="日期时间格式"
                placeholder="例如：YYYY-MM-DD HH:mm:ss"
                initialValue="YYYY-MM-DD HH:mm:ss"
                extra="支持的格式：YYYY-MM-DD HH:mm:ss、YYYY/MM/DD HH:mm等"
              />
            </div>
          </>
        );
      case 'select':
        return (
          <>
            <div style={{ gridColumn: 'span 2' }}>
              <ProFormTextArea
                name="select_options"
                label="选项配置（JSON）"
                placeholder='请输入选项 JSON，例如：[{"label": "选项1", "value": "1"}, {"label": "选项2", "value": "2"}]'
                fieldProps={{ rows: 6 }}
                extra={
                  <div style={{ fontSize: '12px', color: '#666', marginTop: 4 }}>
                    格式示例：
                    <pre style={{ margin: '4px 0', padding: '4px', backgroundColor: '#f5f5f5', borderRadius: '2px', fontSize: '11px' }}>
{`[
  {"label": "选项1", "value": "1"},
  {"label": "选项2", "value": "2"}
]`}
                    </pre>
                  </div>
                }
              />
            </div>
          </>
        );
      case 'multiselect':
        return (
          <>
            <div style={{ gridColumn: 'span 2' }}>
              <ProFormTextArea
                name="select_options"
                label="选项配置（JSON）"
                placeholder='请输入选项 JSON，例如：[{"label": "选项1", "value": "1"}, {"label": "选项2", "value": "2"}]'
                fieldProps={{ rows: 6 }}
                extra={
                  <div style={{ fontSize: '12px', color: '#666', marginTop: 4 }}>
                    格式示例：
                    <pre style={{ margin: '4px 0', padding: '4px', backgroundColor: '#f5f5f5', borderRadius: '2px', fontSize: '11px' }}>
{`[
  {"label": "选项1", "value": "1"},
  {"label": "选项2", "value": "2"}
]`}
                    </pre>
                  </div>
                }
              />
            </div>
          </>
        );
      case 'image':
        return (
          <>
            <div style={{ gridColumn: 'span 1' }}>
              <ProFormDigit
                name="image_max_size"
                label="最大文件大小（KB）"
                placeholder="请输入最大文件大小，例如：2048"
                fieldProps={{ min: 1 }}
                extra="单位：KB，例如：2048 表示 2MB"
              />
            </div>
            <div style={{ gridColumn: 'span 1' }}>
              <ProFormText
                name="image_allowed_types"
                label="允许的文件类型"
                placeholder="例如：jpg,jpeg,png,gif"
                extra="多个类型用逗号分隔，例如：jpg,jpeg,png,gif"
              />
            </div>
          </>
        );
      case 'file':
        return (
          <>
            <div style={{ gridColumn: 'span 1' }}>
              <ProFormDigit
                name="file_max_size"
                label="最大文件大小（KB）"
                placeholder="请输入最大文件大小，例如：10240"
                fieldProps={{ min: 1 }}
                extra="单位：KB，例如：10240 表示 10MB"
              />
            </div>
            <div style={{ gridColumn: 'span 1' }}>
              <ProFormText
                name="file_allowed_types"
                label="允许的文件类型"
                placeholder="例如：pdf,doc,docx,xls,xlsx"
                extra="多个类型用逗号分隔，例如：pdf,doc,docx,xls,xlsx"
              />
            </div>
          </>
        );
      case 'associated_object':
        return (
          <>
            <div style={{ gridColumn: 'span 1' }}>
              <SafeProFormSelect
                name="associated_table"
                label="关联表名"
                rules={[{ required: true, message: '请选择关联表名' }]}
                options={getTableNameOptions(pageConfigs)}
                placeholder="请选择关联的数据表"
                extra="选择要关联的数据表"
                fieldProps={{
                  onChange: (value: string) => {
                    // 当关联表名改变时，清空关联字段名
                    formRef.current?.setFieldsValue({
                      associated_field: undefined,
                    });
                  },
                }}
              />
            </div>
            <div style={{ gridColumn: 'span 1' }}>
              <SafeProFormSelect
                name="associated_field"
                label="关联字段名"
                rules={[{ required: true, message: '请选择关联字段名' }]}
                dependencies={['associated_table']}
                options={({ associated_table }) => {
                  if (!associated_table) {
                    return [];
                  }
                  return getTableFieldOptions(associated_table);
                }}
                placeholder="请选择用于显示的字段"
                extra="选择用于显示的字段名称"
              />
            </div>
          </>
        );
      case 'formula':
        return (
          <>
            <div style={{ gridColumn: 'span 2' }}>
              <ProFormTextArea
                name="formula_expression"
                label="公式表达式"
                placeholder="例如：{field1} + {field2} * 2"
                fieldProps={{ rows: 4 }}
                extra="使用 {字段名} 引用其他字段，支持基本数学运算"
              />
            </div>
          </>
        );
      case 'textarea':
        return (
          <>
            <div style={{ gridColumn: 'span 1' }}>
              <ProFormTextArea
                name="default_value"
                label="默认值"
                placeholder="请输入默认值（可选）"
                fieldProps={{ rows: 3 }}
              />
            </div>
            <div style={{ gridColumn: 'span 1' }}>
              <ProFormDigit
                name="textarea_rows"
                label="行数"
                placeholder="请输入行数"
                fieldProps={{ min: 1, max: 20 }}
                initialValue={4}
              />
            </div>
          </>
        );
      case 'json':
        return (
          <>
            <div style={{ gridColumn: 'span 2' }}>
              <ProFormTextArea
                name="default_value"
                label="默认值（JSON）"
                placeholder='请输入 JSON 格式的默认值，例如：{"key": "value"}'
                fieldProps={{ rows: 6 }}
                extra="请输入有效的 JSON 格式"
              />
            </div>
          </>
        );
      default:
        return null;
    }
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<CustomField>[] = [
    {
      title: '字段名称',
      dataIndex: 'name',
      width: 150,
      fixed: 'left',
    },
    {
      title: '字段代码',
      dataIndex: 'code',
      width: 150,
    },
    {
      title: '关联表',
      dataIndex: 'table_name',
      width: 150,
      hideInTable: true, // 在表格中隐藏，因为已经按表名过滤了
    },
    {
      title: '字段类型',
      dataIndex: 'field_type',
      width: 120,
      valueType: 'select',
      valueEnum: {
        text: { text: '文本', status: 'Default' },
        number: { text: '数值', status: 'Processing' },
        image: { text: '图片', status: 'Success' },
        file: { text: '文件', status: 'Warning' },
        date: { text: '日期', status: 'Success' },
        time: { text: '时间', status: 'Success' },
        datetime: { text: '日期时间', status: 'Success' },
        select: { text: '单选', status: 'Warning' },
        multiselect: { text: '多选', status: 'Warning' },
        associated_object: { text: '关联对象', status: 'Processing' },
        formula: { text: '公式', status: 'Error' },
        textarea: { text: '多行文本', status: 'Error' },
        json: { text: 'JSON', status: 'Default' },
      },
      render: (_, record) => {
        const typeMap: Record<string, { color: string; text: string }> = {
          text: { color: 'default', text: '文本' },
          number: { color: 'blue', text: '数值' },
          image: { color: 'green', text: '图片' },
          file: { color: 'orange', text: '文件' },
          date: { color: 'green', text: '日期' },
          time: { color: 'cyan', text: '时间' },
          datetime: { color: 'blue', text: '日期时间' },
          select: { color: 'orange', text: '单选' },
          multiselect: { color: 'purple', text: '多选' },
          associated_object: { color: 'geekblue', text: '关联对象' },
          formula: { color: 'red', text: '公式' },
          textarea: { color: 'red', text: '多行文本' },
          json: { color: 'purple', text: 'JSON' },
        };
        const typeInfo = typeMap[record.field_type] || { color: 'default', text: record.field_type };
        return <Tag color={typeInfo.color}>{typeInfo.text}</Tag>;
      },
    },
    {
      title: '字段标签',
      dataIndex: 'label',
      width: 150,
      hideInSearch: true,
    },
    {
      title: '是否必填',
      dataIndex: 'is_required',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: '是', status: 'Success' },
        false: { text: '否', status: 'Default' },
      },
      render: (_, record) => (
        <Tag color={record.is_required ? 'success' : 'default'}>
          {record.is_required ? '是' : '否'}
        </Tag>
      ),
    },
    {
      title: '排序',
      dataIndex: 'sort_order',
      width: 80,
      hideInSearch: true,
      sorter: true,
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: '启用', status: 'Success' },
        false: { text: '禁用', status: 'Default' },
      },
      render: (_, record) => (
        <Tag color={record.is_active ? 'success' : 'default'}>
          {record.is_active ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleView(record)}
          >
            查看
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个字段吗？"
            onConfirm={() => handleDelete(record)}
          >
            <Button
              type="link"
              danger
              size="small"
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 获取过滤后的页面列表和选中的页面配置
  const filteredPages = getFilteredPages();
  const selectedPage = getSelectedPageConfig();

  /**
   * 详情列定义
   */
  const detailColumns = [
    { title: '字段名称', dataIndex: 'name' },
    { title: '字段代码', dataIndex: 'code' },
    { title: '关联表名', dataIndex: 'table_name' },
    { title: '字段类型', dataIndex: 'field_type' },
    { title: '字段标签', dataIndex: 'label' },
    { title: '占位符', dataIndex: 'placeholder' },
    {
      title: '字段配置',
      dataIndex: 'config',
      render: (value: any) => (
        <pre style={{
          margin: 0,
          padding: '8px',
          backgroundColor: '#f5f5f5',
          borderRadius: '4px',
          overflow: 'auto',
          maxHeight: '300px',
        }}>
          {JSON.stringify(value || {}, null, 2)}
        </pre>
      ),
    },
    {
      title: '是否必填',
      dataIndex: 'is_required',
      render: (value: boolean) => (value ? '是' : '否'),
    },
    {
      title: '是否可搜索',
      dataIndex: 'is_searchable',
      render: (value: boolean) => (value ? '是' : '否'),
    },
    {
      title: '是否可排序',
      dataIndex: 'is_sortable',
      render: (value: boolean) => (value ? '是' : '否'),
    },
    { title: '排序顺序', dataIndex: 'sort_order' },
    {
      title: '状态',
      dataIndex: 'is_active',
      render: (value: boolean) => (value ? '启用' : '禁用'),
    },
    { title: '创建时间', dataIndex: 'created_at', valueType: 'dateTime' },
    { title: '更新时间', dataIndex: 'updated_at', valueType: 'dateTime' },
  ];

  return (
    <>
      <div
        className="custom-field-management-page"
        style={{
          display: 'flex',
          height: 'calc(100vh - 96px)',
          padding: `${PAGE_SPACING.PADDING}px`,
          margin: 0,
          boxSizing: 'border-box',
          borderRadius: token.borderRadiusLG || token.borderRadius,
          overflow: 'hidden',
        }}
      >
        {/* 功能页面自定义字段配置 - 左右结构 */}
        <div
          style={{
            display: 'flex',
            width: '100%',
            height: '100%',
            borderRadius: token.borderRadiusLG || token.borderRadius,
            overflow: 'hidden',
            border: `1px solid ${token.colorBorder}`,
          }}
        >
          {/* 左侧功能页面列表 */}
          <div
            style={{
              width: '300px',
              borderRight: `1px solid ${token.colorBorder}`,
              backgroundColor: token.colorFillAlter || '#fafafa',
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              borderTopLeftRadius: token.borderRadiusLG || token.borderRadius,
              borderBottomLeftRadius: token.borderRadiusLG || token.borderRadius,
            }}
          >
            {/* 搜索栏 */}
            <div style={{ padding: '8px', borderBottom: `1px solid ${token.colorBorder}` }}>
              <Input
                placeholder="搜索功能页面"
                prefix={<SearchOutlined />}
                value={pageSearchValue}
                onChange={(e) => setPageSearchValue(e.target.value)}
                allowClear
                size="middle"
              />
            </div>

            {/* 功能页面列表 */}
            <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
              {pageConfigsLoading ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <Spin size="large" />
                  <div style={{ marginTop: '16px', color: token.colorTextSecondary }}>
                    加载页面配置中...
                  </div>
                </div>
              ) : (
                Array.from(new Set(pageConfigs.map(p => p.module))).map(module => {
                  const modulePages = (filteredPages || []).filter(page => page?.module === module);
                  if (modulePages.length === 0) return null;

                  return (
                    <div key={module} style={{ marginBottom: '16px' }}>
                      <div
                        style={{
                          padding: '8px 12px',
                          fontWeight: 500,
                          fontSize: '14px',
                          color: token.colorTextHeading,
                          backgroundColor: token.colorFillSecondary,
                          borderRadius: token.borderRadius,
                          marginBottom: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                        }}
                      >
                        <DatabaseOutlined />
                        {module}
                      </div>
                      {modulePages.map(page => {
                      const isSelected = selectedPageCode === page.pageCode;
                      const fieldCount = pageFieldCounts[page.pageCode] || 0;
                      return (
                        <div
                          key={page.pageCode}
                          onClick={() => handleSelectPage(page.pageCode)}
                          style={{
                            padding: '12px',
                            marginBottom: '4px',
                            cursor: 'pointer',
                            borderRadius: token.borderRadius,
                            backgroundColor: isSelected ? token.colorPrimaryBg : 'transparent',
                            border: isSelected ? `1px solid ${token.colorPrimary}` : `1px solid transparent`,
                            transition: 'all 0.2s',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.backgroundColor = token.colorFillSecondary;
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: isSelected ? 500 : 400, marginBottom: '4px' }}>
                              {page.pageName}
                            </div>
                            <div style={{ fontSize: '12px', color: token.colorTextSecondary }}>
                              {page.tableNameLabel}
                            </div>
                          </div>
                          {fieldCount > 0 && (
                            <Tag color="blue" size="small" style={{ marginLeft: '8px' }}>
                              {fieldCount}
                            </Tag>
                          )}
                        </div>
                      );
                    })}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 右侧配置区域 */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: token.colorBgContainer,
              borderTopRightRadius: token.borderRadiusLG || token.borderRadius,
              borderBottomRightRadius: token.borderRadiusLG || token.borderRadius,
            }}
          >
            {selectedPage ? (
              <>
                {/* 顶部标题栏 */}
                <div
                  style={{
                    borderBottom: `1px solid ${token.colorBorder}`,
                    padding: '16px',
                    backgroundColor: token.colorFillAlter,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: 500, marginBottom: '4px' }}>
                      {selectedPage.pageName}
                    </div>
                    <div style={{ fontSize: '12px', color: token.colorTextSecondary }}>
                      {selectedPage.pagePath}
                    </div>
                  </div>
                  <Space>
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={handleCreate}
                    >
                      新建字段
                    </Button>
                    <Button
                      danger
                      icon={<DeleteOutlined />}
                      disabled={selectedRowKeys.length === 0}
                      onClick={handleBatchDelete}
                    >
                      批量删除
                    </Button>
                  </Space>
                </div>

                {/* 字段列表 */}
                <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
                  <UniTable<CustomField>
                    actionRef={actionRef}
                    columns={columns}
                    request={async (params, sort, _filter) => {
                      // 处理搜索参数
                      const apiParams: any = {
                        page: params.current || 1,
                        page_size: params.pageSize || 20,
                        table_name: selectedPage.tableName, // 只查询当前页面的字段
                      };
                      
                      // 状态筛选
                      if (params.is_active !== undefined && params.is_active !== '' && params.is_active !== null) {
                        apiParams.is_active = params.is_active;
                      }
                      
                      // 类型筛选
                      if (params.field_type) {
                        apiParams.field_type = params.field_type;
                      }
                      
                      // 搜索条件处理：name 和 code 使用模糊搜索
                      if (params.name) {
                        apiParams.name = params.name as string;
                      }
                      if (params.code) {
                        apiParams.code = params.code as string;
                      }
                      
                      try {
                        const response = await getCustomFieldList(apiParams);
                        return {
                          data: response.items,
                          success: true,
                          total: response.total,
                        };
                      } catch (error: any) {
                        console.error('获取自定义字段列表失败:', error);
                        messageApi.error(error?.message || '获取自定义字段列表失败');
                        return {
                          data: [],
                          success: false,
                          total: 0,
                        };
                      }
                    }}
                    rowKey="uuid"
                    search={{
                      labelWidth: 'auto',
                    }}
                    pagination={{
                      defaultPageSize: 20,
                      showSizeChanger: true,
                    }}
                    showCreateButton
                    onCreate={handleCreate}
                    rowSelection={{
                      selectedRowKeys,
                      onChange: setSelectedRowKeys,
                    }}
                  />
                </div>
              </>
            ) : (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: token.colorTextSecondary,
                }}
              >
                请从左侧选择一个功能页面进行配置
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 创建/编辑字段 Modal */}
      <FormModalTemplate
        title={isEdit ? '编辑字段' : '新建字段'}
        open={modalVisible}
        onClose={() => setModalVisible(false)}
        onFinish={handleSubmit}
        isEdit={isEdit}
        loading={formLoading}
        width={MODAL_CONFIG.LARGE_WIDTH}
      >
        <ProForm
          formRef={formRef}
          submitter={false}
          layout="vertical"
          grid={true}
          rowProps={{
            gutter: 16,
          }}
        >
          <ProFormText
            name="name"
            label="字段名称"
            rules={[{ required: true, message: '请输入字段名称' }]}
            placeholder="请输入字段名称"
            colProps={{ span: 12 }}
          />
          <ProFormText
            name="code"
            label="字段代码"
            rules={[{ required: true, message: '请输入字段代码' }]}
            placeholder="请输入字段代码（唯一标识）"
            disabled={isEdit}
            extra="字段代码用于程序调用，创建后不可修改"
            colProps={{ span: 12 }}
          />
          <ProFormText
            name="table_name"
            label="关联表名"
            placeholder="例如：sys_users"
            disabled={true}
            initialValue={selectedPage?.tableName || ''}
            extra={isEdit ? "关联表名，创建后不可修改" : "关联表名，根据选中的功能页面自动填充"}
            colProps={{ span: 12 }}
          />
          <SafeProFormSelect
            name="field_type"
            label="字段类型"
            rules={[{ required: true, message: '请选择字段类型' }]}
            options={[
              { label: '文本', value: 'text' },
              { label: '数值', value: 'number' },
              { label: '图片', value: 'image' },
              { label: '文件', value: 'file' },
              { label: '日期', value: 'date' },
              { label: '时间', value: 'time' },
              { label: '日期时间', value: 'datetime' },
              { label: '单选', value: 'select' },
              { label: '多选', value: 'multiselect' },
              { label: '关联对象', value: 'associated_object' },
              { label: '公式', value: 'formula' },
              { label: '多行文本', value: 'textarea' },
              { label: 'JSON', value: 'json' },
            ]}
            fieldProps={{
              onChange: (value) => {
                setFieldType(value);
                // 重置配置
                setConfigForm({});
              },
            }}
            disabled={isEdit}
            colProps={{ span: 12 }}
          />
          <ProFormText
            name="label"
            label="字段标签"
            placeholder="请输入字段标签（显示名称）"
            colProps={{ span: 12 }}
          />
          <ProFormText
            name="placeholder"
            label="占位符"
            placeholder="请输入占位符"
            colProps={{ span: 12 }}
          />
          <div style={{ 
            padding: '16px', 
            backgroundColor: '#fafafa', 
            borderRadius: '4px',
            border: '1px solid #d9d9d9',
            marginBottom: 16,
            gridColumn: '1 / -1',
          }}>
            <div style={{ marginBottom: 12, fontWeight: 500 }}>字段配置</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {renderConfigFields()}
            </div>
          </div>
          <ProFormSwitch
            name="is_required"
            label="是否必填"
            colProps={{ span: 8 }}
          />
          <ProFormSwitch
            name="is_searchable"
            label="是否可搜索"
            colProps={{ span: 8 }}
          />
          <ProFormSwitch
            name="is_sortable"
            label="是否可排序"
            colProps={{ span: 8 }}
          />
          <ProFormDigit
            name="sort_order"
            label="排序顺序"
            fieldProps={{ min: 0 }}
            initialValue={0}
            colProps={{ span: 12 }}
          />
          <ProFormSwitch
            name="is_active"
            label="是否启用"
            colProps={{ span: 12 }}
          />
        </ProForm>
      </FormModalTemplate>

      {/* 查看详情 Drawer */}
      <DetailDrawerTemplate<CustomField>
        title="字段详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        dataSource={detailData || {}}
        columns={detailColumns}
        column={1}
      />
    </>
  );
};

export default CustomFieldListPage;

