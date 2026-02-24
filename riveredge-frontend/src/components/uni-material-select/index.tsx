import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Form, App } from 'antd';
import { useDebounceFn } from 'ahooks';
import { useNavigate } from 'react-router-dom';
import { Material } from '../../apps/master-data/types/material';
import { materialApi } from '../../apps/master-data/services/material';
import { UniDropdown } from '../uni-dropdown';
import { NamePath } from 'antd/es/form/interface';

/** 从物料对象获取字段值，兼容 API 返回的 snake_case（如 main_code）与 camelCase（如 mainCode） */
function getMaterialField(m: Record<string, any>, field: string): any {
  let v = m[field];
  if (v !== undefined && v !== null) return v;
  const snake = field.replace(/([A-Z])/g, '_$1').toLowerCase();
  return m[snake];
}

interface UniMaterialSelectProps {
  /** 表单字段名称 */
  name: NamePath;
  /** 标签 */
  label?: string;
  /** 占位符 */
  placeholder?: string;
  /** 是否必填 */
  required?: boolean;
  /** 禁用状态 */
  disabled?: boolean;
  /** 是否只读模式 */
  readonly?: boolean;
  /** 指定要回填的字段映射配置，配置键为当前上下文下的相对字段名（如在 List 内为兄弟字段），值为 Material 对象上的属性名 */
  fillMapping?: Record<string, keyof Material>;
  /** 只展示启用的物料，默认为 true */
  activeOnly?: boolean;
  /** 初始绑定的表单实例（通常可以从外层 ProForm / Form 自动获取，也可手动传入） */
  formItemProps?: any;
  /** 组件所在的是否是 Form.List 的子项？如果是，请传递该行的 field.name 以便计算回填路径 */
  listFieldKey?: number | string;
  /** Form.List 的 name（当在 Form.List 内时，用于 fillMapping 的 setFieldValue 完整路径） */
  listFieldName?: string;
  /** 尺寸 */
  size?: 'large' | 'middle' | 'small';
  /** 是否显示快速新建入口（跳转物料管理） */
  showQuickCreate?: boolean;
  /** 是否显示高级搜索 */
  showAdvancedSearch?: boolean;
  /** 编辑时预填值对应的选项（当物料不在默认列表中时用于展示） */
  fallbackOption?: { value: number; label: string };
  onChange?: (value: number | undefined, material: Material | undefined) => void;
}

/**
 * 统一物料选择组件
 * 
 * @description
 * 1. 自动防抖搜索物料 (名称/编码/规格/拼音)
 * 2. 选中物料后，根据 fillMapping 自动向当前的 Form 实例回填物料详情（如名、编码、图号等）
 * 3. 完美兼容 ProForm 和标准 Antd Form 以及 Form.List 动态增减行上下文
 */
