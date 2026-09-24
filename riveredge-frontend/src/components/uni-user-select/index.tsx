import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  /** 每页条数（display-search 上限 200） */
  pageSize?: number;
  /** 无搜索关键词时自动分页拉全量（上限 5 页） */
  loadAllWhenNoKeyword?: boolean;
  /** 限定查询某个部门下的用户UUID */
  departmentUuid?: string;
  /** 限定查询某个岗位下的用户UUID */
  positionUuid?: string;
  /** 是否支持多选 */
  mode?: 'multiple' | 'tags';
  /** 自定义宽度 */
  width?: number | 'sm' | 'md' | 'xl' | 'xs' | 'lg';
  /**
   * 值改变时的回调，返回完整的 User 对象以供业务表单进一步同步字段。
   * 注意：不要经 fieldProps.onChange 转发——会覆盖 ProForm 写回表单值，导致二次保存不生效。
   */
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

function orderUsersByUuids(users: User[], uuids: string[]): User[] {
  const byUuid = new Map(users.map((u) => [u.uuid, u]));
  return uuids.map((id) => byUuid.get(id)).filter((u): u is User => Boolean(u));
}

const DEFAULT_PICKER_PAGE_SIZE = 200;
const MAX_PICKER_AUTO_LOAD_PAGES = 5;

async function fetchAllPickerPages(
  fetchPage: (page: number, pageSize: number) => Promise<{ items: User[]; total: number }>,
  options: { keyword?: string; pageSize: number; loadAllWhenNoKeyword: boolean },
): Promise<User[]> {
  const keyword = options.keyword?.trim();
  const pageSize = options.pageSize;
  const first = await fetchPage(1, pageSize);
  let merged = first.items;
  const total = first.total;

  if (keyword || !options.loadAllWhenNoKeyword || merged.length >= total) {
    return merged;
  }

  let page = 2;
  while (merged.length < total && page <= MAX_PICKER_AUTO_LOAD_PAGES) {
    const next = await fetchPage(page, pageSize);
    merged = mergeUsersByUuid(merged, next.items);
    if (next.items.length < pageSize) break;
    page += 1;
  }
  return merged;
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
  pageSize = DEFAULT_PICKER_PAGE_SIZE,
  loadAllWhenNoKeyword = false,
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
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const dataRef = useRef(data);
  dataRef.current = data;

  const fetchUsers = async (searchText: string = '') => {
    if (!canInteract) {
      setData([]);
      return;
    }
    setLoading(true);
    try {
      const keyword = searchText.trim() || undefined;
      const commonFilters = {
        ...(activeOnly ? { is_active: true } : {}),
        ...(departmentUuid ? { department_uuid: departmentUuid } : {}),
        ...(positionUuid ? { position_uuid: positionUuid } : {}),
      };
      const items = await fetchAllPickerPages(
        async (page, size) => {
          if (useFullList) {
            const response = await getUserList({
              page,
              page_size: size,
              keyword,
              ...commonFilters,
            });
            return {
              items: response.items || [],
              total: response.total ?? (response.items || []).length,
            };
          }
          const response = await searchUserDisplay({
            page,
            page_size: size,
            keyword,
            ...commonFilters,
          });
          return {
            items: (response.items || []).map(displayItemToUser),
            total: response.total ?? (response.items || []).length,
          };
        },
        { keyword, pageSize, loadAllWhenNoKeyword },
      );
      setData(items);
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
  }, [activeOnly, departmentUuid, positionUuid, canInteract, useFullList, pageSize, loadAllWhenNoKeyword]);

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

  /**
   * 经 Form.useWatch 通知父级，避免 fieldProps.onChange 覆盖 ProForm 写值
   *（覆盖后受控值卡住，编辑保存仍提交旧人员）。
   */
  useEffect(() => {
    const notify = onChangeRef.current;
    if (!notify) return;

    let cancelled = false;
    void (async () => {
      const selectedUuids = collectSelectedUuids(watchedValue, mode);
      if (!selectedUuids.length) {
        if (!cancelled) {
          notify(
            mode === 'multiple' || mode === 'tags' ? [] : undefined,
            mode === 'multiple' || mode === 'tags' ? [] : undefined,
          );
        }
        return;
      }

      const cached = dataRef.current.filter((u) => selectedUuids.includes(u.uuid));
      const missing = selectedUuids.filter((id) => !cached.some((u) => u.uuid === id));
      let pool = cached;
      if (missing.length) {
        try {
          const resolved = await resolveUserDisplay({ user_uuids: missing });
          pool = mergeUsersByUuid(cached, resolved.map(displayItemToUser));
          if (!cancelled) {
            setData((prev) => mergeUsersByUuid(prev, resolved.map(displayItemToUser)));
          }
        } catch (error) {
          console.error('Failed to resolve users for onChange:', error);
        }
      }
      if (cancelled) return;

      const ordered = orderUsersByUuids(pool, selectedUuids);
      if (mode === 'multiple' || mode === 'tags') {
        notify(watchedValue, ordered);
      } else {
        notify(watchedValue, ordered[0]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [watchedValue, mode]);

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
        // 故意不传 onChange：会覆盖 ProForm createField 写回逻辑
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
