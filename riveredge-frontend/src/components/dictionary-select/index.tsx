/**
 * 数据字典选择组件
 *
 * 基于 UniDropdown 实现，支持从数据字典中选择值，支持快速创建新项。
 *
 * Author: Luigi Lu
 * Date: 2025-12-26
 */

import React, { useState, useEffect, useMemo, useCallback, forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Input, Form, App, Button, Space, Col } from 'antd';
import { ProForm, ProFormSelect } from '@ant-design/pro-components';
import { UniDropdown, QuickCreateAnchorPopover } from '../uni-dropdown';
import { useProFormReadonlyMode } from '../../utils/proFormReadonly';
import {
  getDataDictionaryByCode,
  getDictionaryItemList,
  createDictionaryItem,
} from '../../services/dataDictionary';
import { mapSystemDictionaryItemOptions } from '../../utils/systemDictionaryI18n';

type DictionaryOption = { label: string; value: string };

/** 由 Form.Item 注入 value/onChange；合并异步选项与当前值，避免未加载字典项时误显示占位符 */
const DictionarySelectField = forwardRef<
  any,
  Omit<React.ComponentProps<typeof UniDropdown>, 'options'> & {
    loadedOptions: DictionaryOption[];
    hookOnChange?: (v: any, opt: any) => void;
  }
>(({ loadedOptions, hookOnChange, onChange, value, ...rest }, ref) => {
  const displayOptions = useMemo(() => {
    if (value === undefined || value === null || value === '') {
      return loadedOptions;
    }
    const strVal = String(value);
    if (loadedOptions.some((o) => String(o.value) === strVal)) {
      return loadedOptions;
    }
    return [...loadedOptions, { value: strVal, label: strVal }];
  }, [loadedOptions, value]);

  const handleChange = useCallback(
    (v: any, opt: any) => {
      (onChange as ((val: any, option: any) => void) | undefined)?.(v, opt);
      hookOnChange?.(v, opt);
    },
    [onChange, hookOnChange]
  );

  return <UniDropdown ref={ref} {...rest} options={displayOptions} value={value} onChange={handleChange} />;
});
DictionarySelectField.displayName = 'DictionarySelectField';

/**
 * 数据字典选择组件属性
 */
export interface DictionarySelectProps {
  /** 字典代码 */
  dictionaryCode: string;
  /** 字段名称 (noStyle 为 false 时必填) */
  name?: string | (string | number)[];
  /** 标签 (用于错误提示与快速创建 Popover 标题) */
  label?: string;
  /** 占位符 */
  placeholder?: string;
  /** 是否必填 */
  required?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 只读展示（详情页；未传时跟随 ProForm readonly） */
  readonly?: boolean;
  /** 加载状态 */
  loading?: boolean;
  /** 初始值 */
  initialValue?: any;
  /** 列属性（用于ProForm布局） */
  colProps?: { span: number };
  /** 验证规则 */
  rules?: any[];
  /**
   * 快速新建成功后写入表单的路径（默认与 `name` 相同）。
   * 嵌套在 ProFormList 等场景下请传根路径，例如 `['line_items', rowIndex, 'repair_reason']`，而 `name` 仍用相对字段名 `repair_reason`。
   */
  setFieldValueNamePath?: string | number | (string | number)[];
  /** 表单实例引用（用于创建新项后更新表单值） */
  formRef?: React.RefObject<any>;
  /** 是否不包裹 ProForm.Item */
  noStyle?: boolean;
  /** 组件尺寸 */
  size?: 'large' | 'middle' | 'small';
  /** 自定义样式 */
  style?: React.CSSProperties;
  /** 自定义类名 */
  className?: string;
  /** 值发生变化时的回调 */
  onChange?: (value: any, option: any) => void;
  /** 当前选中的值 */
  value?: any;
  /**
   * 快速创建时是否只填「名称」：为 true 时存储 value 与显示 label 相同（默认）。
   * 需单独维护稳定编码（如币种 CNY / 中文展示）时传 false，将显示「值」输入框。
   */
  valueEqualsLabel?: boolean;
  /**
   * 与客户/供应商表单一致：Popover 内仅一个输入框（占位「请输入新选项」）、标题「快速新增{label}」、主按钮「确定」；
   * 新建项时 value 与 label 均为该输入内容（与 valueEqualsLabel 是否 false 无关，仅影响创建弹层）。
   */
  simpleQuickCreate?: boolean;
  /** 快速创建 Popover 的 zIndex（嵌在抬升的 Modal 内时需高于父级，如报价单弹窗） */
  quickCreatePopoverZIndex?: number;
  /**
   * 宿主单据 resource（{app}:{module}）。
   * 无 system:data-dictionary read/display 时，通过 manifest module_references 隐式加载字典项。
   */
  hostResource?: string;
}

/**
 * 数据字典选择组件（基于 UniDropdown）
 */
