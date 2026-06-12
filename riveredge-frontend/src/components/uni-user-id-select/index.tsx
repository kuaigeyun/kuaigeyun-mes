import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { App, Form } from 'antd';
import { ProFormSelect } from '@ant-design/pro-components';
import { useDebounceFn } from 'ahooks';
import type { NamePath } from 'antd/es/form/interface';
import {
  getUserList,
  resolveUserDisplay,
  searchUserDisplay,
  type UserDisplayItem,
} from '../../services/user';
import { useGlobalStore } from '../../stores';
import { useProFormReadonlyMode } from '../../utils/proFormReadonly';
import {
  canPickUsersForDisplay,
  canReadUserDirectory,
  formatUserDisplayLabel,
} from '../../utils/userDisplay';

export type UniUserIdSelectPreset = {
  id: number;
  label?: string;
  department_uuid?: string;
};

export type UniUserIdSearchFn = (
  keyword?: string,
  selectedIds?: number[],
) => Promise<Array<{ label: string; value: number }>>;

export interface UniUserIdSelectProps {
  name: NamePath;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  activeOnly?: boolean;
  departmentUuid?: string;
  /** 编辑回显：单据快照名或已知 id→label */
  presetUsers?: UniUserIdSelectPreset[];
  /** 业务域自定义人员搜索（如试模单 create/update 权限即可选人，不依赖 system:user:read） */
  searchUsers?: UniUserIdSearchFn;
  /** 选中人员时回调（含 department_uuid，便于联动部门） */
  onUserPicked?: (user: UserDisplayItem | undefined) => void;
  [key: string]: unknown;
}

/**
 * 统一的人员选择（值为用户数字 ID，供业务单据 applicant_user_id 等字段）。
 *
 * - 有 system:user:read → 走原 getUserList
 * - 其他情况 → display-search / display-resolve
 * - 前端不做 display 显式权限阻断，后端统一裁决
 */
