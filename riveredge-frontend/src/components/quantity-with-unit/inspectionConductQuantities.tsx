import React, { useEffect, useMemo, useState } from 'react';
import { Col, Form, Input } from 'antd';
import { ProFormDigit, ProFormItem, ProFormTextArea } from '@ant-design/pro-components';
import type { TFunction } from 'i18next';
import type { Material } from '../../apps/master-data/types/material';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import type { User } from '../../services/user';
import {
  convertFromBaseQuantity,
  convertToBaseQuantity,
  type MaterialScenario,
} from '../../utils/materialScenarioUnit';
import { getMaterialUnitDisplayMapShared, resolveMaterialUnitLabel } from '../../utils/materialUnitDisplay';
import { fetchMaterialForUnitSelectCache } from '../material-unit-select';
import { UniUserSelect } from '../uni-user-select';
import { QuantityWithUnit, type QuantityWithUnitValue } from './index';
import { unitAddonFieldProps } from './unitAddonFieldProps';
import {
  getInspectionTemplateSource,
  getTemplateStepItems,
} from '../../apps/kuaizhizao/pages/quality-management/components/inspectionTemplateUtils';
import { summarizeConductSteps } from '../../apps/kuaizhizao/types/inspectionStepSpec';

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

/** 检验数量合计比较：统一成 number，并按表单 2 位小数口径，避免串接/`dependencies` 未刷新导致误报 */
function qtySumExceedsInspection(
  qualified: unknown,
  unqualified: unknown,
  inspectionQuantity: unknown,
): boolean {
  const q = Number(qualified ?? 0);
  const u = Number(unqualified ?? 0);
  const max = Number(inspectionQuantity ?? 0);
  if (!Number.isFinite(q) || !Number.isFinite(u) || !Number.isFinite(max)) return true;
  const sum = Math.round((q + u) * 100) / 100;
  const lim = Math.round(max * 100) / 100;
  return sum > lim;
}

export type InspectionConductQuantityFieldsProps = {
  materialId?: number | null;
  materialUnit?: string | null;
  scenario: MaterialScenario;
  inspectionQuantity: number;
  t: TFunction;
  /** 方案检验：用项失败约束整单不合格数量（不按失败项数改写件数） */
  inspection?: Record<string, unknown> | null;
};

/** 检验人员：与合格/不合格数量同一行（span 8），默认当前登录用户 */
function InspectionConductInspectorField({ t }: { t: TFunction }) {
  const form = Form.useFormInstance();
  const currentUser = useCurrentUser();

  useEffect(() => {
    if (!form || !currentUser?.id || !currentUser.uuid) return;
    if (form.getFieldValue('inspector_uuid')) return;
    form.setFieldsValue({
      inspector_uuid: currentUser.uuid,
      inspector_id: currentUser.id,
      inspector_name: currentUser.full_name || currentUser.username,
    });
  }, [form, currentUser?.id, currentUser?.uuid, currentUser?.full_name, currentUser?.username]);

  return (
    <>
      <Form.Item name="inspector_id" hidden>
        <Input />
      </Form.Item>
      <Form.Item name="inspector_name" hidden>
        <Input />
      </Form.Item>
      <UniUserSelect
        name="inspector_uuid"
        label={t('app.kuaizhizao.quality.common.form.inspector')}
        placeholder={t('app.kuaizhizao.quality.common.placeholder.inspector')}
        required
        colProps={{ span: 8 }}
        onChange={(_uuid: unknown, user: User | User[] | undefined) => {
          const picked = Array.isArray(user) ? user[0] : user;
          form.setFieldsValue({
            inspector_id: picked?.id,
            inspector_name: picked ? picked.full_name || picked.username : undefined,
          });
        }}
      />
    </>
  );
}

