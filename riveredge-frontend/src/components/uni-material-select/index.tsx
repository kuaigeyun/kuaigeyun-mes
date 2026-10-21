import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { Form, App } from 'antd';
import type { SelectProps } from 'antd';
import { useDebounceFn } from 'ahooks';
import { Material } from '../../apps/master-data/types/material';
import { apiRequest } from '../../services/api';
import { UniDropdown } from '../uni-dropdown';
import type { QuickCreateConfig } from '../uni-dropdown/types';
import { NamePath } from 'antd/es/form/interface';
import { MaterialFormModal } from '../../apps/master-data/components/MaterialFormModal';
import { isVariantSkuMaterial } from '../../apps/master-data/components/MaterialVariantCombinationsTable';
import {
  ReferenceDisplayAccessError,
  resolveReferenceDisplay,
  searchReferenceDisplay,
} from '../../utils/referenceDisplay';
import { referenceDisplayItemsToMaterials } from '../../utils/documentFormReferenceLoad';
import {
  MATERIAL_SELECT_OPTION_ITEM_HEIGHT,
  MaterialSelectOptionContent,
  formatMaterialSelectLabel,
} from './materialSelectOption';

const MATERIAL_REFERENCE_RESOURCE = 'master-data:material';

export {
  MATERIAL_SELECT_OPTION_ITEM_HEIGHT,
  MaterialSelectOptionContent,
  formatMaterialSelectLabel,
  resolveMaterialSelectImageFileUuid,
} from './materialSelectOption';

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

/** 多选：规范为数字 ID 数组 */
export function uniMaterialSelectMultipleValueFromEvent(val: unknown): number[] {
  if (val == null) return [];
  const raw = Array.isArray(val) ? val : [val];
  return raw
    .map((item) => Number(item))
    .filter((n) => Number.isFinite(n) && n > 0);
}

export function uniMaterialSelectGetValueProps(v: unknown): { value: number | undefined } {
  if (v == null || v === '') return { value: undefined };
  const n = Number(v);
  return { value: Number.isFinite(n) ? n : undefined };
}

export function uniMaterialSelectMultipleGetValueProps(v: unknown): { value: number[] } {
  if (v == null) return { value: [] };
  const raw = Array.isArray(v) ? v : [v];
  return {
    value: raw
      .map((item) => Number(item))
      .filter((n) => Number.isFinite(n) && n > 0),
  };
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
  /** 按物料分组过滤（仅展示该分组及子分组内物料） */
  groupId?: number;
  /** 限定为指定仓库内有库存的物料（即时库存汇总口径） */
  warehouseId?: number;
  /** 宿主 {app}:{module}，供引用展示鉴权；未传时按当前路由菜单自动推断 */
  hostResource?: string;
  /** 多选；与 fieldProps.mode='multiple' 等价，显式传入更稳妥 */
  mode?: 'multiple';
  onChange?: (
    value: number | number[] | undefined,
    material: Material | Material[] | undefined,
  ) => void;
}

