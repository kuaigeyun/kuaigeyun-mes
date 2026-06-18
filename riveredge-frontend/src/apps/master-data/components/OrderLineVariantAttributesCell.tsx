/**
 * 单据行属性组合：统一 Modal 内选择 SKU 或单独配置属性
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Form, Modal, Space, Tabs, Tag, Typography, App } from 'antd';
import { SettingOutlined } from '@ant-design/icons';
import type { FormInstance } from 'antd/es/form';
import { VariantSkuPickerPanel } from '../../../components/uni-variant-sku-batch-picker/VariantSkuPickerPanel';
import {
  getMaterialVariantAttrs,
  isVariantMasterMaterial,
  normalizeScalarAttrs,
} from './MaterialVariantCombinationsTable';
import { variantAttributeApi } from '../services/variant-attribute';
import type { Material } from '../types/material';
import type { VariantAttributeDefinition } from '../types/variant-attribute';
import { VariantAttributeFields, parseVariantAttributesValue } from './VariantAttributeFields';
import { normalizeFormListItems } from '../../../utils/formListItems';

/** Form.List 内注册 variant_attributes，不渲染 UI */
const VariantAttributesFormBridge: React.FC<{
  value?: Record<string, unknown>;
  onChange?: (value?: Record<string, unknown>) => void;
}> = () => null;

export interface OrderLineVariantAttributesCellProps {
  form: FormInstance;
  rowIndex: number;
  fieldName?: string;
  materials: Material[];
  onAttributesChange?: (attrs: Record<string, unknown> | undefined) => void;
}

type VariantModalTab = 'sku' | 'manual';

function isPrecombinedSku(material?: Material | null): boolean {
  const attrs = parseVariantAttributesValue(
    material?.variantAttributes ?? (material as any)?.variant_attributes,
  );
  return !!attrs && Object.keys(attrs).length > 0;
}

function AttributeSummaryTags({
  attrs,
  definitions,
}: {
  attrs?: Record<string, unknown> | null;
  definitions: VariantAttributeDefinition[];
}) {
  if (!attrs || Object.keys(attrs).length === 0) {
    return null;
  }
  const labelMap = new Map(definitions.map((d) => [d.attribute_name, d.display_name]));
  return (
    <Space size={[4, 4]} wrap style={{ maxWidth: '100%' }}>
      {Object.entries(attrs).map(([key, value]) => (
        <Tag key={key} color="purple" style={{ margin: 0 }}>
          {labelMap.get(key) ?? key}: {Array.isArray(value) ? value.join(',') : String(value)}
        </Tag>
      ))}
    </Space>
  );
}

