import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ProFormItem } from '@ant-design/pro-components';
import { DownOutlined, UpOutlined } from '@ant-design/icons';
import { Button, Input, Space, Tag, Typography } from 'antd';
import type { TextAreaRef } from 'antd/es/input/TextArea';

import {
  CONTRACT_TERM_FIELD_BINDING_LABEL_KEYS,
  CONTRACT_TERM_FIELD_BINDING_ORDER,
} from './contract-term-placeholders';

type FieldOption = { field: string; label: string };

type ContractTermContentInputProps = {
  value?: string;
  onChange?: (value: string) => void;
  fieldListExpanded: boolean;
  fieldOptions: FieldOption[];
};

const ContractTermContentInput: React.FC<ContractTermContentInputProps> = ({
  value,
  onChange,
  fieldListExpanded,
  fieldOptions,
}) => {
  const textareaRef = useRef<TextAreaRef>(null);

  const insertFieldBinding = (field: string) => {
    const token = `{@${field}}`;
    const current = value ?? '';
    const textarea = textareaRef.current?.resizableTextArea?.textArea;

    if (textarea) {
      const start = textarea.selectionStart ?? current.length;
      const end = textarea.selectionEnd ?? current.length;
      const next = `${current.slice(0, start)}${token}${current.slice(end)}`;
      onChange?.(next);
      const cursor = start + token.length;
      queueMicrotask(() => {
        textarea.focus();
        textarea.setSelectionRange(cursor, cursor);
      });
      return;
    }

    onChange?.(`${current}${token}`);
  };

  return (
    <div>
      {fieldListExpanded ? (
        <Space size={[4, 4]} wrap style={{ marginBottom: 8 }}>
          {fieldOptions.map(({ field, label }) => (
            <Tag
              key={field}
              style={{ cursor: 'pointer', marginInlineEnd: 0 }}
              onClick={() => insertFieldBinding(field)}
            >
              {label}
              <Typography.Text code style={{ marginLeft: 4, fontSize: 12 }}>
                {`{@${field}}`}
              </Typography.Text>
            </Tag>
          ))}
        </Space>
      ) : null}
      <Input.TextArea
        ref={textareaRef}
        rows={6}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
      />
    </div>
  );
};

export const ContractTermContentField: React.FC = () => {
  const { t } = useTranslation();
  const [fieldListExpanded, setFieldListExpanded] = useState(false);

  const fieldOptions = useMemo(
    () =>
      CONTRACT_TERM_FIELD_BINDING_ORDER.map((field) => ({
        field,
        label: t(CONTRACT_TERM_FIELD_BINDING_LABEL_KEYS[field] ?? field),
      })),
    [t],
  );

  return (
    <ProFormItem
      name="content"
      label={
        <Space size={8} align="center" wrap>
          <span>{t('app.kuaizhizao.salesContract.terms.colContent')}</span>
          <Button
            type="link"
            size="small"
            style={{ padding: 0, height: 'auto' }}
            icon={fieldListExpanded ? <UpOutlined /> : <DownOutlined />}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setFieldListExpanded((prev) => !prev);
            }}
          >
            {t('app.kuaizhizao.salesContract.terms.fieldBindingAvailableTitle')}
          </Button>
        </Space>
      }
      rules={[{ required: true, message: t('common.required') }]}
      extra={t('app.kuaizhizao.salesContract.terms.contentPlaceholderHint')}
    >
      <ContractTermContentInput
        fieldListExpanded={fieldListExpanded}
        fieldOptions={fieldOptions}
      />
    </ProFormItem>
  );
};
