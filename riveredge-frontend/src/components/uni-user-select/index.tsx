import React, { useEffect, useMemo, useState } from 'react';
import { App, Form, Space, Tag } from 'antd';
import { ProFormSelect } from '@ant-design/pro-components';
import { useDebounceFn } from 'ahooks';
import { NamePath } from 'antd/es/form/interface';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import {
  getUserList,
  resolveUserDisplay,
  searchUserDisplay,
  type User,
  type UserDisplayItem,
} from '../../services/user';
import { useGlobalStore } from '../../stores';
import { useProFormReadonlyMode } from '../../utils/proFormReadonly';
import {
  canPickUsersForDisplay,
  canReadUserDirectory,
  formatUserDisplayLabel,
} from '../../utils/userDisplay';

interface UniUserSelectProps {
  /** 表单字段名称 */
  name: NamePath;
  /** 标签 */
  label?: React.ReactNode;
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
  /** 下拉中对这些用户 ID 展示「默认」徽章（如工序档案默认生产人员） */
  defaultBadgeUserIds?: number[];
  /** 透传其他 ProFormSelect 属性 */
  [key: string]: any;
}

function displayItemToUser(item: UserDisplayItem): User {
  return {
    id: item.id,
    uuid: item.uuid,
    username: item.username,
    full_name: item.full_name ?? undefined,
    is_active: true,
    is_tenant_admin: false,
    tenant_id: 0,
    created_at: '',
    updated_at: '',
    department_uuid: item.department_uuid ?? undefined,
  };
}

function collectSelectedUuids(value: unknown, mode?: 'multiple' | 'tags'): string[] {
  if (mode === 'multiple' || mode === 'tags') {
    return (Array.isArray(value) ? value : [])
      .map((v) => String(v ?? '').trim())
      .filter(Boolean);
  }
  const single = String(value ?? '').trim();
  return single ? [single] : [];
}

function mergeUsersByUuid(prev: User[], incoming: User[]): User[] {
  const next = [...prev];
  for (const user of incoming) {
    if (!user.uuid || next.some((item) => item.uuid === user.uuid)) continue;
    next.unshift(user);
  }
  return next;
}

/**
 * 统一的人员/角色选择组件
 *
 * @description
 * 有 system:user:read 时走 getUserList；否则走 display-search。
 * 前端不再做 display 显式权限阻断，是否可选由后端统一裁决。
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
  defaultBadgeUserIds,
  ...restProps
}) => {
  const { message } = App.useApp();
  const currentUser = useCurrentUser();
  const isReadonlyMode = useProFormReadonlyMode(readonly);
  const canPick = canPickUsersForDisplay(currentUser);
  const canInteract = !isReadonlyMode && !disabled && canPick;
  const useFullList = canReadUserDirectory(currentUser);

  const [data, setData] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const form = Form.useFormInstance();
  const watchedValue = Form.useWatch(name, form);

  const fetchUsers = async (searchText: string = '') => {
    if (!canInteract) {
      setData([]);
      return;
    }
    setLoading(true);
    try {
      if (useFullList) {
        const response = await getUserList({
          page: 1,
          page_size: 50,
          keyword: searchText,
          ...(activeOnly ? { is_active: true } : {}),
          ...(departmentUuid ? { department_uuid: departmentUuid } : {}),
          ...(positionUuid ? { position_uuid: positionUuid } : {}),
        });
        setData(response.items || []);
      } else {
        const response = await searchUserDisplay({
          page: 1,
          page_size: 50,
          keyword: searchText || undefined,
          ...(activeOnly ? { is_active: true } : {}),
          ...(departmentUuid ? { department_uuid: departmentUuid } : {}),
          ...(positionUuid ? { position_uuid: positionUuid } : {}),
        });
        setData((response.items || []).map(displayItemToUser));
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
      if (!isReadonlyMode) {
        message.error('加载人员列表失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  const { run: debounceFetch } = useDebounceFn(
    (value: string) => fetchUsers(value),
    { wait: 300 },
  );

  useEffect(() => {
    if (!canInteract) return;
    void fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOnly, departmentUuid, positionUuid, canInteract, useFullList]);

  /** 表单预填 uuid 时，解析展示名并并入 options（避免 Select 回显原始 UUID） */
  useEffect(() => {
    if (!canInteract) return;
    const selectedUuids = collectSelectedUuids(watchedValue, mode);
    if (!selectedUuids.length) return;

    let cancelled = false;
    void (async () => {
      try {
        const resolved = await resolveUserDisplay({ user_uuids: selectedUuids });
        if (cancelled) return;
        setData((prev) => mergeUsersByUuid(prev, resolved.map(displayItemToUser)));
      } catch (error) {
        console.error('Failed to resolve selected users:', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [watchedValue, canInteract, mode]);

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

  const defaultIdSet = useMemo(
    () => new Set((defaultBadgeUserIds || []).filter((n) => typeof n === 'number')),
    [defaultBadgeUserIds],
  );

  const options = useMemo(() => {
    return data.map((item) => ({
      label: formatUserDisplayLabel(item),
      value: item.uuid,
      key: item.uuid,
    }));
  }, [data]);

  const effectiveReadonly = isReadonlyMode || disabled || !canPick;

  return (
    <ProFormSelect
      name={name}
      label={label}
      placeholder={placeholder}
      readonly={effectiveReadonly}
      disabled={disabled}
      width={width}
      rules={
        required
          ? [
              {
                required: true,
                message: `请选择${typeof label === 'string' && label ? label : '人员'}`,
              },
            ]
          : undefined
      }
      options={options}
      fieldProps={{
        mode,
        showSearch: canInteract,
        loading,
        filterOption: false,
        onSearch: canInteract ? debounceFetch : undefined,
        onChange: handleChange,
        optionRender: (ori) => {
          const u = data.find((item) => item.uuid === ori.value);
          const text =
            typeof ori.label === 'string'
              ? ori.label
              : u
                ? formatUserDisplayLabel(u)
                : '';
          return (
            <Space size={6} wrap>
              <span>{text}</span>
              {u && defaultIdSet.has(u.id) ? <Tag color="blue">默认</Tag> : null}
            </Space>
          );
        },
      }}
      {...restProps}
    />
  );
};

export default UniUserSelect;
