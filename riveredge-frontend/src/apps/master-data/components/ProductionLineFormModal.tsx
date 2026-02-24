/**
 * 产线新建/编辑弹窗
 */

import React, { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ProFormInstance } from '@ant-design/pro-components';
import { App } from 'antd';
import { FormModalTemplate } from '../../../components/layout-templates';
import { MODAL_CONFIG } from '../../../components/layout-templates/constants';
import { productionLineApi, workshopApi } from '../services/factory';
import { testGenerateCode, generateCode } from '../../../services/codeRule';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../utils/codeRulePage';
import type { ProductionLine, ProductionLineCreate, ProductionLineUpdate, Workshop } from '../types/factory';
import { SchemaFormRenderer } from '../../../components/schema-form';
import { productionLineFormSchema } from '../schemas/production-line';

const PAGE_CODE = 'master-data-factory-production-line';

export interface ProductionLineFormModalProps {
  open: boolean;
  onClose: () => void;
  editUuid: string | null;
  onSuccess: (productionLine: ProductionLine) => void;
}

export const ProductionLineFormModal: React.FC<ProductionLineFormModalProps> = ({
  open,
  onClose,
  editUuid,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const formRef = useRef<ProFormInstance>();
  const [formLoading, setFormLoading] = useState(false);
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [workshops, setWorkshops] = useState<Workshop[]>([]);

  const isEdit = Boolean(editUuid);

  useEffect(() => {
    const loadWorkshops = async () => {
      try {
        const result = await workshopApi.list({ limit: 1000, isActive: true });
        setWorkshops(result);
      } catch (error) {
        console.error('加载车间列表失败:', error);
      }
    };
    loadWorkshops();
  }, []);

  useEffect(() => {
    if (!open) return;
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({ isActive: true });
    if (!editUuid) {
      if (isAutoGenerateEnabled(PAGE_CODE)) {
        const ruleCode = getPageRuleCode(PAGE_CODE);
        if (ruleCode) {
          testGenerateCode({ rule_code: ruleCode })
            .then((res) => {
              setPreviewCode(res.code);
              formRef.current?.setFieldsValue({ code: res.code });
            })
            .catch(() => setPreviewCode(null));
        } else {
          setPreviewCode(null);
        }
      } else {
        setPreviewCode(null);
      }
      return;
    }
    setPreviewCode(null);
    productionLineApi
      .get(editUuid)
      .then((detail) => {
        formRef.current?.setFieldsValue({
          code: detail.code,
          name: detail.name,
          workshopId: detail.workshopId,
          description: detail.description,
          isActive: detail.isActive ?? true,
        });
      })
      .catch((err: any) => {
        messageApi.error(err?.message || '获取产线详情失败');
      });
  }, [open, editUuid]);

  const handleSubmit = async (values: any) => {
    try {
      setFormLoading(true);
      if (isEdit && editUuid) {
        await productionLineApi.update(editUuid, values as ProductionLineUpdate);
        messageApi.success('更新成功');
        const updated = await productionLineApi.get(editUuid);
        onSuccess(updated);
      } else {
        if (isAutoGenerateEnabled(PAGE_CODE)) {
          const ruleCode = getPageRuleCode(PAGE_CODE);
          const currentCode = values.code;
          if (ruleCode && (currentCode === previewCode || !currentCode)) {
            try {
              const codeResponse = await generateCode({ rule_code: ruleCode });
              values.code = codeResponse.code;
            } catch {
              // keep form code
            }
          }
        }
        if (values.isActive === undefined) {
          values.isActive = true;
        }
        const created = await productionLineApi.create(values as ProductionLineCreate);
        messageApi.success('创建成功');
        onSuccess(created);
      }
      onClose();
      formRef.current?.resetFields();
      setPreviewCode(null);
    } catch (error: any) {
      messageApi.error(error?.message || (isEdit ? '更新失败' : '创建失败'));
    } finally {
      setFormLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
    formRef.current?.resetFields();
    setPreviewCode(null);
  };

  const optionsMap = {
    workshopId: workshops.map((w) => ({
      label: `${w.code} - ${w.name}`,
      value: w.id,
    })),
  };

  return (
    <FormModalTemplate
      title={isEdit ? t('field.productionLine.editTitle') : t('field.productionLine.createTitle')}
      open={open}
      onClose={handleClose}
      onFinish={handleSubmit}
      isEdit={isEdit}
      loading={formLoading}
      width={MODAL_CONFIG.STANDARD_WIDTH}
      formRef={formRef as React.RefObject<ProFormInstance>}
      initialValues={{ isActive: true }}
      layout="vertical"
      grid
    >
      <SchemaFormRenderer
        schema={productionLineFormSchema}
        codeField="code"
        codeAutoGenerated={isAutoGenerateEnabled(PAGE_CODE)}
        codeAutoGeneratedKey="field.productionLine.codeAutoGenerated"
        isEdit={isEdit}
        optionsMap={optionsMap}
      />
    </FormModalTemplate>
  );
};
