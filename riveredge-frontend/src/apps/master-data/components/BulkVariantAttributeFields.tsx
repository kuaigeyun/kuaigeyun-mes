/**
 * 批量属性值表单字段（与 MaterialForm VariantManagementTab 字段类型对齐）
 */

import React from 'react'
import { useTranslation } from 'react-i18next'
import { Row, Col, Form, Select, Input, InputNumber, Spin, Typography } from 'antd'
import type { VariantAttributeDefinition } from '../types/variant-attribute'

interface BulkVariantAttributeFieldsProps {
  definitions: VariantAttributeDefinition[]
  loading?: boolean
}

export const BulkVariantAttributeFields: React.FC<BulkVariantAttributeFieldsProps> = ({
  definitions,
  loading = false,
}) => {
  const { t } = useTranslation()

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 24 }}>
        <Spin />
      </div>
    )
  }

  if (definitions.length === 0) {
    return (
      <Typography.Text type="secondary">
        {t('app.master-data.materialForm.noVariantDef')}
      </Typography.Text>
    )
  }

  return (
    <Row gutter={[16, 8]}>
      {definitions.map((def) => (
        <Col span={12} key={def.attribute_name}>
          <Form.Item
            name={def.attribute_name}
            label={def.display_name}
            tooltip={def.description}
          >
            {def.attribute_type === 'enum' ? (
              <Select
                allowClear
                mode={def.allow_multiple ? 'multiple' : undefined}
                placeholder={t('app.master-data.materialForm.selectAttr', {
                  name: def.display_name,
                })}
                options={def.enum_values?.map((v) => ({ label: v, value: v }))}
              />
            ) : def.attribute_type === 'number' ? (
              <InputNumber
                style={{ width: '100%' }}
                min={def.validation_rules?.min}
                max={def.validation_rules?.max}
                placeholder={t('app.master-data.materialForm.enterAttr', {
                  name: def.display_name,
                })}
              />
            ) : def.attribute_type === 'boolean' ? (
              <Select
                allowClear
                placeholder={t('app.master-data.materialForm.selectAttr', {
                  name: def.display_name,
                })}
                options={[
                  { label: t('app.master-data.bom.yes'), value: true },
                  { label: t('app.master-data.bom.no'), value: false },
                ]}
              />
            ) : def.attribute_type === 'date' ? (
              <Input
                type="date"
                placeholder={t('app.master-data.materialForm.selectAttr', {
                  name: def.display_name,
                })}
              />
            ) : (
              <Input
                maxLength={def.validation_rules?.max_length}
                placeholder={t('app.master-data.materialForm.enterAttr', {
                  name: def.display_name,
                })}
              />
            )}
          </Form.Item>
        </Col>
      ))}
    </Row>
  )
}
