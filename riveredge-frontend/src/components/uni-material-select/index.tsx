import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Form, App } from 'antd';
import type { SelectProps } from 'antd';
import { useDebounceFn } from 'ahooks';
import { Material } from '../../apps/master-data/types/material';
import { materialApi } from '../../apps/master-data/services/material';
import { UniDropdown } from '../uni-dropdown';
import type { QuickCreateConfig } from '../uni-dropdown/types';
import { NamePath } from 'antd/es/form/interface';
import { MaterialFormModal } from '../../apps/master-data/components/MaterialFormModal';
import { isVariantSkuMaterial } from '../../apps/master-data/components/MaterialVariantCombinationsTable';

function formatMaterialSelectLabel(m: Record<string, any>): string {
  const mainCode = getMaterialField(m, 'mainCode') || '';
  const nameVal = getMaterialField(m, 'name') || '';
  return `${mainCode} - ${nameVal}`.trim() || String(m.id ?? '');
}

function filterSelectableMaterials(items: Material[], mastersOnly: boolean): Material[] {
  if (!mastersOnly) return items;
  return items.filter((m) => !isVariantSkuMaterial(m));
}

/** 与 Form.Item 的 getValueFromEvent 对齐：将 Select 值规范为数字 ID */
export function uniMaterialSelectValueFromEvent(val: unknown): number | undefined {
  if (val == null || val === '') return undefined;
  const n = Number(val);
  return Number.isFinite(n) ? n : undefined;
}

export function uniMaterialSelectGetValueProps(v: unknown): { value: number | undefined } {
  if (v == null || v === '') return { value: undefined };
  const n = Number(v);
  return { value: Number.isFinite(n) ? n : undefined };
}

/** 单层字段名：兼容 camelCase 与 snake_case（如 defaults 内 default_sale_price） */
function pickObjectKey(obj: Record<string, any>, key: string): any {
  if (obj == null || typeof obj !== 'object') return undefined;
  if (key in obj) return obj[key];
  const snake = key.replace(/([A-Z])/g, '_$1').toLowerCase();
  if (snake !== key && snake in obj) return obj[snake];
  return undefined;
}

function getMaterialField(m: Record<string, any>, field: string): any {
  if (field.includes('.')) {
    return field.split('.').reduce((obj: any, key: string) => pickObjectKey(obj, key), m);
  }
  return pickObjectKey(m, field);
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
  fillMapping?: Record<string, string>;
  getPopupContainer?: SelectProps['getPopupContainer'];
  /** 只展示启用的物料，默认为 true */
  activeOnly?: boolean;
  /** 仅主物料（不列出属性 SKU 行），默认为 true */
  mastersOnly?: boolean;
  /** 初始绑定的表单实例（通常可以从外层 ProForm / Form 自动获取，也可手动传入） */
  formItemProps?: any;
  /** 透传给内部 Select（兼容 ProForm 风格的 fieldProps） */
  fieldProps?: Partial<SelectProps>;
  /** 组件所在的是否是 Form.List 的子项？如果是，请传递该行的 field.name 以便计算回填路径 */
  listFieldKey?: number | string;
  /** Form.List 的 name（当在 Form.List 内时，用于 fillMapping 的 setFieldValue 完整路径） */
  listFieldName?: string;
  /** 尺寸 */
  size?: 'large' | 'middle' | 'small';
  /** 是否显示快速新建入口（未传 quickCreate 时默认跳转物料管理） */
  showQuickCreate?: boolean;
  /** 自定义快速新建（如打开新建物料 Modal）；传入时优先于 showQuickCreate 的默认跳转 */
  quickCreate?: QuickCreateConfig;
  /** 是否显示高级搜索 */
  showAdvancedSearch?: boolean;
  /** 编辑时预填值对应的选项（当物料不在默认列表中时用于展示） */
  fallbackOption?: { value: number; label: string };
  /** 按物料来源类型过滤（如 Make 仅自制件） */
  sourceType?: string;
  onChange?: (value: number | undefined, material: Material | undefined) => void;
}

/**
 * 统一物料选择组件
 * 
 * @description
 * 1. 自动防抖搜索物料 (名称/编号/规格/拼音)
 * 2. 选中物料后，根据 fillMapping 自动向当前的 Form 实例回填物料详情（如名、编号、图号等）
 * 3. 完美兼容 ProForm 和标准 Antd Form 以及 Form.List 动态增减行上下文
 */
