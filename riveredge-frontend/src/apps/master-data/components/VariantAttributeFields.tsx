/**
 * 属性组合表单字段（主数据 / 价格本 / 单据行共用）
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Col, Form, Input, InputNumber, Row, Select, Spin, Typography } from 'antd';
import type { VariantAttributeDefinition } from '../types/variant-attribute';

export interface VariantAttributeFieldsProps {
  definitions: VariantAttributeDefinition[];
  /** Form.List 内嵌时使用，如 [field.name, 'variantAttributes'] */
  namePrefix?: (string | number)[];
  loading?: boolean;
  colSpan?: { xs?: number; sm?: number; md?: number };
  /** 组合明细表：每属性仅选一个值（禁用多选） */
  singleValueOnly?: boolean;
}

export const VariantAttributeFields: React.FC<VariantAttributeFieldsProps> = ({
  definitions,
  namePrefix = [],
  loading = false,
  colSpan = { xs: 24, sm: 12, md: 8 },
  singleValueOnly = false,
}) => {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 16 }}>
        <Spin size="small" />
      </div>
    );
  }

  if (definitions.length === 0) {
    return (
      <Typography.Text type="secondary">
        {t('app.master-data.materialForm.noVariantDef')}
      </Typography.Text>
    );
  }

  return (
    <Row gutter={[12, 8]}>
      {definitions.map((def) => (
        <Col {...colSpan} key={def.attribute_name}>
          <Form.Item
            name={namePrefix.length ? [...namePrefix, def.attribute_name] : def.attribute_name}
            label={def.display_name}
            tooltip={def.description}
            style={namePrefix.length ? { marginBottom: 8 } : undefined}
          >
            {def.attribute_type === 'enum' ? (
              <Select
                allowClear
                size="small"
                mode={!singleValueOnly && def.allow_multiple ? 'multiple' : undefined}
                placeholder={t('app.master-data.materialForm.selectAttr', { name: def.display_name })}
                options={def.enum_values?.map((v) => ({ label: v, value: v }))}
              />
            ) : def.attribute_type === 'number' ? (
              <InputNumber style={{ width: '100%' }} size="small" />
            ) : def.attribute_type === 'boolean' ? (
              <Select
                allowClear
                size="small"
                options={[
                  { label: t('app.master-data.bom.yes'), value: true },
                  { label: t('app.master-data.bom.no'), value: false },
                ]}
              />
            ) : def.attribute_type === 'date' ? (
              <Input type="date" size="small" />
            ) : (
              <Input size="small" maxLength={def.validation_rules?.max_length} />
            )}
          </Form.Item>
        </Col>
      ))}
    </Row>
  );
};

export function parseVariantAttributesValue(
  raw: unknown,
): Record<string, unknown> | undefined {
  if (raw == null || raw === '') return undefined;
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === 'object' && parsed != null && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export function formatVariantAttributesSummary(attrs?: Record<string, unknown> | null): string {
  if (!attrs || Object.keys(attrs).length === 0) return '';
  return Object.entries(attrs)
    .map(([k, v]) => `${k}=${Array.isArray(v) ? v.join(',') : String(v)}`)
    .join('; ');
}
