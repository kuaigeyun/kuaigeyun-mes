/**
 * 采购订单 AI 智能录单（KU-Draft）
 */

import React, { useCallback, useState } from 'react';
import { Alert, App, Button, Upload } from 'antd';
import { PaperClipOutlined } from '@ant-design/icons';
import type { ProFormInstance } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import { UniAiButton } from '../../../../../../components/uni-ai-button';
import { UniDetail } from '../../../../../../components/uni-detail';
import { DRAWER_CONFIG } from '../../../../../../components/layout-templates';
import { useKuaiaiEntryAvailable } from '../../../../../kuaiai/hooks/useKuaiaiEntryAvailable';
import {
  extractPurchaseOrderFromImage,
  parsePurchaseOrderFromText,
  type PurchaseOrderOcrResult,
} from '../../../../services/purchase-order-ocr';

const I18N = 'app.kuaizhizao.purchaseOrder.aiCreate';

export interface PurchaseOrderAiCreateTriggerProps {
  formRef: React.RefObject<ProFormInstance | undefined>;
  onApplied?: () => void;
}

export function PurchaseOrderAiCreateTrigger({ formRef, onApplied }: PurchaseOrderAiCreateTriggerProps) {
  const { t } = useTranslation();
  const available = useKuaiaiEntryAvailable();
  const [open, setOpen] = useState(false);
  if (!available) return null;
  return (
    <>
      <UniAiButton onClick={() => setOpen(true)}>{t(`${I18N}.trigger`)}</UniAiButton>
      <PurchaseOrderAiCreateDrawer
        open={open}
        onClose={() => setOpen(false)}
        formRef={formRef}
        onApplied={onApplied}
      />
    </>
  );
}

type DrawerProps = PurchaseOrderAiCreateTriggerProps & {
  open: boolean;
  onClose: () => void;
};

function applyPurchaseOrderOcr(formRef: React.RefObject<ProFormInstance | undefined>, result: PurchaseOrderOcrResult) {
  const form = formRef.current;
  if (!form) return;
  const fields: Record<string, unknown> = {};
  if (result.supplierName) fields.supplier_name = result.supplierName;
  if (result.orderDate) fields.order_date = result.orderDate;
  if (result.deliveryDate) fields.delivery_date = result.deliveryDate;
  if (result.notes) fields.remarks = result.notes;
  form.setFieldsValue(fields);
  if (result.items?.length) {
    form.setFieldsValue({
      items: result.items.map((row) => ({
        material_code: row.materialCode,
        material_name: row.materialName,
        material_spec: row.materialSpec,
        material_unit: row.materialUnit,
        quantity: row.quantity,
        unit_price: row.unitPrice,
        tax_rate: row.taxRate,
        delivery_date: row.deliveryDate,
        remarks: row.notes,
      })),
    });
  }
}

export function PurchaseOrderAiCreateDrawer({ open, onClose, formRef, onApplied }: DrawerProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<PurchaseOrderOcrResult | null>(null);

  const runParse = useCallback(async (input: string) => {
    setLoading(true);
    try {
      const res = await parsePurchaseOrderFromText(input, preview || undefined);
      setPreview(res);
      message.success('解析完成，请确认后填入表单');
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : '解析失败');
    } finally {
      setLoading(false);
    }
  }, [message, preview]);

  const handleUpload = async (file: File) => {
    setLoading(true);
    try {
      const res = await extractPurchaseOrderFromImage(file);
      setPreview(res);
      message.success('图片识别完成');
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : '识别失败');
    } finally {
      setLoading(false);
    }
    return false;
  };

  const handleApply = () => {
    if (!preview) return;
    applyPurchaseOrderOcr(formRef, preview);
    message.success('已填入表单，请核对后保存');
    onApplied?.();
    onClose();
  };

  return (
    <UniDetail
      {...DRAWER_CONFIG}
      title={t(`${I18N}.title`)}
      open={open}
      onClose={onClose}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" disabled={!preview} onClick={handleApply}>
            确认填入表单
          </Button>
        </div>
      }
    >
      <Alert
        type="info"
        showIcon
        title="上传采购单/询价单图片，或粘贴文字描述；确认后仅填入表单，不会自动保存。"
        style={{ marginBottom: 16 }}
      />
      <Upload beforeUpload={handleUpload} showUploadList={false} accept="image/*">
        <Button icon={<PaperClipOutlined />} loading={loading}>
          上传图片识别
        </Button>
      </Upload>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="粘贴采购需求文字…"
        rows={4}
        style={{ width: '100%', marginTop: 12, marginBottom: 8 }}
      />
      <Button type="primary" loading={loading} disabled={!text.trim()} onClick={() => void runParse(text)}>
        解析文字
      </Button>
      {preview ? (
        <pre style={{ marginTop: 16, fontSize: 12, maxHeight: 280, overflow: 'auto' }}>
          {JSON.stringify(preview, null, 2)}
        </pre>
      ) : null}
    </UniDetail>
  );
}

export default PurchaseOrderAiCreateTrigger;
