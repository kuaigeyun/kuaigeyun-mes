/**
 * 工艺型物料 · 加工原料配置向导（Tier 2/3）
 * 引导用户为工艺型自制件配置 BOM 原料行，可选新建或选用已有采购件。
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  App,
  Button,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Segmented,
  Select,
  Space,
  Steps,
  Typography,
} from 'antd';
import { materialApi, bomApi } from '../services/material';
import type { Material, MaterialCreate } from '../types/material';
import {
  FabricationMaterialRef,
  getMaterialCode,
  getMaterialBaseUnit,
  suggestRawMaterialName,
} from '../utils/fabricationRawMaterial';

export interface FabricationRawMaterialWizardProps {
  open: boolean;
  onClose: () => void;
  fabricationMaterial: FabricationMaterialRef | null;
  onSuccess?: (result: { rawMaterialId: number; rawMaterialName: string }) => void;
}

type RawMaterialMode = 'existing' | 'create';

const FabricationRawMaterialWizard: React.FC<FabricationRawMaterialWizardProps> = ({
  open,
  onClose,
  fabricationMaterial,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const [currentStep, setCurrentStep] = useState(0);
  const [mode, setMode] = useState<RawMaterialMode>('create');
  const [submitting, setSubmitting] = useState(false);
  const [buyMaterials, setBuyMaterials] = useState<Material[]>([]);
  const [buyMaterialsLoading, setBuyMaterialsLoading] = useState(false);
  const [selectedExisting, setSelectedExisting] = useState<Material | null>(null);

  const [form] = Form.useForm();

  const fabricationCode = fabricationMaterial?.mainCode ?? fabricationMaterial?.code ?? '—';
  const defaultRawName = useMemo(
    () => suggestRawMaterialName(fabricationMaterial?.name ?? ''),
    [fabricationMaterial?.name],
  );
  const defaultUnit = fabricationMaterial?.baseUnit ?? '件';

  const resetWizard = useCallback(() => {
    setCurrentStep(0);
    setMode('create');
    setSelectedExisting(null);
  }, []);

  useEffect(() => {
    if (!open) {
      resetWizard();
      return;
    }
    form.setFieldsValue({
      rawMaterialName: defaultRawName,
      baseUnit: defaultUnit,
      quantity: 1,
      wasteRate: 0,
      issueMethod: 'backflush',
      specification: '',
    });
  }, [open, defaultRawName, defaultUnit, form, resetWizard]);

  const loadBuyMaterials = useCallback(async (keyword?: string) => {
    setBuyMaterialsLoading(true);
    try {
      const res = await materialApi.list({
        limit: 200,
        isActive: true,
        sourceType: 'Buy',
        keyword: keyword?.trim() || undefined,
      });
      setBuyMaterials(res.items ?? []);
    } catch {
      setBuyMaterials([]);
    } finally {
      setBuyMaterialsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && mode === 'existing') {
      loadBuyMaterials();
    }
  }, [open, mode, loadBuyMaterials]);

  const handleClose = () => {
    resetWizard();
    onClose();
  };

  const validateStep = async (): Promise<boolean> => {
    if (currentStep === 0) return true;
    if (currentStep === 1) {
      if (mode === 'existing') {
        if (!selectedExisting?.id) {
          messageApi.warning(t('app.master-data.fabricationWizard.selectExistingRequired'));
          return false;
        }
        return true;
      }
      try {
        await form.validateFields(['rawMaterialName', 'baseUnit']);
        return true;
      } catch {
        return false;
      }
    }
    try {
      await form.validateFields(['quantity', 'issueMethod']);
      return true;
    } catch {
      return false;
    }
  };

  const handleNext = async () => {
    if (!(await validateStep())) return;
    setCurrentStep((s) => Math.min(s + 1, 2));
  };

  const handlePrev = () => setCurrentStep((s) => Math.max(s - 1, 0));

  const handleSubmit = async () => {
    if (!fabricationMaterial?.id) return;
    if (!(await validateStep())) return;

    const values = form.getFieldsValue(true);
    setSubmitting(true);
    try {
      let rawMaterialId: number;
      let rawMaterialName: string;

      if (mode === 'existing' && selectedExisting?.id) {
        rawMaterialId = selectedExisting.id;
        rawMaterialName = selectedExisting.name;
      } else {
        const createPayload: Record<string, unknown> = {
          name: String(values.rawMaterialName).trim(),
          base_unit: values.baseUnit || defaultUnit,
          specification: values.specification?.trim() || undefined,
          group_id: fabricationMaterial.groupId,
          source_type: 'Buy',
          source_config: {
            auto_generated: true,
            fabrication_for_material_id: fabricationMaterial.id,
          },
        };
        const created = await materialApi.create(createPayload as MaterialCreate);
        rawMaterialId = created.id!;
        rawMaterialName = created.name;
      }

      await bomApi.create({
        material_id: fabricationMaterial.id,
        version: '1.0',
        approval_status: 'draft',
        items: [
          {
            component_id: rawMaterialId,
            quantity: Number(values.quantity) || 1,
            unit: values.baseUnit || values.unit || defaultUnit,
            waste_rate: Number(values.wasteRate) || 0,
            issue_method: values.issueMethod || 'backflush',
          },
        ],
      } as any);

      messageApi.success(t('app.master-data.fabricationWizard.success'));
      onSuccess?.({ rawMaterialId, rawMaterialName });
      handleClose();
    } catch (e: any) {
      messageApi.error(e?.message || t('app.master-data.fabricationWizard.failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const steps = [
    { title: t('app.master-data.fabricationWizard.stepIntro') },
    { title: t('app.master-data.fabricationWizard.stepRawMaterial') },
    { title: t('app.master-data.fabricationWizard.stepBom') },
  ];

  return (
    <Modal
      title={t('app.master-data.fabricationWizard.title')}
      open={open}
      onCancel={handleClose}
      width={640}
      destroyOnHidden
      footer={
        <Space>
          <Button onClick={handleClose}>{t('app.master-data.fabricationWizard.skipLater')}</Button>
          {currentStep > 0 && (
            <Button onClick={handlePrev}>{t('app.master-data.fabricationWizard.prev')}</Button>
          )}
          {currentStep < 2 ? (
            <Button type="primary" onClick={handleNext}>
              {t('app.master-data.fabricationWizard.next')}
            </Button>
          ) : (
            <Button type="primary" loading={submitting} onClick={handleSubmit}>
              {t('app.master-data.fabricationWizard.confirmCreate')}
            </Button>
          )}
        </Space>
      }
    >
      <Steps current={currentStep} items={steps} size="small" style={{ marginBottom: 24 }} />

      <Form form={form} layout="vertical" preserve>
        {currentStep === 0 && (
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <Alert
              type="info"
              showIcon
              message={t('app.master-data.fabricationWizard.introTitle')}
              description={t('app.master-data.fabricationWizard.introDesc')}
            />
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label={t('app.master-data.bom.materialCode')}>
                {fabricationCode}
              </Descriptions.Item>
              <Descriptions.Item label={t('app.master-data.bom.materialName')}>
                {fabricationMaterial?.name ?? '—'}
              </Descriptions.Item>
            </Descriptions>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {t('app.master-data.fabricationWizard.autoGeneratedHint')}
            </Typography.Text>
          </Space>
        )}

        {currentStep === 1 && (
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <Segmented
              block
              value={mode}
              onChange={(v) => {
                setMode(v as RawMaterialMode);
                setSelectedExisting(null);
              }}
              options={[
                { label: t('app.master-data.fabricationWizard.modeCreate'), value: 'create' },
                { label: t('app.master-data.fabricationWizard.modeExisting'), value: 'existing' },
              ]}
            />
            {mode === 'create' ? (
              <>
                <Form.Item
                  name="rawMaterialName"
                  label={t('app.master-data.fabricationWizard.rawMaterialName')}
                  rules={[{ required: true, message: t('common.required') }]}
                >
                  <Input placeholder={defaultRawName} />
                </Form.Item>
                <Form.Item
                  name="baseUnit"
                  label={t('app.master-data.materialForm.baseUnit')}
                  rules={[{ required: true, message: t('common.required') }]}
                >
                  <Input placeholder={defaultUnit} />
                </Form.Item>
                <Form.Item name="specification" label={t('app.master-data.materialForm.specification')}>
                  <Input placeholder={t('app.master-data.fabricationWizard.specPlaceholder')} />
                </Form.Item>
              </>
            ) : (
              <Select
                showSearch
                allowClear
                placeholder={t('app.master-data.fabricationWizard.selectBuyMaterial')}
                loading={buyMaterialsLoading}
                filterOption={false}
                onSearch={loadBuyMaterials}
                value={selectedExisting?.id}
                onChange={(id) => {
                  const mat = buyMaterials.find((m) => m.id === id) ?? null;
                  setSelectedExisting(mat);
                  if (mat) {
                    form.setFieldsValue({ baseUnit: getMaterialBaseUnit(mat as any) });
                  }
                }}
                options={buyMaterials.map((m) => ({
                  value: m.id,
                  label: `${getMaterialCode(m as any)} - ${m.name}`,
                }))}
                style={{ width: '100%' }}
              />
            )}
          </Space>
        )}

        {currentStep === 2 && (
          <>
            <Form.Item noStyle shouldUpdate>
              {() => {
                const summaryRawName =
                  mode === 'existing'
                    ? selectedExisting?.name ?? '—'
                    : form.getFieldValue('rawMaterialName') || defaultRawName;
                return (
                  <Alert
                    type="success"
                    showIcon
                    style={{ marginBottom: 16 }}
                    message={t('app.master-data.fabricationWizard.summaryTitle')}
                    description={
                      <span>
                        {fabricationCode} · {fabricationMaterial?.name}
                        {' → '}
                        {summaryRawName}
                      </span>
                    }
                  />
                );
              }}
            </Form.Item>
            <Form.Item
              name="quantity"
              label={t('app.master-data.fabricationWizard.quantity')}
              rules={[{ required: true, message: t('common.required') }]}
            >
              <InputNumber min={0.0001} precision={4} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="wasteRate" label={t('app.master-data.bom.wasteRate')}>
              <InputNumber min={0} max={100} precision={2} addonAfter="%" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="issueMethod" label={t('app.master-data.bom.issueMethod')}>
              <Select
                options={[
                  { label: t('app.master-data.bom.issueMethodBackflush'), value: 'backflush' },
                  { label: t('app.master-data.bom.issueMethodPick'), value: 'pick' },
                ]}
              />
            </Form.Item>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {t('app.master-data.fabricationWizard.draftBomHint')}
            </Typography.Text>
          </>
        )}
      </Form>
    </Modal>
  );
};

export default FabricationRawMaterialWizard;
