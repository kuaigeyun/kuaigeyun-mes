/**
 * 业务表单中的 JSON 自定义字段（标准标题行 + 分段器右对齐）
 */

import React, { useState } from 'react';
import { Col, Row } from 'antd';
import { ProFormItem } from '@ant-design/pro-components';
import {
  CustomFieldJsonEditor,
  CustomFieldJsonModeSegmented,
  type CustomFieldJsonEditorMode,
} from './CustomFieldJsonEditor';
import { isEmptyJsonValue, normalizeJsonFieldValue, parseJsonText } from './customFieldJsonUtils';
import { CUSTOM_FIELD_FORM_CLASS_NAMES } from './customFieldFormLayout';
import { FORM_LAYOUT } from '../layout-templates/constants';

export interface CustomFieldJsonFormItemProps {
  name: string;
  label: React.ReactNode;
  labelText: string;
  placeholder?: string;
  initialValue?: unknown;
  required?: boolean;
}

export const CustomFieldJsonFormItem: React.FC<CustomFieldJsonFormItemProps> = ({
  name,
  label,
  labelText,
  placeholder,
  initialValue,
  required = false,
}) => {
  const [mode, setMode] = useState<CustomFieldJsonEditorMode>('kv');

  return (
    <div
      className={`ant-form-item ${CUSTOM_FIELD_FORM_CLASS_NAMES.jsonItem}`}
      style={{
        marginBottom: FORM_LAYOUT.ITEM_MARGIN_BOTTOM,
        marginTop: 0,
      }}
    >
      <Row align="middle" gutter={16} style={{ width: '100%', marginBottom: 8 }}>
        <Col span={16}>
          <div className="ant-form-item-label" style={{ padding: 0, overflow: 'visible' }}>
            <label className={required ? 'ant-form-item-required' : undefined}>{label}</label>
          </div>
        </Col>
        <Col span={8} style={{ textAlign: 'right' }}>
          <CustomFieldJsonModeSegmented mode={mode} onChange={setMode} />
        </Col>
      </Row>
      <ProFormItem
        name={name}
        noStyle
        initialValue={initialValue}
        rules={[
          ...(required
            ? [{
                validator: async (_: unknown, value: unknown) => {
                  if (isEmptyJsonValue(normalizeJsonFieldValue(value))) {
                    throw new Error(`请填写${labelText}`);
                  }
                },
              }]
            : []),
          {
            validator: async (_: unknown, value: unknown) => {
              if (value == null || value === '') return;
              if (typeof value === 'string') {
                const parsed = parseJsonText(value);
                if (!parsed.ok) throw new Error(parsed.error);
              }
            },
          },
        ]}
      >
        <CustomFieldJsonEditor
          placeholder={placeholder}
          showModeToggle={false}
          mode={mode}
          onModeChange={setMode}
        />
      </ProFormItem>
    </div>
  );
};
