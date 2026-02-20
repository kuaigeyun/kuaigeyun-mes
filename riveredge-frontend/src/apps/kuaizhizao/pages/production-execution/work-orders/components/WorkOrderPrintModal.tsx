import React, { useState, useEffect, useRef } from 'react';
import { Modal, Select, Button, Spin, message, Empty } from 'antd';
import { PrinterOutlined } from '@ant-design/icons';
import {
  getPrintTemplateList,
  getPrintTemplateByUuid,
  PrintTemplate,
} from '../../../../../../services/printTemplate';
import { handleError } from '../../../../../../utils/errorHandler';
import { apiRequest } from '../../../../../../services/api';
import { DOCUMENT_TYPE_TO_CODE } from '../../../../../../config/printTemplateSchemas';
import { mapWorkOrderToTemplateVariables } from '../../../../../../utils/printTemplateDataMapper';
import { isPdfmeTemplate, variablesToPdfmeInputs, sanitizeTemplate } from '../../../../../../utils/pdfmeTemplateUtils';
import { generate } from '@pdfme/generator';
import { PDFME_PLUGINS } from '../../../../../../components/pdfme-doc/plugins';
import { getPdfmeChineseFont } from '../../../../../../components/pdfme-doc/fonts';
import { workOrderApi } from '../../../../services/production';

interface WorkOrderPrintModalProps {
  visible: boolean;
  onCancel: () => void;
  workOrderData?: any;
  workOrderId?: number;
}

