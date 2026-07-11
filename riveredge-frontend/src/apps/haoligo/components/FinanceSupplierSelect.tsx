/**
 * 财务材料供应商选择（支持快速新增）
 */
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { App, Button, Col, Form, Input, Space } from 'antd';
import { ProForm } from '@ant-design/pro-components';
import { UniDropdown, QuickCreateAnchorPopover } from '../../../components/uni-dropdown';
import { useProFormReadonlyMode } from '../../../utils/proFormReadonly';
import { useResourcePermissions } from '../../../hooks/useResourcePermissions';
import {
  createFinanceSupplier,
  listFinanceSuppliers,
  type FinanceSupplierRow,
} from '../services/haoligo';

export const HAOLIGO_RESOURCE_FINANCE_SUPPLIERS = 'haoligo:finance-suppliers';

export type FinanceSupplierOption = { label: string; value: number };

export function deriveFinanceSupplierQuickCreateCode(name: string): string {
  const trimmed = name.trim();
  const suffix = Date.now().toString(36).slice(-8);
  const prefix = trimmed.replace(/\s+/g, '').slice(0, 48);
  const code = prefix ? `GYS-${prefix}-${suffix}` : `GYS-${suffix}`;
  return code.slice(0, 64);
}

export function toFinanceSupplierOptions(rows: FinanceSupplierRow[]): FinanceSupplierOption[] {
  return rows.map((s) => ({
    label: s.supplier_name,
    value: s.id,
  }));
}

const FinanceSupplierSelectField = forwardRef<
  any,
  Omit<React.ComponentProps<typeof UniDropdown>, 'options'> & {
    loadedOptions: FinanceSupplierOption[];
    hookOnChange?: (v: number | null) => void;
    selectWrapRef?: React.RefObject<HTMLDivElement | null>;
  }
>(({ loadedOptions, hookOnChange, onChange, value, selectWrapRef, ...rest }, ref) => {
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
    <div ref={selectWrapRef} style={{ width: '100%' }}>
      <UniDropdown
        ref={ref}
        {...rest}
        options={displayOptions}
        value={value}
        onChange={handleChange}
      />
    </div>
  );
});
FinanceSupplierSelectField.displayName = 'FinanceSupplierSelectField';

export interface FinanceSupplierSelectRef {
  openQuickCreate: (defaultName?: string) => void;
}

export interface FinanceSupplierSelectProps {
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
  quickCreateDefaultName?: string;
  extraOption?: FinanceSupplierOption | null;
  onOptionsLoaded?: (rows: FinanceSupplierRow[]) => void;
  onSupplierCreated?: (row: FinanceSupplierRow) => void;
}

