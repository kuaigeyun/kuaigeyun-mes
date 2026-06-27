/**
 * 开单时选择通知接收人（配合配置中心规则中的「用户指定」范围）
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Col, Form } from 'antd';
import { ProFormSelect } from '@ant-design/pro-components';
import { useDebounceFn } from 'ahooks';
import { useTranslation } from 'react-i18next';
import { useGlobalStore } from '../../../stores';
import { useProFormReadonlyMode } from '../../../utils/proFormReadonly';
import { canPickUsersForDisplay } from '../../../utils/userDisplay';

export type NotifyUsersSearchFn = (
  keyword?: string,
  selectedIds?: number[],
) => Promise<Array<{ label: string; value: number }>>;

export type FormNotifyUsersSelectProps = {
  name?: string;
  label?: string;
  /** 标签右侧附加操作（如「设定」按钮） */
  labelAddon?: React.ReactNode;
  placeholder?: string;
  readonly?: boolean;
  /** 配置中心「开单默认人员」；表单未填时写入并用于回显选项 */
  seedUserIds?: number[];
  /** 栅格占位（12 = 半行）；不传则占满当前容器 */
  colSpan?: number;
  /** 为 true 且设置了 colSpan 时只渲染 Col，须放在外层 Row 内 */
  inline?: boolean;
  searchUsers: NotifyUsersSearchFn;
};

function normalizeNotifyUserIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((v) => Number(v)).filter((id) => Number.isFinite(id) && id > 0);
}

/** ProFormSelect request 入参（keyWords）→ 搜索关键词 */
export function resolveSelectSearchKeyword(params?: unknown): string | undefined {
  if (typeof params === 'string') {
    const s = params.trim();
    return s || undefined;
  }
  if (params && typeof params === 'object') {
    const raw = (params as { keyWords?: unknown; keyword?: unknown }).keyWords
      ?? (params as { keyword?: unknown }).keyword;
    if (typeof raw === 'string') {
      const s = raw.trim();
      return s || undefined;
    }
  }
  return undefined;
}

export const FormNotifyUsersSelect: React.FC<FormNotifyUsersSelectProps> = ({
  name = 'report_notify_user_ids',
  label,
  labelAddon,
  placeholder,
  readonly,
  seedUserIds,
  colSpan,
  inline,
  searchUsers,
}) => {
  const { t } = useTranslation();
  const currentUser = useGlobalStore((s) => s.currentUser);
  const isReadonlyMode = useProFormReadonlyMode(readonly);
  const canPick = canPickUsersForDisplay(currentUser);
  const canInteract = !isReadonlyMode && (Boolean(searchUsers) || canPick);
  const resolvedLabel = label ?? t('app.haoligo.equipment.documents.formReportNotifyUsers');
  const formLabel = labelAddon
    ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span>{resolvedLabel}</span>
          {labelAddon}
        </span>
      )
    : resolvedLabel;
  const resolvedPh = placeholder ?? t('app.haoligo.equipment.documents.formReportNotifyUsersPh');

  const form = Form.useFormInstance();
  const watchedIds = Form.useWatch(name, form);
  const [options, setOptions] = useState<{ label: string; value: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const loadGenRef = useRef(0);

  const resolvedSelectedIds = React.useMemo(() => {
    const fromForm = normalizeNotifyUserIds(watchedIds);
    if (fromForm.length) return fromForm;
    return normalizeNotifyUserIds(seedUserIds);
  }, [watchedIds, seedUserIds]);

  const fetchOptions = useCallback(
    async (keyword?: string) => {
      const gen = ++loadGenRef.current;
      setLoading(true);
      try {
        const opts = await searchUsers(keyword, resolvedSelectedIds);
        if (gen === loadGenRef.current) {
          setOptions(opts);
        }
        return opts;
      } catch {
        if (gen === loadGenRef.current) {
          setOptions([]);
        }
        return [];
      } finally {
        if (gen === loadGenRef.current) {
          setLoading(false);
        }
      }
    },
    [searchUsers, resolvedSelectedIds],
  );

  const { run: debouncedFetch } = useDebounceFn(
    (kw: string) => {
      void fetchOptions(kw.trim() || undefined);
    },
    { wait: 300 },
  );

  useEffect(() => {
    const seeds = normalizeNotifyUserIds(seedUserIds);
    if (!seeds.length || !form) return;
    const cur = normalizeNotifyUserIds(form.getFieldValue(name));
    if (cur.length) return;
    form.setFieldsValue({ [name]: seeds });
  }, [form, name, seedUserIds]);

  useEffect(() => {
    if (isReadonlyMode) {
      if (resolvedSelectedIds.length > 0) void fetchOptions();
      return;
    }
    if (!canInteract) return;
    void fetchOptions();
  }, [fetchOptions, resolvedSelectedIds, isReadonlyMode, canInteract]);

  const effectiveReadonly = isReadonlyMode || !canInteract;

  const field = (
    <ProFormSelect
      name={name}
      label={formLabel}
      debounceTime={300}
      options={options}
      request={async (params) => fetchOptions(resolveSelectSearchKeyword(params))}
      colProps={colSpan != null && !inline ? { span: colSpan } : undefined}
      fieldProps={{
        mode: 'multiple',
        showSearch: canInteract,
        filterOption: false,
        disabled: effectiveReadonly,
        loading,
        style: { width: '100%' },
        placeholder: canInteract ? resolvedPh : '当前不可选择人员',
        notFoundContent: canInteract ? undefined : '当前不可选择人员',
        onSearch: canInteract ? debouncedFetch : undefined,
        onDropdownVisibleChange: (open) => {
          if (open && canInteract) {
            void fetchOptions();
          }
        },
      }}
    />
  );

  if (colSpan != null && inline) {
    return <Col span={colSpan}>{field}</Col>;
  }

  return field;
};