export const OrderLineVariantAttributesCell: React.FC<OrderLineVariantAttributesCellProps> = ({
  form,
  rowIndex,
  fieldName = 'variant_attributes',
  materials,
  onAttributesChange,
}) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [definitions, setDefinitions] = useState<VariantAttributeDefinition[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<VariantModalTab>('sku');
  const [defsLoading, setDefsLoading] = useState(false);
  const [selectedSkuUuid, setSelectedSkuUuid] = useState<string | null>(null);
  const [selectedSku, setSelectedSku] = useState<Material | null>(null);
  const [manualForm] = Form.useForm<Record<string, unknown>>();

  const materialId = Form.useWatch(['items', rowIndex, 'material_id'], form);
  const sourceType = Form.useWatch(['items', rowIndex, '_sourceType'], form);
  const masterMaterialUuid = Form.useWatch(['items', rowIndex, '_masterMaterialUuid'], form) as
    | string
    | undefined;
  const rawAttrs = Form.useWatch(['items', rowIndex, fieldName], form);

  const material = useMemo(
    () => materials.find((m) => m.id === Number(materialId)),
    [materials, materialId],
  );

  const st = sourceType ?? material?.sourceType ?? (material as any)?.source_type;
  const showEditor =
    st === 'Configure' || isVariantMasterMaterial(material) || isPrecombinedSku(material);
  const resolvedMasterUuid = masterMaterialUuid || material?.uuid;

  const applyAttributes = (next: Record<string, unknown> | undefined) => {
    const items = normalizeFormListItems<Record<string, unknown>>(form.getFieldValue('items'));
    if (!items[rowIndex]) return;
    const nextItems = items.slice();
    nextItems[rowIndex] = { ...nextItems[rowIndex], [fieldName]: next };
    form.setFieldsValue({ items: nextItems });
    onAttributesChange?.(next);
  };

  useEffect(() => {
    if (!showEditor) return;
    let cancelled = false;
    (async () => {
      setDefsLoading(true);
      try {
        const list = await variantAttributeApi.list({ is_active: true });
        list.sort((a, b) => a.display_order - b.display_order);
        if (!cancelled) setDefinitions(list);
      } finally {
        if (!cancelled) setDefsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showEditor]);

  useEffect(() => {
    if (!material || !isPrecombinedSku(material)) return;
    const skuAttrs = parseVariantAttributesValue(
      material.variantAttributes ?? (material as any).variant_attributes,
    );
    if (skuAttrs && !parseVariantAttributesValue(rawAttrs)) {
      applyAttributes(skuAttrs);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- applyAttributes 依赖 rowIndex/fieldName
  }, [material, rawAttrs]);

  const openModal = () => {
    const current = parseVariantAttributesValue(rawAttrs) ?? {};
    manualForm.setFieldsValue(current);
    setSelectedSkuUuid(null);
    setSelectedSku(null);
    setActiveTab('sku');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedSkuUuid(null);
    setSelectedSku(null);
  };

  const handleConfirm = async () => {
    if (activeTab === 'sku') {
      if (!selectedSku) {
        message.warning(t('app.master-data.priceBook.batchSelectSkuNone', '请至少选择一条 SKU'));
        return;
      }
      const attrs = normalizeScalarAttrs(getMaterialVariantAttrs(selectedSku) as Record<string, unknown>);
      if (Object.keys(attrs).length === 0) {
        message.warning(
          t('app.kuaizhizao.salesOrder.variantAttrsEmpty', '所选 SKU 未包含有效属性，请重新选择或手动配置'),
        );
        return;
      }
      applyAttributes(attrs);
      closeModal();
      return;
    }

    const values = await manualForm.validateFields().catch(() => null);
    if (!values) return;
    const cleaned = Object.fromEntries(
      Object.entries(values).filter(
        ([, v]) => v != null && v !== '' && !(Array.isArray(v) && v.length === 0),
      ),
    );
    const next = Object.keys(cleaned).length ? normalizeScalarAttrs(cleaned) : undefined;
    applyAttributes(next);
    closeModal();
  };

  useEffect(() => {
    if (activeTab !== 'manual' || !selectedSku) return;
    const attrs = normalizeScalarAttrs(getMaterialVariantAttrs(selectedSku) as Record<string, unknown>);
    manualForm.setFieldsValue(attrs);
  }, [activeTab, selectedSku, manualForm]);

  if (!showEditor) {
    return <span style={{ color: '#999' }}>-</span>;
  }

  if (isPrecombinedSku(material)) {
    const attrs =
      parseVariantAttributesValue(rawAttrs) ??
      parseVariantAttributesValue(material?.variantAttributes ?? (material as any)?.variant_attributes);
    return <AttributeSummaryTags attrs={attrs} definitions={definitions} />;
  }

  const attrs = parseVariantAttributesValue(rawAttrs);

  return (
    <>
      <Form.Item name={[rowIndex, fieldName]} noStyle>
        <VariantAttributesFormBridge />
      </Form.Item>
      <div style={{ minWidth: 140, maxWidth: 260 }}>
        {attrs ? (
          <div style={{ marginBottom: 6 }}>
            <AttributeSummaryTags attrs={attrs} definitions={definitions} />
          </div>
        ) : null}
        <Button
          type="link"
          size="small"
          icon={<SettingOutlined />}
          style={{ padding: 0, height: 'auto' }}
          disabled={!resolvedMasterUuid}
          onClick={openModal}
        >
          {t('app.kuaizhizao.salesOrder.setVariantAttrs', '设置属性组合')}
        </Button>
      </div>

      <Modal
        title={t('app.kuaizhizao.salesOrder.variantAttrsModalTitle', '属性组合')}
        open={modalOpen}
        onCancel={closeModal}
        onOk={() => void handleConfirm()}
        width={920}
        destroyOnHidden
        zIndex={1200}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
        okButtonProps={{ disabled: !resolvedMasterUuid }}
      >
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as VariantModalTab)}
          items={[
            {
              key: 'sku',
              label: t('app.kuaizhizao.salesOrder.selectVariantSku', '选择 SKU'),
              children: (
                <VariantSkuPickerPanel
                  active={modalOpen && activeTab === 'sku'}
                  masterMaterialUuid={resolvedMasterUuid}
                  selectionMode="single"
                  selectedUuid={selectedSkuUuid}
                  onSelectedUuidChange={setSelectedSkuUuid}
                  onSelectedSkuChange={setSelectedSku}
                  tableScrollY={320}
                />
              ),
            },
            {
              key: 'manual',
              label: t('app.kuaizhizao.salesOrder.configureVariantAttrs', '配置属性'),
              children: (
                <Form form={manualForm} layout="vertical" style={{ paddingTop: 4 }}>
                  <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 16 }}>
                    {t(
                      'app.kuaizhizao.salesOrder.configureVariantAttrsHint',
                      '逐项选择属性值；也可在「选择 SKU」页签中选取已维护组合后再微调。',
                    )}
                  </Typography.Paragraph>
                  <VariantAttributeFields
                    definitions={definitions}
                    loading={defsLoading}
                    singleValueOnly
                    colSpan={{ xs: 24, sm: 12, md: 8 }}
                  />
                </Form>
              ),
            },
          ]}
        />
      </Modal>
    </>
  );
};
