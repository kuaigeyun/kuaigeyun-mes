/**
 * 客户/供应商价格本 — 批量登记
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  App,
  Button,
  Checkbox,
  Col,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Space,
  Switch,
  Typography,
} from 'antd';
import type { ProFormInstance } from '@ant-design/pro-components';
import { AppstoreAddOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { UniTableDetail } from '../../../../../components/uni-table-detail';
import { UniDropdown } from '../../../../../components/uni-dropdown';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import { UniMaterialBatchPicker } from '../../../../../components/uni-material-batch-picker';
import PriceTypeSwitch, { type PriceTypeValue } from '../../../../../components/price-type-switch/PriceTypeSwitch';
import { createPartnerPriceBookApi } from '../../../services/partner-price-book';
import type {
  PartnerPriceBookBulkConflictItem,
  PartnerPriceBookBulkConflictPolicy,
  PartnerPriceBookBulkCreate,
  PartnerPriceBookType,
} from '../../../types/partner-price-book';
import type { Material } from '../../../types/material';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { convertUnitPriceByPriceType } from '../../../utils/resolve-partner-material-price';
import { useMaterialUnitOptions } from '../../../hooks/useMaterialUnitOptions';

export interface PartnerPriceBookBatchRegisterModalProps {
  partnerType: PartnerPriceBookType;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  partnerOptions: { label: string; value: number }[];
}

type BulkLineForm = {
  materialId?: number;
  materialCode?: string;
  materialName?: string;
  unit?: string;
  unitPrice?: number;
};

function parseBulkConflicts(error: unknown): PartnerPriceBookBulkConflictItem[] {
  const data = (error as { response?: { data?: { error?: { details?: { conflicts?: unknown } } } } })
    ?.response?.data;
  const raw = data?.error?.details?.conflicts;
  if (!Array.isArray(raw)) return [];
  return raw as PartnerPriceBookBulkConflictItem[];
}

function applyBulkPriceTypeChange(
  form: ProFormInstance,
  checked: boolean,
) {
  const nextType: PriceTypeValue = checked ? 'tax_inclusive' : 'tax_exclusive';
  const fromType: PriceTypeValue = checked ? 'tax_exclusive' : 'tax_inclusive';
  const taxR = Number(form.getFieldValue('taxRate')) || 0;
  const lines = (form.getFieldValue('lines') as BulkLineForm[] | undefined) ?? [];
  if (lines.length > 0) {
    form.setFieldValue(
      'lines',
      lines.map((row) => {
        const up = Number(row?.unitPrice);
        if (!Number.isFinite(up) || up <= 0) return row;
        return {
          ...row,
          unitPrice: convertUnitPriceByPriceType(up, taxR, fromType, nextType),
        };
      }),
    );
  }
  form.setFieldValue('priceType', nextType);
}

export const PartnerPriceBookBatchRegisterModal: React.FC<PartnerPriceBookBatchRegisterModalProps> = ({
  partnerType,
  open,
  onClose,
  onSuccess,
  partnerOptions,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const isCustomer = partnerType === 'customer';
  const priceBookApi = useMemo(() => createPartnerPriceBookApi(partnerType), [partnerType]);
  const formRef = useRef<ProFormInstance>(null);
  const [submitting, setSubmitting] = useState(false);
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);
  const [conflictOpen, setConflictOpen] = useState(false);
  const [conflicts, setConflicts] = useState<PartnerPriceBookBulkConflictItem[]>([]);
  const [applyToAllConflicts, setApplyToAllConflicts] = useState(true);
  const pendingPayloadRef = useRef<Omit<PartnerPriceBookBulkCreate, 'conflictPolicy'> | null>(null);
  const { options: unitOptions, isLoading: unitOptionsLoading } = useMaterialUnitOptions();

  const resetConflictState = () => {
    setConflictOpen(false);
    setConflicts([]);
    pendingPayloadRef.current = null;
  };

  const buildPayload = useCallback((): Omit<PartnerPriceBookBulkCreate, 'conflictPolicy'> | null => {
    const form = formRef.current;
    if (!form) return null;
    const values = form.getFieldsValue(true) as {
      partnerIds?: number[];
      priceType?: PriceTypeValue;
      taxRate?: number;
      effectiveFrom?: dayjs.Dayjs;
      effectiveTo?: dayjs.Dayjs;
      remark?: string;
      isActive?: boolean;
      lines?: BulkLineForm[];
    };
    const partnerIds = (values.partnerIds ?? []).filter((id) => id != null);
    const lines = (values.lines ?? [])
      .map((row) => ({
        materialId: Number(row.materialId),
        unitPrice: Number(row.unitPrice),
        unit: row.unit?.trim() || undefined,
      }))
      .filter((row) => row.materialId > 0 && Number.isFinite(row.unitPrice) && row.unitPrice > 0);

    if (partnerIds.length === 0) {
      messageApi.error(t('app.master-data.priceBook.bulkPartnerRequired'));
      return null;
    }
    if (lines.length === 0) {
      messageApi.error(t('app.master-data.priceBook.bulkLinesRequired'));
      return null;
    }

    const materialIds = lines.map((l) => l.materialId);
    if (new Set(materialIds).size !== materialIds.length) {
      messageApi.error(t('app.master-data.priceBook.bulkDuplicateMaterial'));
      return null;
    }

    return {
      partnerIds,
      lines,
      priceType: values.priceType === 'tax_exclusive' ? 'tax_exclusive' : 'tax_inclusive',
      taxRate: values.taxRate != null ? Number(values.taxRate) : undefined,
      effectiveFrom: values.effectiveFrom ? values.effectiveFrom.format('YYYY-MM-DD') : undefined,
      effectiveTo: values.effectiveTo ? values.effectiveTo.format('YYYY-MM-DD') : undefined,
      remark: values.remark?.trim() || undefined,
      isActive: values.isActive !== false,
    };
  }, [messageApi, t]);

  const submitBulk = useCallback(
    async (payload: PartnerPriceBookBulkCreate) => {
      setSubmitting(true);
      try {
        const res = await priceBookApi.bulkCreate(payload);
        messageApi.success(
          t('app.master-data.priceBook.bulkResultSummary', {
            created: res.createdCount,
            skipped: res.skippedCount,
            overwritten: res.overwrittenCount,
          }),
        );
        resetConflictState();
        onClose();
        onSuccess();
      } catch (error: unknown) {
        const list = parseBulkConflicts(error);
        if (list.length > 0 && !payload.conflictPolicy) {
          pendingPayloadRef.current = {
            partnerIds: payload.partnerIds,
            lines: payload.lines,
            priceType: payload.priceType,
            taxRate: payload.taxRate,
            effectiveFrom: payload.effectiveFrom,
            effectiveTo: payload.effectiveTo,
            remark: payload.remark,
            isActive: payload.isActive,
          };
          setConflicts(list);
          setApplyToAllConflicts(true);
          setConflictOpen(true);
          return;
        }
        messageApi.error(getApiErrorMessage(error, t('common.operationFailed')));
      } finally {
        setSubmitting(false);
      }
    },
    [messageApi, onClose, onSuccess, priceBookApi, t],
  );

  const handleFinish = useCallback(async () => {
    const payload = buildPayload();
    if (!payload) return;
    await submitBulk({ ...payload, conflictPolicy: null });
  }, [buildPayload, submitBulk]);

  const resolveConflicts = useCallback(
    async (policy: PartnerPriceBookBulkConflictPolicy) => {
      const base = pendingPayloadRef.current;
      if (!base) return;
      setConflictOpen(false);
      await submitBulk({ ...base, conflictPolicy: policy });
    },
    [submitBulk],
  );

  const appendMaterials = useCallback((materials: Material[]) => {
    const form = formRef.current;
    if (!form || materials.length === 0) return;
    const lines = [...((form.getFieldValue('lines') as BulkLineForm[] | undefined) ?? [])];
    const existing = new Set(lines.map((r) => r.materialId).filter(Boolean));
    for (const m of materials) {
      if (existing.has(m.id)) continue;
      existing.add(m.id);
      lines.push({
        materialId: m.id,
        materialCode: m.mainCode ?? m.code,
        materialName: m.name,
        unit: m.baseUnit ?? (m as { base_unit?: string }).base_unit,
        unitPrice: undefined,
      });
    }
    form.setFieldsValue({ lines });
    setMaterialPickerOpen(false);
  }, []);

  const lineColumns = useMemo(
    () => [
      {
        title: t('app.master-data.materialForm.mainCode', '内部物料'),
        dataIndex: 'materialId',
        width: 300,
        render: (_: unknown, __: unknown, index: number) => (
          <>
            <UniMaterialSelect
              name={[index, 'materialId']}
              label=""
              placeholder={t('app.master-data.materialForm.mainCodePlaceholder', '请选择物料')}
              required
              size="small"
              listFieldKey={index}
              listFieldName="lines"
              mastersOnly
              fillMapping={{
                materialCode: 'mainCode',
                materialName: 'name',
                unit: 'baseUnit',
              }}
              formItemProps={{ style: { margin: 0 } }}
            />
            <Form.Item name={[index, 'materialCode']} hidden>
              <Input />
            </Form.Item>
            <Form.Item name={[index, 'materialName']} hidden>
              <Input />
            </Form.Item>
          </>
        ),
      },
      {
        title: t('app.master-data.priceBook.standardUnitPrice', '标准价'),
        dataIndex: 'unitPrice',
        width: 140,
        align: 'right' as const,
        render: (_: unknown, __: unknown, index: number) => (
          <Form.Item
            name={[index, 'unitPrice']}
            rules={[
              { required: true, message: t('common.required') },
              { type: 'number', min: 0.0001, message: t('app.master-data.priceBook.unitPriceMin') },
            ]}
            style={{ margin: 0 }}
          >
            <InputNumber min={0.0001} precision={4} style={{ width: '100%' }} size="small" />
          </Form.Item>
        ),
      },
      {
        title: t('app.master-data.materialForm.baseUnit', '基础单位'),
        dataIndex: 'unit',
        width: 120,
        render: (_: unknown, __: unknown, index: number) => (
          <Form.Item name={[index, 'unit']} style={{ margin: 0 }}>
            <UniDropdown
              placeholder={t('app.master-data.materialForm.baseUnitPlaceholder', '请选择单位')}
              allowClear
              showSearch
              optionFilterProp="label"
              loading={unitOptionsLoading}
              options={unitOptions}
              size="small"
              style={{ width: '100%' }}
            />
          </Form.Item>
        ),
      },
    ],
    [t, unitOptions, unitOptionsLoading],
  );

  const modalTitle = isCustomer
    ? t('app.master-data.priceBook.bulkRegisterCustomer', '批量登记客户价格本')
    : t('app.master-data.priceBook.bulkRegisterSupplier', '批量登记供应商价格本');

  return (
    <>
      <FormModalTemplate
        title={modalTitle}
        open={open}
        onClose={() => {
          resetConflictState();
          onClose();
        }}
        onFinish={handleFinish}
        isEdit={false}
        formRef={formRef as React.RefObject<ProFormInstance>}
        width={MODAL_CONFIG.LARGE_WIDTH}
        loading={submitting}
        grid={false}
        initialValues={{
          partnerIds: [],
          priceType: 'tax_inclusive',
          isActive: true,
          lines: [],
        }}
      >
        <Row gutter={16}>
          <Col span={24}>
            <Form.Item
              name="partnerIds"
              label={
                isCustomer
                  ? t('app.master-data.codeMapping.customerLabel', '客户')
                  : t('app.master-data.codeMapping.supplierLabel', '供应商')
              }
              rules={[{ required: true, message: t('common.required') }]}
            >
              <UniDropdown
                mode="multiple"
                placeholder={
                  isCustomer
                    ? t('app.master-data.priceBook.bulkSelectPartnersCustomer')
                    : t('app.master-data.priceBook.bulkSelectPartnersSupplier')
                }
                showSearch
                optionFilterProp="label"
                options={partnerOptions}
                style={{ width: '100%' }}
              />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item name="priceType" hidden initialValue="tax_inclusive">
              <Input />
            </Form.Item>
            <Form.Item
              label={t('app.master-data.priceBook.bulkSharedPriceType', '共用价类')}
              tooltip={t('app.master-data.priceBook.standardUnitPriceTypeHint')}
            >
              <Form.Item noStyle shouldUpdate>
                {() => {
                  const priceType = (formRef.current?.getFieldValue('priceType') ?? 'tax_inclusive') as PriceTypeValue;
                  return (
                    <PriceTypeSwitch
                      checked={priceType === 'tax_inclusive'}
                      onChange={(checked) => {
                        if (formRef.current) applyBulkPriceTypeChange(formRef.current, checked);
                      }}
                    />
                  );
                }}
              </Form.Item>
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="taxRate" label={t('app.master-data.defaults.defaultTaxRate', '默认税率')}>
              <InputNumber min={0} max={100} precision={2} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="effectiveFrom" label={t('app.master-data.priceBook.effectiveFrom', '生效起始')}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="effectiveTo" label={t('app.master-data.priceBook.effectiveTo', '生效截止')}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>

        <UniTableDetail
          name="lines"
          title={t('app.master-data.priceBook.bulkMaterialLines', '物料明细')}
          required
          requiredMessage={t('app.master-data.priceBook.bulkLinesRequired')}
          disabledAdd
          headerExtra={(
            <Space size={8}>
              <Button
                type="dashed"
                icon={<PlusOutlined />}
                onClick={() => {
                  const lines = [...((formRef.current?.getFieldValue('lines') as BulkLineForm[] | undefined) ?? [])];
                  lines.push({
                    materialId: undefined,
                    materialCode: '',
                    materialName: '',
                    unit: undefined,
                    unitPrice: undefined,
                  });
                  formRef.current?.setFieldsValue({ lines });
                }}
              >
                {t('app.master-data.priceBook.bulkAddLine')}
              </Button>
              <Button type="default" icon={<AppstoreAddOutlined />} onClick={() => setMaterialPickerOpen(true)}>
                {t('app.kuaizhizao.common.materialBatchSelect')}
              </Button>
            </Space>
          )}
          columns={lineColumns}
          initialValue={{
            materialId: undefined,
            materialCode: '',
            materialName: '',
            unit: undefined,
            unitPrice: undefined,
          }}
          tableProps={{ size: 'small', style: { width: '100%', margin: 0 } }}
        />

        <Row gutter={16}>
          <Col span={24}>
            <Form.Item name="remark" label={t('common.remark', '备注')}>
              <Input.TextArea rows={2} />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item name="isActive" label={t('common.enabled', '启用')} valuePropName="checked">
              <Switch />
            </Form.Item>
          </Col>
        </Row>
      </FormModalTemplate>

      <UniMaterialBatchPicker
        open={materialPickerOpen}
        onCancel={() => setMaterialPickerOpen(false)}
        onConfirm={appendMaterials}
      />

      <Modal
        title={t('app.master-data.priceBook.bulkConflictTitle')}
        open={conflictOpen}
        onCancel={() => setConflictOpen(false)}
        footer={null}
        destroyOnHidden
        width={560}
      >
        <Typography.Paragraph type="secondary">
          {t('app.master-data.priceBook.bulkConflictHint', { count: conflicts.length })}
        </Typography.Paragraph>
        <div style={{ maxHeight: 240, overflow: 'auto', marginBottom: 16 }}>
          {conflicts.map((c) => (
            <div key={`${c.partnerId}-${c.materialId}-${c.existingUuid}`} style={{ marginBottom: 8 }}>
              <Typography.Text>
                {[c.partnerCode, c.partnerName].filter(Boolean).join(' ')}
                {' / '}
                {[c.materialCode, c.materialName].filter(Boolean).join(' ')}
              </Typography.Text>
            </div>
          ))}
        </div>
        <Checkbox checked={applyToAllConflicts} onChange={(e) => setApplyToAllConflicts(e.target.checked)}>
          {t('app.master-data.priceBook.bulkConflictApplyAll')}
        </Checkbox>
        <Space style={{ marginTop: 16 }}>
          <Button onClick={() => setConflictOpen(false)}>{t('common.cancel')}</Button>
          <Button loading={submitting} onClick={() => resolveConflicts('skip')}>
            {t('app.master-data.priceBook.bulkConflictSkip')}
          </Button>
          <Button type="primary" loading={submitting} onClick={() => resolveConflicts('overwrite')}>
            {t('app.master-data.priceBook.bulkConflictOverwrite')}
          </Button>
        </Space>
      </Modal>
    </>
  );
};
