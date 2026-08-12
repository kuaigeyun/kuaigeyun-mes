import React, { useEffect, useMemo, useState } from 'react';
import { Form } from 'antd';
import { ProFormDigit, ProFormItem } from '@ant-design/pro-components';
import type { TFunction } from 'i18next';
import type { Material } from '../../apps/master-data/types/material';
import {
  convertFromBaseQuantity,
  convertToBaseQuantity,
  type MaterialScenario,
} from '../../utils/materialScenarioUnit';
import { getMaterialUnitDisplayMapShared, resolveMaterialUnitLabel } from '../../utils/materialUnitDisplay';
import { fetchMaterialForUnitSelectCache } from '../material-unit-select';
import { QuantityWithUnit, type QuantityWithUnitValue } from './index';
import { unitAddonFieldProps } from './unitAddonFieldProps';

function readBaseUnit(material?: Material | null, fallback?: string | null): string {
  const fromMaterial = String(material?.baseUnit ?? material?.base_unit ?? '').trim();
  if (fromMaterial) return fromMaterial;
  return String(fallback ?? '').trim() || '个';
}

/** 检验单数量单位：单据 material_unit 优先（与 inspection_quantity 同口径） */
function readDocumentUnit(material?: Material | null, materialUnit?: string | null): string {
  const fromDoc = String(materialUnit ?? '').trim();
  if (fromDoc) return fromDoc;
  return readBaseUnit(material, materialUnit);
}

function materialHasAuxiliaryUnits(material: Material | null | undefined, baseUnit: string): boolean {
  const aux = material?.units?.units ?? [];
  return aux.some((row) => {
    const name = String(row?.unit ?? '').trim();
    return name && name !== baseUnit;
  });
}

/**
 * 将数量+单位换算为检验单存储单位（material_unit），与 inspection_quantity 对齐。
 * 禁止直接换算到物料基础单位后再与单据检验数量比较（会把 1 千克误判成对 1 克）。
 */
function bundleToDocumentQty(
  material: Material | null | undefined,
  bundle: QuantityWithUnitValue | undefined,
  documentUnit: string,
): number {
  const qty = Number(bundle?.quantity ?? 0);
  if (!Number.isFinite(qty)) return 0;
  const unit = String(bundle?.unit ?? documentUnit).trim() || documentUnit;
  if (!documentUnit || unit === documentUnit) return qty;
  const baseQty = convertToBaseQuantity(material, qty, unit);
  return convertFromBaseQuantity(material, baseQty, documentUnit);
}

export type InspectionConductQuantityFieldsProps = {
  materialId?: number | null;
  materialUnit?: string | null;
  scenario: MaterialScenario;
  inspectionQuantity: number;
  t: TFunction;
};

