/**
 * 工作中心选择下拉：复用 UniDropdown + WorkCenterFormModal（快速新建/编辑）
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { App, theme } from 'antd';
import { useTranslation } from 'react-i18next';
import { UniDropdown, type UniDropdownProps } from '../../../components/uni-dropdown';
import { MODAL_NESTED_ABOVE_PARENT_OFFSET } from '../../../components/layout-templates/constants';
import { useGlobalStore } from '../../../stores/globalStore';
import { hasPermission } from '../../../utils/permission';
import type { WorkCenter } from '../types/factory';
import { factoryListItems, workCenterApi } from '../services/factory';
import { WorkCenterFormModal } from './WorkCenterFormModal';

function getWorkCenterCodeName(wc: WorkCenter | Record<string, unknown>): { code: string; name: string } {
  const row = wc as Record<string, unknown>;
  return {
    code: String(row.code ?? '').trim(),
    name: String(row.name ?? '').trim(),
  };
}

function formatWorkCenterLabel(wc: WorkCenter | Record<string, unknown>): string {
  const { code, name } = getWorkCenterCodeName(wc);
  if (code && name) return `${code} ${name}`;
  return name || code || String((wc as Record<string, unknown>).id ?? '');
}

function getWorkCenterId(wc: WorkCenter | Record<string, unknown>): number | undefined {
  const id = (wc as Record<string, unknown>).id;
  return id != null ? Number(id) : undefined;
}

export type WorkCenterSelectDropdownProps = Omit<
  UniDropdownProps,
  'options' | 'quickCreate' | 'quickEdit' | 'advancedSearch' | 'loading'
> & {
  workCenters?: WorkCenter[];
  loading?: boolean;
  onWorkCentersChange?: (workCenters: WorkCenter[]) => void;
  onWorkCenterPick?: (workCenter: WorkCenter | null) => void;
  modalZIndex?: number;
  /** 未传入 workCenters 时是否自动加载 */
  autoLoad?: boolean;
};

export const WorkCenterSelectDropdown: React.FC<WorkCenterSelectDropdownProps> = ({
  workCenters: workCentersProp,
  loading: loadingProp,
  onWorkCentersChange,
  onWorkCenterPick,
  modalZIndex,
  autoLoad = true,
  onChange,
  value,
  ...rest
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const currentUser = useGlobalStore((s) => s.currentUser);
  const { token } = theme.useToken();
  const [internalList, setInternalList] = useState<WorkCenter[]>([]);
  const [internalLoading, setInternalLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editUuid, setEditUuid] = useState<string | null>(null);

  const workCenters = workCentersProp ?? internalList;
  const loading = loadingProp ?? internalLoading;

  const mergeList = useCallback((prev: WorkCenter[], created: WorkCenter) => {
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
        const listRes = await workCenterApi.list({
          is_active: true,
          limit: 1000,
          keyword: keyword?.trim() || undefined,
        });
        const list = factoryListItems(listRes as any);
        if (workCentersProp == null) {
          setInternalList(list);
        }
        onWorkCentersChange?.(list);
        return list;
      } catch (error: any) {
        messageApi.warning(
          error?.message || t('app.kuaizhizao.salesOrder.loadWorkCentersFailed', {
            defaultValue: '加载工作中心列表失败',
          }),
        );
        return [];
      } finally {
        setInternalLoading(false);
      }
    },
    [messageApi, onWorkCentersChange, t, workCentersProp],
  );

  useEffect(() => {
    if (autoLoad && workCentersProp == null) {
      void refreshList();
    }
  }, [autoLoad, refreshList, workCentersProp]);

  const options = useMemo(
    () =>
      workCenters
        .filter((w) => Number(getWorkCenterId(w)) > 0)
        .map((w) => ({
          value: Number(getWorkCenterId(w)),
          label: formatWorkCenterLabel(w),
        })),
    [workCenters],
  );

  const optionRender = useCallback<NonNullable<UniDropdownProps['optionRender']>>(
    (option) => {
      const wc = workCenters.find((w) => getWorkCenterId(w) === option.value);
      const { code, name } = wc
        ? getWorkCenterCodeName(wc)
        : { code: '', name: String(option.label ?? '') };
      const title = code || name;
      const subtitle = code && name ? name : '';
      return (
        <div style={{ lineHeight: 1.35, whiteSpace: 'normal', padding: '2px 0' }}>
          <div style={{ fontWeight: 500, color: token.colorText }}>{title}</div>
          {subtitle ? (
            <div style={{ fontSize: 12, color: token.colorTextSecondary }}>{subtitle}</div>
          ) : null}
        </div>
      );
    },
    [token.colorText, token.colorTextSecondary, workCenters],
  );

  const handleChange = useCallback(
    (nextValue: number | undefined, option: unknown) => {
      const picked =
        nextValue != null
          ? workCenters.find((w) => getWorkCenterId(w) === nextValue) ?? null
          : null;
      onWorkCenterPick?.(picked);
      onChange?.(nextValue, option as Parameters<NonNullable<UniDropdownProps['onChange']>>[1]);
    },
    [onChange, onWorkCenterPick, workCenters],
  );

  const openCreate = useCallback(() => {
    setEditUuid(null);
    setFormOpen(true);
  }, []);

  const openEdit = useCallback(
    (workCenterId: unknown) => {
      const wc = workCenters.find((w) => getWorkCenterId(w) === workCenterId);
      const uuid = wc?.uuid;
      if (!uuid) {
        messageApi.warning(
          t('app.kuaizhizao.salesOrder.workCenterEditUnavailable', {
            defaultValue: '无法编辑该工作中心，请刷新列表后重试',
          }),
        );
        return;
      }
      setEditUuid(String(uuid));
      setFormOpen(true);
    },
    [messageApi, t, workCenters],
  );

  const handleSuccess = useCallback(
    (created: WorkCenter) => {
      const nextList = mergeList(workCenters, created);
      if (workCentersProp == null) {
        setInternalList(nextList);
      }
      onWorkCentersChange?.(nextList);
      onWorkCenterPick?.(created);
      onChange?.(created.id, {
        value: created.id,
        label: formatWorkCenterLabel(created),
      });
      setFormOpen(false);
      setEditUuid(null);
    },
    [mergeList, onChange, onWorkCenterPick, onWorkCentersChange, workCenters, workCentersProp],
  );

  const canCreate = hasPermission(currentUser, 'master-data:factory:work-center:create');
  const canUpdate = hasPermission(currentUser, 'master-data:factory:work-center:update');
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
        popupMatchSelectWidth={false}
        styles={{
          ...rest.styles,
          popup: {
            ...rest.styles?.popup,
            root: { minWidth: 260, ...(rest.styles?.popup as any)?.root },
          },
        }}
        onChange={handleChange}
        quickCreate={
          canCreate
            ? {
                label: t('field.operation.quickAddWorkCenter'),
                onClick: openCreate,
              }
            : undefined
        }
        quickEdit={
          canUpdate
            ? {
                label: t('app.kuaizhizao.salesOrder.editWorkCenter', {
                  defaultValue: '编辑工作中心',
                }),
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
              .filter((w) => Number(getWorkCenterId(w)) > 0)
              .map((w) => ({
                value: Number(getWorkCenterId(w)),
                label: formatWorkCenterLabel(w),
              }));
          },
        }}
      />
      {formOpen ? (
        <WorkCenterFormModal
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
