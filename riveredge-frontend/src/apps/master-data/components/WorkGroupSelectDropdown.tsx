/**
 * 工作小组选择下拉：UniDropdown + WorkGroupFormModal（快速新建/编辑）
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { App, theme } from 'antd';
import { useTranslation } from 'react-i18next';
import { UniDropdown, type UniDropdownProps } from '../../../components/uni-dropdown';
import { MODAL_NESTED_ABOVE_PARENT_OFFSET } from '../../../components/layout-templates/constants';
import { useGlobalStore } from '../../../stores/globalStore';
import { hasPermission } from '../../../utils/permission';
import type { WorkGroup } from '../types/factory';
import { factoryListItems, workGroupApi } from '../services/factory';
import { WorkGroupFormModal } from './WorkGroupFormModal';
import { useCurrentUser } from '../../../hooks/useCurrentUser';

function formatWorkGroupLabel(wg: WorkGroup | Record<string, unknown>): string {
  const row = wg as Record<string, unknown>;
  const code = String(row.code ?? '').trim();
  const name = String(row.name ?? '').trim();
  if (code && name) return `${code} ${name}`;
  return name || code || String(row.id ?? '');
}

function getWorkGroupId(wg: WorkGroup | Record<string, unknown>): number | undefined {
  const id = (wg as Record<string, unknown>).id;
  return id != null ? Number(id) : undefined;
}

/** 成员姓名摘要（兼容 camelCase / snake_case） */
function formatWorkGroupMemberNames(
  wg: WorkGroup | Record<string, unknown>,
  options?: { maxNames?: number },
): string {
  const members = ((wg as WorkGroup).members ??
    (wg as Record<string, unknown>).members ??
    []) as Array<Record<string, unknown>>;
  if (!Array.isArray(members) || members.length === 0) return '';
  const names = members
    .map((m) => String(m.employeeName ?? m.employee_name ?? '').trim())
    .filter(Boolean);
  if (names.length === 0) return '';
  const maxNames = options?.maxNames ?? 6;
  if (names.length <= maxNames) return names.join('、');
  return `${names.slice(0, maxNames).join('、')} 等${names.length}人`;
}

function formatWorkGroupOptionLabel(wg: WorkGroup | Record<string, unknown>): string {
  const base = formatWorkGroupLabel(wg);
  const members = formatWorkGroupMemberNames(wg);
  return members ? `${base} ${members}` : base;
}

export type WorkGroupSelectDropdownProps = Omit<
  UniDropdownProps,
  'options' | 'quickCreate' | 'quickEdit' | 'advancedSearch' | 'loading'
> & {
  workGroups?: WorkGroup[];
  loading?: boolean;
  onWorkGroupsChange?: (workGroups: WorkGroup[]) => void;
  onWorkGroupPick?: (workGroup: WorkGroup | null) => void;
  modalZIndex?: number;
  autoLoad?: boolean;
};

