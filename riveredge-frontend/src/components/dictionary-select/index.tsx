/**
 * 数据字典选择组件
 *
 * 基于 UniDropdown 实现，支持从数据字典中选择值，支持快速创建新项。
 *
 * Author: Luigi Lu
 * Date: 2025-12-26
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Input, Form, App } from 'antd';
import { ProForm } from '@ant-design/pro-components';
import { UniDropdown } from '../uni-dropdown';
import {
  getDataDictionaryByCode,
  getDictionaryItemList,
  createDictionaryItem,
} from '../../services/dataDictionary';

/**
 * 数据字典选择组件属性
 */
export interface DictionarySelectProps {
  /** 字典代码 */
  dictionaryCode: string;
  /** 字段名称 (noStyle 为 false 时必填) */
  name?: string | (string | number)[];
  /** 标签 (用于错误提示和 Modal 标题) */
  label?: string;
  /** 占位符 */
  placeholder?: string;
  /** 是否必填 */
  required?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 加载状态 */
  loading?: boolean;
  /** 初始值 */
  initialValue?: any;
  /** 列属性（用于ProForm布局） */
  colProps?: { span: number };
  /** 验证规则 */
  rules?: any[];
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
   * 快速创建时仅填写「标签」，存储用的 value 与 label 相同（适合基础单位等场景）。
   * 其它字典仍可单独填写稳定唯一标识。
   */
  valueEqualsLabel?: boolean;
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
  loading: externalLoading = false,
  initialValue,
  colProps,
  rules,
  formRef,
  noStyle = false,
  size,
  style,
  className,
  onChange,
  value,
  valueEqualsLabel = false,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const [options, setOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createForm] = Form.useForm<{ displayLabel: string; storedValue?: string; description?: string }>();
  const [creating, setCreating] = useState(false);
  const [dictionaryUuid, setDictionaryUuid] = useState<string>('');

  /**
   * 加载字典项列表
   */
  const loadDictionaryItems = async () => {
    try {
      setLoading(true);
      const dictionary = await getDataDictionaryByCode(dictionaryCode);
      setDictionaryUuid(dictionary.uuid);
      const items = await getDictionaryItemList(dictionary.uuid, true);
      const optionsList = items
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(item => ({
          label: item.label,
          value: item.value,
        }));
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
  }, [dictionaryCode]);

  /**
   * 处理创建新项
   */
  const handleCreateItem = async () => {
    let trimmedLabel: string;
    let trimmedValue: string;
    try {
      const values = await createForm.validateFields();
      trimmedLabel = String(values.displayLabel ?? '').trim();
      trimmedValue = valueEqualsLabel ? trimmedLabel : String(values.storedValue ?? '').trim();
    } catch {
      return;
    }

    if (!trimmedLabel || (!valueEqualsLabel && !trimmedValue)) {
      messageApi.warning(
        valueEqualsLabel
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
      const descTrimmed = String(createForm.getFieldValue('description') ?? '').trim();

      const newItem = await createDictionaryItem(dictionaryUuid, {
        label: trimmedLabel,
        value: trimmedValue,
        description: descTrimmed || undefined,
        is_active: true,
        sort_order: options.length,
      });

      messageApi.success(t('common.createSuccess'));
      setCreateModalVisible(false);
      createForm.resetFields();

      await loadDictionaryItems();

      const newValue = newItem.value;
      
      // 如果提供了 name，则尝试通过 name 更新表单（针对 ProForm 或 antd Form）
      if (name) {
        if (formRef?.current) {
          formRef.current.setFieldsValue({ [Array.isArray(name) ? name[name.length - 1] : name]: newValue });
        }
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

  const effectiveColProps = colProps ?? { span: 12 };

  const dropdown = (
    <UniDropdown
      style={{ width: '100%', ...style }}
      className={className}
      placeholder={placeholder || `请选择${label}`}
      showSearch
      allowClear
      loading={loading || externalLoading}
      disabled={disabled}
      options={options}
      size={size}
      onChange={onChange}
      value={value}
      quickCreate={{
        label: '创建新项',
        onClick: () => {
          createForm.resetFields();
          setCreateModalVisible(true);
        },
      }}
    />
  );

  const modal = (
    <Modal
      title={`创建新的${label}项`}
      open={createModalVisible}
      onOk={handleCreateItem}
      onCancel={() => {
        setCreateModalVisible(false);
        createForm.resetFields();
      }}
      confirmLoading={creating}
      okText="创建"
      cancelText="取消"
      zIndex={2000} // 确保在 Table 单元格等复杂场景下也能正确覆盖
    >
      <Form form={createForm} layout="vertical" preserve={false}>
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
      </Form>
    </Modal>
  );

  if (noStyle) {
    return (
      <>
        {dropdown}
        {modal}
      </>
    );
  }

  return (
    <>
      <ProForm.Item
        name={name}
        label={label}
        rules={mergedRules}
        initialValue={initialValue}
        colProps={effectiveColProps}
        className="dictionary-select-form-item"
      >
        {dropdown}
      </ProForm.Item>
      {modal}
    </>
  );
};


export default DictionarySelect;