export const DictionarySelect: React.FC<DictionarySelectProps> = ({
  dictionaryCode,
  name,
  label = '项',
  placeholder,
  required = false,
  disabled = false,
  readonly = false,
  loading: externalLoading = false,
  initialValue,
  colProps,
  rules,
  setFieldValueNamePath,
  formRef,
  noStyle = false,
  size,
  style,
  className,
  onChange,
  value,
  valueEqualsLabel = true,
  simpleQuickCreate = false,
  quickCreatePopoverZIndex,
  hostResource,
}) => {
  const { t, i18n } = useTranslation();
  const { message: messageApi } = App.useApp();
  const isReadonlyMode = useProFormReadonlyMode(readonly);
  const [options, setOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [createPopoverOpen, setCreatePopoverOpen] = useState(false);
  const [createAnchorEl, setCreateAnchorEl] = useState<HTMLElement | null>(null);
  const [createForm] = Form.useForm<{ displayLabel: string; storedValue?: string; description?: string }>();
  const [creating, setCreating] = useState(false);
  const [dictionaryUuid, setDictionaryUuid] = useState<string>('');

  /**
   * 加载字典项列表
   */
  const loadDictionaryItems = async () => {
    try {
      setLoading(true);
      const loadOpts = hostResource ? { hostResource } : undefined;
      const dictionary = await getDataDictionaryByCode(dictionaryCode, loadOpts);
      setDictionaryUuid(dictionary.uuid);
      const items = await getDictionaryItemList(dictionary.uuid, true, loadOpts);
      const optionsList = mapSystemDictionaryItemOptions(dictionaryCode, items, t)
        .sort((a, b) => {
          const orderA = items.find((i) => i.value === a.value)?.sort_order ?? 0;
          const orderB = items.find((i) => i.value === b.value)?.sort_order ?? 0;
          return orderA - orderB;
        });
      setOptions(optionsList);
    } catch (error: any) {
      console.error(`加载字典项失败 (${dictionaryCode}):`, error);
      messageApi.error(t('components.dictionarySelect.loadOptionsFailed', { label }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDictionaryItems();
  }, [dictionaryCode, hostResource, i18n.language]);

  /**
   * 处理创建新项
   */
  const handleCreateItem = async () => {
    let trimmedLabel: string;
    let trimmedValue: string;
    try {
      if (simpleQuickCreate) {
        const values = await createForm.validateFields(['displayLabel']);
        trimmedLabel = String(values.displayLabel ?? '').trim();
        trimmedValue = trimmedLabel;
      } else {
        const values = await createForm.validateFields();
        trimmedLabel = String(values.displayLabel ?? '').trim();
        trimmedValue = valueEqualsLabel ? trimmedLabel : String(values.storedValue ?? '').trim();
      }
    } catch {
      return;
    }

    if (!trimmedLabel || (!simpleQuickCreate && !valueEqualsLabel && !trimmedValue)) {
      messageApi.warning(
        simpleQuickCreate
          ? '请填写新选项'
          : valueEqualsLabel
            ? t('components.dictionarySelect.enterUnitItem')
            : t('components.dictionarySelect.enterLabelAndValue')
      );
      return;
    }

    const exists = options.some(option => option.value === trimmedValue);
    if (exists) {
      messageApi.warning(t('components.dictionarySelect.valueExists'));
      return;
    }

    try {
      setCreating(true);
      const descTrimmed = simpleQuickCreate
        ? ''
        : String(createForm.getFieldValue('description') ?? '').trim();

      const newItem = await createDictionaryItem(dictionaryUuid, {
        label: trimmedLabel,
        value: trimmedValue,
        description: descTrimmed || undefined,
        is_active: true,
        sort_order: options.length,
      });

      messageApi.success(t('common.createSuccess'));
      setCreatePopoverOpen(false);
      setCreateAnchorEl(null);
      createForm.resetFields();

      await loadDictionaryItems();

      const newValue = newItem.value;

      const pathSource = setFieldValueNamePath !== undefined ? setFieldValueNamePath : name;
      if (pathSource != null && formRef?.current?.setFieldValue) {
        const path = (Array.isArray(pathSource) ? pathSource : [pathSource]) as (string | number)[];
        formRef.current.setFieldValue(path, newValue);
      }
      
      // 触发 onChange 供外部同步
      onChange?.(newValue, { value: newValue, label: newItem.label });

      return newValue;
    } catch (error: any) {
      console.error('创建字典项失败:', error);
      messageApi.error(error?.response?.data?.detail || t('components.dictionarySelect.createFailed'));
    } finally {
      setCreating(false);
    }
  };

  const mergedRules = useMemo(() => {
    const baseRules = rules || [];
    if (required) {
      return [{ required: true, message: `请选择${label}` }, ...baseRules];
    }
    return baseRules;
  }, [required, label, rules]);

  if (isReadonlyMode && noStyle) {
    const strVal = value != null && value !== '' ? String(value) : '';
    const displayLabel = options.find((o) => o.value === strVal)?.label ?? strVal;
    return <span>{displayLabel || '-'}</span>;
  }

  if (isReadonlyMode) {
    return (
      <ProFormSelect
        name={name}
        label={label}
        rules={mergedRules}
        initialValue={initialValue}
        colProps={colProps}
        className="dictionary-select-form-item"
        readonly
        options={options}
      />
    );
  }

  const baseFieldProps = {
    style: { width: '100%', ...style } as React.CSSProperties,
    className,
    placeholder: placeholder || `请选择${label}`,
    showSearch: true as const,
    allowClear: true,
    loading: loading || externalLoading,
    disabled,
    loadedOptions: options,
    size,
    quickCreate: {
      label: simpleQuickCreate ? '快速新建' : '创建新项',
      onClick: (anchor: HTMLElement | null | undefined) => {
        createForm.resetFields();
        setCreateAnchorEl(anchor ?? null);
        setCreatePopoverOpen(true);
      },
    },
  };

  /** noStyle 时无 Form.Item 注入，需显式传 value；有 ProForm.Item 时勿传 value，避免 undefined 覆盖表单里的站点默认币种等 */
  const dropdown = (
    <DictionarySelectField
      {...baseFieldProps}
      hookOnChange={onChange}
      {...(noStyle ? { value } : {})}
    />
  );

  const createPopoverZ = quickCreatePopoverZIndex ?? 2000;

  const createPopover = (
    <QuickCreateAnchorPopover
      open={createPopoverOpen}
      anchorEl={createAnchorEl}
      title={simpleQuickCreate ? `快速新增${label}` : `创建新的${label}项`}
      zIndex={createPopoverZ}
      onClose={() => {
        setCreatePopoverOpen(false);
        setCreateAnchorEl(null);
        createForm.resetFields();
      }}
    >
      <Form form={createForm} layout="vertical" preserve={false}>
        {simpleQuickCreate ? (
          <Form.Item
            name="displayLabel"
            rules={[
              { required: true, whitespace: true, message: '请填写新选项' },
              { max: 100, message: t('components.dictionarySelect.maxLength100') },
            ]}
            style={{ marginBottom: 0 }}
          >
            <Input placeholder="请输入新选项" maxLength={100} autoFocus />
          </Form.Item>
        ) : (
          <>
            <Form.Item
              name="displayLabel"
              label={
                valueEqualsLabel
                  ? t('components.dictionarySelect.unitItem')
                  : t('components.dictionarySelect.fieldLabel')
              }
              rules={[
                {
                  required: true,
                  whitespace: true,
                  message: valueEqualsLabel
                    ? t('components.dictionarySelect.enterUnitItem')
                    : t('components.dictionarySelect.enterLabel'),
                },
                { max: 100, message: t('components.dictionarySelect.maxLength100') },
              ]}
              extra={
                valueEqualsLabel ? t('components.dictionarySelect.valueMirrorsLabelHint') : undefined
              }
            >
              <Input
                placeholder={
                  valueEqualsLabel
                    ? t('components.dictionarySelect.placeholderUnitItem')
                    : t('components.dictionarySelect.placeholderLabel')
                }
                maxLength={100}
              />
            </Form.Item>
            {!valueEqualsLabel ? (
              <Form.Item
                name="storedValue"
                label={t('components.dictionarySelect.fieldValue')}
                rules={[
                  {
                    required: true,
                    whitespace: true,
                    message: t('components.dictionarySelect.enterValue'),
                  },
                  { max: 100, message: t('components.dictionarySelect.maxLength100') },
                ]}
              >
                <Input placeholder={t('components.dictionarySelect.placeholderValue')} maxLength={100} />
              </Form.Item>
            ) : null}
            <Form.Item name="description" label={t('components.dictionarySelect.fieldDescription')}>
              <Input.TextArea
                placeholder={t('components.dictionarySelect.placeholderDescription')}
                rows={3}
                maxLength={500}
                showCount
              />
            </Form.Item>
          </>
        )}
        <Space style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
          <Button
            onClick={() => {
              setCreatePopoverOpen(false);
              setCreateAnchorEl(null);
              createForm.resetFields();
            }}
          >
            取消
          </Button>
          <Button type="primary" loading={creating} onClick={() => void handleCreateItem()}>
            {simpleQuickCreate ? '确定' : '创建'}
          </Button>
        </Space>
      </Form>
    </QuickCreateAnchorPopover>
  );

  if (noStyle) {
    return (
      <>
        {dropdown}
        {createPopover}
      </>
    );
  }

  const itemNode = (
    <ProForm.Item
      name={name}
      label={label}
      rules={mergedRules}
      initialValue={initialValue}
      className="dictionary-select-form-item"
    >
      {dropdown}
    </ProForm.Item>
  );

  return (
    <>
      {colProps ? <Col {...colProps}>{itemNode}</Col> : itemNode}
      {createPopover}
    </>
  );
};


export default DictionarySelect;