const WorkOrderPrintModal: React.FC<WorkOrderPrintModalProps> = ({
  visible,
  onCancel,
  workOrderData,
  workOrderId,
}) => {
  const [templates, setTemplates] = useState<PrintTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [printLoading, setPrintLoading] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>();
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const fontPromiseRef = useRef<Promise<Awaited<ReturnType<typeof getPdfmeChineseFont>>> | null>(null);
  const templateCacheRef = useRef<Map<string, { template: any }>>(new Map());
  const latestSelectionRef = useRef<{ selectedTemplateId?: string; effectiveWorkOrderId?: number }>({});

  const effectiveWorkOrderId = workOrderId ?? workOrderData?.id;
  latestSelectionRef.current = { selectedTemplateId, effectiveWorkOrderId };

  // Modal 打开时预加载字体，减少首次预览等待
  useEffect(() => {
    if (visible) {
      fontPromiseRef.current = getPdfmeChineseFont();
    }
  }, [visible]);

  useEffect(() => {
    if (visible) {
      loadTemplates();
      setSelectedTemplateId(undefined);
      setPreviewHtml('');
      setPreviewPdfUrl(null);
    }
  }, [visible]);

  useEffect(() => {
    if (visible && selectedTemplateId && effectiveWorkOrderId) {
      loadPreview();
    } else {
      setPreviewHtml('');
      setPreviewPdfUrl(null);
    }
  }, [visible, selectedTemplateId, effectiveWorkOrderId]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await getPrintTemplateList({
        is_active: true,
        document_type: 'work_order',
      });
      setTemplates(data);
      const defaultTpl =
        data.find((t) => t.is_default) ??
        data.find((t) => t.code === DOCUMENT_TYPE_TO_CODE.work_order) ??
        data[0];
      if (defaultTpl) {
        setSelectedTemplateId(defaultTpl.uuid);
      }
    } catch (error: any) {
      handleError(error, '加载打印模板失败');
    } finally {
      setLoading(false);
    }
  };

  const loadPreview = async () => {
    if (!effectiveWorkOrderId || !selectedTemplateId) return;
    const reqId = `${selectedTemplateId}-${effectiveWorkOrderId}`;
    setPrintLoading(true);
    try {
      // 并行：API 请求 + 字体加载（字体在 modal 打开时已预加载）
      const [templateDetail, detail, operations, font] = await Promise.all([
        getPrintTemplateByUuid(selectedTemplateId),
        workOrderApi.get(effectiveWorkOrderId.toString()),
        workOrderApi.getOperations(effectiveWorkOrderId.toString()),
        fontPromiseRef.current ?? getPdfmeChineseFont(),
      ]);

      const variables = mapWorkOrderToTemplateVariables(detail, operations || []);

      if (isPdfmeTemplate(templateDetail.content)) {
        let template = templateCacheRef.current.get(selectedTemplateId)?.template;
        if (!template) {
          const rawTemplate = JSON.parse(templateDetail.content);
          template = sanitizeTemplate(rawTemplate);
          templateCacheRef.current.set(selectedTemplateId, { template });
        }
        const inputs = variablesToPdfmeInputs(template, variables);
        const pdf = await generate({
          template,
          inputs,
          plugins: PDFME_PLUGINS as any,
          options: { font },
        });
        const current = latestSelectionRef.current;
        if (reqId !== `${current.selectedTemplateId}-${current.effectiveWorkOrderId}`) return;
        const blob = new Blob([pdf.buffer], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        setPreviewPdfUrl(url);
        setPreviewHtml('');
      } else {
        const result = await apiRequest<{ content?: string }>(
          `/apps/kuaizhizao/work-orders/${effectiveWorkOrderId}/print`,
          {
            method: 'GET',
            params: {
              template_uuid: selectedTemplateId,
              output_format: 'html',
              response_format: 'json',
            },
          }
        );
        const current = latestSelectionRef.current;
        if (reqId !== `${current.selectedTemplateId}-${current.effectiveWorkOrderId}`) return;
        setPreviewHtml(result?.content ?? '');
        setPreviewPdfUrl(null);
      }
    } catch (error: any) {
      const current = latestSelectionRef.current;
      if (reqId !== `${current.selectedTemplateId}-${current.effectiveWorkOrderId}`) return;
      handleError(error, '加载预览失败');
      setPreviewHtml('');
      setPreviewPdfUrl(null);
    } finally {
      const current = latestSelectionRef.current;
      if (reqId === `${current.selectedTemplateId}-${current.effectiveWorkOrderId}`) {
        setPrintLoading(false);
      }
    }
  };

  const handlePrint = async () => {
    if (!effectiveWorkOrderId) {
      message.warning('工单ID缺失，无法打印');
      return;
    }
    if (!selectedTemplateId) {
      message.warning('请先选择打印模板');
      return;
    }
    setPrintLoading(true);
    try {
      const templateDetail = await getPrintTemplateByUuid(selectedTemplateId);
      const [detail, operations] = await Promise.all([
        workOrderApi.get(effectiveWorkOrderId.toString()),
        workOrderApi.getOperations(effectiveWorkOrderId.toString()),
      ]);
      const variables = mapWorkOrderToTemplateVariables(detail, operations || []);

      if (isPdfmeTemplate(templateDetail.content)) {
        let template = templateCacheRef.current.get(selectedTemplateId)?.template;
        if (!template) {
          const rawTemplate = JSON.parse(templateDetail.content);
          template = sanitizeTemplate(rawTemplate);
          templateCacheRef.current.set(selectedTemplateId, { template });
        }
        const inputs = variablesToPdfmeInputs(template, variables);
        const font = await (fontPromiseRef.current ?? getPdfmeChineseFont());
        const pdf = await generate({
          template,
          inputs,
          plugins: PDFME_PLUGINS as any,
          options: { font },
        });
        const blob = new Blob([pdf.buffer], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const printWindow = window.open(url, '_blank');
        if (printWindow) {
          printWindow.onload = () => {
            printWindow.print();
            printWindow.onafterprint = () => {
              URL.revokeObjectURL(url);
              printWindow.close();
            };
          };
          message.success('打印已发送');
        } else {
          URL.revokeObjectURL(url);
          message.error('无法打开打印窗口，请检查浏览器弹窗设置');
        }
      } else {
        const result = await apiRequest<{ content?: string }>(
          `/apps/kuaizhizao/work-orders/${effectiveWorkOrderId}/print`,
          {
            method: 'GET',
            params: {
              template_uuid: selectedTemplateId,
              output_format: 'html',
              response_format: 'json',
            },
          }
        );
        const html = result?.content ?? '';
        if (!html) {
          message.error('打印内容为空');
          return;
        }
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(
            `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>打印</title></head><body>${html}</body></html>`
          );
          printWindow.document.close();
          printWindow.focus();
          printWindow.print();
          printWindow.close();
          message.success('打印已发送');
        } else {
          message.error('无法打开打印窗口，请检查浏览器弹窗设置');
        }
      }
    } catch (error: any) {
      handleError(error, '打印失败');
    } finally {
      setPrintLoading(false);
    }
  };

  // 清理 PDF URL
  useEffect(() => {
    return () => {
      if (previewPdfUrl) URL.revokeObjectURL(previewPdfUrl);
    };
  }, [previewPdfUrl]);

  return (
    <Modal
      title={
        <div className="no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 16 }}>
          <span style={{ fontWeight: 600, fontSize: 16 }}>工单打印</span>
          <Select
            style={{ width: 260, flexShrink: 0 }}
            placeholder="请选择打印模板"
            value={selectedTemplateId}
            onChange={setSelectedTemplateId}
            loading={loading}
            options={templates.map((t: PrintTemplate) => ({
              label: t.name,
              value: t.uuid,
            }))}
          />
        </div>
      }
      open={visible}
      onCancel={onCancel}
      width={1000}
      wrapClassName="work-order-print-modal-wrap"
      styles={{
        body: {
          padding: 0,
          overflow: 'hidden',
          height: '70vh',
          minHeight: 500,
        },
      }}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          取消
        </Button>,
        <Button
          key="print"
          type="primary"
          icon={<PrinterOutlined />}
          onClick={handlePrint}
          loading={printLoading}
          disabled={!selectedTemplateId || !effectiveWorkOrderId}
        >
          打印
        </Button>,
      ]}
      className="work-order-print-modal"
    >
      <Spin spinning={loading}>
        <div className="work-order-print-preview" style={{ height: '100%', overflow: 'auto' }}>
          {!effectiveWorkOrderId ? (
            <Empty description="工单ID缺失，无法预览" style={{ paddingTop: 100 }} />
          ) : printLoading && !previewHtml && !previewPdfUrl ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: 400 }}>
              <Spin tip="加载预览中..." />
            </div>
          ) : previewPdfUrl ? (
            <iframe
              src={`${previewPdfUrl}#toolbar=0&view=Fit`}
              title="打印预览"
              className="work-order-print-iframe"
            />
          ) : previewHtml ? (
            <div dangerouslySetInnerHTML={{ __html: previewHtml }} style={{ height: '100%', overflow: 'auto', padding: 16 }} />
          ) : (
            <Empty description="请选择有效的打印模板" style={{ paddingTop: 100 }} />
          )}
        </div>
      </Spin>
      <style>{`
        .work-order-print-modal-wrap .ant-modal {
          max-width: calc(100vw - 32px) !important;
        }
        .work-order-print-modal-wrap .ant-modal-body .ant-spin-nested-loading,
        .work-order-print-modal-wrap .ant-modal-body .ant-spin-container,
        .work-order-print-modal-wrap .work-order-print-preview {
          height: 100% !important;
        }
        .work-order-print-modal-wrap .work-order-print-iframe {
          width: 100% !important;
          height: 100% !important;
          min-height: 500px !important;
          border: none !important;
          display: block !important;
          background: #fff !important;
        }
        @media print {
          body * {
            visibility: hidden;
          }
          .ant-modal-wrap,
          .ant-modal-wrap *,
          .ant-modal-content,
          .ant-modal-content *,
          .work-order-print-preview,
          .work-order-print-preview * {
            visibility: visible !important;
          }
          .ant-modal-wrap {
            position: absolute !important;
            left: 0;
            top: 0;
            width: 100%;
            height: auto;
            overflow: visible;
          }
          .ant-modal-content {
            position: absolute !important;
            left: 0;
            top: 0;
            width: 100%;
            border: none;
            box-shadow: none;
            background: white;
          }
          .work-order-print-preview {
            width: 100% !important;
            min-height: auto !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .no-print, .ant-modal-footer, .ant-modal-header, .ant-modal-close {
            display: none !important;
          }
        }
      `}</style>
    </Modal>
  );
};

export default WorkOrderPrintModal;