export const UniMaterialSelect: React.FC<UniMaterialSelectProps> = ({
  name,
  label = '物料名称',
  placeholder = '请选择物料（支持名称/编号搜索）',
  required = false,
  disabled = false,
  readonly = false,
  fillMapping = {
    mainCode: 'mainCode',
    name: 'name',
    specification: 'specification',
    baseUnit: 'baseUnit',
  } as Record<string, string>,
  getPopupContainer,
  activeOnly = true,
  mastersOnly = true,
  listFieldKey,
  listFieldName,
  size = 'middle',
  showQuickCreate = true,
  quickCreate: quickCreateProp,
  showAdvancedSearch = true,
  fallbackOption,
  sourceType,
  onChange,
  formItemProps,
  fieldProps,
  ...restProps
}) => {
  const { style: formItemStyle, ...restFormItemProps } = formItemProps || {}
  const {
    onChange: fieldPropsOnChange,
    style: fieldPropsStyle,
    getPopupContainer: fieldPropsGetPopupContainer,
    ...restFieldProps
  } = (fieldProps || {}) as Partial<SelectProps>;
  const form = Form.useFormInstance();
  const [materialModalVisible, setMaterialModalVisible] = useState(false);

  const effectiveQuickCreate =
    quickCreateProp ??
    (showQuickCreate
      ? {
          label: '快速新增物料',
          onClick: () => setMaterialModalVisible(true),
        }
      : undefined);
  const { message } = App.useApp();
  const [data, setData] = useState<Material[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchMaterials = async (searchText: string = '') => {
    setLoading(true);
    try {
      const response: any = await materialApi.list({
        keyword: searchText,
        isActive: activeOnly ? true : undefined,
        mastersOnly: mastersOnly ? true : undefined,
        sourceType: sourceType || undefined,
        limit: 200,
      });
      const raw = response?.data || response?.items || response || [];
      const rows = Array.isArray(raw) ? raw : [];
      setData(filterSelectableMaterials(rows, mastersOnly));
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
  }, [activeOnly, mastersOnly, sourceType]);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const mergeMaterialsIntoData = (items: Material[]) => {
    if (!items.length) return;
    setData((prev) => {
      const merged = [...prev];
      for (const item of items) {
        const id = Number((item as any).id);
        if (!merged.some((m) => Number((m as any).id) === id)) {
          merged.push(item);
        }
      }
      return merged;
    });
  };

  const resolveSelectedMaterial = async (
    val: number,
    opt: any,
    currentData: Material[],
  ): Promise<Material | undefined> => {
    let selected =
      currentData.find((m) => Number((m as any).id) === Number(val)) ?? undefined;
    if (selected) return selected;

    const labelStr = typeof opt?.label === 'string' ? opt.label : '';
    const codePart = labelStr.split(' - ')[0]?.trim();
    if (!codePart) return undefined;

    try {
      const list = await materialApi.list({
        code: codePart,
        limit: 50,
        isActive: activeOnly ? true : undefined,
        mastersOnly: mastersOnly ? true : undefined,
        sourceType: sourceType || undefined,
      });
      selected = list.items.find((m) => Number((m as any).id) === Number(val));
      if (selected) {
        mergeMaterialsIntoData([selected]);
      }
      return selected;
    } catch (error) {
      console.error('Failed to resolve material for fillMapping:', error);
      return undefined;
    }
  };

  const handleChange = async (val: number | undefined, opt: any) => {
    const selectedMaterial =
      val != null ? await resolveSelectedMaterial(val, opt, data) : undefined;

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

    if (onChangeRef.current) {
      onChangeRef.current(val, selectedMaterial);
    }
  };

  // Form.Item 会合并子组件的 onChange（先 trigger 再 child.onChange），因此 mergedOnChange 会被调用
  // 不再在此处 setFieldValue，由 Form.Item 的 trigger 负责更新表单；getValueFromEvent 负责规范化存储为 number
  const mergedOnChange = (val: number | undefined, opt: any) => {
    let numVal: number | undefined;
    if ((val as any) != null && (val as any) !== '') {
      const n = Number(val);
      numVal = Number.isFinite(n) ? n : undefined;
    }
    void handleChange(numVal, opt);
    if (typeof fieldPropsOnChange === 'function') {
      fieldPropsOnChange(val as any, opt as any);
    }
  };

  const options = useMemo(() => {
    const opts = data.map((item) => {
      const rawId = (item as any).id;
      const numId = Number(rawId);
      return {
        label: formatMaterialSelectLabel(item as any),
        value: Number.isFinite(numId) ? numId : rawId,
      };
    });
    if (fallbackOption && !opts.some((o) => Number(o.value) === Number(fallbackOption.value))) {
      opts.unshift(fallbackOption);
    }
    return opts;
  }, [data, fallbackOption]);

  /**
   * rc-field-form：Form.Item 经 toChildrenArray 展开 Fragment 后若出现多个子节点，不会对任一子节点注入 value/onChange，
   * 导致 Select 仅本地展示、store 无 material_id。故 Form.Item 只包裹 UniDropdown，MaterialFormModal 放在外层兄弟节点。
   */
  const dropdown = (
    <UniDropdown
      placeholder={placeholder}
      allowClear
      showSearch
      loading={loading}
      disabled={disabled}
      size={size}
      style={{ width: '100%', ...(fieldPropsStyle as React.CSSProperties | undefined) }}
      options={options}
      filterOption={false}
      onSearch={debounceFetch}
      onChange={mergedOnChange}
      getPopupContainer={getPopupContainer ?? fieldPropsGetPopupContainer}
      quickCreate={effectiveQuickCreate}
      advancedSearch={
        showAdvancedSearch
          ? {
              label: '高级搜索',
              fields: [
                { name: 'mainCode', label: '物料编号' },
                { name: 'name', label: '物料名称' },
                { name: 'specification', label: '规格' },
              ],
              onSearch: async (values) => {
                const kw = [values.mainCode, values.name, values.specification].filter(Boolean).join(' ').trim();
                const list = await materialApi.list({
                  limit: 200,
                  isActive: activeOnly ? true : undefined,
                  mastersOnly: mastersOnly ? true : undefined,
                  sourceType: sourceType || undefined,
                  ...(kw && { keyword: kw }),
                });
                const raw = list as { items?: Material[]; data?: Material[] } | Material[];
                const rows = Array.isArray(raw) ? raw : raw?.items ?? raw?.data ?? [];
                const items = filterSelectableMaterials(Array.isArray(rows) ? rows : [], mastersOnly);
                mergeMaterialsIntoData(items);
                return items.map((m) => {
                  const rawId = (m as any).id;
                  const numId = Number(rawId);
                  return {
                    value: Number.isFinite(numId) ? numId : rawId,
                    label: formatMaterialSelectLabel(m as any),
                  };
                });
              },
            }
          : undefined
      }
      {...restFieldProps}
      {...restProps}
    />
  );

  const modal = (
    <MaterialFormModal
      open={materialModalVisible}
      onClose={() => setMaterialModalVisible(false)}
      onSuccess={(newMaterial) => {
        setData((prev) => [newMaterial, ...prev.filter((m) => m.id !== newMaterial.id)]);
        if (form) {
          form.setFieldValue(name, newMaterial.id);
          handleChange(newMaterial.id, {
            label: formatMaterialSelectLabel(newMaterial as any),
            value: newMaterial.id,
          });
        }
        setMaterialModalVisible(false);
      }}
    />
  );

  return (
    <>
      <Form.Item
        name={name}
        label={label || undefined}
        rules={required ? [{ required: true, message: `请选择${label || '物料'}` }] : undefined}
        validateTrigger={['onChange', 'onBlur']}
        getValueFromEvent={(val: unknown) => uniMaterialSelectValueFromEvent(val)}
        getValueProps={(v: any) => uniMaterialSelectGetValueProps(v)}
        /** 勿用 margin:0，会吃掉 ant-form-item 默认 margin-bottom，导致与下一表单项贴死 */
        style={{ marginTop: 0, marginInline: 0, ...formItemStyle }}
        {...restFormItemProps}
      >
        {dropdown}
      </Form.Item>
      {modal}
    </>
  );
};

export default UniMaterialSelect;
