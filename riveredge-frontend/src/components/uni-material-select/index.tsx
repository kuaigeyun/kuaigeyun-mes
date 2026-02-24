import React, { useMemo, useState, useEffect } from 'react';
import { Form, App } from 'antd';
import { useDebounceFn } from 'ahooks';
import { Material } from '../../apps/master-data/types/material';
import { materialApi } from '../../apps/master-data/services/material';
import { ProFormSelect } from '@ant-design/pro-components';
import { NamePath } from 'antd/es/form/interface';

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
  placeholder = '请选择物料 (支持名称 / 编码搜索)',
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
  onChange,
  ...restProps
}) => {
  const form = Form.useFormInstance();
  const { message } = App.useApp();
  const [data, setData] = useState<Material[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchMaterials = async (searchText: string = '') => {
    setLoading(true);
    try {
      const response: any = await materialApi.list({
        keyword: searchText,
      });
      setData(response.data || response.items || response || []);
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
    // 初始加载一次默认数据
    fetchMaterials();
  }, []);

  const handleChange = (val: number, _option: any) => {
    const selectedMaterial = data.find((m) => m.id === val);

    // 触发外部回调
    if (onChange) {
      onChange(val, selectedMaterial);
    }

    // 处理回填映射
    if (selectedMaterial && fillMapping && form) {
      const isListContext = listFieldKey !== undefined && listFieldKey !== null;
      const updates: Record<string, any> = {};

      Object.entries(fillMapping).forEach(([targetField, sourceField]) => {
        // 构建最终的回填路径
        const fieldPath: string[] = [];
        
        if (isListContext) {
          // 如果是在 List 中，需要拼接外层的数组 name 和子项 index
          if (Array.isArray(name)) {
            // [ 'items', 0, 'material_id' ] -> 我们取前面部分作为列表根路径
            const basePath = name.slice(0, -1);
            fieldPath.push(...basePath, targetField);
          } else {
             //  fallback 对于无法推断的场景，可能不是标准 ProFormItem 设计
            fieldPath.push(targetField);
          }
        } else {
           fieldPath.push(targetField);
        }

        // 处理特殊属性值的映射获取
        let sourceValue = selectedMaterial[sourceField as keyof Material];
        
        // 由于可能直接绑定主单位/销售单位对象，做一个兼容提取
        if (typeof sourceValue === 'object' && sourceValue !== null) {
          sourceValue = (sourceValue as any).unit_name || (sourceValue as any).name || sourceValue;
        }

        updates[fieldPath.join('.')] = sourceValue;
        
        if (isListContext && Array.isArray(name)) {
          // 在 Form.List 中，如果直接用路径字符串有时不支持，使用数组路径
          form.setFieldValue([...name.slice(0, -1), targetField], sourceValue);
        } else {
          form.setFieldValue(targetField, sourceValue);
        }
      });
    }
  };

  // 格式化搜索下拉列表
  const options = useMemo(() => {
    return data.map((item) => ({
      label: (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <span style={{ fontWeight: 500, marginRight: 8, flexShrink: 0 }}>
             {item.name}
          </span>
          <span style={{ color: '#8c8c8c', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.mainCode} {item.specification ? `| ${item.specification}` : ''}
          </span>
        </div>
      ),
      value: item.id || item.uuid,
      key: item.id || item.uuid,
    }));
  }, [data]);

  return (
    <ProFormSelect
      name={name}
      label={label}
      placeholder={placeholder}
      readonly={readonly}
      disabled={disabled}
      rules={required ? [{ required: true, message: `请选择${label}` }] : undefined}
      options={options}
      fieldProps={{
        showSearch: true,
        loading,
        filterOption: false,
        onSearch: debounceFetch,
        onChange: handleChange,
      }}
      {...restProps}
    />
  );
};

export default UniMaterialSelect;