/** 检验开展：合格/不合格数量 + 检验人员同一行（单单位 addon；多单位 QuantityWithUnit，提交换算为单据单位） */
export function InspectionConductQuantityFields({
  materialId,
  materialUnit,
  scenario,
  inspectionQuantity,
  t,
  inspection,
}: InspectionConductQuantityFieldsProps) {
  const form = Form.useFormInstance();
  const [material, setMaterial] = useState<Material | null>(null);
  const [unitLabelMap, setUnitLabelMap] = useState<Record<string, string>>({});
  const stepResults = Form.useWatch('conduct_step_results', form) as
    | Record<string, { value?: unknown; judgment?: string }>
    | undefined;
  const itemResults = Form.useWatch('item_results', form) as Record<string, unknown> | undefined;
  const stepFailSummary = useMemo(() => {
    const template = getInspectionTemplateSource(inspection);
    const steps = getTemplateStepItems(template);
    return summarizeConductSteps(steps, stepResults, itemResults, t);
  }, [inspection, stepResults, itemResults, t]);

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

  // 关键项失败：若尚未填不合格数量，建议整批不合格（检验员仍可改成分选）
  useEffect(() => {
    if (!form || stepFailSummary.criticalFailCount <= 0 || !(inspectionQuantity > 0)) return;
    if (useMultiUnit) {
      const u = (form.getFieldValue('unqualified_qty_with_unit') || {}) as QuantityWithUnitValue;
      if (Number(u.quantity ?? 0) > 0) return;
      form.setFieldsValue({
        qualified_qty_with_unit: { quantity: 0, unit: documentUnit },
        unqualified_qty_with_unit: { quantity: inspectionQuantity, unit: documentUnit },
        qualified_quantity: 0,
        unqualified_quantity: inspectionQuantity,
      });
      return;
    }
    if (Number(form.getFieldValue('unqualified_quantity') || 0) > 0) return;
    form.setFieldsValue({
      qualified_quantity: 0,
      unqualified_quantity: inspectionQuantity,
    });
  }, [stepFailSummary.criticalFailCount, inspectionQuantity, useMultiUnit, documentUnit, form]);

  const stepFailQtyRule = (unqualifiedDoc: number) => {
    if (stepFailSummary.failCount > 0 && !(unqualifiedDoc > 0)) {
      return Promise.reject(t('app.kuaizhizao.quality.common.validation.qtyRequiredWhenStepFail'));
    }
    return Promise.resolve();
  };

  if (useMultiUnit && materialId) {
    return (
      <>
        <Col span={8}>
          <ProFormItem
            name="qualified_qty_with_unit"
            label={t('app.kuaizhizao.quality.common.form.qualifiedQty')}
            dependencies={['unqualified_qty_with_unit', 'conduct_step_results', 'item_results']}
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
                  if (qtySumExceedsInspection(qualifiedDoc, unqualifiedDoc, inspectionQuantity)) {
                    return Promise.reject(t('app.kuaizhizao.quality.common.validation.qtySumExceeds'));
                  }
                  return stepFailQtyRule(unqualifiedDoc);
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
        </Col>
        <Col span={8}>
          <ProFormItem
            name="unqualified_qty_with_unit"
            label={t('app.kuaizhizao.quality.common.form.unqualifiedQty')}
            dependencies={['qualified_qty_with_unit', 'conduct_step_results', 'item_results']}
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
                  if (qtySumExceedsInspection(qualifiedDoc, unqualifiedDoc, inspectionQuantity)) {
                    return Promise.reject(t('app.kuaizhizao.quality.common.validation.qtySumExceeds'));
                  }
                  return stepFailQtyRule(unqualifiedDoc);
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
        </Col>
        <InspectionConductInspectorField t={t} />
        <Col span={24}>
          <div style={{ marginBottom: 8, color: 'var(--ant-color-text-secondary)', fontSize: 12 }}>
            {t('app.kuaizhizao.quality.common.label.inspectionQty')}: {inspectionQuantity} {displayUnitLabel}
          </div>
        </Col>
      </>
    );
  }

  return (
    <>
      <ProFormDigit
        name="qualified_quantity"
        label={t('app.kuaizhizao.quality.common.form.qualifiedQty')}
        placeholder={t('app.kuaizhizao.quality.common.placeholder.qualifiedQty')}
        colProps={{ span: 8 }}
        dependencies={['unqualified_quantity', 'conduct_step_results', 'item_results']}
        rules={[
          { required: true, message: t('app.kuaizhizao.quality.common.validation.requiredQualifiedQty') },
          { type: 'number', min: 0, message: t('app.kuaizhizao.quality.common.validation.minZero') },
          ({ getFieldValue }: { getFieldValue: (name: string) => unknown }) => ({
            validator(_: unknown, value: unknown) {
              if (qtySumExceedsInspection(value, getFieldValue('unqualified_quantity'), inspectionQuantity)) {
                return Promise.reject(t('app.kuaizhizao.quality.common.validation.qtySumExceeds'));
              }
              return stepFailQtyRule(Number(getFieldValue('unqualified_quantity') || 0));
            },
          }),
        ]}
        fieldProps={{ precision: 2, ...addonProps }}
      />
      <ProFormDigit
        name="unqualified_quantity"
        label={t('app.kuaizhizao.quality.common.form.unqualifiedQty')}
        placeholder={t('app.kuaizhizao.quality.common.placeholder.unqualifiedQty')}
        colProps={{ span: 8 }}
        dependencies={['qualified_quantity', 'conduct_step_results', 'item_results']}
        rules={[
          { required: true, message: t('app.kuaizhizao.quality.common.validation.requiredUnqualifiedQty') },
          { type: 'number', min: 0, message: t('app.kuaizhizao.quality.common.validation.minZero') },
          ({ getFieldValue }: { getFieldValue: (name: string) => unknown }) => ({
            validator(_: unknown, value: unknown) {
              if (qtySumExceedsInspection(getFieldValue('qualified_quantity'), value, inspectionQuantity)) {
                return Promise.reject(t('app.kuaizhizao.quality.common.validation.qtySumExceeds'));
              }
              return stepFailQtyRule(Number(value || 0));
            },
          }),
        ]}
        fieldProps={{ precision: 2, ...addonProps }}
      />
      <InspectionConductInspectorField t={t} />
    </>
  );
}

/** 不合格数量 > 0 时才展示不合格原因（勿用 ProFormDependency 包 colProps，会打断栅格） */
export function InspectionNonconformanceReasonField({ t }: { t: TFunction }) {
  const form = Form.useFormInstance();
  const unqualifiedQty = Form.useWatch('unqualified_quantity', form);
  const unqualifiedBundle = Form.useWatch('unqualified_qty_with_unit', form) as
    | QuantityWithUnitValue
    | undefined;
  const qty =
    unqualifiedBundle != null && typeof unqualifiedBundle === 'object'
      ? Number(unqualifiedBundle.quantity ?? 0)
      : Number(unqualifiedQty ?? 0);
  if (!(qty > 0)) return null;
  return (
    <ProFormTextArea
      name="nonconformance_reason"
      label={t('app.kuaizhizao.quality.common.form.nonconformanceReason')}
      placeholder={t('app.kuaizhizao.quality.common.placeholder.nonconformanceReason')}
      fieldProps={{ rows: 2 }}
      colProps={{ span: 24 }}
    />
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
