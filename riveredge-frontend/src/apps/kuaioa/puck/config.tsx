import React from 'react';
import { DatePicker, Input, InputNumber, Select, Switch, Upload } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import type { Config } from '@measured/puck';
import type { TFunction } from 'i18next';
import type { OaFormFieldOption } from '../utils/oaFormSchema';

type OnOff = 'on' | 'off';
type SpanValue = '12' | '24';

type FieldProps = {
  name: string;
  label: string;
  required: OnOff;
  span: SpanValue;
};

type SelectFieldProps = FieldProps & {
  options: OaFormFieldOption[];
};

export type OaFormPuckProps = {
  OaText: FieldProps;
  OaTextarea: FieldProps;
  OaNumber: FieldProps;
  OaDate: FieldProps;
  OaDatetime: FieldProps;
  OaSwitch: FieldProps;
  OaSelect: SelectFieldProps;
  OaUser: FieldProps;
  OaDepartment: FieldProps;
  OaFile: FieldProps;
};

function FieldPreview({
  label,
  required,
  untitled,
  children,
}: {
  label: string;
  required: OnOff;
  untitled: string;
  children: React.ReactNode;
}) {
  return (
    <div className="oa-form-puck-field">
      <div className="oa-form-puck-field__label">
        {required === 'on' ? <span className="oa-form-puck-field__req">*</span> : null}
        {label.trim() || untitled}
      </div>
      {children}
    </div>
  );
}

function commonFields(t: TFunction, extras?: Record<string, unknown>) {
  return {
    name: { type: 'text' as const, label: t('app.kuaioa.formSchema.fieldName') },
    label: { type: 'text' as const, label: t('app.kuaioa.formSchema.fieldLabel') },
    required: {
      type: 'radio' as const,
      label: t('app.kuaioa.formSchema.required'),
      options: [
        { label: t('app.kuaioa.formSchema.requiredYes'), value: 'on' },
        { label: t('app.kuaioa.formSchema.requiredNo'), value: 'off' },
      ],
    },
    span: {
      type: 'radio' as const,
      label: t('app.kuaioa.formSchema.span'),
      options: [
        { label: t('app.kuaioa.formSchema.spanHalf'), value: '12' },
        { label: t('app.kuaioa.formSchema.spanFull'), value: '24' },
      ],
    },
    ...extras,
  };
}

function defaultFieldProps(span: SpanValue = '12'): FieldProps {
  return { name: '', label: '', required: 'off', span };
}

function resolveInsertDefaults(typeKey: string, defaultLabel: string) {
  return (
    data: { props: FieldProps },
    params: { trigger: 'insert' | 'replace' | 'load' | 'force' },
  ) => {
    if (params.trigger !== 'insert') return { props: data.props };
    const suffix = String((data.props as FieldProps & { id?: string }).id ?? '')
      .split('-')
      .pop()
      ?.replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 8);
    const token = suffix || Date.now().toString(36);
    return {
      props: {
        ...data.props,
        name: data.props.name.trim() || `${typeKey}_${token}`,
        label: data.props.label.trim() || defaultLabel,
      },
    };
  };
}

