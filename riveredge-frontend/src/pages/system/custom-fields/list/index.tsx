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

import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { rowActionKind } from '../../../../components/uni-action';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProFormText, ProFormTextArea, ProFormSwitch, ProFormDigit, ProFormInstance, ProFormItem, ProFormDependency } from '@ant-design/pro-components';
import SafeProFormSelect from '../../../../components/safe-pro-form-select';
import { App, Badge, Button, Col, Descriptions, Form, Input, Popconfirm, Row, Space, Spin, Tag, Tooltip, theme } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined, PlusOutlined, SearchOutlined, DatabaseOutlined, MinusCircleOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import { flushDrawerOpen, DRAWER_CONFIG, FormModalTemplate, MODAL_CONFIG } from '../../../../components/layout-templates';
import { CustomFieldJsonEditor, CustomFieldJsonModeSegmented, type CustomFieldJsonEditorMode } from '../../../../components/custom-fields/CustomFieldJsonEditor';
import { CustomFieldFormulaConfigEditor } from '../../../../components/custom-fields/CustomFieldFormulaConfigEditor';
import { normalizeJsonFieldValue, isFlatJsonObject } from '../../../../components/custom-fields/customFieldJsonUtils';
import {
  buildSourceFieldKeyFromConfig,
  parseSourceFieldKey,
} from '../../../../components/custom-fields/customFieldSourceFieldUtils';
import {
  buildSourceFieldSelectOptions,
  createSourceFieldSelectRenderers,
} from '../../../../components/custom-fields/CustomFieldSourceFieldOption';
import { AssociatedTableModelFieldSelect } from '../../../../components/custom-fields/AssociatedTableModelFieldSelect';
import { AssociatedDisplayModeSegmented } from '../../../../components/custom-fields/AssociatedDisplayModeSegmented';
import {
  getAssociatedDisplayModeDefault,
  type AssociatedDisplayMode,
} from '../../../../components/custom-fields/customFieldAssociatedDisplayMode';
import { UniDetail, detailDrawerDescriptionItems } from '../../../../components/uni-detail';
import {
  getCustomFieldList,
  getCustomFieldByUuid,
  createCustomField,
  updateCustomField,
  deleteCustomField,
  getCustomFieldPages,
  getCustomFieldsByTable,
  getSystemSourceFields,
  CustomField,
  type CustomFieldSystemSourceField,
  CreateCustomFieldData,
  UpdateCustomFieldData,
  CustomFieldPageConfig,
} from '../../../../services/customField';
import { getApplicationList } from '../../../../services/application';
import { useNavigationMenuTreeQuery } from '../../../../hooks/useNavigationMenuTreeQuery';
import {
  buildMenuPathNameMap,
  enrichPagesWithMenuNames,
} from '../../../../utils/featurePageDisplay';

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
 * 自定义字段管理列表页面组件
 */
const CustomFieldListPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const { token } = theme.useToken();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>(null);
  const customFieldDetailReqRef = useRef(0);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // 功能页面选择状态（左右结构）
  const [selectedPageCode, setSelectedPageCode] = useState<string | null>(null);
  const [pageSearchValue, setPageSearchValue] = useState<string>('');

  // Modal 相关状态（创建/编辑字段）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentFieldUuid, setCurrentFieldUuid] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [fieldType, setFieldType] = useState<'text' | 'number' | 'date' | 'time' | 'datetime' | 'select' | 'multiselect' | 'textarea' | 'image' | 'file' | 'associated_object' | 'associated_attribute' | 'formula' | 'json'>('text');
  const [jsonEditorMode, setJsonEditorMode] = useState<CustomFieldJsonEditorMode>('kv');
  const [sameTableFields, setSameTableFields] = useState<CustomField[]>([]);
  const [systemSourceFields, setSystemSourceFields] = useState<CustomFieldSystemSourceField[]>([]);
  const editingFieldConfigRef = useRef<Record<string, unknown> | null>(null);


  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailData, setDetailData] = useState<CustomField | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // 页面配置状态
  const [pageConfigs, setPageConfigs] = useState<CustomFieldPageConfig[]>([]);
  const [pageConfigsLoading, setPageConfigsLoading] = useState(true);
  const [tableFieldCounts, setTableFieldCounts] = useState<Record<string, number>>({});

  const { data: menuTree } = useNavigationMenuTreeQuery();

  const menuPathNameMap = useMemo(
    () => buildMenuPathNameMap(menuTree || [], t),
    [menuTree, t],
  );

  const displayPageConfigs = useMemo(
    () => enrichPagesWithMenuNames(pageConfigs, menuPathNameMap, t),
    [pageConfigs, menuPathNameMap, t],
  );

  /**
   * 根据已启用应用过滤页面：只展示已安装且启用的应用下的页面
   */
  const filterPagesByEnabledApps = (
    pages: CustomFieldPageConfig[],
    apps: any[]
  ): CustomFieldPageConfig[] => {
    const enabledPrefixes = apps.map((a) => a.route_path || `/apps/${a.code}`).filter(Boolean);
    if (enabledPrefixes.length === 0) return [];
    return pages.filter((p) =>
      enabledPrefixes.some(
        (prefix) => p.pagePath === prefix || p.pagePath.startsWith(prefix + '/'),
      ),
    );
  };

  /**
   * 按表名统计已配置自定义字段数量（左栏徽章）
   */
  const loadTableFieldCounts = useCallback(async () => {
    try {
      const counts: Record<string, number> = {};
      const pageSize = 1000;
      let page = 1;
      let total = 0;
      do {
        const response = await getCustomFieldList({ page, page_size: pageSize });
        for (const item of response.items || []) {
          counts[item.table_name] = (counts[item.table_name] || 0) + 1;
        }
        total = response.total ?? 0;
        page += 1;
      } while ((page - 1) * pageSize < total);
      setTableFieldCounts(counts);
    } catch (error) {
      console.warn('Failed to load custom field counts:', error);
    }
  }, []);

  /**
   * 加载页面配置列表
   */
  const loadPageConfigs = async () => {
    try {
      setPageConfigsLoading(true);
      // 并行加载全部页面配置和已安装应用列表，显著提升首屏加载性能
      const [allPages, apps] = await Promise.all([
        getCustomFieldPages(),
        getApplicationList({ is_installed: true, is_active: true })
      ]);
      const pages = filterPagesByEnabledApps(allPages, apps);
      setPageConfigs(pages);
      void loadTableFieldCounts();

      // 默认选中第一个页面（仅当没有选中页面时）；若当前选中项已不在列表中（应用被禁用），则重置为第一项
      if (pages.length > 0) {
        const stillInList = selectedPageCode && pages.some((p) => p.pageCode === selectedPageCode);
        if (!stillInList) setSelectedPageCode(pages[0].pageCode);
      } else if (pages.length === 0) {
        console.warn('No custom field page configs found. Please check whether the app manifest.json includes custom_field_pages.');
        messageApi.warning(t('field.customField.noPageConfig'));
      }
    } catch (error: any) {
      console.error('Failed to load page config list:', error);
      const errorMessage = error?.message || error?.error?.message || t('field.customField.pageConfigLoadFailed');
      messageApi.error(`${t('field.customField.pageConfigLoadFailed')}: ${errorMessage}`);
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

  useEffect(() => {
    if (!modalVisible) {
      setSameTableFields([]);
      return;
    }
    const tableName = displayPageConfigs.find((page) => page.pageCode === selectedPageCode)?.tableName;
    if (!tableName) {
      setSameTableFields([]);
      setSystemSourceFields([]);
      editingFieldConfigRef.current = null;
      return;
    }
    getCustomFieldsByTable(tableName, true)
      .then((fields) => setSameTableFields(fields.filter((field) => field.uuid !== currentFieldUuid)))
      .catch(() => setSameTableFields([]));
    getSystemSourceFields(tableName)
      .then(setSystemSourceFields)
      .catch(() => setSystemSourceFields([]));
  }, [modalVisible, selectedPageCode, displayPageConfigs, currentFieldUuid]);

  /**
   * 处理新建字段
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentFieldUuid(null);
    editingFieldConfigRef.current = null;
    setFieldType('text');
    setJsonEditorMode('kv');
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
      setModalVisible(true);

      // 获取字段详情
      const detail = await getCustomFieldByUuid(record.uuid);
      editingFieldConfigRef.current = detail.config ?? null;
      if (detail.field_type === 'json') {
        setJsonEditorMode(
          detail.config?.default != null && !isFlatJsonObject(detail.config.default) ? 'source' : 'kv',
        );
      } else {
        setJsonEditorMode('kv');
      }
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
        default_value: detail.field_type === 'json'
          ? (detail.config?.default ?? null)
          : (detail.config?.default || ''),
        max_length: detail.config?.maxLength || '',
        min_value: detail.config?.min || '',
        max_value: detail.config?.max || '',
        date_format: detail.config?.format || 'YYYY-MM-DD',
        time_format: detail.config?.format || 'HH:mm:ss',
        datetime_format: detail.config?.format || 'YYYY-MM-DD HH:mm:ss',
        textarea_rows: detail.config?.rows || 4,
        select_options: detail.config?.options ? JSON.stringify(detail.config.options, null, 2) : '',
        select_options_list: detail.config?.options?.map((o: { label?: string; value?: string }) => ({
          label: o?.label ?? '',
          value: o?.value ?? '',
        })) || [{ label: '', value: '' }],
        image_max_size: detail.config?.maxSize || '',
        image_allowed_types: detail.config?.allowedTypes ? detail.config.allowedTypes.join(',') : '',
        file_max_size: detail.config?.maxSize || '',
        file_allowed_types: detail.config?.allowedTypes ? detail.config.allowedTypes.join(',') : '',
        associated_table: detail.config?.associatedTable || '',
        associated_field: detail.config?.associatedField || '',
        source_field: buildSourceFieldKeyFromConfig({
          sourceField: detail.config?.sourceField,
          sourceFieldType: detail.config?.sourceFieldType,
        }) || '',
        match_field: detail.config?.matchField || 'code',
        return_field: detail.config?.returnField || 'id',
        attribute_field: detail.config?.attributeField || 'name',
        display_mode: detail.config?.displayMode || '',
        formula_expression: detail.config?.expression || '',
      });
    } catch (error: any) {
      messageApi.error(error.message || t('field.customField.fetchDetailFailed'));
    }
  };

  /**
   * 处理查看详情
   */
  const handleView = async (record: CustomField) => {
    const req = ++customFieldDetailReqRef.current;
    flushDrawerOpen(() => {
      setDrawerVisible(true);
      setDetailData(null);
      setDetailLoading(true);
    });
    try {
      const detail = await getCustomFieldByUuid(record.uuid);
      if (customFieldDetailReqRef.current !== req) return;
      setDetailData(detail);
    } catch (error: any) {
      if (customFieldDetailReqRef.current === req) {
        messageApi.error(error.message || t('field.customField.fetchDetailFailed'));
      }
    } finally {
      if (customFieldDetailReqRef.current === req) {
        setDetailLoading(false);
      }
    }
  };

  /**
   * 处理删除字段
   */
  const handleDelete = async (record: CustomField) => {
    try {
      await deleteCustomField(record.uuid);
      messageApi.success(t('pages.system.deleteSuccess'));
      actionRef.current?.reload();
      void loadTableFieldCounts();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.deleteFailed'));
    }
  };

  /**
   * 处理批量删除字段
   */
  const handleBatchDelete = async (keys: React.Key[]) => {
    try {
      let successCount = 0;
      let failCount = 0;
      const errors: string[] = [];

      for (const key of keys) {
        try {
          await deleteCustomField(key.toString());
          successCount++;
        } catch (error: any) {
          failCount++;
          errors.push(error.message || t('pages.system.deleteFailed'));
        }
      }

      if (successCount > 0) {
        messageApi.success(t('pages.system.deleteSuccess'));
      }
      if (failCount > 0) {
        messageApi.error(t('pages.system.deleteFailed') + (errors.length > 0 ? t('field.customField.errorDetailPrefix') + errors.join('; ') : ''));
      }

      setSelectedRowKeys([]);
      actionRef.current?.reload();
      void loadTableFieldCounts();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.deleteFailed'));
    }
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
        messageApi.error(t('field.customField.tableNameRequired'));
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
      } else if (fieldType === 'select' || fieldType === 'multiselect') {
        const list = values.select_options_list as Array<{ label?: string; value?: string }> | undefined;
        if (list && Array.isArray(list) && list.length > 0) {
          config.options = list
            .filter((item) => item?.label?.trim() || item?.value?.trim())
            .map((item) => ({
              label: String(item?.label ?? '').trim() || String(item?.value ?? ''),
              value: String(item?.value ?? '').trim() || String(item?.label ?? ''),
            }));
        }
      } else if (fieldType === 'image') {
        if (values.image_max_size) config.maxSize = parseInt(values.image_max_size);
        if (values.image_allowed_types) config.allowedTypes = values.image_allowed_types.split(',').map((t: string) => t.trim());
      } else if (fieldType === 'file') {
        if (values.file_max_size) config.maxSize = parseInt(values.file_max_size);
        if (values.file_allowed_types) config.allowedTypes = values.file_allowed_types.split(',').map((t: string) => t.trim());
      } else if (fieldType === 'associated_object') {
        if (values.associated_table) config.associatedTable = values.associated_table;
        if (values.display_mode) config.displayMode = values.display_mode;
        if (values.source_field) {
          const parsed = parseSourceFieldKey(values.source_field);
          if (parsed) {
            config.sourceField = parsed.name;
            config.sourceFieldType = parsed.scope;
          }
          if (values.match_field) config.matchField = values.match_field;
          if (values.return_field) config.returnField = values.return_field;
        } else if (values.associated_field) {
          config.associatedField = values.associated_field;
        }
      } else if (fieldType === 'associated_attribute') {
        if (values.associated_table) config.associatedTable = values.associated_table;
        if (values.display_mode) config.displayMode = values.display_mode;
        if (values.attribute_field) config.attributeField = values.attribute_field;
        const legacy = editingFieldConfigRef.current;
        if (legacy?.linkField) {
          config.linkField = legacy.linkField;
          if (legacy.linkFieldType) config.linkFieldType = legacy.linkFieldType;
          if (legacy.linkMatchField) config.linkMatchField = legacy.linkMatchField;
        }
      } else if (fieldType === 'formula') {
        if (values.formula_expression) config.expression = values.formula_expression;
      } else if (fieldType === 'textarea') {
        if (values.default_value) config.default = values.default_value;
        if (values.textarea_rows) config.rows = parseInt(values.textarea_rows);
      } else if (fieldType === 'json') {
        const normalizedDefault = normalizeJsonFieldValue(values.default_value);
        if (normalizedDefault != null) {
          config.default = normalizedDefault;
        }
      }

      // 移除配置相关字段
      const {
        default_value, max_length, min_value, max_value,
        date_format, time_format, datetime_format,
        textarea_rows, select_options, select_options_list,
        image_max_size, image_allowed_types,
        file_max_size, file_allowed_types,
        associated_table, associated_field, source_field, match_field, return_field,
        attribute_field, display_mode,
        formula_expression,
        ...fieldData
      } = values;

      if (isEdit && currentFieldUuid) {
        await updateCustomField(currentFieldUuid, {
          ...fieldData,
          config: Object.keys(config).length > 0 ? config : undefined,
        } as UpdateCustomFieldData);
        messageApi.success(t('pages.system.updateSuccess'));
      } else {
        await createCustomField({
          ...fieldData,
          config: Object.keys(config).length > 0 ? config : undefined,
        } as CreateCustomFieldData);
        messageApi.success(t('pages.system.createSuccess'));
      }

      setModalVisible(false);
      actionRef.current?.reload();
      void loadTableFieldCounts();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.deleteFailed'));
      throw error;
    } finally {
      setFormLoading(false);
    }
  };

  /**
   * 根据字段类型渲染配置表单
   */
  const sourceFieldOptions = useMemo(
    () =>
      buildSourceFieldSelectOptions(
        systemSourceFields,
        sameTableFields.filter((field) => field.field_type === 'text' || field.field_type === 'number'),
      ),
    [sameTableFields, systemSourceFields],
  );

  const sourceFieldSelectRenderers = useMemo(
    () => createSourceFieldSelectRenderers(sourceFieldOptions),
    [sourceFieldOptions],
  );

  const renderDisplayModeSegmented = (
    fieldKind: 'associated_object' | 'associated_attribute',
    hasSourceField: boolean,
  ) => (
    <div style={{ gridColumn: '1 / -1', width: '100%', minWidth: 0 }}>
      <ProFormItem
        name="display_mode"
        label={t('field.customField.displayMode')}
        initialValue={getAssociatedDisplayModeDefault(fieldKind, hasSourceField)}
        extra={
          fieldKind === 'associated_object'
            ? t('field.customField.displayModeAssociatedObjectExtra')
            : t('field.customField.displayModeAssociatedAttributeExtra')
        }
      >
        <AssociatedDisplayModeSegmented fieldKind={fieldKind} hasSourceField={hasSourceField} />
      </ProFormItem>
    </div>
  );

  const renderConfigFields = () => {
    switch (fieldType) {
      case 'text':
        return (
          <>
            <div style={{ gridColumn: '1 / -1', width: '100%', minWidth: 0 }}>
              <ProFormText
                name="default_value"
                label={t('field.customField.defaultValue')}
                placeholder={t('field.customField.defaultValuePlaceholder')}
              />
            </div>
            <div style={{ gridColumn: '1 / -1', width: '100%', minWidth: 0 }}>
              <ProFormDigit
                name="max_length"
                label={t('field.customField.maxLength')}
                placeholder={t('field.customField.maxLengthPlaceholder')}
                fieldProps={{ min: 1 }}
              />
            </div>
          </>
        );
      case 'number':
        return (
          <>
            <div style={{ gridColumn: '1 / -1', width: '100%', minWidth: 0 }}>
              <ProFormDigit
                name="default_value"
                label={t('field.customField.defaultValue')}
                placeholder={t('field.customField.defaultValuePlaceholder')}
              />
            </div>
            <div style={{ gridColumn: '1 / -1', width: '100%', minWidth: 0 }}>
              <ProFormDigit
                name="min_value"
                label={t('field.customField.minValue')}
                placeholder={t('field.customField.minValuePlaceholder')}
              />
            </div>
            <div style={{ gridColumn: '1 / -1', width: '100%', minWidth: 0 }}>
              <ProFormDigit
                name="max_value"
                label={t('field.customField.maxValue')}
                placeholder={t('field.customField.maxValuePlaceholder')}
              />
            </div>
          </>
        );
      case 'date':
        return (
          <>
            <div style={{ gridColumn: '1 / -1', width: '100%', minWidth: 0 }}>
              <ProFormText
                name="default_value"
                label={t('field.customField.defaultValue')}
                placeholder={t('field.customField.dateDefaultPlaceholder')}
              />
            </div>
            <div style={{ gridColumn: '1 / -1', width: '100%', minWidth: 0 }}>
              <ProFormText
                name="date_format"
                label={t('field.customField.dateFormat')}
                placeholder={t('field.customField.dateFormatPlaceholder')}
                initialValue="YYYY-MM-DD"
                extra={t('field.customField.dateFormatExtra')}
              />
            </div>
          </>
        );
      case 'time':
        return (
          <>
            <div style={{ gridColumn: '1 / -1', width: '100%', minWidth: 0 }}>
              <ProFormText
                name="default_value"
                label={t('field.customField.defaultValue')}
                placeholder={t('field.customField.timeDefaultPlaceholder')}
              />
            </div>
            <div style={{ gridColumn: '1 / -1', width: '100%', minWidth: 0 }}>
              <ProFormText
                name="time_format"
                label={t('field.customField.timeFormat')}
                placeholder={t('field.customField.timeFormatPlaceholder')}
                initialValue="HH:mm:ss"
                extra={t('field.customField.timeFormatExtra')}
              />
            </div>
          </>
        );
      case 'datetime':
        return (
          <>
            <div style={{ gridColumn: '1 / -1', width: '100%', minWidth: 0 }}>
              <ProFormText
                name="default_value"
                label={t('field.customField.defaultValue')}
                placeholder={t('field.customField.datetimeDefaultPlaceholder')}
              />
            </div>
            <div style={{ gridColumn: '1 / -1', width: '100%', minWidth: 0 }}>
              <ProFormText
                name="datetime_format"
                label={t('field.customField.datetimeFormat')}
                placeholder={t('field.customField.datetimeFormatPlaceholder')}
                initialValue="YYYY-MM-DD HH:mm:ss"
                extra={t('field.customField.datetimeFormatExtra')}
              />
            </div>
          </>
        );
      case 'select':
      case 'multiselect':
        return (
          <div style={{ gridColumn: '1 / -1', width: '100%', minWidth: 0 }}>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>{t('field.customField.selectOptions')}</div>
            <div style={{ fontSize: 12, color: token.colorTextSecondary, marginBottom: 8 }}>
              {t('field.customField.selectOptionsHint')}
            </div>
            <Form.List name="select_options_list">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...restField }) => (
                    <Space key={key} style={{ display: 'flex', marginBottom: 8, alignItems: 'flex-start' }} align="baseline">
                      <Form.Item
                        {...restField}
                        name={[name, 'label']}
                        rules={[{ required: true, message: t('field.customField.optionLabelRequired') }]}
                        style={{ marginBottom: 0, flex: 1, minWidth: 120 }}
                      >
                        <Input placeholder={t('field.customField.optionLabelPlaceholder')} size="small" />
                      </Form.Item>
                      <Form.Item
                        {...restField}
                        name={[name, 'value']}
                        rules={[{ required: true, message: t('field.customField.optionValueRequired') }]}
                        style={{ marginBottom: 0, flex: 1, minWidth: 100 }}
                      >
                        <Input placeholder={t('field.customField.optionValuePlaceholder')} size="small" />
                      </Form.Item>
                      <Button
                        type="text"
                        danger
                        size="small"
                        icon={<MinusCircleOutlined />}
                        onClick={() => remove(name)}
                        disabled={fields.length <= 1}
                        style={{ flexShrink: 0 }}
                      />
                    </Space>
                  ))}
                  <Button type="dashed" onClick={() => add()} block size="small" icon={<PlusOutlined />}>
                    {t('field.customField.addOption')}
                  </Button>
                </>
              )}
            </Form.List>
          </div>
        );
      case 'image':
        return (
          <>
            <div style={{ gridColumn: '1 / -1', width: '100%', minWidth: 0 }}>
              <ProFormDigit
                name="image_max_size"
                label={t('field.customField.imageMaxSize')}
                placeholder={t('field.customField.imageMaxSizePlaceholder')}
                fieldProps={{ min: 1 }}
                extra={t('field.customField.imageMaxSizeExtra')}
              />
            </div>
            <div style={{ gridColumn: '1 / -1', width: '100%', minWidth: 0 }}>
              <ProFormText
                name="image_allowed_types"
                label={t('field.customField.allowedTypes')}
                placeholder={t('field.customField.allowedTypesImagePlaceholder')}
                extra={t('field.customField.allowedTypesExtra') + '，' + t('field.customField.allowedTypesImagePlaceholder')}
              />
            </div>
          </>
        );
      case 'file':
        return (
          <>
            <div style={{ gridColumn: '1 / -1', width: '100%', minWidth: 0 }}>
              <ProFormDigit
                name="file_max_size"
                label={t('field.customField.fileMaxSize')}
                placeholder={t('field.customField.fileMaxSizePlaceholder')}
                fieldProps={{ min: 1 }}
                extra={t('field.customField.fileMaxSizeExtra')}
              />
            </div>
            <div style={{ gridColumn: '1 / -1', width: '100%', minWidth: 0 }}>
              <ProFormText
                name="file_allowed_types"
                label={t('field.customField.allowedTypes')}
                placeholder={t('field.customField.allowedTypesFilePlaceholder')}
                extra={t('field.customField.allowedTypesExtra') + '，' + t('field.customField.allowedTypesFilePlaceholder')}
              />
            </div>
          </>
        );
      case 'associated_object':
        return (
          <>
            <div style={{ gridColumn: '1 / -1', width: '100%', minWidth: 0 }}>
              <SafeProFormSelect
                name="source_field"
                label={t('field.customField.sourceField')}
                options={sourceFieldOptions}
                placeholder={t('field.customField.sourceFieldPlaceholder')}
                extra={t('field.customField.sourceFieldExtra')}
                fieldProps={{
                  allowClear: true,
                  optionRender: sourceFieldSelectRenderers.optionRender,
                  labelRender: sourceFieldSelectRenderers.labelRender,
                  onChange: () => {
                    formRef.current?.setFieldsValue({
                      match_field: 'code',
                      return_field: 'id',
                    });
                  },
                }}
              />
            </div>
            <div style={{ gridColumn: '1 / -1', width: '100%', minWidth: 0 }}>
              <SafeProFormSelect
                name="associated_table"
                label={t('field.customField.associatedTable')}
                rules={[{ required: true, message: t('field.customField.associatedTableRequired') }]}
                options={getTableNameOptions(displayPageConfigs)}
                placeholder={t('field.customField.associatedTablePlaceholder')}
                extra={t('field.customField.associatedTableExtra')}
                fieldProps={{
                  onChange: () => {
                    formRef.current?.setFieldsValue({
                      associated_field: undefined,
                      match_field: 'code',
                      attribute_field: 'name',
                    });
                  },
                }}
              />
            </div>
            <ProFormDependency name={['source_field', 'associated_table']}>
              {({ source_field, associated_table }) => (
                <>
                  {source_field ? (
                  <>
                    <div style={{ gridColumn: '1 / -1', width: '100%', minWidth: 0 }}>
                      <AssociatedTableModelFieldSelect
                        name="match_field"
                        label={t('field.customField.matchField')}
                        tableName={associated_table as string | undefined}
                        rules={[{ required: true, message: t('field.customField.matchFieldRequired') }]}
                        placeholder={t('field.customField.matchFieldPlaceholder')}
                        extra={t('field.customField.matchFieldExtra')}
                      />
                    </div>
                    <div style={{ gridColumn: '1 / -1', width: '100%', minWidth: 0 }}>
                      <AssociatedTableModelFieldSelect
                        name="return_field"
                        label={t('field.customField.returnField')}
                        tableName={associated_table as string | undefined}
                        rules={[{ required: true, message: t('field.customField.returnFieldRequired') }]}
                        placeholder={t('field.customField.returnFieldPlaceholder')}
                        extra={t('field.customField.returnFieldExtra')}
                        initialValue="id"
                      />
                    </div>
                  </>
                  ) : (
                  <div style={{ gridColumn: '1 / -1', width: '100%', minWidth: 0 }}>
                    <AssociatedTableModelFieldSelect
                      name="associated_field"
                      label={t('field.customField.associatedField')}
                      tableName={associated_table as string | undefined}
                      rules={[{ required: true, message: t('field.customField.associatedFieldRequired') }]}
                      placeholder={t('field.customField.associatedFieldPlaceholder')}
                      extra={t('field.customField.associatedFieldDropdownExtra')}
                    />
                  </div>
                  )}
                  {renderDisplayModeSegmented('associated_object', Boolean(source_field))}
                </>
              )}
            </ProFormDependency>
          </>
        );
      case 'associated_attribute':
        return (
          <>
            <div style={{ gridColumn: '1 / -1', width: '100%', minWidth: 0 }}>
              <SafeProFormSelect
                name="associated_table"
                label={t('field.customField.associatedTable')}
                rules={[{ required: true, message: t('field.customField.associatedTableRequired') }]}
                options={getTableNameOptions(displayPageConfigs)}
                placeholder={t('field.customField.associatedTablePlaceholder')}
                extra={t('field.customField.associatedAttributeTableExtra')}
                fieldProps={{
                  onChange: () => {
                    formRef.current?.setFieldsValue({ attribute_field: 'name' });
                  },
                }}
              />
            </div>
            <div style={{ gridColumn: '1 / -1', width: '100%', minWidth: 0 }}>
              <ProFormDependency name={['associated_table']}>
                {({ associated_table }) => (
                  <AssociatedTableModelFieldSelect
                    name="attribute_field"
                    label={t('field.customField.attributeField')}
                    tableName={associated_table as string | undefined}
                    rules={[{ required: true, message: t('field.customField.attributeFieldRequired') }]}
                    placeholder={t('field.customField.attributeFieldPlaceholder')}
                    extra={t('field.customField.attributeFieldExtra')}
                    initialValue="name"
                  />
                )}
              </ProFormDependency>
            </div>
            <div style={{ gridColumn: '1 / -1', width: '100%', minWidth: 0 }}>
              {renderDisplayModeSegmented('associated_attribute', false)}
            </div>
          </>
        );
      case 'textarea':
        return (
          <>
            <div style={{ gridColumn: '1 / -1', width: '100%', minWidth: 0 }}>
              <ProFormTextArea
                name="default_value"
                label={t('field.customField.defaultValue')}
                placeholder={t('field.customField.defaultValuePlaceholder')}
                fieldProps={{ rows: 3 }}
              />
            </div>
            <div style={{ gridColumn: '1 / -1', width: '100%', minWidth: 0 }}>
              <ProFormDigit
                name="textarea_rows"
                label={t('field.customField.textareaRows')}
                placeholder={t('field.customField.textareaRowsPlaceholder')}
                fieldProps={{ min: 1, max: 20 }}
                initialValue={4}
              />
            </div>
          </>
        );
      case 'json':
        return (
          <div style={{ gridColumn: '1 / -1', width: '100%', minWidth: 0 }}>
            <ProFormItem name="default_value" noStyle>
              <CustomFieldJsonEditor
                placeholder={t('field.customField.defaultValueJsonPlaceholder')}
                showModeToggle={false}
                mode={jsonEditorMode}
                onModeChange={setJsonEditorMode}
              />
            </ProFormItem>
          </div>
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
      title: t('field.customField.name'),
      dataIndex: 'name',
      width: 150,
      fixed: 'left',
    },
    {
      title: t('field.customField.code'),
      dataIndex: 'code',
      width: 150,
    },
    {
      title: t('field.customField.tableName'),
      dataIndex: 'table_name',
      width: 150,
      hideInTable: true,
    },
    {
      title: t('field.customField.fieldType'),
      dataIndex: 'field_type',
      width: 120,
      valueType: 'select',
      valueEnum: {
        text: { text: t('field.customField.typeText'), status: 'Default' },
        number: { text: t('field.customField.typeNumber'), status: 'Processing' },
        image: { text: t('field.customField.typeImage'), status: 'Success' },
        file: { text: t('field.customField.typeFile'), status: 'Warning' },
        date: { text: t('field.customField.typeDate'), status: 'Success' },
        time: { text: t('field.customField.typeTime'), status: 'Success' },
        datetime: { text: t('field.customField.typeDatetime'), status: 'Success' },
        select: { text: t('field.customField.typeSelect'), status: 'Warning' },
        multiselect: { text: t('field.customField.typeMultiselect'), status: 'Warning' },
        associated_object: { text: t('field.customField.typeAssociatedObject'), status: 'Processing' },
        associated_attribute: { text: t('field.customField.typeAssociatedAttribute'), status: 'Processing' },
        formula: { text: t('field.customField.typeFormula'), status: 'Error' },
        textarea: { text: t('field.customField.typeTextarea'), status: 'Error' },
        json: { text: t('field.customField.typeJson'), status: 'Default' },
      },
      render: (_, record) => {
        const typeMap: Record<string, { color: string; textKey: string }> = {
          text: { color: 'default', textKey: 'field.customField.typeText' },
          number: { color: 'blue', textKey: 'field.customField.typeNumber' },
          image: { color: 'green', textKey: 'field.customField.typeImage' },
          file: { color: 'orange', textKey: 'field.customField.typeFile' },
          date: { color: 'green', textKey: 'field.customField.typeDate' },
          time: { color: 'cyan', textKey: 'field.customField.typeTime' },
          datetime: { color: 'blue', textKey: 'field.customField.typeDatetime' },
          select: { color: 'orange', textKey: 'field.customField.typeSelect' },
          multiselect: { color: 'purple', textKey: 'field.customField.typeMultiselect' },
          associated_object: { color: 'geekblue', textKey: 'field.customField.typeAssociatedObject' },
          associated_attribute: { color: 'purple', textKey: 'field.customField.typeAssociatedAttribute' },
          formula: { color: 'red', textKey: 'field.customField.typeFormula' },
          textarea: { color: 'red', textKey: 'field.customField.typeTextarea' },
          json: { color: 'purple', textKey: 'field.customField.typeJson' },
        };
        const typeInfo = typeMap[record.field_type] || { color: 'default', textKey: record.field_type };
        return <Tag color={typeInfo.color}>{t(typeInfo.textKey)}</Tag>;
      },
    },
    {
      title: t('field.customField.label'),
      dataIndex: 'label',
      width: 150,
      hideInSearch: true,
    },
    {
      title: t('field.customField.isRequired'),
      dataIndex: 'is_required',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: t('field.customField.yes'), status: 'Success' },
        false: { text: t('field.customField.no'), status: 'Default' },
      },
      render: (_, record) => (
        <Tag color={record.is_required ? 'success' : 'default'}>
          {record.is_required ? t('field.customField.yes') : t('field.customField.no')}
        </Tag>
      ),
    },
    {
      title: t('field.customField.sortOrder'),
      dataIndex: 'sort_order',
      width: 80,
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t('field.customField.status'),
      dataIndex: 'is_active',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: t('field.customField.enabled'), status: 'Success' },
        false: { text: t('field.customField.disabled'), status: 'Default' },
      },
      render: (_, record) => (
        <Tag color={record.is_active ? 'success' : 'default'}>
          {record.is_active ? t('field.customField.enabled') : t('field.customField.disabled')}
        </Tag>
      ),
    },
    {
      title: t('field.customField.createdAt'),
      dataIndex: 'created_at',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t('common.actions'),
      valueType: 'option',
      fixed: 'right',
      render: (_, record) => [
            <Button {...rowActionKind('read')} key="view" onClick={() => handleView(record)}>
              {t('field.customField.view')}
            </Button>,
            <Button {...rowActionKind('update')} key="edit" onClick={() => handleEdit(record)}>
              {t('field.customField.edit')}
            </Button>,
            <Popconfirm {...rowActionKind('delete')} key="delete" title={t('field.customField.deleteConfirm')} onConfirm={() => handleDelete(record)}>
              <Button type="link" danger size="small" icon={<DeleteOutlined />}>
                {t('field.customField.delete')}
              </Button>
            </Popconfirm>,
          ],
    },
  ];

  // 获取过滤后的页面列表和选中的页面配置
  const filteredPages = React.useMemo(() => {
    if (!pageSearchValue) return displayPageConfigs;
    const searchLower = pageSearchValue.toLowerCase();
    return (displayPageConfigs || []).filter(
      page =>
        page.pageName.toLowerCase().includes(searchLower) ||
        page.pagePath.toLowerCase().includes(searchLower) ||
        page.tableName.toLowerCase().includes(searchLower)
    );
  }, [displayPageConfigs, pageSearchValue]);

  const selectedPage = React.useMemo(() => {
    if (!selectedPageCode) return null;
    return displayPageConfigs.find(page => page.pageCode === selectedPageCode) || null;
  }, [displayPageConfigs, selectedPageCode]);

  const modules = React.useMemo(() => {
    return Array.from(new Set(displayPageConfigs.map(p => p.module)));
  }, [displayPageConfigs]);

  /**
   * 详情列定义
   */
  const detailColumns = [
    { title: t('field.customField.name'), dataIndex: 'name' },
    { title: t('field.customField.code'), dataIndex: 'code' },
    { title: t('field.customField.tableNameLabel'), dataIndex: 'table_name' },
    { title: t('field.customField.fieldType'), dataIndex: 'field_type' },
    { title: t('field.customField.label'), dataIndex: 'label' },
    { title: t('field.customField.placeholder'), dataIndex: 'placeholder' },
    {
      title: t('field.customField.config'),
      dataIndex: 'config',
      render: (_: any, entity: CustomField) => (
        <pre style={{
          margin: 0,
          padding: '8px',
          backgroundColor: '#f5f5f5',
          borderRadius: '4px',
          overflow: 'auto',
          maxHeight: '300px',
        }}>
          {JSON.stringify(entity?.config || {}, null, 2)}
        </pre>
      ),
    },
    {
      title: t('field.customField.isRequired'),
      dataIndex: 'is_required',
      render: (_: any, entity: CustomField) => (
        <Tag color={entity?.is_required ? 'success' : 'default'}>
          {entity?.is_required ? t('field.customField.yes') : t('field.customField.no')}
        </Tag>
      ),
    },
    {
      title: t('field.customField.isSearchable'),
      dataIndex: 'is_searchable',
      render: (_: any, entity: CustomField) => (
        <Tag color={entity?.is_searchable ? 'success' : 'default'}>
          {entity?.is_searchable ? t('field.customField.yes') : t('field.customField.no')}
        </Tag>
      ),
    },
    {
      title: t('field.customField.isSortable'),
      dataIndex: 'is_sortable',
      render: (_: any, entity: CustomField) => (
        <Tag color={entity?.is_sortable ? 'success' : 'default'}>
          {entity?.is_sortable ? t('field.customField.yes') : t('field.customField.no')}
        </Tag>
      ),
    },
    { title: t('field.customField.sortOrderLabel'), dataIndex: 'sort_order' },
    {
      title: t('field.customField.status'),
      dataIndex: 'is_active',
      render: (_: any, entity: CustomField) => (
        <Tag color={entity?.is_active ? 'success' : 'default'}>
          {entity?.is_active ? t('field.customField.enabled') : t('field.customField.disabled')}
        </Tag>
      ),
    },
    { title: t('field.customField.createdAt'), dataIndex: 'created_at', valueType: 'dateTime' as const },
    { title: t('field.customField.updatedAt'), dataIndex: 'updated_at', valueType: 'dateTime' as const },
  ];

  return (
    <>
      <div
        className="custom-field-management-page"
        style={{
          display: 'flex',
          height: '100%',
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
          {/* 左侧功能页面列表：固定宽度不参与收缩，由右侧区域伸缩（与编号规则页一致） */}
          <div
            style={{
              width: '300px',
              minWidth: '300px',
              flexShrink: 0,
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
                placeholder={t('field.customField.searchPagePlaceholder')}
                prefix={<SearchOutlined />}
                value={pageSearchValue}
                onChange={(e) => setPageSearchValue(e.target.value)}
                allowClear
                size="middle"
              />
            </div>

            {/* 功能页面列表 */}
            <div className="scrollbar-like-modal" style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '8px' }}>
              {pageConfigsLoading ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <Spin size="large" />
                  <div style={{ marginTop: '16px', color: token.colorTextSecondary }}>
                    {t('field.customField.loadingPageConfig')}
                  </div>
                </div>
              ) : (
                modules.map(module => {
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
                        const fieldCount = tableFieldCounts[page.tableName] || 0;
                        return (
                          <div
                            key={page.pageCode}
                            onClick={() => setSelectedPageCode(page.pageCode)}
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
                              gap: 8,
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
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  fontWeight: isSelected ? 500 : 400,
                                  marginBottom: '4px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                }}
                              >
                                <span style={{ minWidth: 0 }}>{page.pageName}</span>
                                {fieldCount > 0 ? (
                                  <Tooltip title={t('field.customField.sidebarCountTitle', { count: fieldCount })}>
                                    <Badge
                                      count={fieldCount}
                                      size="small"
                                      color={token.colorPrimary}
                                      style={{ flexShrink: 0 }}
                                    />
                                  </Tooltip>
                                ) : null}
                              </div>
                              <div style={{ fontSize: '12px', color: token.colorTextSecondary }}>
                                {page.tableNameLabel}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 右侧配置区域：占据剩余空间，不足时可收缩并滚动（与编号规则页一致） */}
          <div
            style={{
              flex: 1,
              minWidth: 0,
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
                    borderBottom: `1px solid ${token.colorBorderSecondary}`,
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
                </div>

                {/* 字段列表 */}
                <div className="scrollbar-like-modal" style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '24px' }}>
                  <UniTable<CustomField>
                    columnPersistenceId="pages.system.custom-fields.list"
                    actionRef={actionRef}
                    params={{ table_name: selectedPage.tableName }}
                    columns={columns}
                    request={async (params, _sort, _filter) => {
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
                        console.error('Failed to fetch custom fields:', error);
                        messageApi.error(error?.message || t('field.customField.listFetchFailed'));
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
                    showAdvancedSearch={true}
                    showCreateButton
                    createButtonText={t('field.customField.createButton')}
                    onCreate={handleCreate}
                    enableRowSelection
                    onRowSelectionChange={setSelectedRowKeys}
                    showDeleteButton
                    onDelete={handleBatchDelete}
                    deleteButtonText={t('field.customField.batchDeleteButton')}
                    deleteConfirmTitle={t('field.customField.batchDeleteConfirmTitle')}
                    deleteConfirmDescription={(c) => t('field.customField.batchDeleteConfirmDescription', { count: c })}
                    showImportButton={false}
                    showExportButton={true}
                    onExport={async (type, keys, pageData) => {
                      if (!selectedPage) return;
                      try {
                        const res = await getCustomFieldList({
                          page: 1,
                          page_size: 10000,
                          table_name: selectedPage.tableName,
                        });
                        let items = res.items || [];
                        if (type === 'currentPage' && pageData?.length) {
                          items = pageData;
                        } else if (type === 'selected' && keys?.length) {
                          items = items.filter((d) => keys.includes(d.uuid));
                        }
                        if (items.length === 0) {
                          messageApi.warning(t('field.customField.exportNoData'));
                          return;
                        }
                        const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `custom-fields-${selectedPage.tableName}-${new Date().toISOString().slice(0, 10)}.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                        messageApi.success(t('field.customField.exportSuccess', { count: items.length }));
                      } catch (error: any) {
                        messageApi.error(error?.message || t('pages.system.deleteFailed'));
                      }
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
                {t('field.customField.selectPageHint')}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 创建/编辑字段 Modal */}
      <FormModalTemplate
        title={isEdit ? t('field.customField.editTitle') : t('field.customField.createTitle')}
        open={modalVisible}
        onClose={() => setModalVisible(false)}
        onFinish={handleSubmit}
        isEdit={isEdit}
        loading={formLoading}
        width={fieldType === 'formula' ? MODAL_CONFIG.LARGE_WIDTH : MODAL_CONFIG.STANDARD_WIDTH}
        formRef={formRef}
        grid
        onValuesChange={(changed) => {
          if ('field_type' in changed && changed.field_type) {
            setFieldType(changed.field_type);
            if (changed.field_type === 'json') setJsonEditorMode('kv');
          }
        }}
      >
          <ProFormText
            name="code"
            label={t('field.customField.code')}
            rules={[{ required: true, message: t('field.customField.codeRequired') }]}
            placeholder={t('field.customField.codePlaceholder')}
            disabled={isEdit}
            extra={t('field.customField.codeExtra')}
            colProps={{ span: 12 }}
          />
          <ProFormText
            name="name"
            label={t('field.customField.name')}
            rules={[{ required: true, message: t('field.customField.nameRequired') }]}
            placeholder={t('field.customField.namePlaceholder')}
            colProps={{ span: 12 }}
          />
          <ProFormText
            name="table_name"
            label={t('field.customField.tableNameLabel')}
            placeholder={t('field.customField.tableNamePlaceholder')}
            disabled={true}
            initialValue={selectedPage?.tableName || ''}
            extra={isEdit ? t('field.customField.tableNameExtraEdit') : t('field.customField.tableNameExtraCreate')}
            colProps={{ span: 12 }}
          />
          <SafeProFormSelect
            name="field_type"
            label={t('field.customField.fieldType')}
            rules={[{ required: true, message: t('field.customField.fieldTypeRequired') }]}
            options={[
              { label: t('field.customField.typeText'), value: 'text' },
              { label: t('field.customField.typeNumber'), value: 'number' },
              { label: t('field.customField.typeImage'), value: 'image' },
              { label: t('field.customField.typeFile'), value: 'file' },
              { label: t('field.customField.typeDate'), value: 'date' },
              { label: t('field.customField.typeTime'), value: 'time' },
              { label: t('field.customField.typeDatetime'), value: 'datetime' },
              { label: t('field.customField.typeSelect'), value: 'select' },
              { label: t('field.customField.typeMultiselect'), value: 'multiselect' },
              { label: t('field.customField.typeAssociatedObject'), value: 'associated_object' },
              { label: t('field.customField.typeAssociatedAttribute'), value: 'associated_attribute' },
              { label: t('field.customField.typeFormula'), value: 'formula' },
              { label: t('field.customField.typeTextarea'), value: 'textarea' },
              { label: t('field.customField.typeJson'), value: 'json' },
            ]}
            fieldProps={{
              onChange: (value: any) => {
                setFieldType(value);
                if (value === 'json') setJsonEditorMode('kv');
              },
            }}
            disabled={isEdit}
            colProps={{ span: 12 }}
          />
          <ProFormText
            name="label"
            label={t('field.customField.label')}
            placeholder={t('field.customField.labelPlaceholder')}
            colProps={{ span: 8 }}
          />
          <ProFormText
            name="placeholder"
            label={t('field.customField.placeholder')}
            placeholder={t('field.customField.placeholderPlaceholder')}
            colProps={{ span: 8 }}
          />
          <ProFormDigit
            name="sort_order"
            label={t('field.customField.sortOrderLabel')}
            fieldProps={{ min: 0 }}
            colProps={{ span: 8 }}
          />
          <Row style={{ width: '100%', marginBottom: 16 }}>
            <Col span={24} style={{ paddingLeft: 8, paddingRight: 8, boxSizing: 'border-box' }}>
              <div
                style={{
                  padding: '16px',
                  backgroundColor: token.colorFillAlter || '#fafafa',
                  borderRadius: token.borderRadius,
                  border: `1px solid ${token.colorBorder}`,
                  width: '100%',
                  minWidth: 0,
                  boxSizing: 'border-box',
                }}
              >
                {fieldType === 'json' ? (
                  <Row align="middle" gutter={16} style={{ marginBottom: 12 }}>
                    <Col span={16}>
                      <span style={{ fontWeight: 500 }}>{t('field.customField.config')}</span>
                    </Col>
                    <Col span={8} style={{ textAlign: 'right' }}>
                      <CustomFieldJsonModeSegmented mode={jsonEditorMode} onChange={setJsonEditorMode} />
                    </Col>
                  </Row>
                ) : (
                  <>
                    <div style={{ marginBottom: 12, fontWeight: 500 }}>{t('field.customField.config')}</div>
                    {fieldType === 'associated_object' ? (
                      <div style={{ marginBottom: 12, color: token.colorTextSecondary, fontSize: 13 }}>
                        {t('field.customField.typeAssociatedObjectDesc')}
                      </div>
                    ) : null}
                    {fieldType === 'associated_attribute' ? (
                      <div style={{ marginBottom: 12, color: token.colorTextSecondary, fontSize: 13 }}>
                        {t('field.customField.typeAssociatedAttributeDesc')}
                      </div>
                    ) : null}
                  </>
                )}
                {fieldType === 'formula' ? (
                  <ProFormDependency name={['table_name', 'code']}>
                    {({ table_name, code }) => (
                      <ProFormItem name="formula_expression" style={{ marginBottom: 0 }}>
                        <CustomFieldFormulaConfigEditor
                          tableName={(table_name as string) || selectedPage?.tableName || ''}
                          excludeFieldCode={code as string | undefined}
                        />
                      </ProFormItem>
                    )}
                  </ProFormDependency>
                ) : (
                  <Row gutter={[16, 16]}>
                    <Col span={24}>{renderConfigFields()}</Col>
                  </Row>
                )}
              </div>
            </Col>
          </Row>
          <ProFormSwitch
            name="is_required"
            label={t('field.customField.isRequired')}
            colProps={{ span: 6 }}
          />
          <ProFormSwitch
            name="is_searchable"
            label={t('field.customField.isSearchable')}
            colProps={{ span: 6 }}
          />
          <ProFormSwitch
            name="is_sortable"
            label={t('field.customField.isSortable')}
            colProps={{ span: 6 }}
          />
          <ProFormSwitch
            name="is_active"
            label={t('field.customField.isActiveLabel')}
            colProps={{ span: 6 }}
          />
      </FormModalTemplate>

      {/* 查看详情 Drawer */}
      <UniDetail
        title={t('field.customField.detailTitle')}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        basic={detailData ? (
            <Descriptions column={1} items={detailDrawerDescriptionItems(detailColumns, detailData)} />
          ) : null}
      />
    </>
  );
};

export default CustomFieldListPage;
