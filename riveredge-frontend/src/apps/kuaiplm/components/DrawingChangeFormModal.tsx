/**
 * 变更台新建图纸工程变更（不新开页）
 */

import React, { useEffect, useState } from 'react';
import { App, Col, Row } from 'antd';
import { ProFormSelect, ProFormTextArea } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import { FormModalTemplate, MODAL_CONFIG } from '../../../components/layout-templates';
import { drawingApi, type EngineeringDrawing } from '../../master-data/services/drawing';
import { createDrawingChange } from '../services/change-desk';
import { getApiErrorMessage } from '../../../utils/errorHandler';

const CHANGE_TYPES = ['revision', 'file_replace', 'obsolete', 'metadata', 'other'] as const;

export interface DrawingChangeFormModalProps {
  open: boolean;
  drawingUuid?: string;
  onClose: () => void;
  onSuccess: () => void;
}

const DrawingChangeFormModal: React.FC<DrawingChangeFormModalProps> = ({
  open,
  drawingUuid,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [drawings, setDrawings] = useState<EngineeringDrawing[]>([]);

  useEffect(() => {
    if (!open) return;
    void drawingApi.list({ status: 'Released', limit: 200 }).then((res) => {
      setDrawings(res.data ?? []);
    });
  }, [open]);

  return (
    <FormModalTemplate
      title={t('app.kuaiplm.change.createDrawingTitle')}
      open={open}
      onClose={onClose}
      width={MODAL_CONFIG.STANDARD_WIDTH}
      loading={loading}
      grid={false}
      initialValues={{
        drawingUuid,
        changeType: 'revision',
      }}
      onFinish={async (values) => {
        setLoading(true);
        try {
          await createDrawingChange({
            drawing_uuid: values.drawingUuid,
            drawing_change_type: values.changeType,
            change_reason: values.changeReason,
          });
          messageApi.success(t('app.kuaiplm.change.createDrawingSuccess'));
          onSuccess();
          onClose();
        } catch (e) {
          messageApi.error(getApiErrorMessage(e) || t('common.saveFailed'));
        } finally {
          setLoading(false);
        }
      }}
    >
      <Row gutter={16}>
        <Col span={24}>
          <ProFormSelect
            name="drawingUuid"
            label={t('app.kuaiplm.change.drawing')}
            rules={[{ required: true, message: t('app.kuaiplm.change.drawingRequired') }]}
            options={drawings.map((row) => ({
              value: row.uuid,
              label: `${row.code} ${row.name} ${row.revision}`.trim(),
            }))}
            fieldProps={{ showSearch: true, optionFilterProp: 'label' }}
          />
        </Col>
        <Col span={24}>
          <ProFormSelect
            name="changeType"
            label={t('app.kuaiplm.common.columns.changeType')}
            rules={[{ required: true }]}
            options={CHANGE_TYPES.map((value) => ({
              value,
              label: t(`app.kuaiplm.common.drawingChangeType.${value}`),
            }))}
          />
        </Col>
        <Col span={24}>
          <ProFormTextArea
            name="changeReason"
            label={t('app.kuaiplm.common.columns.changeReason')}
            fieldProps={{ rows: 3 }}
          />
        </Col>
      </Row>
    </FormModalTemplate>
  );
};

export default DrawingChangeFormModal;
