/**
 * OCR 录单 · 主数据新建确认弹窗
 */

import React, { useEffect, useMemo, useState } from 'react';
import { App, Button, Checkbox, Divider, Form, Input, Modal, Space, Tag, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { MaterialFormModal } from '../../../../../master-data/components/MaterialFormModal';
import type { Material, MaterialCreate } from '../../../../../master-data/types/material';
import { MODAL_CONFIG } from '../../../../../../components/layout-templates/constants';
import type { SalesOrderOcrResult } from '../../../../services/sales-order-ocr';
import {
  buildOcrCreatePlan,
  commitOcrCreateDrafts,
  prepareOcrCustomerDraftCode,
  type CustomerLike,
  type MaterialLike,
  type OcrCreatePlan,
  type OcrCustomerCreateDraft,
  type OcrMaterialCreateDraft,
} from './salesOrderOcrMasters';

const { Text } = Typography;
const I18N = 'app.kuaizhizao.salesOrder.aiCreate';

type FormValues = {
  customer?: OcrCustomerCreateDraft;
};

export interface SalesOrderOcrMasterConfirmModalProps {
  open: boolean;
  result: SalesOrderOcrResult | null;
  customers: CustomerLike[];
  materials: MaterialLike[];
  canCreateCustomer: boolean;
  canCreateMaterial: boolean;
  onClose: () => void;
  onSkip: () => void;
  onConfirmed: (payload: {
    customers: CustomerLike[];
    materials: MaterialLike[];
    createdCustomer?: CustomerLike;
    createdMaterialsByDedupeKey: Map<string, MaterialLike>;
    createdCustomerCount: number;
    createdMaterialCount: number;
  }) => void;
}

function clonePlan(plan: OcrCreatePlan): OcrCreatePlan {
  return {
    customer: plan.customer ? { ...plan.customer } : undefined,
    materials: plan.materials.map((item) => ({ ...item, lineIndices: [...item.lineIndices] })),
    needsConfirmation: plan.needsConfirmation,
  };
}

function toMaterialLike(material: Material): MaterialLike {
  return {
    id: material.id,
    name: material.name,
    mainCode: material.mainCode,
    code: material.code,
    specification: material.specification,
    baseUnit: material.baseUnit,
  };
}

function materialDraftToInitialValues(draft: OcrMaterialCreateDraft): Partial<MaterialCreate> {
  return {
    name: draft.name,
    mainCode: draft.mainCode,
    specification: draft.specification,
    baseUnit: draft.baseUnit,
    sourceType: 'Buy',
    isActive: true,
  };
}

export function SalesOrderOcrMasterConfirmModal({
  open,
  result,
  customers,
  materials,
  canCreateCustomer,
  canCreateMaterial,
  onClose,
  onSkip,
  onConfirmed,
}: SalesOrderOcrMasterConfirmModalProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [createdMaterialsByDedupeKey, setCreatedMaterialsByDedupeKey] = useState<Map<string, MaterialLike>>(
    () => new Map(),
  );
  const [materialModalOpen, setMaterialModalOpen] = useState(false);
  const [activeMaterialDraft, setActiveMaterialDraft] = useState<OcrMaterialCreateDraft | null>(null);

  const basePlan = useMemo(() => {
    if (!result) return null;
    return buildOcrCreatePlan(result, customers, materials, {
      canCreateCustomer,
      canCreateMaterial,
    });
  }, [result, customers, materials, canCreateCustomer, canCreateMaterial]);

  useEffect(() => {
    if (!open) {
      setCreatedMaterialsByDedupeKey(new Map());
      setMaterialModalOpen(false);
      setActiveMaterialDraft(null);
      return;
    }
    if (!basePlan) return;

    let cancelled = false;
    const init = async () => {
      setPreparing(true);
      try {
        const plan = clonePlan(basePlan);
        if (plan.customer) {
          plan.customer = await prepareOcrCustomerDraftCode(plan.customer);
        }
        if (!cancelled) {
          form.setFieldsValue({ customer: plan.customer });
        }
      } finally {
        if (!cancelled) setPreparing(false);
      }
    };
    void init();
    return () => {
      cancelled = true;
    };
  }, [open, basePlan, form]);

  const openMaterialForm = (draft: OcrMaterialCreateDraft) => {
    setActiveMaterialDraft(draft);
    setMaterialModalOpen(true);
  };

  const handleMaterialCreated = (material: Material) => {
    if (!activeMaterialDraft) return;
    const normalized = toMaterialLike(material);
    setCreatedMaterialsByDedupeKey((prev) => {
      const next = new Map(prev);
      next.set(activeMaterialDraft.dedupeKey, normalized);
      return next;
    });
    setMaterialModalOpen(false);
    setActiveMaterialDraft(null);
  };

  const handleConfirm = async () => {
    if (!result || !basePlan) return;
    try {
      const values = await form.validateFields();
      const plan: OcrCreatePlan = {
        customer: basePlan.customer
          ? {
              ...basePlan.customer,
              ...values.customer,
              enabled: values.customer?.enabled ?? false,
              name: values.customer?.name?.trim() ?? '',
              code: values.customer?.code?.trim() ?? '',
            }
          : undefined,
        materials: basePlan.materials.map((item) => ({ ...item, enabled: false })),
        needsConfirmation: basePlan.needsConfirmation,
      };

      if (plan.customer?.enabled && !canCreateCustomer) {
        message.warning(t(`${I18N}.customerCreateDenied`));
        return;
      }

      setSubmitting(true);
      const committed = await commitOcrCreateDrafts({
        plan,
        canCreateCustomer,
        canCreateMaterial: false,
        customers,
        materials: [
          ...materials,
          ...Array.from(createdMaterialsByDedupeKey.values()).filter(
            (item) => !materials.some((m) => m.id === item.id),
          ),
        ],
      });

      const mergedMaterialsByDedupeKey = new Map<string, MaterialLike>(createdMaterialsByDedupeKey);
      let mergedMaterials = [...committed.materials];
      for (const material of createdMaterialsByDedupeKey.values()) {
        if (!mergedMaterials.some((item) => item.id === material.id)) {
          mergedMaterials = [...mergedMaterials, material];
        }
      }

      onConfirmed({
        customers: committed.customers,
        materials: mergedMaterials,
        createdCustomer: committed.customer,
        createdMaterialsByDedupeKey: mergedMaterialsByDedupeKey,
        createdCustomerCount: committed.createdCustomerCount,
        createdMaterialCount: createdMaterialsByDedupeKey.size,
      });
    } catch (err: unknown) {
      const code = err instanceof Error ? err.message : '';
      if (code === 'CUSTOMER_CODE_RULE_REQUIRED') {
        message.error(t(`${I18N}.customerCodeRuleRequired`));
        return;
      }
      if (code === 'CUSTOMER_NAME_REQUIRED') {
        message.error(t(`${I18N}.confirmMasterRequired`));
        return;
      }
      if (err && typeof err === 'object' && 'errorFields' in err) {
        return;
      }
      message.error(err instanceof Error ? err.message : t(`${I18N}.recognizeFailed`));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Modal
        title={t(`${I18N}.confirmMasterTitle`)}
        open={open}
        onCancel={onClose}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        destroyOnHidden
        confirmLoading={submitting}
        footer={
          <Space wrap>
            <Button onClick={onClose} disabled={submitting || preparing}>
              {t('common.cancel')}
            </Button>
            <Button onClick={onSkip} disabled={submitting || preparing}>
              {t(`${I18N}.confirmMasterSkip`)}
            </Button>
            <Button type="primary" loading={submitting || preparing} onClick={() => void handleConfirm()}>
              {t(`${I18N}.confirmMasterCreate`)}
            </Button>
          </Space>
        }
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Text type="secondary">{t(`${I18N}.confirmMasterDesc`)}</Text>
          <Form form={form} layout="vertical" disabled={preparing || submitting}>
            {basePlan?.customer ? (
              <>
                <Divider orientation="left" plain>
                  {t(`${I18N}.confirmMasterCustomer`)}
                </Divider>
                <Form.Item name={['customer', 'enabled']} valuePropName="checked" style={{ marginBottom: 12 }}>
                  <Checkbox disabled={!canCreateCustomer}>{t(`${I18N}.confirmMasterCreateCustomer`)}</Checkbox>
                </Form.Item>
                <Form.Item
                  label={t('field.customer.code')}
                  name={['customer', 'code']}
                  rules={[
                    ({ getFieldValue }) => ({
                      validator: async (_, value) => {
                        if (!getFieldValue(['customer', 'enabled'])) return;
                        if ((value ?? '').trim()) return;
                        throw new Error(t(`${I18N}.customerCodeRuleRequired`));
                      },
                    }),
                  ]}
                >
                  <Input placeholder={t('field.customer.codePlaceholder')} />
                </Form.Item>
                <Form.Item
                  label={t('field.customer.name')}
                  name={['customer', 'name']}
                  rules={[
                    ({ getFieldValue }) => ({
                      validator: async (_, value) => {
                        if (!getFieldValue(['customer', 'enabled'])) return;
                        if ((value ?? '').trim()) return;
                        throw new Error(t('field.customer.nameRequired'));
                      },
                    }),
                  ]}
                >
                  <Input placeholder={t('field.customer.namePlaceholder')} />
                </Form.Item>
                <Form.Item label={t('field.customer.contactPerson')} name={['customer', 'contactPerson']}>
                  <Input placeholder={t('field.customer.contactPersonPlaceholder')} />
                </Form.Item>
                <Form.Item label={t('field.customer.phone')} name={['customer', 'phone']}>
                  <Input placeholder={t('field.customer.phonePlaceholder')} />
                </Form.Item>
                <Form.Item label={t('field.customer.address')} name={['customer', 'address']}>
                  <Input placeholder={t('field.customer.addressPlaceholder')} />
                </Form.Item>
              </>
            ) : null}
          </Form>

          {basePlan?.materials.length ? (
            <>
              <Divider orientation="left" plain>
                {t(`${I18N}.confirmMasterMaterial`)}
              </Divider>
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                {basePlan.materials.map((draft, index) => {
                  const created = createdMaterialsByDedupeKey.get(draft.dedupeKey);
                  const summary = [draft.name, draft.specification, draft.baseUnit].filter(Boolean).join(' · ');
                  return (
                    <div key={draft.dedupeKey} className="sales-order-ai-master-confirm-item">
                      <div className="sales-order-ai-master-confirm-item-head">
                        <Text strong>
                          {t(`${I18N}.confirmMasterCreateMaterial`)} #{index + 1}
                        </Text>
                        <Tag color={created ? 'success' : 'processing'}>
                          {created
                            ? t(`${I18N}.confirmMasterMaterialCreated`)
                            : t(`${I18N}.confirmMasterMaterialPending`)}
                        </Tag>
                      </div>
                      <Text type="secondary">{summary}</Text>
                      {!created && canCreateMaterial ? (
                        <Button
                          type="link"
                          size="small"
                          style={{ paddingInline: 0, alignSelf: 'flex-start' }}
                          onClick={() => openMaterialForm(draft)}
                        >
                          {t(`${I18N}.confirmMasterOpenMaterialForm`)}
                        </Button>
                      ) : null}
                    </div>
                  );
                })}
              </Space>
            </>
          ) : null}
        </Space>
      </Modal>

      <MaterialFormModal
        open={materialModalOpen}
        onClose={() => {
          setMaterialModalOpen(false);
          setActiveMaterialDraft(null);
        }}
        onSuccess={handleMaterialCreated}
        initialValues={activeMaterialDraft ? materialDraftToInitialValues(activeMaterialDraft) : undefined}
      />
    </>
  );
}

export default SalesOrderOcrMasterConfirmModal;
