/**
 * 库区新建/编辑弹窗
 */

import React, { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ProFormInstance } from '@ant-design/pro-components';
import { App } from 'antd';
import { FormModalTemplate } from '../../../components/layout-templates';
import { MODAL_CONFIG } from '../../../components/layout-templates/constants';
import { storageAreaApi, warehouseApi } from '../services/warehouse';
import { testGenerateCode, generateCode, getCodeRulePageConfig } from '../../../services/codeRule';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../utils/codeRulePage';
import type { StorageArea, StorageAreaCreate, StorageAreaUpdate, Warehouse } from '../types/warehouse';
import { SchemaFormRenderer } from '../../../components/schema-form';
import { storageAreaFormSchema } from '../schemas/storage-area';

const PAGE_CODE = 'master-data-warehouse-storage-area';

export interface StorageAreaFormModalProps {
  open: boolean;
  onClose: () => void;
  editUuid: string | null;
  onSuccess: (storageArea: StorageArea) => void;
}

export const StorageAreaFormModal: React.FC<StorageAreaFormModalProps> = ({
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
  const [effectiveRuleCode, setEffectiveRuleCode] = useState<string | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  const isEdit = Boolean(editUuid);

  useEffect(() => {
    const loadWarehouses = async () => {
      try {
        const result = await warehouseApi.list({ limit: 1000, isActive: true });
        setWarehouses(result);
      } catch (error) {
        console.error('加载仓库列表失败:', error);
      }
    };
    loadWarehouses();
  }, []);

  useEffect(() => {
    if (!open) return;
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({ isActive: true });
    if (!editUuid) {
      (async () => {
        let ruleCode = getPageRuleCode(PAGE_CODE);
        let autoGenerate = isAutoGenerateEnabled(PAGE_CODE);
        try {
          const pageConfig = await getCodeRulePageConfig(PAGE_CODE);
          if (pageConfig?.ruleCode) {
            ruleCode = pageConfig.ruleCode;
            autoGenerate = !!pageConfig.autoGenerate;
          }
        } catch {}
        if (autoGenerate && ruleCode) {
          setEffectiveRuleCode(ruleCode);
          testGenerateCode({ rule_code: ruleCode })
            .then((res) => {
              setPreviewCode(res.code);
              formRef.current?.setFieldsValue({ code: res.code, isActive: true });
            })
            .catch(() => {
              setPreviewCode(null);
              formRef.current?.setFieldsValue({ isActive: true });
            });
        } else {
          setPreviewCode(null);
          setEffectiveRuleCode(null);
          formRef.current?.setFieldsValue({ isActive: true });
        }
      })();
      return;
    }
    setPreviewCode(null);
    setEffectiveRuleCode(null);
    storageAreaApi
      .get(editUuid)
      .then((detail) => {
        formRef.current?.setFieldsValue({
          code: detail.code,
          name: detail.name,
          warehouseId: detail.warehouseId,
          description: detail.description,
          isActive: detail.isActive ?? true,
        });
      })
      .catch((err: any) => {
        messageApi.error(err?.message || t('app.master-data.storageAreas.getDetailFailed'));
      });
  }, [open, editUuid]);

  const handleSubmit = async (values: any) => {
    try {
      setFormLoading(true);
      if (isEdit && editUuid) {
        await storageAreaApi.update(editUuid, values as StorageAreaUpdate);
        messageApi.success(t('common.updateSuccess'));
        const updated = await storageAreaApi.get(editUuid);
        onSuccess(updated);
      } else {
        const ruleCodeToUse = effectiveRuleCode || getPageRuleCode(PAGE_CODE);
        if (
          ruleCodeToUse &&
          (isAutoGenerateEnabled(PAGE_CODE) || effectiveRuleCode) &&
          (values.code === previewCode || !values.code)
        ) {
          try {
            const codeResponse = await generateCode({ rule_code: ruleCodeToUse });
            values.code = codeResponse.code;
          } catch {
            // keep form code
          }
        }
        if (values.isActive === undefined) {
          values.isActive = true;
        }
        const created = await storageAreaApi.create(values as StorageAreaCreate);
        messageApi.success(t('common.createSuccess'));
        onSuccess(created);
      }
      onClose();
      formRef.current?.resetFields();
      setPreviewCode(null);
    } catch (error: any) {
      messageApi.error(error?.message || (isEdit ? t('common.updateFailed') : t('common.createFailed')));
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
    warehouseId: warehouses.map((w) => ({
      label: `${w.code} - ${w.name}`,
      value: w.id,
    })),
  };

  return (
    <FormModalTemplate
      title={isEdit ? t('field.storageArea.editTitle') : t('field.storageArea.createTitle')}
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
        schema={storageAreaFormSchema}
        codeField="code"
        codeAutoGenerated={isAutoGenerateEnabled(PAGE_CODE)}
        codeAutoGeneratedKey="field.storageArea.codeAutoGenerated"
        isEdit={isEdit}
        optionsMap={optionsMap}
      />
    </FormModalTemplate>
  );
};
