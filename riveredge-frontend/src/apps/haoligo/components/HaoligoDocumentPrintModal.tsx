/**
 * 好力 GO — 维保/维修完成单打印预览
 */

import React, { useEffect, useRef, useState } from 'react';
import { App, Button, Modal, Select, Space, Spin } from 'antd';
import { PrinterOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { apiRequest } from '../../../services/api';
import { getPrintTemplateList, type PrintTemplate } from '../../../services/printTemplate';
import { DOCUMENT_TYPE_TO_CODE } from '../../../config/printTemplateSchemas';
import { loadHaoligoPrintTemplatePresets } from '../services/haoligo';
import { MODAL_CONFIG } from '../../../components/layout-templates';
import { handleError } from '../../../utils/errorHandler';

export type HaoligoPrintDocumentType =
  | 'equipment_spot_check'
  | 'equipment_upkeep_complete'
  | 'mold_maintenance_complete'
  | 'mold_outsource_maintenance_complete'
  | 'finance_material_acceptance';

interface HaoligoDocumentPrintModalProps {
  open: boolean;
  onClose: () => void;
  documentType: HaoligoPrintDocumentType;
  documentId?: number | null;
  title?: string;
}

const HaoligoDocumentPrintModal: React.FC<HaoligoDocumentPrintModalProps> = ({
  open,
  onClose,
  documentType,
  documentId,
  title,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const [templates, setTemplates] = useState<PrintTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [printLoading, setPrintLoading] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>();
  const [previewHtml, setPreviewHtml] = useState('');
  const latestRef = useRef<{ templateId?: string; docId?: number }>({});
  const printFrameRef = useRef<HTMLIFrameElement | null>(null);

  const effectiveId = documentId ?? undefined;
  latestRef.current = { templateId: selectedTemplateId, docId: effectiveId };

  const printHtmlInHiddenFrame = (html: string) => {
    const existing = printFrameRef.current;
    if (existing?.parentNode) {
      existing.parentNode.removeChild(existing);
    }
    const iframe = document.createElement('iframe');
    iframe.setAttribute('title', 'haoligo-print-frame');
    iframe.setAttribute('aria-hidden', 'true');
    Object.assign(iframe.style, {
      position: 'fixed',
      right: '0',
      bottom: '0',
      width: '0',
      height: '0',
      border: '0',
      opacity: '0',
      pointerEvents: 'none',
    });
    document.body.appendChild(iframe);
    printFrameRef.current = iframe;

    const win = iframe.contentWindow;
    const doc = iframe.contentDocument ?? win?.document;
    if (!win || !doc) {
      messageApi.error(t('app.haoligo.print.printFailed'));
      iframe.remove();
      printFrameRef.current = null;
      return;
    }

    const cleanup = () => {
      win.removeEventListener('afterprint', cleanup);
      if (printFrameRef.current === iframe) {
        iframe.remove();
        printFrameRef.current = null;
      }
    };
    win.addEventListener('afterprint', cleanup);

    doc.open();
    doc.write(html);
    doc.close();

    const waitForImages = () => {
      const images = Array.from(doc.images);
      if (images.length === 0) return Promise.resolve();
      return Promise.all(
        images.map(
          (img) =>
            img.complete
              ? Promise.resolve()
              : new Promise<void>((resolve) => {
                  img.addEventListener('load', () => resolve(), { once: true });
                  img.addEventListener('error', () => resolve(), { once: true });
                }),
        ),
      );
    };

    void waitForImages().then(() => {
      try {
        win.focus();
        win.print();
      } catch {
        cleanup();
        messageApi.error(t('app.haoligo.print.printFailed'));
      }
    });
  };

  useEffect(() => {
    return () => {
      if (printFrameRef.current?.parentNode) {
        printFrameRef.current.parentNode.removeChild(printFrameRef.current);
      }
      printFrameRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    setSelectedTemplateId(undefined);
    setPreviewHtml('');
    void (async () => {
      setLoading(true);
      try {
        try {
          await loadHaoligoPrintTemplatePresets();
        } catch {
          // 无任一连单据 print 权时跳过预设写入，仍可使用已有模板
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
        handleError(e as Error, t('app.haoligo.print.loadTemplatesFailed'));
        setTemplates([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, documentType, t]);

  useEffect(() => {
    if (!open || !effectiveId || !selectedTemplateId) {
      setPreviewHtml('');
      return;
    }
    const reqKey = `${selectedTemplateId}-${effectiveId}`;
    setPrintLoading(true);
    void (async () => {
      try {
        const result = await apiRequest<{ content?: string }>(
          `/apps/haoligo/print/documents/${documentType}/${effectiveId}`,
          {
            method: 'GET',
            params: {
              template_uuid: selectedTemplateId,
              output_format: 'html',
              response_format: 'json',
            },
          },
        );
        if (latestRef.current.templateId !== selectedTemplateId || latestRef.current.docId !== effectiveId) return;
        setPreviewHtml(result?.content ?? '');
      } catch (e) {
        if (latestRef.current.templateId === selectedTemplateId && latestRef.current.docId === effectiveId) {
          handleError(e as Error, t('app.haoligo.print.previewFailed'));
          setPreviewHtml('');
        }
      } finally {
        if (latestRef.current.templateId === selectedTemplateId && latestRef.current.docId === effectiveId) {
          setPrintLoading(false);
        }
      }
    })();
  }, [open, documentType, effectiveId, selectedTemplateId, t]);

  const handlePrint = async () => {
    if (!effectiveId) {
      messageApi.warning(t('app.haoligo.print.missingDocumentId'));
      return;
    }
    if (!selectedTemplateId) {
      messageApi.warning(t('app.haoligo.print.selectTemplateFirst'));
      return;
    }
    setPrintLoading(true);
    try {
      const result = await apiRequest<{ content?: string }>(
        `/apps/haoligo/print/documents/${documentType}/${effectiveId}`,
        {
          method: 'GET',
          params: {
            template_uuid: selectedTemplateId,
            output_format: 'html',
            response_format: 'json',
          },
        },
      );
      const html = result?.content ?? '';
      if (!html) {
        messageApi.warning(t('app.haoligo.print.emptyContent'));
        return;
      }
      printHtmlInHiddenFrame(html);
    } catch (e) {
      handleError(e as Error, t('app.haoligo.print.printFailed'));
    } finally {
      setPrintLoading(false);
    }
  };

  const modalTitle = title ?? t('app.haoligo.print.modalTitle');

  return (
    <Modal
      {...MODAL_CONFIG}
      title={modalTitle}
      open={open}
      onCancel={onClose}
      width={960}
      destroyOnHidden
      footer={
        <Space>
          <Button onClick={onClose}>{t('app.haoligo.equipment.documents.btnCancel')}</Button>
          <Button type="primary" icon={<PrinterOutlined />} loading={printLoading} onClick={() => void handlePrint()}>
            {t('app.haoligo.print.printButton')}
          </Button>
        </Space>
      }
    >
      <Spin spinning={loading || printLoading}>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <div style={{ marginBottom: 8, color: 'rgba(0,0,0,0.65)' }}>{t('app.haoligo.print.templateLabel')}</div>
            <Select
              style={{ width: '100%' }}
              placeholder={t('app.haoligo.print.templatePlaceholder')}
              notFoundContent={loading ? null : t('app.haoligo.print.noTemplates')}
              value={selectedTemplateId}
              onChange={setSelectedTemplateId}
              options={templates.map((tpl) => ({
                label: `${tpl.name}${tpl.is_default ? ` (${t('app.haoligo.print.defaultTag')})` : ''}`,
                value: tpl.uuid,
              }))}
            />
          </div>
          <div
            style={{
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              minHeight: 420,
              maxHeight: '60vh',
              overflow: 'auto',
              background: '#f8fafc',
              padding: 12,
            }}
          >
            {previewHtml ? (
              <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
            ) : (
              <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>
                {effectiveId ? t('app.haoligo.print.previewEmpty') : t('app.haoligo.print.missingDocumentId')}
              </div>
            )}
          </div>
        </Space>
      </Spin>
    </Modal>
  );
};

export default HaoligoDocumentPrintModal;
