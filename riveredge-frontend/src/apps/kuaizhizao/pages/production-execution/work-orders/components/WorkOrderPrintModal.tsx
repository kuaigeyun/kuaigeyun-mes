import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Select, Button, Spin, message, Empty } from 'antd';
import { PrinterOutlined } from '@ant-design/icons';
import {
  getPrintTemplateList,
  PrintTemplate,
} from '../../../../../../services/printTemplate';
import { handleError } from '../../../../../../utils/errorHandler';
import { apiRequest } from '../../../../../../services/api';
import { DOCUMENT_TYPE_TO_CODE } from '../../../../../../config/printTemplateSchemas';
import { MODAL_CONFIG } from '../../../../../../components/layout-templates';

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
  const { t } = useTranslation();
  const [templates, setTemplates] = useState<PrintTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [printLoading, setPrintLoading] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>();
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const latestSelectionRef = useRef<{ selectedTemplateId?: string; effectiveWorkOrderId?: number }>({});

  const effectiveWorkOrderId = workOrderId ?? workOrderData?.id;
  latestSelectionRef.current = { selectedTemplateId, effectiveWorkOrderId };

  useEffect(() => {
    if (visible) {
      loadTemplates();
      setSelectedTemplateId(undefined);
      setPreviewHtml('');
    }
  }, [visible]);

  useEffect(() => {
    if (visible && selectedTemplateId && effectiveWorkOrderId) {
      loadPreview();
    } else {
      setPreviewHtml('');
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
      handleError(error, t('app.kuaizhizao.workOrder.msgLoadPrintTemplateFailed'));
    } finally {
      setLoading(false);
    }
  };

  const loadPreview = async () => {
    if (!effectiveWorkOrderId || !selectedTemplateId) return;
    const reqId = `${selectedTemplateId}-${effectiveWorkOrderId}`;
    setPrintLoading(true);
    try {
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
    } catch (error: any) {
      const current = latestSelectionRef.current;
      if (reqId !== `${current.selectedTemplateId}-${current.effectiveWorkOrderId}`) return;
      handleError(error, t('app.kuaizhizao.workOrder.msgLoadPreviewFailed'));
      setPreviewHtml('');
    } finally {
      const current = latestSelectionRef.current;
      if (reqId === `${current.selectedTemplateId}-${current.effectiveWorkOrderId}`) {
        setPrintLoading(false);
      }
    }
  };

  const handlePrint = async () => {
    if (!effectiveWorkOrderId) {
      message.warning(t('app.kuaizhizao.workOrder.msgWorkOrderIdMissingPrint'));
      return;
    }
    if (!selectedTemplateId) {
      message.warning(t('app.kuaizhizao.workOrder.msgSelectPrintTemplate'));
      return;
    }
    setPrintLoading(true);
    try {
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
        message.error(t('app.kuaizhizao.workOrder.msgPrintContentEmpty'));
        return;
      }
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(
          `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${t('app.kuaizhizao.workOrder.actionPrint')}</title></head><body>${html}</body></html>`
        );
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
        printWindow.close();
        message.success(t('app.kuaizhizao.workOrder.msgPrintSent'));
      } else {
        message.error(t('app.kuaizhizao.workOrder.msgPrintPopupBlocked'));
      }
    } catch (error: any) {
      handleError(error, t('app.kuaizhizao.workOrder.msgPrintFailed'));
    } finally {
      setPrintLoading(false);
    }
  };

  return (
    <Modal
      title={
        <div className="no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 16 }}>
          <span style={{ fontWeight: 600, fontSize: 16 }}>{t('app.kuaizhizao.workOrder.modalPrintTitle')}</span>
          <Select
            style={{ width: 260, flexShrink: 0 }}
            placeholder={t('app.kuaizhizao.workOrder.msgSelectPrintTemplatePlaceholder')}
            value={selectedTemplateId}
            onChange={setSelectedTemplateId}
            loading={loading}
            options={templates.map((tpl: PrintTemplate) => ({
              label: tpl.name,
              value: tpl.uuid,
            }))}
          />
        </div>
      }
      open={visible}
      onCancel={onCancel}
      width={MODAL_CONFIG.LARGE_WIDTH}
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
          {t('common.cancel')}
        </Button>,
        <Button
          key="print"
          type="primary"
          icon={<PrinterOutlined />}
          onClick={handlePrint}
          loading={printLoading}
          disabled={!selectedTemplateId || !effectiveWorkOrderId}
        >
          {t('app.kuaizhizao.workOrder.actionPrint')}
        </Button>,
      ]}
      className="work-order-print-modal"
    >
      <Spin spinning={loading}>
        <div className="work-order-print-preview" style={{ height: '100%', overflow: 'auto' }}>
          {!effectiveWorkOrderId ? (
            <Empty description={t('app.kuaizhizao.workOrder.msgWorkOrderIdMissingPreview')} style={{ paddingTop: 100 }} />
          ) : printLoading && !previewHtml ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: 400 }}>
              <Spin tip={t('app.kuaizhizao.workOrder.msgLoadingPreview')}>
                <div style={{ minHeight: 24 }} />
              </Spin>
            </div>
          ) : previewHtml ? (
            <div dangerouslySetInnerHTML={{ __html: previewHtml }} style={{ height: '100%', overflow: 'auto', padding: 16 }} />
          ) : (
            <Empty description={t('app.kuaizhizao.workOrder.msgSelectValidPrintTemplate')} style={{ paddingTop: 100 }} />
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
