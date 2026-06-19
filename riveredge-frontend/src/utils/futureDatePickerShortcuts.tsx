import React from 'react';
import { Button, DatePicker, Space } from 'antd';
import type { DatePickerProps } from 'antd/es/date-picker';
import dayjs, { type Dayjs } from 'dayjs';
import { coerceFormDate } from './formDate';

export type FormDateAccessor = {
  getFieldValue?: (name: string | (string | number)[]) => unknown;
  setFieldsValue?: (values: Record<string, unknown>) => void;
  setFieldValue?: (name: string | (string | number)[], value: unknown) => void;
};

function coerceDayjsBase(value: unknown): Dayjs | null {
  if (value == null || value === '') return null;
  if (dayjs.isDayjs(value)) return value.isValid() ? value.startOf('day') : null;
  const parsed = dayjs(value as string | Date | number);
  return parsed.isValid() ? parsed.startOf('day') : null;
}

/** 以单据日期为基准（未填则取今天） */
export function resolveFormDateBase(
  form: FormDateAccessor | null | undefined,
  baseFieldName?: string,
): Dayjs {
  if (baseFieldName && form?.getFieldValue) {
    const fromField = coerceDayjsBase(form.getFieldValue(baseFieldName));
    if (fromField) return fromField;
  }
  return dayjs().startOf('day');
}

export type FutureDateShortcut = {
  label: string;
  resolve: (base: Dayjs) => Dayjs;
};

export function getFutureDateShortcuts(t: (key: string) => string): FutureDateShortcut[] {
  return [
    { label: t('app.kuaizhizao.quotation.dateShortcut.7days'), resolve: (base) => base.add(7, 'day') },
    { label: t('app.kuaizhizao.quotation.dateShortcut.15days'), resolve: (base) => base.add(15, 'day') },
    { label: t('app.kuaizhizao.quotation.dateShortcut.1month'), resolve: (base) => base.add(1, 'month') },
    { label: t('app.kuaizhizao.quotation.dateShortcut.monthEnd'), resolve: (base) => base.endOf('month') },
  ];
}

function renderShortcutFooter(
  t: (key: string) => string,
  getBase: () => Dayjs,
  onApply: (date: Dayjs) => void,
) {
  return (
    <Space wrap size={[0, 0]} style={{ padding: '6px 4px', width: '100%', justifyContent: 'center' }}>
      {getFutureDateShortcuts(t).map(({ label, resolve }) => (
        <Button
          key={label}
          type="link"
          size="small"
          onClick={() => onApply(resolve(getBase()))}
        >
          {label}
        </Button>
      ))}
    </Space>
  );
}

export function buildFutureDateShortcutPickerProps(options: {
  getForm: () => FormDateAccessor | null | undefined;
  baseFieldName?: string;
  t: (key: string) => string;
  onApply: (date: Dayjs) => void;
  fieldProps?: DatePickerProps;
}): DatePickerProps {
  const { getForm, baseFieldName, t, onApply, fieldProps } = options;
  return {
    showToday: false,
    ...fieldProps,
    style: { width: '100%', ...fieldProps?.style },
    renderExtraFooter: () =>
      renderShortcutFooter(t, () => resolveFormDateBase(getForm(), baseFieldName), onApply),
  };
}

/** ProFormDatePicker / 表单头字段：传入 fieldName 自动写回表单 */
export function buildFutureDateShortcutFieldProps(options: {
  getForm: () => FormDateAccessor | null | undefined;
  fieldName: string;
  baseFieldName?: string;
  t: (key: string) => string;
  fieldProps?: DatePickerProps;
  onApply?: (date: Dayjs) => void;
}): DatePickerProps {
  const { getForm, fieldName, baseFieldName, t, fieldProps, onApply } = options;
  return buildFutureDateShortcutPickerProps({
    getForm,
    baseFieldName,
    t,
    fieldProps,
    onApply:
      onApply ??
      ((date) => {
        const form = getForm();
        if (form?.setFieldValue) {
          form.setFieldValue(fieldName, date);
          return;
        }
        form?.setFieldsValue?.({ [fieldName]: date });
      }),
  });
}

export type FutureDatePickerProps = Omit<DatePickerProps, 'renderExtraFooter'> & {
  getForm: () => FormDateAccessor | null | undefined;
  baseFieldName?: string;
  t: (key: string) => string;
  onApply?: (date: Dayjs) => void;
  fieldName?: string;
};

function applyShortcutDate(
  date: Dayjs,
  options: {
    onChange?: DatePickerProps['onChange'];
    format?: DatePickerProps['format'];
    onApply?: (date: Dayjs) => void;
    getForm?: () => FormDateAccessor | null | undefined;
    fieldName?: string;
  },
) {
  const { onChange, format, onApply, getForm, fieldName } = options;
  const dateString =
    typeof format === 'string' ? date.format(format) : date.toISOString();
  onChange?.(date, dateString);
  if (onApply) {
    onApply(date);
    return;
  }
  if (!fieldName) return;
  const form = getForm?.();
  if (form?.setFieldValue) {
    form.setFieldValue(fieldName, date);
    return;
  }
  form?.setFieldsValue?.({ [fieldName]: date });
}

/** 明细行 / 普通 Form.Item 内 DatePicker */
export const FutureDatePicker: React.FC<FutureDatePickerProps> = ({
  getForm,
  baseFieldName,
  t,
  onApply,
  fieldName,
  onChange,
  value,
  ...pickerProps
}) => {
  const shortcutProps = buildFutureDateShortcutPickerProps({
    getForm,
    baseFieldName,
    t,
    fieldProps: pickerProps,
    onApply: (date) =>
      applyShortcutDate(date, {
        onChange,
        format: pickerProps.format,
        onApply,
        getForm,
        fieldName,
      }),
  });
  const coercedValue = coerceFormDate(value) ?? undefined;
  return <DatePicker value={coercedValue} onChange={onChange} {...pickerProps} {...shortcutProps} />;
};
