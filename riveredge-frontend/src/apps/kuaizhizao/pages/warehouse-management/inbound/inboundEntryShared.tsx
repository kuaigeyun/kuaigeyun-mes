/**
 * 入库取单录入页 — 共享表单项与入库人选择
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { App, Button, Form, Input, Select, Upload } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import { useDebounceFn } from 'ahooks';
import { useGlobalStore } from '../../../../../stores/globalStore';
import { uploadMultipleFiles } from '../../../../../services/file';
import { getUserList, searchUserDisplay, type User, type UserDisplayItem } from '../../../../../services/user';
import { canReadUserDirectory, formatUserDisplayLabel } from '../../../../../utils/userDisplay';

export const readOnlyFieldProps = {
  readOnly: true,
  variant: 'borderless' as const,
  tabIndex: -1,
};

export function ReadOnlyFormValue({ value }: { value?: React.ReactNode }) {
  const text = value == null || value === '' ? '—' : value;
  return <Input {...readOnlyFieldProps} value={String(text)} />;
}

export type WarehouseSelectOption = { label: string; value: number; name: string };

export function mapWarehouseSelectOptions(whRes: unknown): WarehouseSelectOption[] {
  const whList = Array.isArray(whRes) ? whRes : (whRes as { items?: unknown[] })?.items ?? [];
  return (Array.isArray(whList) ? whList : []).map((w) => {
    const row = w as { id: number; name?: string };
    return {
      label: String(row.name || '').trim() || String(row.id),
      value: row.id,
      name: row.name || '',
    };
  });
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

function userOptionFromUser(user: User) {
  return {
    label: formatUserDisplayLabel(user),
    value: user.uuid,
    name: String(user.full_name || user.username || '').trim(),
  };
}

export function useInboundReceiverSelect() {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const currentUser = useGlobalStore((s) => s.currentUser);
  const useFullUserList = canReadUserDirectory(currentUser);

  const [receiverUuid, setReceiverUuid] = useState<string | undefined>();
  const [receiverName, setReceiverName] = useState('');
  const [receiverOptions, setReceiverOptions] = useState<Array<{ label: string; value: string; name: string }>>([]);
  const [receiverLoading, setReceiverLoading] = useState(false);

  const loadReceiverOptions = useCallback(
    async (keyword = '') => {
      if (!currentUser) return;
      setReceiverLoading(true);
      try {
        let users: User[] = [];
        if (useFullUserList) {
          const response = await getUserList({
            page: 1,
            page_size: 50,
            keyword,
            is_active: true,
          });
          users = response.items || [];
        } else {
          const response = await searchUserDisplay({
            page: 1,
            page_size: 50,
            keyword: keyword || undefined,
            is_active: true,
          });
          users = (response.items || []).map(displayItemToUser);
        }
        setReceiverOptions(users.map(userOptionFromUser));
      } catch {
        messageApi.error(t('app.kuaizhizao.warehouseInbound.msg.loadUsersFailed'));
      } finally {
        setReceiverLoading(false);
      }
    },
    [currentUser, messageApi, t, useFullUserList],
  );

  const { run: debounceLoadReceiverOptions } = useDebounceFn(
    (keyword: string) => {
      void loadReceiverOptions(keyword);
    },
    { wait: 300 },
  );

  const receiverSelectOptions = useMemo(() => {
    if (!receiverUuid || receiverOptions.some((opt) => opt.value === receiverUuid)) {
      return receiverOptions;
    }
    if (!receiverName) return receiverOptions;
    return [{ label: receiverName, value: receiverUuid, name: receiverName }, ...receiverOptions];
  }, [receiverName, receiverOptions, receiverUuid]);

  useEffect(() => {
    if (!currentUser || receiverUuid) return;
    const uuid = currentUser.uuid;
    const name = String(currentUser.full_name || currentUser.username || '').trim();
    if (uuid) {
      setReceiverUuid(uuid);
      if (name) setReceiverName(name);
    } else if (name) {
      setReceiverName(name);
    }
  }, [currentUser, receiverUuid]);

  useEffect(() => {
    if (!currentUser) return;
    void loadReceiverOptions();
  }, [currentUser, loadReceiverOptions]);

  const handleReceiverChange = useCallback(
    (uuid: string) => {
      setReceiverUuid(uuid);
      const picked = receiverSelectOptions.find((opt) => opt.value === uuid);
      setReceiverName(picked?.name || '');
    },
    [receiverSelectOptions],
  );

  const restoreReceiver = useCallback((uuid?: string, name?: string) => {
    if (uuid) setReceiverUuid(uuid);
    if (name !== undefined) setReceiverName(name);
  }, []);

  return {
    currentUser,
    receiverUuid,
    receiverName,
    receiverLoading,
    receiverSelectOptions,
    debounceLoadReceiverOptions,
    handleReceiverChange,
    restoreReceiver,
  };
}

type InboundEntryReceiverFieldProps = {
  label?: string;
  hook: ReturnType<typeof useInboundReceiverSelect>;
};

export function InboundEntryReceiverField({ label, hook }: InboundEntryReceiverFieldProps) {
  const { t } = useTranslation();
  const resolvedLabel = label ?? t('app.kuaizhizao.warehouseInbound.field.receiver');
  const {
    currentUser,
    receiverUuid,
    receiverName,
    receiverLoading,
    receiverSelectOptions,
    debounceLoadReceiverOptions,
    handleReceiverChange,
  } = hook;

  return (
    <Form.Item label={resolvedLabel}>
      {currentUser?.uuid ? (
        <Select
          style={{ width: '100%' }}
          placeholder={t('app.kuaizhizao.warehouseInbound.field.selectReceiver', { label: resolvedLabel })}
          showSearch
          filterOption={false}
          loading={receiverLoading}
          value={receiverUuid}
          options={receiverSelectOptions}
          onSearch={debounceLoadReceiverOptions}
          onChange={handleReceiverChange}
        />
      ) : (
        <ReadOnlyFormValue value={receiverName} />
      )}
    </Form.Item>
  );
}

type InboundEntryAttachmentsSectionProps = {
  category: string;
  fileList: UploadFile[];
  onChange: (fileList: UploadFile[]) => void;
};

export function InboundEntryAttachmentsSection({
  category,
  fileList,
  onChange,
}: InboundEntryAttachmentsSectionProps) {
  const { t } = useTranslation();
  return (
    <Form.Item label={t('app.kuaizhizao.warehouseInbound.field.attachments')}>
      <Upload
        fileList={fileList}
        onChange={({ fileList: next }) => onChange(next)}
        customRequest={async (options) => {
          try {
            const res = await uploadMultipleFiles([options.file as File], { category });
            options.onSuccess?.(res[0], options.file as File);
          } catch (err) {
            options.onError?.(err as Error);
          }
        }}
        multiple
      >
        <Button>{t('app.kuaizhizao.warehouseInbound.action.uploadAttachments')}</Button>
      </Upload>
    </Form.Item>
  );
}

type InboundEntryRemarksSectionProps = {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
};

export function InboundEntryRemarksSection({
  value,
  onChange,
  label,
  placeholder,
}: InboundEntryRemarksSectionProps) {
  const { t } = useTranslation();
  const resolvedLabel = label ?? t('app.kuaizhizao.warehouseInbound.field.inboundRemarks');
  const resolvedPlaceholder = placeholder ?? t('app.kuaizhizao.warehouseInbound.field.inboundRemarksPlaceholder');
  return (
    <Form.Item label={resolvedLabel}>
      <Input.TextArea
        placeholder={resolvedPlaceholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        maxLength={500}
        showCount
      />
    </Form.Item>
  );
}
