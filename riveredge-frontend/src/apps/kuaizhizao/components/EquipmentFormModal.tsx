/**
 * 设备新建弹窗（可复用，供工序表单等场景快速新增）
 */

import React, { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ProFormInstance, ProFormText, ProFormSwitch } from '@ant-design/pro-components';
import { App, Row, Col } from 'antd';
import { FormModalTemplate } from '../../../components/layout-templates';
import { MODAL_CONFIG } from '../../../components/layout-templates/constants';
import CodeField from '../../../components/code-field';
import { DictionarySelect } from '../../../components/dictionary-select';
import { equipmentApi } from '../services/equipment';

export interface EquipmentRecord {
  id?: number;
  uuid?: string;
  code?: string;
  name?: string;
  status?: string;
  is_active?: boolean;
}

export interface EquipmentFormModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (equipment: EquipmentRecord) => void;
  zIndex?: number;
}

export const EquipmentFormModal: React.FC<EquipmentFormModalProps> = ({
  open,
  onClose,
  onSuccess,
  zIndex,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const formRef = useRef<ProFormInstance>();
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({ is_active: true });
  }, [open]);

  const handleClose = () => {
    onClose();
    formRef.current?.resetFields();
  };

  const handleSubmit = async (values: Record<string, unknown>): Promise<void> => {
    try {
      setFormLoading(true);
      const created = await equipmentApi.create(values);
      messageApi.success(t('app.kuaizhizao.equipment.createSuccess'));
      onSuccess(created);
      handleClose();
    } catch (error: any) {
      messageApi.error(error?.message || t('common.createFailed'));
      throw error;
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <FormModalTemplate
      title={t('app.kuaizhizao.equipment.create')}
      open={open}
      onClose={handleClose}
      onFinish={handleSubmit}
      isEdit={false}
      loading={formLoading}
      width={MODAL_CONFIG.STANDARD_WIDTH}
      formRef={formRef as React.RefObject<ProFormInstance>}
      initialValues={{ is_active: true }}
      grid={false}
      zIndex={zIndex}
    >
      <Row gutter={16}>
        <Col span={12}>
          <CodeField
            pageCode="kuaizhizao-equipment-management-equipment"
            name="code"
            label={t('app.kuaizhizao.equipment.fieldCode')}
            required={false}
            autoGenerateOnCreate
            showGenerateButton={false}
          />
        </Col>
        <Col span={12}>
          <ProFormText
            name="name"
            label={t('app.kuaizhizao.equipment.fieldName')}
            placeholder={t('app.kuaizhizao.equipment.phName')}
            rules={[{ required: true, message: t('app.kuaizhizao.equipment.ruleNameRequired') }]}
          />
        </Col>
        <Col span={12}>
          <DictionarySelect
            dictionaryCode="EQUIPMENT_STATUS"
            name="status"
            label={t('app.kuaizhizao.equipment.fieldStatus')}
            placeholder={t('app.kuaizhizao.equipment.phStatus')}
            required
            rules={[{ required: true, message: t('app.kuaizhizao.equipment.ruleStatusRequired') }]}
            formRef={formRef}
          />
        </Col>
        <Col span={12}>
          <ProFormSwitch name="is_active" label={t('app.kuaizhizao.equipment.fieldIsActive')} />
        </Col>
      </Row>
    </FormModalTemplate>
  );
};

export default EquipmentFormModal;
