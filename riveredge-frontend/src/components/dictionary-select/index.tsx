/**
 * 数据字典选择组件
 *
 * 支持从数据字典中选择值，如果字典中不存在，允许快速创建新项
 *
 * Author: Luigi Lu
 * Date: 2025-12-26
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Select, Modal, Input, message, App } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { ProFormSelect } from '@ant-design/pro-components';
import {
  getDataDictionaryByCode,
  getDictionaryItemList,
  createDictionaryItem,
  DictionaryItem,
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
 * 数据字典选择组件
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
  const { message: messageApi } = App.useApp();
  const [options, setOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [searchValue, setSearchValue] = useState('');
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
      // 获取字典信息
      const dictionary = await getDataDictionaryByCode(dictionaryCode);
      setDictionaryUuid(dictionary.uuid);
      // 获取字典项列表（只获取启用的）
      const items = await getDictionaryItemList(dictionary.uuid, true);
      // 转换为选项格式，按排序顺序排列
      const optionsList = items
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(item => ({
          label: item.label,
          value: item.value,
        }));
      setOptions(optionsList);
    } catch (error: any) {
      console.error(`加载字典项失败 (${dictionaryCode}):`, error);
      messageApi.error(`加载${label}选项失败`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 初始化加载字典项
   */
  useEffect(() => {
    loadDictionaryItems();
  }, [dictionaryCode]);

  /**
   * 处理搜索
   */
  const handleSearch = (value: string) => {
    setSearchValue(value);
  };

  /**
   * 过滤选项（用于搜索）
   */
  const filteredOptions = useMemo(() => {
    if (!searchValue) {
      return options;
    }
    return options.filter(option =>
      option.label.toLowerCase().includes(searchValue.toLowerCase()) ||
      option.value.toLowerCase().includes(searchValue.toLowerCase())
    );
  }, [options, searchValue]);

  /**
   * 检查是否需要显示创建选项
   */
  const showCreateOption = useMemo(() => {
    if (!searchValue || !dictionaryUuid) {
      return false;
    }
    // 如果搜索值不在现有选项中，显示创建选项
    const exists = options.some(
      option =>
        option.label.toLowerCase() === searchValue.toLowerCase() ||
        option.value.toLowerCase() === searchValue.toLowerCase()
    );
    return !exists && searchValue.trim().length > 0;
  }, [searchValue, options, dictionaryUuid]);

  /**
   * 处理创建新项
   */
  const handleCreateItem = async () => {
    if (!createLabel.trim() || !createValue.trim()) {
      messageApi.warning('请输入标签和值');
      return;
    }

    // 检查值是否已存在
    const exists = options.some(option => option.value === createValue.trim());
    if (exists) {
      messageApi.warning('该值已存在，请使用其他值');
      return;
    }

    try {
      setCreating(true);
      // 创建字典项
      const newItem = await createDictionaryItem(dictionaryUuid, {
        label: createLabel.trim(),
        value: createValue.trim(),
        description: createDescription.trim() || undefined,
        is_active: true,
        sort_order: options.length, // 添加到末尾
      });

      messageApi.success('创建成功');
      setCreateModalVisible(false);
      setCreateLabel('');
      setCreateValue('');
      setCreateDescription('');
      setSearchValue('');

      // 重新加载字典项列表
      await loadDictionaryItems();

      // 自动选择新创建的项
      const newValue = newItem.value;
      
      // 通过formRef更新表单值
      if (formRef?.current) {
        formRef.current.setFieldsValue({ [name]: newValue });
      }

      return newValue;
    } catch (error: any) {
      console.error('创建字典项失败:', error);
      messageApi.error(error?.response?.data?.detail || '创建失败');
    } finally {
      setCreating(false);
    }
  };

  /**
   * 处理下拉菜单渲染（使用 popupRender，dropdownRender 已废弃）
   */
  const popupRender = (menu: React.ReactElement) => {
    return (
      <>
        {menu}
        {showCreateOption && (
          <div
            style={{
              padding: '8px',
              borderTop: '1px solid #f0f0f0',
              cursor: 'pointer',
            }}
            onClick={() => {
              setCreateLabel(searchValue);
              setCreateValue(searchValue);
              setCreateModalVisible(true);
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f5f5f5';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <PlusOutlined style={{ marginRight: 8 }} />
            创建新项：{searchValue}
          </div>
        )}
      </>
    );
  };

  /**
   * 合并验证规则
   */
  const mergedRules = useMemo(() => {
    const baseRules = rules || [];
    if (required) {
      return [{ required: true, message: `请选择${label}` }, ...baseRules];
    }
    return baseRules;
  }, [required, label, rules]);

  return (
    <>
      <ProFormSelect
        name={name}
        label={label}
        rules={mergedRules}
        initialValue={initialValue}
        options={filteredOptions}
        placeholder={placeholder || `请选择${label}`}
        fieldProps={{
          loading: loading || externalLoading,
          disabled,
          showSearch: true,
          allowClear: true,
          filterOption: false, // 禁用默认过滤，使用自定义过滤
          onSearch: handleSearch,
          popupRender,
        }}
      />

      {/* 创建新项弹窗 */}
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
