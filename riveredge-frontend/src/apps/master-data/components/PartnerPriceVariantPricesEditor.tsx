/**
 * 价格本：属性 SKU 单价明细表
 * - 添加明细：现场选择属性组合
 * - 多选 SKU：从物料已维护 SKU 批量勾选
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { App, Button, Form, Input, InputNumber, Select, Space, Table, Typography } from 'antd';
import { AppstoreAddOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { FormListFieldData } from 'antd/es/form';
import {
  getMaterialVariantAttrs,
  normalizeScalarAttrs,
} from './MaterialVariantCombinationsTable';
import { variantAttributeApi } from '../services/variant-attribute';
import type { VariantAttributeDefinition } from '../types/variant-attribute';
import type { Material } from '../types/material';
import { UniVariantSkuBatchPicker } from '../../../components/uni-variant-sku-batch-picker';

type VariantPriceRowMode = 'manual' | 'sku';

function attrsKey(attrs: Record<string, unknown>): string {
  return JSON.stringify(normalizeScalarAttrs(attrs));
}

function VariantAttributeCell({
  fieldName,
  def,
}: {
  fieldName: number;
  def: VariantAttributeDefinition;
}) {
  const { t } = useTranslation();
  const form = Form.useFormInstance();
  const rowMode = Form.useWatch(['variantPrices', fieldName, '_rowMode'], form) as
    | VariantPriceRowMode
    | undefined;
  const namePath: (string | number)[] = [fieldName, 'variantAttributes', def.attribute_name];
  const readOnly = rowMode !== 'manual';

  return (
    <Form.Item name={namePath} noStyle preserve>
      {def.attribute_type === 'enum' ? (
        <Select
          allowClear={!readOnly}
          disabled={readOnly}
          size="small"
          placeholder={def.display_name}
          options={def.enum_values?.map((v) => ({ label: v, value: v }))}
        />
      ) : def.attribute_type === 'number' ? (
        <InputNumber disabled={readOnly} size="small" style={{ width: '100%' }} />
      ) : def.attribute_type === 'boolean' ? (
        <Select
          allowClear={!readOnly}
          disabled={readOnly}
          size="small"
          options={[
            { label: t('app.master-data.bom.yes'), value: true },
            { label: t('app.master-data.bom.no'), value: false },
          ]}
        />
      ) : def.attribute_type === 'date' ? (
        <Input type="date" size="small" disabled={readOnly} />
      ) : (
        <Input size="small" disabled={readOnly} maxLength={def.validation_rules?.max_length} />
      )}
    </Form.Item>
  );
}

function VariantPricesFormListTable({
  fields,
  add,
  remove,
  definitions,
  loading,
  masterMaterialUuid,
}: {
  fields: FormListFieldData[];
  add: (defaultValue?: {
    variantAttributes: Record<string, unknown>;
    unitPrice?: number;
    _rowMode?: VariantPriceRowMode;
  }) => void;
  remove: (index: number) => void;
  definitions: VariantAttributeDefinition[];
  loading: boolean;
  masterMaterialUuid?: string | null;
}) {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const form = Form.useFormInstance();
  const [pickerOpen, setPickerOpen] = useState(false);

  const existingAttrKeys = useMemo(() => {
    const rows = form.getFieldValue('variantPrices') as
      | Array<{ variantAttributes?: Record<string, unknown> }>
      | undefined;
    const keys = new Set<string>();
    (rows ?? []).forEach((row) => {
      if (row?.variantAttributes) keys.add(attrsKey(row.variantAttributes));
    });
    return keys;
  }, [fields, form]);

  const columns: ColumnsType<FormListFieldData> = useMemo(
    () => [
      {
        title: '#',
        width: 48,
        align: 'center',
        render: (_value, field: FormListFieldData, index) => (
          <>
            <Form.Item name={[field.name, '_rowMode']} hidden />
            {index + 1}
          </>
        ),
      },
      ...definitions.map((def) => ({
        title: def.display_name,
        key: def.attribute_name,
        width: 120,
        render: (_: unknown, field: FormListFieldData) => (
          <VariantAttributeCell fieldName={field.name} def={def} />
        ),
      })),
      {
        title: t('app.master-data.priceBook.variantUnitPrice', 'SKU 单价'),
        key: 'unitPrice',
        width: 130,
        align: 'right' as const,
        render: (_: unknown, field: FormListFieldData) => (
          <Form.Item
            name={[field.name, 'unitPrice']}
            noStyle
            rules={[{ required: true, message: t('common.required') }]}
          >
            <InputNumber min={0.0001} precision={4} size="small" style={{ width: '100%' }} />
          </Form.Item>
        ),
      },
      {
        title: t('app.common.actions', '操作'),
        key: 'actions',
        width: 56,
        fixed: 'right' as const,
        render: (_: unknown, field: FormListFieldData) => (
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => remove(field.name)}
          />
        ),
      },
    ],
    [definitions, remove, t],
  );

  const handleBatchConfirm = (skus: Material[]) => {
    let added = 0;
    let skipped = 0;
    const keySet = new Set(existingAttrKeys);
    const newRows: Array<{
      variantAttributes: Record<string, unknown>;
      unitPrice?: number;
      _rowMode: VariantPriceRowMode;
    }> = [];

    for (const sku of skus) {
      const normalized = normalizeScalarAttrs(getMaterialVariantAttrs(sku) as Record<string, unknown>);
      if (Object.keys(normalized).length === 0) {
        skipped += 1;
        continue;
      }
      const key = attrsKey(normalized);
      if (keySet.has(key)) {
        skipped += 1;
        continue;
      }
      keySet.add(key);
      newRows.push({ variantAttributes: normalized, unitPrice: undefined, _rowMode: 'sku' });
      added += 1;
    }

    for (const row of newRows) {
      add(row);
    }
    if (added > 0) {
      messageApi.success(
        t('app.master-data.priceBook.batchSelectSkuAdded', {
          count: added,
          defaultValue: `已添加 ${added} 条 SKU`,
        }),
      );
    }
    if (skipped > 0 && added === 0) {
      messageApi.warning(
        t('app.master-data.priceBook.batchSelectSkuAllDuplicate', '所选 SKU 均已存在或未维护属性'),
      );
    }
  };

  return (
    <>
      <Space orientation="vertical" size="small" style={{ width: '100%' }}>
        <Table<FormListFieldData>
          size="small"
          bordered
          pagination={false}
          loading={loading}
          dataSource={fields}
          rowKey="key"
          columns={columns}
          scroll={{ x: 'max-content' }}
          locale={{
            emptyText: t(
              'app.master-data.priceBook.variantPricesEmpty',
              '请添加明细或多选 SKU',
            ),
          }}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            style={{ flex: 1, minWidth: 120 }}
            onClick={() =>
              add({ variantAttributes: {}, unitPrice: undefined, _rowMode: 'manual' })
            }
          >
            {t('app.master-data.priceBook.addVariantPriceRow', '添加明细')}
          </Button>
          <Button
            type="default"
            icon={<AppstoreAddOutlined />}
            style={{ flex: 1, minWidth: 120 }}
            disabled={!masterMaterialUuid}
            onClick={() => {
              if (!masterMaterialUuid) {
                messageApi.warning(
                  t('app.master-data.priceBook.selectMaterialFirst', '请先选择内部物料'),
                );
                return;
              }
              setPickerOpen(true);
            }}
          >
            {t('app.master-data.priceBook.batchSelectSku', '多选 SKU')}
          </Button>
        </div>
      </Space>
      <UniVariantSkuBatchPicker
        open={pickerOpen}
        masterMaterialUuid={masterMaterialUuid}
        excludeAttrKeys={existingAttrKeys}
        onCancel={() => setPickerOpen(false)}
        onConfirm={handleBatchConfirm}
        zIndex={1100}
      />
    </>
  );
}

export const PartnerPriceVariantPricesEditor: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const form = Form.useFormInstance();
  const masterMaterialUuid = Form.useWatch('_masterMaterialUuid', form) as string | undefined;
  const priceType = (Form.useWatch('priceType', form) ?? 'tax_inclusive') as 'tax_inclusive' | 'tax_exclusive';
  const [definitions, setDefinitions] = useState<VariantAttributeDefinition[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const list = await variantAttributeApi.list({ is_active: true });
        if (cancelled) return;
        list.sort((a, b) => a.display_order - b.display_order);
        setDefinitions(list);
      } catch (error: any) {
        if (!cancelled) {
          messageApi.error(error?.message || t('app.master-data.materials.batchVariantLoadDefFailed'));
          setDefinitions([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [messageApi, t]);

  if (!loading && definitions.length === 0) {
    return (
      <Typography.Text type="secondary">
        {t('app.master-data.materialForm.noVariantDef')}
      </Typography.Text>
    );
  }

  return (
    <>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 8, fontSize: 12 }}>
        {priceType === 'tax_inclusive'
          ? t('app.master-data.priceBook.variantPricesInclHint')
          : t('app.master-data.priceBook.variantPricesExclHint')}
      </Typography.Paragraph>
      <Form.List name="variantPrices">
        {(fields, { add, remove }) => (
          <VariantPricesFormListTable
            fields={fields}
            add={add}
            remove={remove}
            definitions={definitions}
            loading={loading}
            masterMaterialUuid={masterMaterialUuid}
          />
        )}
      </Form.List>
    </>
  );
};
