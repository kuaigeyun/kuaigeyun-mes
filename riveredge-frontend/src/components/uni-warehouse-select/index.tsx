import React, { useMemo, useState, useEffect } from 'react';
import { App } from 'antd';
import { ProFormSelect } from '@ant-design/pro-components';
import { useDebounceFn } from 'ahooks';
import { warehouseApi } from '../../apps/master-data/services/warehouse';
import { Warehouse } from '../../apps/master-data/types/warehouse';
import { NamePath } from 'antd/es/form/interface';

interface UniWarehouseSelectProps {
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
  /** 只展示启用的仓库，默认为 true */
  activeOnly?: boolean;
  /** 自定义宽度 */
  width?: number | 'sm' | 'md' | 'xl' | 'xs' | 'lg';
  /** 值改变时的回调，额外返回完整的 warehouse 对象 */
  onChange?: (value: number | undefined, warehouse: Warehouse | undefined) => void;
  /** 初始绑定的表单实例等 */
  [key: string]: any;
}

/**
 * 统一仓库选择组件
 *
 * @description
 * 内置防抖搜索与列表数据的自动拉取。
 * 解决了各业务组件中重复手写 `loadWarehouses` 以及维护 `warehouseList` 的模板代码。
 */
export const UniWarehouseSelect: React.FC<UniWarehouseSelectProps> = ({
  name,
  label = '仓库',
  placeholder = '请选择或搜索仓库',
  required = false,
  disabled = false,
  readonly = false,
  activeOnly = true,
  width,
  onChange,
  ...restProps
}) => {
  const { message } = App.useApp();
  const [data, setData] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchWarehouses = async (searchText: string = '') => {
    setLoading(true);
    try {
      const response: any = await warehouseApi.list({
        ...(searchText ? { name: searchText } : {}), // Fallback if API needs name
        ...(activeOnly ? { isActive: true } : {}),
      } as any);
      // 兼容不同服务层的返回结构
      const items = response.data || response.items || response || [];
      setData(items);
    } catch (error) {
      console.error('Failed to fetch warehouses:', error);
      message.error('加载仓库列表失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const { run: debounceFetch } = useDebounceFn(
    (value: string) => fetchWarehouses(value),
    { wait: 300 }
  );

  useEffect(() => {
    // 初始加载一次默认数据
    fetchWarehouses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (val: number, _option: any) => {
    if (onChange) {
      const selected = data.find((w) => w.id === val || w.uuid === val?.toString());
      onChange(val, selected);
    }
  };

  const options = useMemo(() => {
    return data.map((item) => ({
      label: `${item.code} ${item.name}`,
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
      width={width}
      rules={required ? [{ required: true, message: `请选择${label}` }] : undefined}
      options={options}
      fieldProps={{
        showSearch: true,
        loading,
        filterOption: false, // 禁用默认前端过滤，交由防抖后的后端按 keyword 搜索
        onSearch: debounceFetch,
        onChange: handleChange,
      }}
      {...restProps}
    />
  );
};

export default UniWarehouseSelect;