export const UniUserIdSelect: React.FC<UniUserIdSelectProps> = ({
  name,
  label = '人员',
  placeholder = '请输入人员姓名或账号搜索',
  required = false,
  disabled = false,
  readonly = false,
  activeOnly = true,
  departmentUuid,
  presetUsers,
  searchUsers,
  onUserPicked,
  ...restProps
}) => {
  const { message } = App.useApp();
  const currentUser = useGlobalStore((s) => s.currentUser);
  const isReadonlyMode = useProFormReadonlyMode(readonly);
  const canPickDirectory = canPickUsersForDisplay(currentUser);
  const canInteract = !isReadonlyMode && !disabled && (Boolean(searchUsers) || canPickDirectory);
  const canResolveLabels = Boolean(searchUsers) || canPickDirectory;
  const useFullList = canReadUserDirectory(currentUser);

  const [options, setOptions] = useState<{ label: string; value: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const deptByUserIdRef = useRef<Map<number, string>>(new Map());
  const labelByIdRef = useRef<Map<number, string>>(new Map());
  const displayCacheRef = useRef<Map<number, UserDisplayItem>>(new Map());

  const form = Form.useFormInstance();
  const watchedId = Form.useWatch(name, form);

  const needsLabelResolve = (id: number): boolean => {
    const lbl = labelByIdRef.current.get(id);
    return !lbl || lbl === String(id) || lbl === `用户#${id}`;
  };

  const syncOptionsFromLabelMap = useCallback(() => {
    const opts = Array.from(labelByIdRef.current.entries()).map(([id, lbl]) => ({
      label: lbl,
      value: id,
    }));
    setOptions(opts);
  }, []);

  const mergePresets = useCallback((extra?: UniUserIdSelectPreset[]) => {
    const labelMap = new Map(labelByIdRef.current);
    const deptMap = new Map(deptByUserIdRef.current);
    for (const p of extra || presetUsers || []) {
      if (p.id == null) continue;
      const lbl = (p.label || '').trim() || labelMap.get(p.id) || `用户#${p.id}`;
      labelMap.set(p.id, lbl);
      if (p.department_uuid) deptMap.set(p.id, p.department_uuid);
    }
    labelByIdRef.current = labelMap;
    deptByUserIdRef.current = deptMap;
    syncOptionsFromLabelMap();
  }, [presetUsers, syncOptionsFromLabelMap]);

  const ingestDisplayItems = useCallback((items: UserDisplayItem[]) => {
    const labelMap = new Map(labelByIdRef.current);
    const deptMap = new Map(deptByUserIdRef.current);
    const cache = new Map(displayCacheRef.current);
    for (const u of items) {
      labelMap.set(u.id, u.label || formatUserDisplayLabel(u));
      if (u.department_uuid) deptMap.set(u.id, u.department_uuid);
      cache.set(u.id, u);
    }
    labelByIdRef.current = labelMap;
    deptByUserIdRef.current = deptMap;
    displayCacheRef.current = cache;
    syncOptionsFromLabelMap();
  }, [syncOptionsFromLabelMap]);

  const resolveUserIdsToLabels = useCallback(
    async (ids: number[]) => {
      if (!canResolveLabels) {
        mergePresets();
        return;
      }
      const unique = [...new Set(ids.filter((id) => Number.isFinite(id) && id > 0))];
      const missing = unique.filter((id) => needsLabelResolve(id));
      if (!missing.length) {
        syncOptionsFromLabelMap();
        return;
      }
      try {
        if (searchUsers) {
          const opts = await searchUsers(undefined, missing);
          ingestDisplayItems(
            opts.map((o) => ({
              id: o.value,
              uuid: '',
              username: '',
              label: o.label,
            })),
          );
          return;
        }
        const resolved = await resolveUserDisplay({ user_ids: missing });
        ingestDisplayItems(resolved);
      } catch {
        mergePresets();
      }
    },
    [canResolveLabels, ingestDisplayItems, mergePresets, searchUsers, syncOptionsFromLabelMap],
  );

  const fetchUsers = async (searchText: string = '') => {
    if (!canInteract) {
      mergePresets();
      return;
    }
    setLoading(true);
    try {
      if (searchUsers) {
        const wid = watchedId != null ? Number(watchedId) : NaN;
        const selectedIds = Number.isFinite(wid) ? [wid] : [];
        const opts = await searchUsers(searchText.trim() || undefined, selectedIds);
        ingestDisplayItems(
          opts.map((o) => ({
            id: o.value,
            uuid: '',
            username: '',
            label: o.label,
          })),
        );
        return;
      }
      if (useFullList) {
        const response = await getUserList({
          page: 1,
          page_size: 50,
          keyword: searchText,
          ...(activeOnly ? { is_active: true } : {}),
          ...(departmentUuid ? { department_uuid: departmentUuid } : {}),
        });
        const items = response.items || [];
        const labelMap = new Map(labelByIdRef.current);
        const deptMap = new Map(deptByUserIdRef.current);
        const cache = new Map(displayCacheRef.current);
        for (const u of items) {
          const lbl = formatUserDisplayLabel(u);
          labelMap.set(u.id, lbl);
          const du = u.department_uuid || u.department?.uuid;
          if (du) deptMap.set(u.id, du);
          cache.set(u.id, {
            id: u.id,
            uuid: u.uuid,
            username: u.username,
            full_name: u.full_name ?? null,
            label: lbl,
            department_uuid: du,
          });
        }
        labelByIdRef.current = labelMap;
        deptByUserIdRef.current = deptMap;
        displayCacheRef.current = cache;
        syncOptionsFromLabelMap();
      } else {
        const response = await searchUserDisplay({
          page: 1,
          page_size: 50,
          keyword: searchText || undefined,
          ...(activeOnly ? { is_active: true } : {}),
          ...(departmentUuid ? { department_uuid: departmentUuid } : {}),
        });
        ingestDisplayItems(response.items || []);
      }
    } catch {
      if (!isReadonlyMode) {
        message.error('加载人员列表失败，请稍后重试');
      }
      mergePresets();
    } finally {
      setLoading(false);
    }
  };

  const { run: debounceFetch } = useDebounceFn((value: string) => fetchUsers(value), { wait: 300 });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      mergePresets();
      const presetIds = (presetUsers || []).map((p) => p.id).filter((id) => id != null);
      const wid = watchedId != null ? Number(watchedId) : NaN;
      const ids = [...presetIds];
      if (Number.isFinite(wid)) ids.push(wid);
      if (!cancelled) await resolveUserIdsToLabels(ids);
      if (!cancelled && canInteract) void fetchUsers();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOnly, departmentUuid, canInteract, canResolveLabels, useFullList, searchUsers, isReadonlyMode]);

  useEffect(() => {
    mergePresets(presetUsers);
  }, [presetUsers, mergePresets]);

  useEffect(() => {
    const wid = watchedId != null ? Number(watchedId) : NaN;
    if (!Number.isFinite(wid)) return;
    void resolveUserIdsToLabels([wid]);
  }, [watchedId, resolveUserIdsToLabels]);

  const effectiveReadonly = isReadonlyMode || disabled || !canInteract;

  const handleChange = (val: number | undefined) => {
    if (val == null) {
      onUserPicked?.(undefined);
      return;
    }
    const cached = displayCacheRef.current.get(val);
    if (cached) {
      onUserPicked?.(cached);
      return;
    }
    onUserPicked?.({
      id: val,
      uuid: '',
      username: '',
      label: labelByIdRef.current.get(val) || String(val),
      department_uuid: deptByUserIdRef.current.get(val),
    });
  };

  const mergedOptions = useMemo(() => options, [options]);

  return (
    <ProFormSelect
      name={name}
      label={label}
      placeholder={placeholder}
      readonly={effectiveReadonly}
      disabled={disabled}
      rules={required ? [{ required: true, message: `请选择${label}` }] : undefined}
      options={mergedOptions}
      fieldProps={{
        showSearch: canInteract,
        loading,
        filterOption: false,
        onSearch: canInteract ? debounceFetch : undefined,
        onChange: handleChange,
      }}
      {...restProps}
    />
  );
};

export default UniUserIdSelect;