export const FinanceSupplierSelect = forwardRef<FinanceSupplierSelectRef, FinanceSupplierSelectProps>(
  (
    {
      name = 'supplier_id',
      label = '材料供应商',
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
      quickCreateDefaultName,
      extraOption,
      onOptionsLoaded,
      onSupplierCreated,
    },
    ref,
  ) => {
    const { message: messageApi } = App.useApp();
    const supplierPerms = useResourcePermissions(HAOLIGO_RESOURCE_FINANCE_SUPPLIERS);
    const isReadonlyMode = useProFormReadonlyMode(readonly);
    const [options, setOptions] = useState<FinanceSupplierOption[]>([]);
    const [loading, setLoading] = useState(false);
    const [createPopoverOpen, setCreatePopoverOpen] = useState(false);
    const [createAnchorEl, setCreateAnchorEl] = useState<HTMLElement | null>(null);
    const [createForm] = Form.useForm<{ supplier_name: string }>();
    const [creating, setCreating] = useState(false);
    const selectWrapRef = useRef<HTMLDivElement>(null);

    const mergedOptions = useMemo(() => {
      if (!extraOption || options.some((o) => o.value === extraOption.value)) {
        return options;
      }
      return [extraOption, ...options];
    }, [options, extraOption]);

    const loadSuppliers = useCallback(async () => {
      setLoading(true);
      try {
        const rows = await listFinanceSuppliers({ is_active: true });
        const next = toFinanceSupplierOptions(rows);
        setOptions(next);
        onOptionsLoaded?.(rows);
      } catch (error) {
        messageApi.error((error as Error).message || '加载供应商失败');
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, [messageApi, onOptionsLoaded]);

    useEffect(() => {
      void loadSuppliers();
    }, [loadSuppliers]);

    const openQuickCreatePopover = useCallback(
      (defaultName?: string) => {
        if (!supplierPerms.canCreate) {
          messageApi.warning('暂无供应商新建权限');
          return;
        }
        createForm.resetFields();
        const trimmed = String(defaultName ?? quickCreateDefaultName ?? '').trim();
        if (trimmed) {
          createForm.setFieldValue('supplier_name', trimmed);
        }
        setCreateAnchorEl(selectWrapRef.current);
        setCreatePopoverOpen(true);
      },
      [createForm, messageApi, quickCreateDefaultName, supplierPerms.canCreate],
    );

    useImperativeHandle(ref, () => ({
      openQuickCreate: openQuickCreatePopover,
    }));

    const handleQuickCreate = async () => {
      let trimmedName: string;
      try {
        const values = await createForm.validateFields(['supplier_name']);
        trimmedName = String(values.supplier_name ?? '').trim();
      } catch {
        return;
      }
      if (!trimmedName) {
        messageApi.warning('请输入供应商名称');
        return;
      }
      setCreating(true);
      try {
        const row = await createFinanceSupplier({
          supplier_code: deriveFinanceSupplierQuickCreateCode(trimmedName),
          supplier_name: trimmedName,
          payment_terms_days: 0,
          is_active: true,
        });
        const nextOption = { label: row.supplier_name, value: row.id };
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
        onSupplierCreated?.(row);
        messageApi.success('供应商已创建');
        setCreatePopoverOpen(false);
        setCreateAnchorEl(null);
        createForm.resetFields();
      } catch (error) {
        messageApi.error((error as Error).message || '创建供应商失败');
      } finally {
        setCreating(false);
      }
    };

    if (isReadonlyMode) {
      const readonlyNode = (
        <ProForm.Item name={name} label={label} rules={rules} initialValue={initialValue} readonly>
          <FinanceSupplierSelectField loadedOptions={mergedOptions} disabled loading={loading} />
        </ProForm.Item>
      );
      return colProps ? <Col {...colProps}>{readonlyNode}</Col> : readonlyNode;
    }

    const baseFieldProps = {
      style: { width: '100%' } as React.CSSProperties,
      placeholder: placeholder ?? '请选择',
      showSearch: true as const,
      allowClear: true,
      loading,
      disabled,
      loadedOptions: mergedOptions,
      optionFilterProp: 'label' as const,
      selectWrapRef,
      ...(supplierPerms.canCreate
        ? {
            quickCreate: {
              label: '快速新建',
              onClick: (anchor: HTMLElement | null | undefined) => {
                createForm.resetFields();
                const trimmed = String(quickCreateDefaultName ?? '').trim();
                if (trimmed) {
                  createForm.setFieldValue('supplier_name', trimmed);
                }
                setCreateAnchorEl(anchor ?? selectWrapRef.current);
                setCreatePopoverOpen(true);
              },
            },
          }
        : {}),
    };

    const dropdown = (
      <FinanceSupplierSelectField
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
        title={`快速新增${label}`}
        zIndex={createPopoverZ}
        onClose={() => {
          setCreatePopoverOpen(false);
          setCreateAnchorEl(null);
          createForm.resetFields();
        }}
      >
        <Form form={createForm} layout="vertical" preserve={false}>
          <Form.Item
            name="supplier_name"
            rules={[
              { required: true, whitespace: true, message: '请输入供应商名称' },
              { max: 200, message: '名称不超过 200 字' },
            ]}
            style={{ marginBottom: 0 }}
          >
            <Input placeholder="供应商名称" maxLength={200} autoFocus />
          </Form.Item>
          <Space style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
            <Button
              onClick={() => {
                setCreatePopoverOpen(false);
                setCreateAnchorEl(null);
                createForm.resetFields();
              }}
            >
              取消
            </Button>
            <Button type="primary" loading={creating} onClick={() => void handleQuickCreate()}>
              确定
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
      <ProForm.Item name={name} label={label} rules={rules} initialValue={initialValue}>
        {dropdown}
      </ProForm.Item>
    );

    return (
      <>
        {colProps ? <Col {...colProps}>{itemNode}</Col> : itemNode}
        {createPopover}
      </>
    );
  },
);
FinanceSupplierSelect.displayName = 'FinanceSupplierSelect';

export default FinanceSupplierSelect;
