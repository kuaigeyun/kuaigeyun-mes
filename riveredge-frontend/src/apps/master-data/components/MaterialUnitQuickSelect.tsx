/**
 * 物料表单单位下拉：读单位主数据，支持快速新建（编码=名称）
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { App, Form, Input, theme } from 'antd';
import { UniDropdown, QuickCreateModal } from '../../../components/uni-dropdown';
import { MODAL_NESTED_ABOVE_PARENT_OFFSET } from '../../../components/layout-templates/constants';
import { useResourcePermissions } from '../../../hooks/useResourcePermissions';
import { invalidateMaterialUnitDisplayMapCache } from '../../../utils/materialUnitDisplay';
import { useMaterialUnitOptions } from '../hooks/useMaterialUnitOptions';
import { materialUnitApi } from '../services/material-unit';

export const MATERIAL_UNIT_OPTIONS_QUERY_KEY = ['master-data', 'material-units', 'active'] as const;

export interface MaterialUnitQuickSelectProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  allowClear?: boolean;
  size?: 'large' | 'middle' | 'small';
  style?: React.CSSProperties;
}

export const MaterialUnitQuickSelect: React.FC<MaterialUnitQuickSelectProps> = ({
  value,
  onChange,
  placeholder,
  disabled,
  allowClear = true,
  size,
  style,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const { token } = theme.useToken();
  const queryClient = useQueryClient();
  const unitPerms = useResourcePermissions('master-data:material-unit');
  const { options, isLoading } = useMaterialUnitOptions();

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm] = Form.useForm<{ name: string }>();

  const handleCreate = async () => {
    const values = await createForm.validateFields();
    const name = String(values.name ?? '').trim();
    if (!name) return;
    setCreating(true);
    try {
      await materialUnitApi.create({
        code: name,
        name,
        is_active: true,
        sort_order: 999,
      });
      invalidateMaterialUnitDisplayMapCache();
      await queryClient.invalidateQueries({ queryKey: [...MATERIAL_UNIT_OPTIONS_QUERY_KEY] });
      onChange?.(name);
      setCreateOpen(false);
      createForm.resetFields();
      messageApi.success(t('common.createSuccess'));
    } catch (e: any) {
      messageApi.error(e?.message || t('common.saveFailed'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <UniDropdown
        value={value}
        onChange={(v) => onChange?.(v == null ? '' : String(v))}
        options={options}
        loading={isLoading}
        showSearch
        allowClear={allowClear}
        disabled={disabled}
        size={size}
        placeholder={placeholder}
        style={{ width: '100%', ...style }}
        optionFilterProp="label"
        quickCreate={
          unitPerms.canCreate
            ? {
                label: t('app.master-data.materialForm.quickAddUnit'),
                onClick: () => {
                  createForm.resetFields();
                  setCreateOpen(true);
                },
              }
            : undefined
        }
      />
      <QuickCreateModal
        open={createOpen}
        title={t('app.master-data.materialForm.quickAddUnitTitle')}
        zIndex={token.zIndexPopupBase + MODAL_NESTED_ABOVE_PARENT_OFFSET}
        confirmLoading={creating}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
        onClose={() => {
          setCreateOpen(false);
          createForm.resetFields();
        }}
        onConfirm={handleCreate}
      >
        <Form form={createForm} layout="vertical" preserve={false}>
          <Form.Item
            name="name"
            rules={[
              { required: true, whitespace: true, message: t('app.master-data.units.nameRequired') },
              { max: 100, message: t('app.master-data.units.nameMax', { defaultValue: '最多 100 个字符' }) },
            ]}
            style={{ marginBottom: 0 }}
            extra={t('app.master-data.units.codeFollowsNameHint')}
          >
            <Input
              placeholder={t('app.master-data.materialForm.quickAddUnitPlaceholder')}
              maxLength={100}
              autoFocus
            />
          </Form.Item>
        </Form>
      </QuickCreateModal>
    </>
  );
};

export default MaterialUnitQuickSelect;
