/**
 * 设备制造厂商选择（支持快速新增）
 */
import React, { forwardRef, useCallback, useEffect, useMemo, useState } from 'react';
import { App, Button, Col, Form, Input, Space } from 'antd';
import { ProForm } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import { UniDropdown, QuickCreateAnchorPopover } from '../../../components/uni-dropdown';
import { useProFormReadonlyMode } from '../../../utils/proFormReadonly';
import { useResourcePermissions } from '../../../hooks/useResourcePermissions';
import {
  createManufacturer,
  listManufacturers,
  type ManufacturerRow,
} from '../services/haoligo';

export const HAOLIGO_RESOURCE_EQUIPMENT_MANUFACTURERS = 'haoligo:equipment-manufacturers';

export type ManufacturerOption = { label: string; value: number };

export function deriveManufacturerQuickCreateCode(name: string): string {
  const trimmed = name.trim();
  const suffix = Date.now().toString(36).slice(-8);
  const prefix = trimmed.replace(/\s+/g, '').slice(0, 48);
  const code = prefix ? `${prefix}-${suffix}` : `MFR-${suffix}`;
  return code.slice(0, 64);
}

export function toManufacturerOptions(rows: ManufacturerRow[]): ManufacturerOption[] {
  return rows.map((m) => ({
    label: m.name || m.code || `#${m.id}`,
    value: m.id,
  }));
}

const ManufacturerSelectField = forwardRef<
  any,
  Omit<React.ComponentProps<typeof UniDropdown>, 'options'> & {
    loadedOptions: ManufacturerOption[];
    hookOnChange?: (v: number | null) => void;
  }
>(({ loadedOptions, hookOnChange, onChange, value, ...rest }, ref) => {
  const displayOptions = useMemo(() => {
    if (value === undefined || value === null || value === '') {
      return loadedOptions;
    }
    const numVal = Number(value);
    if (loadedOptions.some((o) => o.value === numVal)) {
      return loadedOptions;
    }
    return [...loadedOptions, { value: numVal, label: `#${numVal}` }];
  }, [loadedOptions, value]);

  const handleChange = useCallback(
    (v: number | null) => {
      (onChange as ((val: number | null) => void) | undefined)?.(v);
      hookOnChange?.(v);
    },
    [onChange, hookOnChange],
  );

  return (
    <UniDropdown
      ref={ref}
      {...rest}
      options={displayOptions}
      value={value}
      onChange={handleChange}
    />
  );
});
ManufacturerSelectField.displayName = 'ManufacturerSelectField';

export interface ManufacturerSelectProps {
  name?: string | (string | number)[];
  label?: string;
  placeholder?: string;
  rules?: any[];
  initialValue?: number | null;
  colProps?: { span: number };
  disabled?: boolean;
  readonly?: boolean;
  formRef?: React.RefObject<any>;
  noStyle?: boolean;
  value?: number | null;
  onChange?: (value: number | null) => void;
  quickCreatePopoverZIndex?: number;
  onOptionsLoaded?: (options: ManufacturerOption[]) => void;
}

