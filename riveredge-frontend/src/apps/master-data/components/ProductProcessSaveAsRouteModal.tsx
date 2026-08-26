/**
 * 产品工艺另存为新工艺路线（支持编号规则自动编码，仅新建不覆盖）
 */

import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { App, Form, Input, Modal } from 'antd';
import CodeField from '../../../components/code-field';
import { generateCode, getCodeRulePageConfig, testGenerateCode } from '../../../services/codeRule';
import { getPageRuleCode, isAutoGenerateEnabled } from '../../../utils/codeRulePage';
import type { Material } from '../types/material';

const PAGE_CODE = 'master-data-process-route';

export type ProductProcessSaveAsRouteModalProps = {
  open: boolean;
  material: Material;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (values: { newRouteCode: string; newRouteName: string }) => void | Promise<void>;
};

export const ProductProcessSaveAsRouteModal: React.FC<ProductProcessSaveAsRouteModalProps> = ({
  open,
  material,
  loading = false,
  onClose,
  onSubmit,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const [form] = Form.useForm<{ newRouteCode: string; newRouteName: string }>();

  useEffect(() => {
    if (!open) return;
    const suggestedName = material.name
      ? t('app.master-data.productProcess.saveAsNewRouteNameDefault', { name: material.name })
      : '';
    form.resetFields();
    form.setFieldsValue({
      newRouteCode: '',
      newRouteName: suggestedName,
    });
  }, [form, material.name, open, t]);

  const resolveFinalRouteCode = async (inputCode: string): Promise<string> => {
    let ruleCode: string | undefined;
    let autoGenerate = false;
    let allowManualEdit = true;
    try {
      const pageConfig = await getCodeRulePageConfig(PAGE_CODE);
      ruleCode = pageConfig?.ruleCode;
      autoGenerate = !!(pageConfig?.autoGenerate && ruleCode);
      allowManualEdit = pageConfig?.allowManualEdit !== false;
    } catch {
      ruleCode = getPageRuleCode(PAGE_CODE);
      autoGenerate = isAutoGenerateEnabled(PAGE_CODE);
    }

    const trimmed = inputCode.trim();
    if (!autoGenerate || !ruleCode) {
      return trimmed;
    }

    try {
      const testRes = await testGenerateCode({
        rule_code: ruleCode,
        check_duplicate: true,
        entity_type: 'process_route',
      });
      const preview = (testRes?.code ?? '').trim();
      const useAutoCode = !trimmed || trimmed === preview || !allowManualEdit;
      if (useAutoCode) {
        const codeResponse = await generateCode({ rule_code: ruleCode, entity_type: 'process_route' });
        return (codeResponse?.code ?? (trimmed || preview)).trim();
      }
    } catch {
      if (trimmed) return trimmed;
    }
    return trimmed;
  };

  const handleOk = async () => {
    const values = await form.validateFields();
    const finalCode = await resolveFinalRouteCode(values.newRouteCode ?? '');
    if (!finalCode) {
      messageApi.error(t('field.route.codeRequired'));
      return;
    }
    await onSubmit({
      newRouteCode: finalCode,
      newRouteName: values.newRouteName.trim(),
    });
  };

  return (
    <Modal
      title={t('app.master-data.productProcess.saveAsNewRouteTitle')}
      open={open}
      onCancel={onClose}
      onOk={() => void handleOk()}
      confirmLoading={loading}
      destroyOnHidden
      okText={t('app.master-data.productProcess.saveAsNewRouteConfirm')}
      cancelText={t('common.cancel')}
    >
      <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
        <CodeField
          pageCode={PAGE_CODE}
          name="newRouteCode"
          label={t('field.route.code')}
          required
          autoGenerateOnCreate
          showGenerateButton
        />
        <Form.Item
          name="newRouteName"
          label={t('field.route.name')}
          rules={[
            { required: true, whitespace: true, message: t('field.route.nameRequired') },
            { max: 200, message: t('app.master-data.productProcess.saveAsNewRouteNameMax') },
          ]}
        >
          <Input placeholder={t('field.route.namePlaceholder')} />
        </Form.Item>
      </Form>
    </Modal>
  );
};
