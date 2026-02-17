import React, { useState, useEffect } from 'react';
import { Modal, Select, Button, Spin, message, Space, Empty } from 'antd';
import { PrinterOutlined } from '@ant-design/icons';
import {
  getPrintTemplateList,
  getPrintTemplateByUuid,
  PrintTemplate,
} from '../../../../../../services/printTemplate';
import { handleError } from '../../../../../../utils/errorHandler';
import { apiRequest } from '../../../../../../services/api';
import { DOCUMENT_TYPE_TO_CODE } from '../../../../../../configs/printTemplateSchemas';
import { mapWorkOrderToTemplateVariables } from '../../../../../../utils/printTemplateDataMapper';
import {
  renderUniverTemplateToHtml,
  isUniverDocument,
} from '../../../../../../utils/univerDocToHtml';
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

  const effectiveWorkOrderId = workOrderId ?? workOrderData?.id;

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
      handleError(error, '加载打印模板失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 使用前端 Univer convertBodyToHtml 渲染，保留格式（加粗、表格等）
   * 仅当模板为 Univer 格式时使用；否则回退到后端 API
   */
  const loadPreview = async () => {
    if (!effectiveWorkOrderId || !selectedTemplateId) return;
    setPrintLoading(true);
    try {
      const [templateDetail, detail, operations] = await Promise.all([
        getPrintTemplateByUuid(selectedTemplateId),
        workOrderApi.get(effectiveWorkOrderId.toString()),
        workOrderApi.getOperations(effectiveWorkOrderId.toString()),
      ]);

      const variables = mapWorkOrderToTemplateVariables(detail, operations || []);

      if (isUniverDocument(templateDetail.content)) {
        const html = renderUniverTemplateToHtml(templateDetail.content, variables);
        setPreviewHtml(html || '');
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
        setPreviewHtml(result?.content ?? '');
      }
    } catch (error: any) {
      handleError(error, '加载预览失败');
      setPreviewHtml('');
    } finally {
      setPrintLoading(false);
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

      let html = '';
      if (isUniverDocument(templateDetail.content)) {
        html = renderUniverTemplateToHtml(templateDetail.content, variables);
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
        html = result?.content ?? '';
      }

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
    } catch (error: any) {
      handleError(error, '打印失败');
    } finally {
      setPrintLoading(false);
    }
  };

  return (
    <Modal
      title="工单打印"
      open={visible}
      onCancel={onCancel}
      width={1000}
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
        </Button>
      ]}
      className="print-modal"
    >
      <Spin spinning={loading}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Space className="no-print">
            <span>选择模板：</span>
            <Select
              style={{ width: 300 }}
              placeholder="请选择打印模板"
              value={selectedTemplateId}
              onChange={setSelectedTemplateId}
              loading={loading}
              options={templates.map((t: PrintTemplate) => ({
                label: t.name,
                value: t.uuid,
              }))}
            />
          </Space>

          <div
            style={{
              border: '1px solid #f0f0f0',
              minHeight: 400,
              marginTop: 16,
              overflow: 'auto',
              height: '60vh',
              position: 'relative',
              padding: 16,
              background: '#fff',
            }}
            className="print-preview-area"
          >
            {!effectiveWorkOrderId ? (
              <Empty description="工单ID缺失，无法预览" style={{ paddingTop: 100 }} />
            ) : printLoading && !previewHtml ? (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  height: 400,
                }}
              >
                <Spin tip="加载预览中..." />
              </div>
            ) : previewHtml ? (
              <div
                dangerouslySetInnerHTML={{ __html: previewHtml }}
                style={{ minHeight: 200 }}
              />
            ) : (
              <Empty description="请选择有效的打印模板" style={{ paddingTop: 100 }} />
            )}
          </div>
        </Space>
      </Spin>
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .ant-modal-wrap,
          .ant-modal-wrap *,
          .ant-modal-content,
          .ant-modal-content *,
          .print-preview-area,
          .print-preview-area * {
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
          .print-preview-area {
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