export const ManufacturerSelect: React.FC<ManufacturerSelectProps> = ({
  name = 'manufacturer_id',
  label,
  placeholder,
  rules,
  initialValue,
  colProps,
  disabled = false,
  readonly = false,
  formRef,
  noStyle = false,
  value,
  onChange,
  quickCreatePopoverZIndex,
  onOptionsLoaded,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const isReadonlyMode = useProFormReadonlyMode(readonly);
  const mfrPerms = useResourcePermissions(HAOLIGO_RESOURCE_EQUIPMENT_MANUFACTURERS);
  const [options, setOptions] = useState<ManufacturerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [createPopoverOpen, setCreatePopoverOpen] = useState(false);
  const [createAnchorEl, setCreateAnchorEl] = useState<HTMLElement | null>(null);
  const [createForm] = Form.useForm<{ name: string }>();
  const [creating, setCreating] = useState(false);

  const resolvedLabel =
    label ?? t('app.haoligo.equipment.documents.acceptance.colManufacturer');

  const loadManufacturers = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listManufacturers();
      const next = toManufacturerOptions(rows);
      setOptions(next);
      onOptionsLoaded?.(next);
    } catch (error) {
      messageApi.error((error as Error).message || t('common.loadFailed'));
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, [messageApi, onOptionsLoaded, t]);

  useEffect(() => {
    void loadManufacturers();
  }, [loadManufacturers]);

  const handleQuickCreate = async () => {
    let trimmedName: string;
    try {
      const values = await createForm.validateFields(['name']);
      trimmedName = String(values.name ?? '').trim();
    } catch {
      return;
    }
    if (!trimmedName) {
      messageApi.warning(t('app.haoligo.equipment.manufacturers.formNameReq'));
      return;
    }
    setCreating(true);
    try {
      const row = await createManufacturer({
        code: deriveManufacturerQuickCreateCode(trimmedName),
        name: trimmedName,
      });
      const nextOption = { label: row.name || row.code || `#${row.id}`, value: row.id };
      setOptions((prev) => {
        if (prev.some((o) => o.value === nextOption.value)) {
          return prev;
        }
        return [...prev, nextOption].sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'));
      });
      if (formRef?.current) {
        formRef.current.setFieldValue(name, row.id);
      }
      onChange?.(row.id);
      messageApi.success(t('app.haoligo.equipment.createSuccess'));
      setCreatePopoverOpen(false);
      setCreateAnchorEl(null);
      createForm.resetFields();
    } catch (error) {
      messageApi.error((error as Error).message || t('app.haoligo.equipment.saveFailed'));
    } finally {
      setCreating(false);
    }
  };

  if (isReadonlyMode) {
    const readonlyNode = (
      <ProForm.Item name={name} label={resolvedLabel} rules={rules} initialValue={initialValue} readonly>
        <ManufacturerSelectField loadedOptions={options} disabled loading={loading} />
      </ProForm.Item>
    );
    return colProps ? <Col {...colProps}>{readonlyNode}</Col> : readonlyNode;
  }

  const baseFieldProps = {
    style: { width: '100%' } as React.CSSProperties,
    placeholder: placeholder ?? t('common.select'),
    showSearch: true as const,
    allowClear: true,
    loading,
    disabled,
    loadedOptions: options,
    optionFilterProp: 'label' as const,
    ...(mfrPerms.canCreate
      ? {
          quickCreate: {
            label: '快速新建',
            onClick: (anchor: HTMLElement | null | undefined) => {
              createForm.resetFields();
              setCreateAnchorEl(anchor ?? null);
              setCreatePopoverOpen(true);
            },
          },
        }
      : {}),
  };

  const dropdown = (
    <ManufacturerSelectField
      {...baseFieldProps}
      hookOnChange={onChange}
      {...(noStyle ? { value } : {})}
    />
  );

  const createPopoverZ = quickCreatePopoverZIndex ?? 2000;
  const createPopover = (
    <QuickCreateAnchorPopover
      open={createPopoverOpen}
      anchorEl={createAnchorEl}
      title={`快速新增${resolvedLabel}`}
      zIndex={createPopoverZ}
      onClose={() => {
        setCreatePopoverOpen(false);
        setCreateAnchorEl(null);
        createForm.resetFields();
      }}
    >
      <Form form={createForm} layout="vertical" preserve={false}>
        <Form.Item
          name="name"
          rules={[
            { required: true, whitespace: true, message: t('app.haoligo.equipment.manufacturers.formNameReq') },
            { max: 200, message: t('components.dictionarySelect.maxLength100') },
          ]}
          style={{ marginBottom: 0 }}
        >
          <Input
            placeholder={t('app.haoligo.equipment.manufacturers.formNamePh')}
            maxLength={200}
            autoFocus
          />
        </Form.Item>
        <Space style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
          <Button
            onClick={() => {
              setCreatePopoverOpen(false);
              setCreateAnchorEl(null);
              createForm.resetFields();
            }}
          >
            {t('common.cancel')}
          </Button>
          <Button type="primary" loading={creating} onClick={() => void handleQuickCreate()}>
            {t('common.confirm')}
          </Button>
        </Space>
      </Form>
    </QuickCreateAnchorPopover>
  );

  if (noStyle) {
    return (
      <>
        {dropdown}
        {createPopover}
      </>
    );
  }

  const itemNode = (
    <ProForm.Item name={name} label={resolvedLabel} rules={rules} initialValue={initialValue}>
      {dropdown}
    </ProForm.Item>
  );

  return (
    <>
      {colProps ? <Col {...colProps}>{itemNode}</Col> : itemNode}
      {createPopover}
    </>
  );
};

export default ManufacturerSelect;
