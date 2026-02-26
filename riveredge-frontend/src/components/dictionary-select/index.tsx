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
import { Modal, Input, message, App } from 'antd';
import { ProForm } from '@ant-design/pro-components';
import { UniDropdown } from '../uni-dropdown';
import {
  getDataDictionaryByCode,
  getDictionaryItemList,
  createDictionaryItem,
} from '../../services/dataDictionary';

const { TextArea } = Input;

/**
 * 数据字典选择组件属性
 */
export interface DictionarySelectProps {
  /** 字典代码 */
  dictionaryCode: string;
  /** 字段名称 */
  name: string;
  /** 标签 */
  label: string;
  /** 占位符 */
  placeholder?: string;
  /** 是否必填 */
  required?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 加载状态 */
  loading?: boolean;
  /** 初始值 */
  initialValue?: string;
  /** 列属性（用于ProForm布局） */
  colProps?: { span: number };
  /** 验证规则 */
  rules?: any[];
  /** 表单实例引用（用于创建新项后更新表单值） */
  formRef?: React.RefObject<any>;
}

/**
 * 数据字典选择组件（基于 UniDropdown）
 */
export const DictionarySelect: React.FC<DictionarySelectProps> = ({
  dictionaryCode,
  name,
  label,
  placeholder,
  required = false,
  disabled = false,
  loading: externalLoading = false,
  initialValue,
  colProps,
  rules,
  formRef,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const [options, setOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createLabel, setCreateLabel] = useState('');
  const [createValue, setCreateValue] = useState('');
  const [createDescription, setCreateDescription] = useState('');
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
    if (!createLabel.trim() || !createValue.trim()) {
      messageApi.warning(t('components.dictionarySelect.enterLabelAndValue'));
      return;
    }

    const exists = options.some(option => option.value === createValue.trim());
    if (exists) {
      messageApi.warning(t('components.dictionarySelect.valueExists'));
      return;
    }

    try {
      setCreating(true);
      const newItem = await createDictionaryItem(dictionaryUuid, {
        label: createLabel.trim(),
        value: createValue.trim(),
        description: createDescription.trim() || undefined,
        is_active: true,
        sort_order: options.length,
      });

      messageApi.success(t('common.createSuccess'));
      setCreateModalVisible(false);
      setCreateLabel('');
      setCreateValue('');
      setCreateDescription('');

      await loadDictionaryItems();

      const newValue = newItem.value;
      if (formRef?.current) {
        formRef.current.setFieldsValue({ [name]: newValue });
      }

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
        <div className="dictionary-select-wrapper">
          <UniDropdown
            placeholder={placeholder || `请选择${label}`}
            showSearch
            allowClear
            loading={loading || externalLoading}
            disabled={disabled}
            options={options}
            quickCreate={{
              label: '创建新项',
              onClick: () => {
                setCreateLabel('');
                setCreateValue('');
                setCreateDescription('');
                setCreateModalVisible(true);
              },
            }}
          />
        </div>
      </ProForm.Item>

      <Modal
        title={`创建新的${label}项`}
        open={createModalVisible}
        onOk={handleCreateItem}
        onCancel={() => {
          setCreateModalVisible(false);
          setCreateLabel('');
          setCreateValue('');
          setCreateDescription('');
        }}
        confirmLoading={creating}
        okText="创建"
        cancelText="取消"
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>标签 *</div>
          <Input
            value={createLabel}
            onChange={(e) => setCreateLabel(e.target.value)}
            placeholder="请输入标签（显示名称）"
            maxLength={100}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>值 *</div>
          <Input
            value={createValue}
            onChange={(e) => setCreateValue(e.target.value)}
            placeholder="请输入值（唯一标识）"
            maxLength={100}
          />
        </div>
        <div>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>描述</div>
          <TextArea
            value={createDescription}
            onChange={(e) => setCreateDescription(e.target.value)}
            placeholder="请输入描述（可选）"
            rows={3}
            maxLength={500}
          />
        </div>
      </Modal>
    </>
  );
};

export default DictionarySelect;