export function createOaFormPuckConfig(t: TFunction): Config<OaFormPuckProps> {
  const untitled = t('app.kuaioa.formSchema.untitled');
  const previewWidth = { style: { width: '100%' as const } };

  return {
    categories: {
      fields: {
        title: t('app.kuaioa.formSchema.title'),
        defaultExpanded: true,
        components: [
          'OaText',
          'OaTextarea',
          'OaNumber',
          'OaDate',
          'OaDatetime',
          'OaSwitch',
          'OaSelect',
          'OaUser',
          'OaDepartment',
          'OaFile',
        ],
      },
    },
    components: {
      OaText: {
        label: t('app.kuaioa.formSchema.comp.text'),
        fields: commonFields(t),
        defaultProps: defaultFieldProps(),
        resolveData: resolveInsertDefaults('text', t('app.kuaioa.formSchema.comp.text')),
        render: ({ label, required }) => (
          <FieldPreview label={label} required={required} untitled={untitled}>
            <Input disabled />
          </FieldPreview>
        ),
      },
      OaTextarea: {
        label: t('app.kuaioa.formSchema.comp.textarea'),
        fields: commonFields(t),
        defaultProps: defaultFieldProps('24'),
        resolveData: resolveInsertDefaults('textarea', t('app.kuaioa.formSchema.comp.textarea')),
        render: ({ label, required }) => (
          <FieldPreview label={label} required={required} untitled={untitled}>
            <Input.TextArea disabled rows={3} />
          </FieldPreview>
        ),
      },
      OaNumber: {
        label: t('app.kuaioa.formSchema.comp.number'),
        fields: commonFields(t),
        defaultProps: defaultFieldProps(),
        resolveData: resolveInsertDefaults('number', t('app.kuaioa.formSchema.comp.number')),
        render: ({ label, required }) => (
          <FieldPreview label={label} required={required} untitled={untitled}>
            <InputNumber disabled {...previewWidth} />
          </FieldPreview>
        ),
      },
      OaDate: {
        label: t('app.kuaioa.formSchema.comp.date'),
        fields: commonFields(t),
        defaultProps: defaultFieldProps(),
        resolveData: resolveInsertDefaults('date', t('app.kuaioa.formSchema.comp.date')),
        render: ({ label, required }) => (
          <FieldPreview label={label} required={required} untitled={untitled}>
            <DatePicker disabled {...previewWidth} />
          </FieldPreview>
        ),
      },
      OaDatetime: {
        label: t('app.kuaioa.formSchema.comp.datetime'),
        fields: commonFields(t),
        defaultProps: defaultFieldProps(),
        resolveData: resolveInsertDefaults('datetime', t('app.kuaioa.formSchema.comp.datetime')),
        render: ({ label, required }) => (
          <FieldPreview label={label} required={required} untitled={untitled}>
            <DatePicker showTime disabled {...previewWidth} />
          </FieldPreview>
        ),
      },
      OaSwitch: {
        label: t('app.kuaioa.formSchema.comp.switch'),
        fields: commonFields(t),
        defaultProps: defaultFieldProps(),
        resolveData: resolveInsertDefaults('switch', t('app.kuaioa.formSchema.comp.switch')),
        render: ({ label, required }) => (
          <FieldPreview label={label} required={required} untitled={untitled}>
            <Switch disabled />
          </FieldPreview>
        ),
      },
      OaSelect: {
        label: t('app.kuaioa.formSchema.comp.select'),
        fields: commonFields(t, {
          options: {
            type: 'array' as const,
            label: t('app.kuaioa.formSchema.options'),
            getItemSummary: (item: OaFormFieldOption) => item.label || item.value || t('app.kuaioa.formSchema.options'),
            arrayFields: {
              label: { type: 'text' as const, label: t('app.kuaioa.formSchema.fieldLabel') },
              value: { type: 'text' as const, label: t('app.kuaioa.formSchema.optionValue') },
            },
            defaultItemProps: { label: '', value: '' },
          },
        }),
        defaultProps: { ...defaultFieldProps(), options: [] },
        resolveData: resolveInsertDefaults('select', t('app.kuaioa.formSchema.comp.select')),
        render: ({ label, required, options }) => (
          <FieldPreview label={label} required={required} untitled={untitled}>
            <Select
              disabled
              {...previewWidth}
              options={(options ?? []).map((o) => ({ label: o.label, value: o.value }))}
            />
          </FieldPreview>
        ),
      },
      OaUser: {
        label: t('app.kuaioa.formSchema.comp.user'),
        fields: commonFields(t),
        defaultProps: defaultFieldProps(),
        resolveData: resolveInsertDefaults('user', t('app.kuaioa.formSchema.comp.user')),
        render: ({ label, required }) => (
          <FieldPreview label={label} required={required} untitled={untitled}>
            <Select disabled {...previewWidth} placeholder={t('app.kuaioa.formSchema.comp.user')} />
          </FieldPreview>
        ),
      },
      OaDepartment: {
        label: t('app.kuaioa.formSchema.comp.department'),
        fields: commonFields(t),
        defaultProps: defaultFieldProps(),
        resolveData: resolveInsertDefaults('department', t('app.kuaioa.formSchema.comp.department')),
        render: ({ label, required }) => (
          <FieldPreview label={label} required={required} untitled={untitled}>
            <Select disabled {...previewWidth} placeholder={t('app.kuaioa.formSchema.comp.department')} />
          </FieldPreview>
        ),
      },
      OaFile: {
        label: t('app.kuaioa.formSchema.comp.file'),
        fields: commonFields(t),
        defaultProps: defaultFieldProps('24'),
        resolveData: resolveInsertDefaults('file', t('app.kuaioa.formSchema.comp.file')),
        render: ({ label, required }) => (
          <FieldPreview label={label} required={required} untitled={untitled}>
            <Upload disabled>
              <button type="button" disabled style={{ border: 0, background: 'none', padding: 0 }}>
                <UploadOutlined /> {t('app.kuaioa.formSchema.comp.file')}
              </button>
            </Upload>
          </FieldPreview>
        ),
      },
    },
    root: {
      fields: {},
      render: ({ children }) => <div className="oa-form-puck-canvas">{children}</div>,
    },
  };
}