export const WorkGroupSelectDropdown: React.FC<WorkGroupSelectDropdownProps> = ({
  workGroups: workGroupsProp,
  loading: loadingProp,
  onWorkGroupsChange,
  onWorkGroupPick,
  modalZIndex,
  autoLoad = true,
  onChange,
  value,
  ...rest
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const currentUser = useCurrentUser();
  const { token } = theme.useToken();
  const [internalList, setInternalList] = useState<WorkGroup[]>([]);
  const [internalLoading, setInternalLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editUuid, setEditUuid] = useState<string | null>(null);

  const workGroups = workGroupsProp ?? internalList;
  const loading = loadingProp ?? internalLoading;

  const mergeList = useCallback((prev: WorkGroup[], created: WorkGroup) => {
    const matchKey = created.uuid ?? created.id;
    const idx = prev.findIndex((w) => (w.uuid ?? w.id) === matchKey);
    if (idx >= 0) {
      const next = [...prev];
      next[idx] = { ...next[idx], ...created };
      return next;
    }
    return [...prev, created];
  }, []);

  const refreshList = useCallback(
    async (keyword?: string) => {
      setInternalLoading(true);
      try {
        const listRes = await workGroupApi.list({
          is_active: true,
          limit: 500,
          keyword: keyword?.trim() || undefined,
        });
        const list = factoryListItems(listRes as any);
        if (workGroupsProp == null) {
          setInternalList(list);
        }
        onWorkGroupsChange?.(list);
        return list;
      } catch (error: any) {
        messageApi.warning(error?.message || t('app.master-data.workGroups.listFetchFailed'));
        return [];
      } finally {
        setInternalLoading(false);
      }
    },
    [messageApi, onWorkGroupsChange, t, workGroupsProp],
  );

  useEffect(() => {
    if (autoLoad && workGroupsProp == null) {
      void refreshList();
    }
  }, [autoLoad, refreshList, workGroupsProp]);

  const options = useMemo(
    () =>
      workGroups
        .filter((w) => Number(getWorkGroupId(w)) > 0)
        .map((w) => ({
          value: Number(getWorkGroupId(w)),
          label: formatWorkGroupOptionLabel(w),
        })),
    [workGroups],
  );

  const optionRender = useCallback<NonNullable<UniDropdownProps['optionRender']>>(
    (option) => {
      const wg = workGroups.find((w) => getWorkGroupId(w) === option.value);
      const code = String((wg as any)?.code ?? '').trim();
      const name = String((wg as any)?.name ?? '').trim();
      const title = code || name || String(option.label ?? '');
      const nameLine = code && name ? name : '';
      const membersLine = wg ? formatWorkGroupMemberNames(wg) : '';
      return (
        <div style={{ lineHeight: 1.35, whiteSpace: 'normal', padding: '2px 0', maxWidth: 360 }}>
          <div style={{ fontWeight: 500, color: token.colorText }}>{title}</div>
          {nameLine ? (
            <div style={{ fontSize: 12, color: token.colorTextSecondary }}>{nameLine}</div>
          ) : null}
          {membersLine ? (
            <div style={{ fontSize: 12, color: token.colorTextTertiary, marginTop: 2 }}>
              {membersLine}
            </div>
          ) : null}
        </div>
      );
    },
    [token.colorText, token.colorTextSecondary, token.colorTextTertiary, workGroups],
  );

  const handleChange = useCallback(
    (nextValue: number | undefined, option: unknown) => {
      const picked =
        nextValue != null
          ? workGroups.find((w) => getWorkGroupId(w) === nextValue) ?? null
          : null;
      onWorkGroupPick?.(picked);
      onChange?.(nextValue, option as Parameters<NonNullable<UniDropdownProps['onChange']>>[1]);
    },
    [onChange, onWorkGroupPick, workGroups],
  );

  const openCreate = useCallback(() => {
    setEditUuid(null);
    setFormOpen(true);
  }, []);

  const openEdit = useCallback(
    (workGroupId: unknown) => {
      const wg = workGroups.find((w) => getWorkGroupId(w) === workGroupId);
      const uuid = wg?.uuid;
      if (!uuid) {
        messageApi.warning(t('app.master-data.workGroups.getDetailFailed'));
        return;
      }
      setEditUuid(String(uuid));
      setFormOpen(true);
    },
    [messageApi, t, workGroups],
  );

  const handleSuccess = useCallback(
    (created: WorkGroup) => {
      const nextList = mergeList(workGroups, created);
      if (workGroupsProp == null) {
        setInternalList(nextList);
      }
      onWorkGroupsChange?.(nextList);
      onWorkGroupPick?.(created);
      onChange?.(created.id, {
        value: created.id,
        label: formatWorkGroupOptionLabel(created),
      });
      setFormOpen(false);
      setEditUuid(null);
    },
    [mergeList, onChange, onWorkGroupPick, onWorkGroupsChange, workGroups, workGroupsProp],
  );

  const canCreate = hasPermission(currentUser, 'master-data:factory:work-group:create');
  const canUpdate = hasPermission(currentUser, 'master-data:factory:work-group:update');
  const nestedZIndex =
    modalZIndex != null ? modalZIndex + MODAL_NESTED_ABOVE_PARENT_OFFSET : undefined;

  return (
    <>
      <UniDropdown
        {...rest}
        value={value}
        showSearch
        allowClear
        loading={loading}
        options={options}
        optionRender={optionRender}
        labelRender={(props) => {
          const wg = workGroups.find((w) => getWorkGroupId(w) === props.value);
          return wg ? formatWorkGroupLabel(wg) : (props.label ?? '');
        }}
        popupMatchSelectWidth={false}
        styles={{
          ...rest.styles,
          popup: {
            ...rest.styles?.popup,
            root: { minWidth: 300, ...(rest.styles?.popup as any)?.root },
          },
        }}
        onChange={handleChange}
        optionFilterProp="label"
        quickCreate={
          canCreate
            ? {
                label: t('app.kuaizhizao.workReporting.quickCreateWorkGroup'),
                onClick: openCreate,
              }
            : undefined
        }
        quickEdit={
          canUpdate
            ? {
                label: t('field.workGroup.editTitle'),
                onEdit: openEdit,
              }
            : undefined
        }
        advancedSearch={{
          label: t('components.uniTable.advancedSearch', { defaultValue: '高级搜索' }),
          fields: [
            {
              name: 'keyword',
              label: t('components.uniTable.fuzzySearch', { defaultValue: '关键词' }),
            },
          ],
          onSearch: async (values) => {
            const list = await refreshList(String(values.keyword ?? ''));
            return list
              .filter((w) => Number(getWorkGroupId(w)) > 0)
              .map((w) => ({
                value: Number(getWorkGroupId(w)),
                label: formatWorkGroupOptionLabel(w),
              }));
          },
        }}
      />
      {formOpen ? (
        <WorkGroupFormModal
          open
          onClose={() => {
            setFormOpen(false);
            setEditUuid(null);
          }}
          editUuid={editUuid}
          onSuccess={handleSuccess}
          zIndex={nestedZIndex}
        />
      ) : null}
    </>
  );
};
