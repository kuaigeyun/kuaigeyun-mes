import React, { useMemo, useState, useEffect } from 'react';
import { App } from 'antd';
import { ProFormSelect } from '@ant-design/pro-components';
import { useDebounceFn } from 'ahooks';
import { NamePath } from 'antd/es/form/interface';
import { getUserList, User } from '../../services/user';

interface UniUserSelectProps {
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
  /** 是否只查询启用状态的用户，默认为 true */
  activeOnly?: boolean;
  /** 限定查询某个部门下的用户UUID */
  departmentUuid?: string;
  /** 限定查询某个岗位下的用户UUID */
  positionUuid?: string;
  /** 是否支持多选 */
  mode?: 'multiple' | 'tags';
  /** 自定义宽度 */
  width?: number | 'sm' | 'md' | 'xl' | 'xs' | 'lg';
  /** 值改变时的回调，返回完整的 User 对象以供业务表单进一步同步字段 */
  onChange?: (value: any, user: User | User[] | undefined) => void;
  /** 透传其他 ProFormSelect 属性 */
  [key: string]: any;
}

/**
 * 统一的人员/角色选择组件
 *
 * @description
 * 封装了 `getUserList` API。支持防抖搜索、限定部门和禁用过滤。
 * 组件自带对后端结构转换为 Select option 结构的映射。
 */
export const UniUserSelect: React.FC<UniUserSelectProps> = ({
  name,
  label = '人员',
  placeholder = '请输入人员姓名或账号搜索',
  required = false,
  disabled = false,
  readonly = false,
  activeOnly = true,
  departmentUuid,
  positionUuid,
  mode,
  width,
  onChange,
  ...restProps
}) => {
  const { message } = App.useApp();
  const [data, setData] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchUsers = async (searchText: string = '') => {
    setLoading(true);
    try {
      const response = await getUserList({
        page: 1,
        page_size: 50,
        keyword: searchText,
        ...(activeOnly ? { is_active: true } : {}),
        ...(departmentUuid ? { department_uuid: departmentUuid } : {}),
        ...(positionUuid ? { position_uuid: positionUuid } : {}),
      });
      setData(response.items || []);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      message.error('加载人员列表失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const { run: debounceFetch } = useDebounceFn(
    (value: string) => fetchUsers(value),
    { wait: 300 }
  );

  useEffect(() => {
    fetchUsers();
    // 只在入参过滤条件变化时重新初次拉取
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOnly, departmentUuid, positionUuid]);

  const handleChange = (val: any, _option: any) => {
    if (!onChange) return;

    if (mode === 'multiple' || mode === 'tags') {
      const vals = Array.isArray(val) ? val : [];
      const selectedUsers = data.filter((u) => vals.includes(u.uuid));
      onChange(val, selectedUsers);
    } else {
      const selectedUser = data.find((u) => u.uuid === val);
      onChange(val, selectedUser);
    }
  };

  const options = useMemo(() => {
    return data.map((item) => ({
      label: item.full_name ? `${item.full_name} (${item.username})` : item.username,
      value: item.uuid,
      key: item.uuid,
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
        mode,
        showSearch: true,
        loading,
        filterOption: false, // 禁用默认前端过滤，配合关键字查询后端结果
        onSearch: debounceFetch,
        onChange: handleChange,
      }}
      {...restProps}
    />
  );
};

export default UniUserSelect;
