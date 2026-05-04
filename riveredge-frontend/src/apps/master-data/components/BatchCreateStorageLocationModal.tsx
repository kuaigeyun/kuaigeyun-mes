/**
 * 批量建位弹窗
 *
 * 按库区/货架排数/货架层数/层数分区批量建立库位，层级详细程度可自定义。
 * 支持预览与二次确认，正式建立前可检查生成结果。
 */

import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Form, InputNumber, Select, Input, App, Table, Steps, Typography, Button, Space } from 'antd';
import { storageLocationApi, storageAreaApi } from '../services/warehouse';
import type { StorageLocationCreate, StorageArea } from '../types/warehouse';
import { batchImport } from '../../../utils/batchOperations';

/** 批量建位参数 */
export interface BatchCreateStorageLocationParams {
  storageAreaId: number;
  codePrefix?: string;
  shelfRows: number;
  shelfLayers?: number;
  layerPartitions?: number;
}

/**
 * 根据参数生成库位列表（纯函数，便于复用与测试）
 */
export function generateStorageLocations(params: BatchCreateStorageLocationParams): StorageLocationCreate[] {
  const { storageAreaId, codePrefix = '', shelfRows = 1, shelfLayers = 0, layerPartitions = 0 } = params;

  const rows = Math.max(1, Number(shelfRows) || 1);
  const layers = Math.max(0, Number(shelfLayers) || 0);
  const partitions = Math.max(0, Number(layerPartitions) || 0);

  const items: StorageLocationCreate[] = [];
  const prefix = (codePrefix || '').trim().toUpperCase();
  const sep = prefix ? '-' : '';

  const layerCount = layers > 0 ? layers : 1;
  const partCount = partitions > 0 ? partitions : 1;

  for (let r = 1; r <= rows; r++) {
    for (let l = 1; l <= layerCount; l++) {
      for (let p = 1; p <= partCount; p++) {
        const parts: string[] = [String(r).padStart(2, '0')];
        if (layers > 0) parts.push(String(l).padStart(2, '0'));
        if (partitions > 0) parts.push(String(p).padStart(2, '0'));
        const suffix = parts.join('-');
        const code = prefix ? `${prefix}${sep}${suffix}` : suffix;
        const name = prefix ? `${prefix}-${suffix}` : suffix;
        items.push({
          code,
          name,
          storageAreaId,
          isActive: true,
        });
      }
    }
  }

  return items;
}

const STEP_FORM = 0;
const STEP_PREVIEW = 1;
const PREVIEW_DISPLAY_LIMIT = 20;
const MAX_ITEMS = 500;

export interface BatchCreateStorageLocationModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const BatchCreateStorageLocationModal: React.FC<BatchCreateStorageLocationModalProps> = ({
  open,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const [form] = Form.useForm();
  const [step, setStep] = useState(STEP_FORM);
  const [loading, setLoading] = useState(false);
  const [storageAreas, setStorageAreas] = useState<StorageArea[]>([]);
  const [previewItems, setPreviewItems] = useState<StorageLocationCreate[]>([]);

  React.useEffect(() => {
    if (open) {
      storageAreaApi.list({ limit: 1000, is_active: true }).then(res => setStorageAreas(res.items)).catch(() => {});
      form.resetFields();
      setStep(STEP_FORM);
      setPreviewItems([]);
    }
  }, [open, form]);

  const handlePreview = useCallback(async () => {
    try {
      const values = await form.validateFields();
      const params: BatchCreateStorageLocationParams = {
        storageAreaId: values.storageAreaId,
        codePrefix: values.codePrefix,
        shelfRows: values.shelfRows ?? 1,
        shelfLayers: values.shelfLayers ?? 0,
        layerPartitions: values.layerPartitions ?? 0,
      };

      const items = generateStorageLocations(params);

      if (items.length === 0) {
        messageApi.warning(t('field.storageLocation.batchCreateNoItems'));
        return;
      }

      if (items.length > MAX_ITEMS) {
        messageApi.warning(t('field.storageLocation.batchCreateTooMany', { max: MAX_ITEMS }));
        return;
      }

      setPreviewItems(items);
      setStep(STEP_PREVIEW);
    } catch (e: any) {
      if (e?.errorFields) return;
      messageApi.error(e?.message || t('common.operationFailed'));
    }
  }, [form, messageApi, t]);

  const handleBack = useCallback(() => {
    setStep(STEP_FORM);
    setPreviewItems([]);
  }, []);

  const handleConfirmCreate = useCallback(async () => {
    if (previewItems.length === 0) return;

    setLoading(true);
    try {
      const result = await batchImport({
        items: previewItems,
        importFn: async (item) => storageLocationApi.create(item),
        title: t('field.storageLocation.batchCreateTitle'),
        concurrency: 5,
      });

      if (result.failureCount > 0) {
        messageApi.warning(
          t('app.master-data.warehouses.importResult', {
            success: result.successCount,
            failure: result.failureCount,
          })
        );
      } else {
        messageApi.success(t('app.master-data.importSuccess', { count: result.successCount }));
      }

      if (result.successCount > 0) {
        onSuccess();
        onClose();
      }
    } catch (e: any) {
      messageApi.error(e?.message || t('common.operationFailed'));
    } finally {
      setLoading(false);
    }
  }, [previewItems, messageApi, t, onSuccess, onClose]);

  const handleCancel = useCallback(() => {
    onClose();
  }, [onClose]);

  const getStorageAreaName = (id: number) => {
    const area = storageAreas.find((s) => s.id === id);
    return area ? `${area.code} - ${area.name}` : String(id);
  };

  const previewColumns = [
    { title: t('app.master-data.storageLocations.code'), dataIndex: 'code', width: 120 },
    { title: t('app.master-data.storageLocations.name'), dataIndex: 'name', width: 120 },
    {
      title: t('field.storageLocation.storageAreaId'),
      dataIndex: 'storageAreaId',
      width: 180,
      render: (id: number) => getStorageAreaName(id),
    },
  ];

  const displayItems = previewItems.slice(0, PREVIEW_DISPLAY_LIMIT);
  const hasMore = previewItems.length > PREVIEW_DISPLAY_LIMIT;

  const steps = [
    { title: t('field.storageLocation.batchCreateStepConfig') },
    { title: t('field.storageLocation.batchCreateStepPreview') },
  ];

  const renderFooter = () => {
    if (step === STEP_FORM) {
      return (
        <Space>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="primary" onClick={handlePreview}>
            {t('field.storageLocation.batchCreatePreview')}
          </Button>
        </Space>
      );
    }
    return (
      <Space>
        <Button onClick={handleBack}>{t('field.storageLocation.batchCreateBack')}</Button>
        <Button type="primary" loading={loading} onClick={handleConfirmCreate}>
          {t('field.storageLocation.batchCreateConfirm')}
        </Button>
      </Space>
    );
  };

  return (
    <Modal
      title={t('field.storageLocation.batchCreateTitle')}
      open={open}
      onCancel={handleCancel}
      footer={renderFooter()}
      width={step === STEP_FORM ? 480 : 560}
      destroyOnHidden
      className="batch-create-storage-location-modal"
      styles={{ body: { maxHeight: 'none', overflow: 'visible' } }}
    >
      <Steps
        current={step}
        size="small"
        style={{ marginBottom: 24 }}
        items={steps.map((s, i) => ({ key: i, title: s.title }))}
      />

      {step === STEP_FORM && (
        <Form
          form={form}
          layout="vertical"
          initialValues={{ shelfRows: 1, shelfLayers: 0, layerPartitions: 0 }}
          onValuesChange={(changed) => {
            if ('storageAreaId' in changed && changed.storageAreaId != null) {
              const area = storageAreas.find((s) => s.id === changed.storageAreaId);
              if (area?.code) {
                form.setFieldValue('codePrefix', area.code);
              }
            }
          }}
        >
          <Form.Item
            name="storageAreaId"
            label={t('field.storageLocation.storageAreaId')}
            rules={[{ required: true, message: t('field.storageLocation.storageAreaIdRequired') }]}
          >
            <Select
              placeholder={t('field.storageLocation.storageAreaIdPlaceholder')}
              options={storageAreas.map((s) => ({ label: `${s.code} - ${s.name}`, value: s.id }))}
              showSearch
              filterOption={(input, opt) => (opt?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())}
            />
          </Form.Item>
          <Form.Item name="codePrefix" label={t('field.storageLocation.codePrefix')} extra={t('field.storageLocation.codePrefixExtra')}>
            <Input
              placeholder={t('field.storageLocation.codePrefixPlaceholder')}
              allowClear
              maxLength={20}
            />
          </Form.Item>
          <Form.Item
            name="shelfRows"
            label={t('field.storageLocation.shelfRows')}
            rules={[{ required: true, message: t('field.storageLocation.shelfRowsRequired') }]}
          >
            <InputNumber
              min={1}
              max={99}
              placeholder={t('field.storageLocation.shelfRowsPlaceholder')}
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item name="shelfLayers" label={t('field.storageLocation.shelfLayers')} extra={t('field.storageLocation.shelfLayersExtra')}>
            <InputNumber
              min={0}
              max={99}
              placeholder={t('field.storageLocation.shelfLayersPlaceholder')}
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item name="layerPartitions" label={t('field.storageLocation.layerPartitions')} extra={t('field.storageLocation.layerPartitionsExtra')}>
            <InputNumber
              min={0}
              max={99}
              placeholder={t('field.storageLocation.layerPartitionsPlaceholder')}
              style={{ width: '100%' }}
            />
          </Form.Item>
        </Form>
      )}

      {step === STEP_PREVIEW && (
        <div>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
            {t('field.storageLocation.batchCreatePreviewSummary', { count: previewItems.length })}
          </Typography.Paragraph>
          <Table
            size="small"
            columns={previewColumns}
            dataSource={displayItems}
            rowKey="code"
            pagination={false}
          />
          {hasMore && (
            <Typography.Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
              {t('field.storageLocation.batchCreatePreviewMore', {
                shown: PREVIEW_DISPLAY_LIMIT,
                total: previewItems.length,
              })}
            </Typography.Text>
          )}
        </div>
      )}
    </Modal>
  );
};