/** 检验开展：合格/不合格数量（单单位 addon；多单位 QuantityWithUnit，提交换算为单据单位） */
export function InspectionConductQuantityFields({
  materialId,
  materialUnit,
  scenario,
  inspectionQuantity,
  t,
}: InspectionConductQuantityFieldsProps) {
  const form = Form.useFormInstance();
  const [material, setMaterial] = useState<Material | null>(null);
  const [unitLabelMap, setUnitLabelMap] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    void getMaterialUnitDisplayMapShared().then((map) => {
      if (!cancelled) setUnitLabelMap(map);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!materialId) {
      setMaterial(null);
      return;
    }
    let cancelled = false;
    void fetchMaterialForUnitSelectCache(materialId).then((resp) => {
      if (!cancelled) setMaterial(resp ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [materialId]);

  const baseUnit = useMemo(
    () => readBaseUnit(material, materialUnit),
    [material, materialUnit],
  );
  const documentUnit = useMemo(
    () => readDocumentUnit(material, materialUnit),
    [material, materialUnit],
  );
  const displayUnitLabel = resolveMaterialUnitLabel(documentUnit, unitLabelMap) || documentUnit;
  const addonProps = unitAddonFieldProps(documentUnit, unitLabelMap);
  const useMultiUnit = Boolean(materialId) && materialHasAuxiliaryUnits(material, baseUnit);

  // 多单位路径：默认带出单据单位与检验数量（与检验数量展示口径一致）
  useEffect(() => {
    if (!useMultiUnit || !documentUnit || !form) return;
    const q = (form.getFieldValue('qualified_qty_with_unit') || {}) as QuantityWithUnitValue;
    const u = (form.getFieldValue('unqualified_qty_with_unit') || {}) as QuantityWithUnitValue;
    const needQUnit = !String(q.unit || '').trim();
    const needUUnit = !String(u.unit || '').trim();
    const needQQty = q.quantity == null;
    const needUQty = u.quantity == null;
    if (!needQUnit && !needUUnit && !needQQty && !needUQty) return;
    form.setFieldsValue({
      qualified_qty_with_unit: {
        quantity: needQQty ? inspectionQuantity : q.quantity,
        unit: needQUnit ? documentUnit : q.unit,
      },
      unqualified_qty_with_unit: {
        quantity: needUQty ? 0 : u.quantity,
        unit: needUUnit ? documentUnit : u.unit,
      },
    });
  }, [useMultiUnit, documentUnit, inspectionQuantity, materialId, form]);

  if (useMultiUnit && materialId) {
    return (
      <>
        <ProFormItem
          name="qualified_qty_with_unit"
          label={t('app.kuaizhizao.quality.common.form.qualifiedQty')}
          colProps={{ span: 12 }}
          rules={[
            { required: true, message: t('app.kuaizhizao.quality.common.validation.requiredQualifiedQty') },
            ({ getFieldValue }) => ({
              validator(_: unknown, value: QuantityWithUnitValue | undefined) {
                const qualifiedDoc = bundleToDocumentQty(material, value, documentUnit);
                const unqualifiedDoc = bundleToDocumentQty(
                  material,
                  getFieldValue('unqualified_qty_with_unit') as QuantityWithUnitValue | undefined,
                  documentUnit,
                );
                if (qualifiedDoc + unqualifiedDoc > inspectionQuantity + 1e-9) {
                  return Promise.reject(t('app.kuaizhizao.quality.common.validation.qtySumExceeds'));
                }
                return Promise.resolve();
              },
            }),
          ]}
        >
          <QuantityWithUnit
            materialId={materialId}
            material={material}
            scenario={scenario}
            preferredUnit={documentUnit}
          />
        </ProFormItem>
        <ProFormItem
          name="unqualified_qty_with_unit"
          label={t('app.kuaizhizao.quality.common.form.unqualifiedQty')}
          colProps={{ span: 12 }}
          rules={[
            { required: true, message: t('app.kuaizhizao.quality.common.validation.requiredUnqualifiedQty') },
            ({ getFieldValue }) => ({
              validator(_: unknown, value: QuantityWithUnitValue | undefined) {
                const unqualifiedDoc = bundleToDocumentQty(material, value, documentUnit);
                const qualifiedDoc = bundleToDocumentQty(
                  material,
                  getFieldValue('qualified_qty_with_unit') as QuantityWithUnitValue | undefined,
                  documentUnit,
                );
                if (qualifiedDoc + unqualifiedDoc > inspectionQuantity + 1e-9) {
                  return Promise.reject(t('app.kuaizhizao.quality.common.validation.qtySumExceeds'));
                }
                return Promise.resolve();
              },
            }),
          ]}
        >
          <QuantityWithUnit
            materialId={materialId}
            material={material}
            scenario={scenario}
            preferredUnit={documentUnit}
          />
        </ProFormItem>
        <div style={{ width: '100%', marginBottom: 8, color: 'var(--ant-color-text-secondary)', fontSize: 12 }}>
          {t('app.kuaizhizao.quality.common.label.inspectionQty')}: {inspectionQuantity} {displayUnitLabel}
        </div>
      </>
    );
  }

  return (
    <>
      <ProFormDigit
        name="qualified_quantity"
        label={t('app.kuaizhizao.quality.common.form.qualifiedQty')}
        placeholder={t('app.kuaizhizao.quality.common.placeholder.qualifiedQty')}
        colProps={{ span: 12 }}
        rules={[
          { required: true, message: t('app.kuaizhizao.quality.common.validation.requiredQualifiedQty') },
          { type: 'number', min: 0, message: t('app.kuaizhizao.quality.common.validation.minZero') },
          ({ getFieldValue }: { getFieldValue: (name: string) => unknown }) => ({
            validator(_: unknown, value: unknown) {
              const unqualifiedQuantity = Number(getFieldValue('unqualified_quantity') || 0);
              if (Number(value || 0) + unqualifiedQuantity > inspectionQuantity + 1e-9) {
                return Promise.reject(t('app.kuaizhizao.quality.common.validation.qtySumExceeds'));
              }
              return Promise.resolve();
            },
          }),
        ]}
        fieldProps={{ precision: 2, ...addonProps }}
      />
      <ProFormDigit
        name="unqualified_quantity"
        label={t('app.kuaizhizao.quality.common.form.unqualifiedQty')}
        placeholder={t('app.kuaizhizao.quality.common.placeholder.unqualifiedQty')}
        colProps={{ span: 12 }}
        rules={[
          { required: true, message: t('app.kuaizhizao.quality.common.validation.requiredUnqualifiedQty') },
          { type: 'number', min: 0, message: t('app.kuaizhizao.quality.common.validation.minZero') },
          ({ getFieldValue }: { getFieldValue: (name: string) => unknown }) => ({
            validator(_: unknown, value: unknown) {
              const qualifiedQuantity = Number(getFieldValue('qualified_quantity') || 0);
              if (qualifiedQuantity + Number(value || 0) > inspectionQuantity + 1e-9) {
                return Promise.reject(t('app.kuaizhizao.quality.common.validation.qtySumExceeds'));
              }
              return Promise.resolve();
            },
          }),
        ]}
        fieldProps={{ precision: 2, ...addonProps }}
      />
    </>
  );
}

export type InspectionDefectQuantityFieldProps = {
  materialId?: number | null;
  materialUnit?: string | null;
  maxQuantity?: number;
  t: TFunction;
};

/** 不良登记数量（带单位 addon） */
export function InspectionDefectQuantityField({
  materialId,
  materialUnit,
  maxQuantity,
  t,
}: InspectionDefectQuantityFieldProps) {
  const [unitLabelMap, setUnitLabelMap] = useState<Record<string, string>>({});
  const [resolvedUnit, setResolvedUnit] = useState(String(materialUnit ?? '').trim());

  useEffect(() => {
    void getMaterialUnitDisplayMapShared().then(setUnitLabelMap);
  }, []);

  useEffect(() => {
    const direct = String(materialUnit ?? '').trim();
    if (direct) {
      setResolvedUnit(direct);
      return;
    }
    if (!materialId) return;
    let cancelled = false;
    void fetchMaterialForUnitSelectCache(materialId).then((mat) => {
      if (cancelled) return;
      setResolvedUnit(readBaseUnit(mat, materialUnit));
    });
    return () => {
      cancelled = true;
    };
  }, [materialId, materialUnit]);

  const addonProps = unitAddonFieldProps(resolvedUnit, unitLabelMap);

  return (
    <ProFormDigit
      name="defect_quantity"
      label={t('app.kuaizhizao.quality.common.form.defectQty')}
      colProps={{ span: 24 }}
      rules={[
        { required: true, message: t('app.kuaizhizao.quality.common.validation.requiredDefectQty') },
        { type: 'number', min: 0, message: t('app.kuaizhizao.quality.common.validation.minZero') },
        ...(maxQuantity != null
          ? [
              {
                validator(_: unknown, value: unknown) {
                  if (Number(value || 0) > maxQuantity + 1e-9) {
                    return Promise.reject(
                      t('app.kuaizhizao.quality.common.validation.defectQtyExceeds', {
                        max: maxQuantity,
                      }),
                    );
                  }
                  return Promise.resolve();
                },
              },
            ]
          : []),
      ]}
      fieldProps={{ precision: 2, ...addonProps }}
    />
  );
}

export async function normalizeInspectionConductPayload(
  values: Record<string, unknown>,
  options: {
    materialId?: number | null;
    materialUnit?: string | null;
    scenario: MaterialScenario;
  },
): Promise<Record<string, unknown>> {
  const next = { ...values };
  if (next.qualified_qty_with_unit || next.unqualified_qty_with_unit) {
    let material: Material | null = null;
    if (options.materialId) {
      material = (await fetchMaterialForUnitSelectCache(options.materialId)) ?? null;
    }
    const documentUnit = readDocumentUnit(material, options.materialUnit);
    next.qualified_quantity = bundleToDocumentQty(
      material,
      next.qualified_qty_with_unit as QuantityWithUnitValue | undefined,
      documentUnit,
    );
    next.unqualified_quantity = bundleToDocumentQty(
      material,
      next.unqualified_qty_with_unit as QuantityWithUnitValue | undefined,
      documentUnit,
    );
    delete next.qualified_qty_with_unit;
    delete next.unqualified_qty_with_unit;
  }
  return next;
}