export const UniMaterialSelect: React.FC<UniMaterialSelectProps> = ({
  name,
  label = '物料名称',
  placeholder = '请选择物料（支持名称/编码搜索）',
  required = false,
  disabled = false,
  readonly = false,
  fillMapping = {
    mainCode: 'mainCode',
    name: 'name',
    specification: 'specification',
    baseUnit: 'baseUnit',
  },
  activeOnly = true,
  listFieldKey,
  listFieldName,
  size = 'middle',
  showQuickCreate = true,
  showAdvancedSearch = true,
  fallbackOption,
  onChange,
  formItemProps,
  ...restProps
}) => {
  const form = Form.useFormInstance();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [data, setData] = useState<Material[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchMaterials = async (searchText: string = '') => {
    setLoading(true);
    try {
      const response: any = await materialApi.list({
        keyword: searchText,
        isActive: activeOnly ? true : undefined,
        limit: 200,
      });
      setData(response?.data || response?.items || response || []);
    } catch (error) {
      console.error('Failed to fetch materials:', error);
      message.error('加载物料列表失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const { run: debounceFetch } = useDebounceFn(
    (value: string) => fetchMaterials(value),
    { wait: 300 }
  );

  useEffect(() => {
    fetchMaterials();
  }, []);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const handleChange = (val: number | undefined, _option: any) => {
    const selectedMaterial = val ? data.find((m) => m.id === val) : undefined;

    if (onChangeRef.current) {
      onChangeRef.current(val, selectedMaterial);
    }

    if (selectedMaterial && fillMapping && form) {
      const isListContext = listFieldKey !== undefined && listFieldKey !== null;

      Object.entries(fillMapping).forEach(([targetField, sourceField]) => {
        let sourceValue = getMaterialField(selectedMaterial as any, sourceField);
        if (typeof sourceValue === 'object' && sourceValue !== null) {
          sourceValue = (sourceValue as any).unit_name || (sourceValue as any).name || sourceValue;
        }

        if (isListContext && listFieldName != null) {
          form.setFieldValue([listFieldName, listFieldKey, targetField], sourceValue);
        } else if (isListContext && Array.isArray(name)) {
          form.setFieldValue([...name.slice(0, -1), targetField], sourceValue);
        } else {
          form.setFieldValue(targetField, sourceValue);
        }
      });
    }
  };

  // Form.Item 会合并子组件的 onChange（先 trigger 再 child.onChange），因此 mergedOnChange 会被调用
  // 不再在此处 setFieldValue，由 Form.Item 的 trigger 负责更新表单；getValueFromEvent 负责规范化存储为 number
  const mergedOnChange = (val: number | undefined, opt: any) => {
    const numVal = val != null && val !== '' ? Number(val) : undefined;
    handleChange(numVal, opt);
  };

  const options = useMemo(() => {
    const opts = data.map((item) => {
      const code = getMaterialField(item as any, 'mainCode') || getMaterialField(item as any, 'code') || '';
      const nameVal = getMaterialField(item as any, 'name') || '';
      return {
        label: `${code} - ${nameVal}`.trim() || String(item.id),
        value: item.id,
      };
    });
    if (fallbackOption && !opts.some((o) => o.value === fallbackOption.value)) {
      opts.unshift(fallbackOption);
    }
    return opts;
  }, [data, fallbackOption]);

  return (
    <Form.Item
      name={name}
      label={label || undefined}
      rules={required ? [{ required: true, message: `请选择${label || '物料'}` }] : undefined}
      validateTrigger={['onChange', 'onBlur']}
      getValueFromEvent={(val: any) => (val != null && val !== '' ? Number(val) : undefined)}
      getValueProps={(v: any) => ({ value: v != null && v !== '' ? Number(v) : undefined })}
      style={{ margin: 0, ...formItemProps?.style }}
      {...formItemProps}
    >
      <UniDropdown
        placeholder={placeholder}
        allowClear
        showSearch
        loading={loading}
        disabled={disabled}
        size={size}
        style={{ width: '100%' }}
        options={options}
        filterOption={false}
        onSearch={debounceFetch}
        onChange={mergedOnChange}
        quickCreate={
          showQuickCreate
            ? {
                label: '物料管理',
                onClick: () => navigate('/apps/master-data/materials'),
              }
            : undefined
        }
        advancedSearch={
          showAdvancedSearch
            ? {
                label: '高级搜索',
                fields: [
                  { name: 'mainCode', label: '物料编码' },
                  { name: 'name', label: '物料名称' },
                  { name: 'specification', label: '规格' },
                ],
                onSearch: async (values) => {
                  const kw = [values.mainCode, values.name, values.specification].filter(Boolean).join(' ').trim();
                  const list = await materialApi.list({
                    limit: 200,
                    isActive: activeOnly ? true : undefined,
                    ...(kw && { keyword: kw }),
                  });
                  const items = list || [];
                  return items.map((m) => {
                    const code = getMaterialField(m as any, 'mainCode') || getMaterialField(m as any, 'code') || '';
                    const nameVal = getMaterialField(m as any, 'name') || '';
                    return {
                      value: m.id,
                      label: `${code} - ${nameVal}`.trim() || String(m.id),
                    };
                  });
                },
              }
            : undefined
        }
        {...restProps}
      />
    </Form.Item>
  );
};

export default UniMaterialSelect;
