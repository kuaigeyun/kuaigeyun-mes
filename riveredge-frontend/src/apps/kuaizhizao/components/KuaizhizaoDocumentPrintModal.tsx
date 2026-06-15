/**
 * 快制造 — 业务单据打印预览（模板选择 + 浏览器打印）
 */

import React, { useEffect, useRef, useState } from 'react';
import { App, Button, Modal, Select, Space, Spin } from 'antd';
import { PrinterOutlined } from '@ant-design/icons';
import { apiRequest } from '../../../services/api';
import { getPrintTemplateList, type PrintTemplate } from '../../../services/printTemplate';
import { DOCUMENT_TYPE_TO_CODE } from '../../../config/printTemplateSchemas';
import { loadKuaizhizaoPrintTemplatePresets } from '../services/print';
import { buildKuaizhizaoPrintApiPath } from '../utils/kuaizhizaoPrintConfig';
import { MODAL_CONFIG } from '../../../components/layout-templates';
import { handleError } from '../../../utils/errorHandler';

interface KuaizhizaoDocumentPrintModalProps {
  open: boolean;
  onClose: () => void;
  documentType: string;
  documentId?: number | null;
  /** 不传则按 documentType + documentId 从 kuaizhizaoPrintConfig 解析 */
  printApiPath?: string;
  title?: string;
  /** 成功触发浏览器打印后回调（如报价单 record-print） */
  onAfterPrint?: () => void | Promise<void>;
}

const KuaizhizaoDocumentPrintModal: React.FC<KuaizhizaoDocumentPrintModalProps> = ({
  open,
  onClose,
  documentType,
  documentId,
  printApiPath: printApiPathProp,
  title = '打印预览',
  onAfterPrint,
}) => {
  const { message: messageApi } = App.useApp();
  const [templates, setTemplates] = useState<PrintTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [printLoading, setPrintLoading] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>();
  const [previewHtml, setPreviewHtml] = useState('');
  const latestRef = useRef<{ templateId?: string; docId?: number }>({});

  const effectiveId = documentId ?? undefined;
  const resolvedPrintApiPath =
    printApiPathProp ||
    (effectiveId && documentType ? buildKuaizhizaoPrintApiPath(documentType, effectiveId) : '');
  latestRef.current = { templateId: selectedTemplateId, docId: effectiveId };

  useEffect(() => {
    if (!open) return;
    setSelectedTemplateId(undefined);
    setPreviewHtml('');
    void (async () => {
      setLoading(true);
      try {
        try {
          await loadKuaizhizaoPrintTemplatePresets();
        } catch {
          // 无预设加载权限时跳过，仍可使用已有模板
        }
        let data = await getPrintTemplateList({ is_active: true, document_type: documentType });
        const code = DOCUMENT_TYPE_TO_CODE[documentType];
        if (!data.length && code) {
          const all = await getPrintTemplateList({ is_active: true });
          data = all.filter(
            (tpl) =>
              tpl.code === code ||
              tpl.code?.toUpperCase().startsWith(`${code}_`) ||
              tpl.config?.document_type === documentType,
          );
        }
        setTemplates(data);
        const defaultTpl = data.find((x) => x.is_default) ?? data.find((x) => x.code === code) ?? data[0];
        if (defaultTpl) setSelectedTemplateId(defaultTpl.uuid);
      } catch (e) {
        handleError(e as Error, '加载打印模板失败');
        setTemplates([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, documentType]);

  useEffect(() => {
    if (!open || !effectiveId || !selectedTemplateId || !resolvedPrintApiPath) {
      setPreviewHtml('');
      return;
    }
    setPrintLoading(true);
    void (async () => {
      try {
        const result = await apiRequest<{ content?: string }>(resolvedPrintApiPath, {
          method: 'GET',
          params: {
            template_uuid: selectedTemplateId,
            output_format: 'html',
            response_format: 'json',
          },
        });
        if (latestRef.current.templateId !== selectedTemplateId || latestRef.current.docId !== effectiveId) return;
        setPreviewHtml(result?.content ?? '');
      } catch (e) {
        if (latestRef.current.templateId === selectedTemplateId && latestRef.current.docId === effectiveId) {
          handleError(e as Error, '打印预览失败');
          setPreviewHtml('');
        }
      } finally {
        if (latestRef.current.templateId === selectedTemplateId && latestRef.current.docId === effectiveId) {
          setPrintLoading(false);
        }
      }
    })();
  }, [open, effectiveId, selectedTemplateId, resolvedPrintApiPath]);

  const handlePrint = async () => {
    if (!effectiveId) {
      messageApi.warning('缺少单据 ID');
      return;
    }
    if (!selectedTemplateId) {
      messageApi.warning('请先选择打印模板');
      return;
    }
    if (!resolvedPrintApiPath) {
      messageApi.warning('无法解析打印接口');
      return;
    }
    setPrintLoading(true);
    try {
      const result = await apiRequest<{ content?: string }>(resolvedPrintApiPath, {
        method: 'GET',
        params: {
          template_uuid: selectedTemplateId,
          output_format: 'html',
          response_format: 'json',
        },
      });
      const html = result?.content ?? '';
      if (!html) {
        messageApi.warning('打印内容为空');
        return;
      }
      const w = window.open('', '_blank');
      if (!w) {
        messageApi.error('无法打开打印窗口，请检查浏览器拦截设置');
        return;
      }
      w.document.write(html);
      w.document.close();
      w.focus();
      w.onload = () => w.print();
      if (onAfterPrint) {
        await onAfterPrint();
      }
    } catch (e) {
      handleError(e as Error, '打印失败');
    } finally {
      setPrintLoading(false);
    }
  };

  return (
    <Modal
      {...MODAL_CONFIG}
      title={title}
      open={open}
      onCancel={onClose}
      width={960}
      footer={
        <Space>
          <Button onClick={onClose}>关闭</Button>
          <Button type="primary" icon={<PrinterOutlined />} loading={printLoading} onClick={() => void handlePrint()}>
            打印
          </Button>
        </Space>
      }
    >
      <Spin spinning={loading || printLoading}>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Select
            style={{ width: '100%' }}
            placeholder="选择打印模板"
            value={selectedTemplateId}
            onChange={setSelectedTemplateId}
            options={templates.map((tpl) => ({
              value: tpl.uuid,
              label: `${tpl.name}${tpl.is_default ? '（默认）' : ''}`,
            }))}
          />
          <div
            style={{
              border: '1px solid #e2e8f0',
              borderRadius: 4,
              minHeight: 400,
              maxHeight: '60vh',
              overflow: 'auto',
              background: '#fff',
            }}
          >
            {previewHtml ? (
              <iframe title="print-preview" srcDoc={previewHtml} style={{ width: '100%', minHeight: 400, border: 'none' }} />
            ) : (
              <div style={{ padding: 24, color: '#94a3b8', textAlign: 'center' }}>选择模板后将显示预览</div>
            )}
          </div>
        </Space>
      </Spin>
    </Modal>
  );
};

export default KuaizhizaoDocumentPrintModal;