/**
 * 统一物料选择组件
 *
 * @description
 * 1. 自动防抖搜索物料 (名称/编号/规格)
 * 2. 选中物料后，根据 fillMapping 自动向当前的 Form 实例回填物料详情（如名、编号、图号等）
 * 3. 兼容 ProForm / Antd Form / Form.List
 * 4. 走 reference-display：具备物料 read 或 display（回显）即可拉选项，无需物料菜单 read
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
  size='medium',
  showQuickCreate = true,
  quickCreate: quickCreateProp,
  showAdvancedSearch = true,
  fallbackOption,
  sourceType,
  groupId,
  warehouseId,
  hostResource,
  mode,
  onChange,
  formItemProps,
  fieldProps,
}) => {
  const { style: formItemStyle, ...restFormItemProps } = formItemProps || {}
  const {
    onChange: fieldPropsOnChange,
    style: fieldPropsStyle,
    getPopupContainer: fieldPropsGetPopupContainer,
    mode: fieldPropsMode,
    quickCreate: _fieldQuickCreate,
    advancedSearch: _fieldAdvancedSearch,
    popupRender: _fieldPopupRender,
    ...restFieldProps
  } = (fieldProps || {}) as Partial<SelectProps & { quickCreate?: unknown; advancedSearch?: unknown }>;
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
  const dataIdsRef = useRef<Set<number>>(new Set());
  const resolvingIdsRef = useRef<Set<number>>(new Set());
  const selectedIdRef = useRef<number | undefined>(undefined);
  const selectedIdsRef = useRef<number[]>([]);
  const listAbortRef = useRef<AbortController | null>(null);

  const resolvedGroupId = useMemo(() => {
    if (groupId == null) return undefined;
    const n = Number(groupId);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  }, [groupId]);

  const resolvedWarehouseId = useMemo(() => {
    if (warehouseId == null) return undefined;
    const n = Number(warehouseId);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  }, [warehouseId]);

  const isMultiple =
    mode === 'multiple' ||
    fieldPropsMode === 'multiple' ||
    (restFieldProps as SelectProps | undefined)?.mode === 'multiple';

  /** Form.List 内 name 为相对路径，需拼出完整字段路径才能 watch 到当前值 */
  const watchedName = useMemo(() => {
    if (listFieldName != null && listFieldKey !== undefined && listFieldKey !== null) {
      const leaf = Array.isArray(name) ? name[name.length - 1] : name;
      return [listFieldName, listFieldKey, leaf] as NamePath;
    }
    return name;
  }, [listFieldName, listFieldKey, name]);

  const currentValue = Form.useWatch(watchedName, form);
  if (isMultiple) {
    selectedIdsRef.current = uniMaterialSelectMultipleValueFromEvent(currentValue);
  } else {
    selectedIdRef.current = (() => {
      const id = Number(currentValue);
      return Number.isFinite(id) && id > 0 ? id : undefined;
    })();
  }

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

  const filterClientMaterialRows = (rows: Material[]): Material[] => {
    let next = rows;
    if (sourceType) {
      const st = String(sourceType);
      next = next.filter(
        (m) => String((m as any).source_type ?? (m as any).sourceType ?? '') === st,
      );
    }
    if (resolvedGroupId != null) {
      next = next.filter(
        (m) => Number((m as any).group_id ?? (m as any).groupId) === resolvedGroupId,
      );
    }
    return filterSelectableMaterials(next, mastersOnly);
  };

  const fetchMaterials = async (searchText: string = '') => {
    listAbortRef.current?.abort();
    const ac = new AbortController();
    listAbortRef.current = ac;
    setLoading(true);
    try {
      let rows: Material[] = [];
      if (resolvedWarehouseId) {
        const balanceRes: any = await apiRequest('/apps/kuaizhizao/reports/inventory/material-balances', {
          method: 'GET',
          params: {
            warehouse_id: resolvedWarehouseId,
            include_zero_stock: false,
            keyword: searchText || undefined,
            current: 1,
            page_size: 200,
          },
          signal: ac.signal,
        });
        if (ac.signal.aborted) return;
        const balanceRows = balanceRes?.items || balanceRes?.data || [];
        const materialIds = [
          ...new Set(
            (Array.isArray(balanceRows) ? balanceRows : [])
              .map((row: { material_id?: number }) => Number(row.material_id))
              .filter((id: number) => Number.isFinite(id) && id > 0),
          ),
        ] as number[];
        if (!materialIds.length) {
          setData((prev) => {
            const selectedIds = isMultiple
              ? selectedIdsRef.current
              : selectedIdRef.current
                ? [selectedIdRef.current]
                : [];
            if (!selectedIds.length) return [];
            return prev.filter((m) => selectedIds.includes(Number((m as any).id)));
          });
          return;
        }
        const items = await resolveReferenceDisplay({
          resource: MATERIAL_REFERENCE_RESOURCE,
          recordIds: materialIds,
          hostResource,
        });
        if (ac.signal.aborted) return;
        const order = new Map(materialIds.map((id, idx) => [id, idx]));
        rows = [...referenceDisplayItemsToMaterials(items)].sort(
          (a, b) => (order.get(Number(a.id)) ?? 0) - (order.get(Number(b.id)) ?? 0),
        );
        rows = filterClientMaterialRows(rows);
      } else {
        const response = await searchReferenceDisplay({
          resource: MATERIAL_REFERENCE_RESOURCE,
          hostResource,
          keyword: searchText.trim() || undefined,
          isActive: activeOnly ? true : undefined,
          sourceType: sourceType || undefined,
          groupId: resolvedGroupId,
          pageSize: 200,
        });
        if (ac.signal.aborted) return;
        rows = filterSelectableMaterials(
          referenceDisplayItemsToMaterials(response.items ?? []),
          mastersOnly,
        );
      }
      const next = rows;
      setData((prev) => {
        const selectedIds = isMultiple
          ? selectedIdsRef.current
          : selectedIdRef.current
            ? [selectedIdRef.current]
            : [];
        if (!selectedIds.length) return next;
        const keep = prev.filter((m) => selectedIds.includes(Number((m as any).id)));
        const missingKeep = keep.filter((m) => !next.some((n) => Number((n as any).id) === Number((m as any).id)));
        return missingKeep.length ? [...missingKeep, ...next] : next;
      });
    } catch (error) {
      if (ac.signal.aborted) return;
      console.error('Failed to fetch materials:', error);
      if (error instanceof ReferenceDisplayAccessError) {
        message.error(error.message);
      } else {
        message.error('加载物料列表失败，请稍后重试');
      }
    } finally {
      if (!ac.signal.aborted) {
        setLoading(false);
      }
    }
  };

  const { run: debounceFetch } = useDebounceFn(
    (value: string) => fetchMaterials(value),
    { wait: 300 }
  );

  useEffect(() => {
    // 分组等过滤条件变化时立刻清空旧选项，避免仍展示上一轮「全部物料」
    setData([]);
    void fetchMaterials();
    return () => {
      listAbortRef.current?.abort();
    };
    // fetchMaterials 闭包随 deps 更新；debounce 经 useLatest 取最新 fn
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅过滤条件变化时重拉
  }, [activeOnly, mastersOnly, sourceType, resolvedGroupId, resolvedWarehouseId, hostResource]);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    dataIdsRef.current = new Set(
      data.map((m) => Number((m as any).id)).filter((id) => Number.isFinite(id) && id > 0),
    );
  }, [data]);

  /**
   * 编辑回填时，当前选中 ID 往往不在初始 200 条搜索结果中。
   * 按主键精确补齐选项，避免 Select 只显示裸 ID。
   */
  useEffect(() => {
    const ids = isMultiple
      ? uniMaterialSelectMultipleValueFromEvent(currentValue)
      : (() => {
          const id = Number(currentValue);
          return Number.isFinite(id) && id > 0 ? [id] : [];
        })();
    if (!ids.length) return;

    const missing = ids.filter(
      (id) =>
        !dataIdsRef.current.has(id) &&
        !(fallbackOption && Number(fallbackOption.value) === id) &&
        !resolvingIdsRef.current.has(id),
    );
    if (!missing.length) return;

    for (const id of missing) {
      resolvingIdsRef.current.add(id);
    }
    let cancelled = false;
    void (async () => {
      try {
        const items = await resolveReferenceDisplay({
          resource: MATERIAL_REFERENCE_RESOURCE,
          recordIds: missing,
          hostResource,
        });
        if (cancelled) return;
        const found = referenceDisplayItemsToMaterials(items).filter((m) =>
          missing.includes(Number((m as any).id)),
        );
        if (found.length) {
          mergeMaterialsIntoData(found);
        } else if (!isMultiple) {
          console.error('[UniMaterialSelect] selected material not found by id', missing[0]);
        }
      } catch (error) {
        console.error('[UniMaterialSelect] failed to resolve selected material(s)', missing, error);
      } finally {
        for (const id of missing) {
          resolvingIdsRef.current.delete(id);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentValue, fallbackOption, isMultiple, hostResource]);

  const resolveSelectedMaterial = async (
    val: number,
    opt: any,
    currentData: Material[],
  ): Promise<Material | undefined> => {
    let selected =
      currentData.find((m) => Number((m as any).id) === Number(val)) ?? undefined;
    if (selected) return selected;

    try {
      const items = await resolveReferenceDisplay({
        resource: MATERIAL_REFERENCE_RESOURCE,
        recordIds: [Number(val)],
        hostResource,
      });
      selected = referenceDisplayItemsToMaterials(items).find(
        (m) => Number((m as any).id) === Number(val),
      );
      if (selected) {
        mergeMaterialsIntoData([selected]);
        return selected;
      }
    } catch (error) {
      console.error('Failed to resolve material for fillMapping:', error);
    }

    const labelStr = typeof opt?.label === 'string' ? opt.label : '';
    const codePart = labelStr.split(' - ')[0]?.trim();
    if (!codePart) return undefined;

    try {
      const response = await searchReferenceDisplay({
        resource: MATERIAL_REFERENCE_RESOURCE,
        hostResource,
        keyword: codePart,
        isActive: activeOnly ? true : undefined,
        sourceType: sourceType || undefined,
        groupId: resolvedGroupId,
        pageSize: 50,
      });
      selected = referenceDisplayItemsToMaterials(response.items ?? []).find(
        (m) => Number((m as any).id) === Number(val),
      );
      if (selected) {
        mergeMaterialsIntoData([selected]);
      }
      return selected;
    } catch (error) {
      console.error('Failed to resolve material for fillMapping:', error);
      return undefined;
    }
  };

  const handleChange = async (val: number | number[] | undefined, opt: any) => {
    if (isMultiple) {
      const ids = uniMaterialSelectMultipleValueFromEvent(val);
      const selectedMaterials = ids
        .map((id) => data.find((m) => Number((m as any).id) === Number(id)))
        .filter((m): m is Material => m != null);
      if (onChangeRef.current) {
        onChangeRef.current(ids, selectedMaterials);
      }
      return;
    }

    const singleVal = typeof val === 'number' ? val : uniMaterialSelectValueFromEvent(val);
    const selectedMaterial =
      singleVal != null ? await resolveSelectedMaterial(singleVal, opt, data) : undefined;

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
      onChangeRef.current(singleVal, selectedMaterial);
    }
  };

  // Form.Item 会合并子组件的 onChange（先 trigger 再 child.onChange），因此 mergedOnChange 会被调用
  // 不再在此处 setFieldValue，由 Form.Item 的 trigger 负责更新表单；getValueFromEvent 负责规范化存储
  const mergedOnChange = (val: number | number[] | undefined, opt: any) => {
    if (isMultiple) {
      const ids = uniMaterialSelectMultipleValueFromEvent(val);
      void handleChange(ids, opt);
      if (typeof fieldPropsOnChange === 'function') {
        fieldPropsOnChange(ids as any, opt as any);
      }
      return;
    }

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

  const materialById = useMemo(() => {
    const map = new Map<number, Material>();
    for (const item of data) {
      const id = Number((item as any).id);
      if (Number.isFinite(id)) map.set(id, item);
    }
    return map;
  }, [data]);

  const optionRender = useCallback<NonNullable<SelectProps['optionRender']>>(
    (option) => {
      const id = Number(option.value);
      const material = Number.isFinite(id) ? materialById.get(id) : undefined;
      return (
        <MaterialSelectOptionContent
          material={material as Record<string, unknown> | undefined}
          fallbackLabel={option.label}
        />
      );
    },
    [materialById],
  );

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
      optionRender={optionRender}
      listItemHeight={MATERIAL_SELECT_OPTION_ITEM_HEIGHT}
      popupMatchSelectWidth={480}
      {...restFieldProps}
      mode={isMultiple ? 'multiple' : undefined}
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
                let items: Material[] = [];
                if (resolvedWarehouseId) {
                  const balanceRes: any = await apiRequest('/apps/kuaizhizao/reports/inventory/material-balances', {
                    method: 'GET',
                    params: {
                      warehouse_id: resolvedWarehouseId,
                      include_zero_stock: false,
                      keyword: kw || undefined,
                      current: 1,
                      page_size: 200,
                    },
                  });
                  const balanceRows = balanceRes?.items || balanceRes?.data || [];
                  const materialIds = [
                    ...new Set(
                      (Array.isArray(balanceRows) ? balanceRows : [])
                        .map((row: { material_id?: number }) => Number(row.material_id))
                        .filter((id: number) => Number.isFinite(id) && id > 0),
                    ),
                  ] as number[];
                  if (materialIds.length) {
                    const resolved = await resolveReferenceDisplay({
                      resource: MATERIAL_REFERENCE_RESOURCE,
                      recordIds: materialIds,
                      hostResource,
                    });
                    items = filterClientMaterialRows(referenceDisplayItemsToMaterials(resolved));
                  }
                } else {
                  const response = await searchReferenceDisplay({
                    resource: MATERIAL_REFERENCE_RESOURCE,
                    hostResource,
                    keyword: kw || undefined,
                    isActive: activeOnly ? true : undefined,
                    sourceType: sourceType || undefined,
                    groupId: resolvedGroupId,
                    pageSize: 200,
                  });
                  items = filterSelectableMaterials(
                    referenceDisplayItemsToMaterials(response.items ?? []),
                    mastersOnly,
                  );
                }
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
    />
  );

  const modal = (
    <MaterialFormModal
      open={materialModalVisible}
      onClose={() => setMaterialModalVisible(false)}
      onSuccess={(newMaterial) => {
        setData((prev) => [newMaterial, ...prev.filter((m) => m.id !== newMaterial.id)]);
        if (form) {
          if (isMultiple) {
            const next = [...selectedIdsRef.current];
            const id = Number(newMaterial.id);
            if (Number.isFinite(id) && id > 0 && !next.includes(id)) {
              next.push(id);
            }
            form.setFieldValue(name, next);
            handleChange(next, undefined);
          } else {
            form.setFieldValue(name, newMaterial.id);
            handleChange(newMaterial.id, {
              label: formatMaterialSelectLabel(newMaterial as any),
              value: newMaterial.id,
            });
          }
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
        getValueFromEvent={(val: unknown) =>
          isMultiple ? uniMaterialSelectMultipleValueFromEvent(val) : uniMaterialSelectValueFromEvent(val)
        }
        getValueProps={(v: any) =>
          isMultiple ? uniMaterialSelectMultipleGetValueProps(v) : uniMaterialSelectGetValueProps(v)
        }
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
