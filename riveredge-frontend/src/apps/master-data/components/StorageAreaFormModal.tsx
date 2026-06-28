/**
 * 库区新建/编辑弹窗
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ProFormInstance } from '@ant-design/pro-components';
import { App, theme } from 'antd';
import { FormModalTemplate } from '../../../components/layout-templates';
import { MODAL_CONFIG, MODAL_NESTED_ABOVE_PARENT_OFFSET } from '../../../components/layout-templates/constants';
import { storageAreaApi, warehouseApi } from '../services/warehouse';
import { testGenerateCode, generateCode, getCodeRulePageConfig } from '../../../services/codeRule';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../utils/codeRulePage';
import type { StorageArea, StorageAreaCreate, StorageAreaUpdate, Warehouse } from '../types/warehouse';
import { SchemaFormRenderer } from '../../../components/schema-form';
import { storageAreaFormSchema } from '../schemas/storage-area';
import { useCustomFields } from '../../../hooks/useCustomFields';
import { CustomFieldsFormSection } from '../../../components/custom-fields';
import { WarehouseFormModal } from './WarehouseFormModal';

const PAGE_CODE = 'master-data-warehouse-storage-area';
const CUSTOM_FIELD_TABLE = 'master_data_warehouse_storage_areas';

export interface StorageAreaFormModalProps {
  open: boolean;
  onClose: () => void;
  editUuid: string | null;
  onSuccess: (storageArea: StorageArea) => void;
  zIndex?: number;
}

export const StorageAreaFormModal: React.FC<StorageAreaFormModalProps> = ({
  open,
  onClose,
  editUuid,
  onSuccess,
  zIndex,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const { token } = theme.useToken();
  const formRef = useRef<ProFormInstance>();
  const [formLoading, setFormLoading] = useState(false);
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [effectiveRuleCode, setEffectiveRuleCode] = useState<string | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseQuickCreateVisible, setWarehouseQuickCreateVisible] = useState(false);

  const {
    customFields,
    customFieldValues,
    loadFieldValues,
    extractFormValues,
    saveCustomFieldValues,
    resetFieldValues,
  } = useCustomFields({ tableName: CUSTOM_FIELD_TABLE, loadWhenOpen: true, open });

  const isEdit = Boolean(editUuid);

  const nestedModalZIndex =
    zIndex != null
      ? zIndex + MODAL_NESTED_ABOVE_PARENT_OFFSET
      : token.zIndexPopupBase + MODAL_NESTED_ABOVE_PARENT_OFFSET;

  const reloadWarehouses = useCallback(async () => {
    try {
      const result = await warehouseApi.list({ limit: 1000, is_active: true });
      setWarehouses(result.items);
    } catch (error) {
      console.error('加载仓库列表失败:', error);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void reloadWarehouses();
  }, [open, reloadWarehouses]);

  useEffect(() => {
    if (!open) return;
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({ isActive: true });
    resetFieldValues();
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
      .then(async (detail) => {
        formRef.current?.setFieldsValue({
          code: detail.code,
          name: detail.name,
          warehouseId: detail.warehouseId,
          description: detail.description,
          isActive: detail.isActive ?? true,
        });
        const fieldFormValues = await loadFieldValues(detail.id);
        formRef.current?.setFieldsValue(fieldFormValues);
      })
      .catch((err: any) => {
        messageApi.error(err?.message || t('app.master-data.storageAreas.getDetailFailed'));
      });
  }, [open, editUuid]);

  const handleSubmit = async (values: any) => {
    try {
      setFormLoading(true);
      const { customData, standardValues } = extractFormValues(values);

      if (isEdit && editUuid) {
        await storageAreaApi.update(editUuid, standardValues as StorageAreaUpdate);
        messageApi.success(t('common.updateSuccess'));
        const updated = await storageAreaApi.get(editUuid);
        await saveCustomFieldValues(updated.id, customData);
        onSuccess(updated);
      } else {
        const ruleCodeToUse = effectiveRuleCode || getPageRuleCode(PAGE_CODE);
        if (
          ruleCodeToUse &&
          (isAutoGenerateEnabled(PAGE_CODE) || effectiveRuleCode) &&
          (standardValues.code === previewCode || !standardValues.code)
        ) {
          try {
            const codeResponse = await generateCode({ rule_code: ruleCodeToUse });
            standardValues.code = codeResponse.code;
          } catch {}
        }
        if (standardValues.isActive === undefined) {
          standardValues.isActive = true;
        }
        const created = await storageAreaApi.create(standardValues as StorageAreaCreate);
        await saveCustomFieldValues(created.id, customData);
        messageApi.success(t('common.createSuccess'));
        onSuccess(created);
      }
      onClose();
      formRef.current?.resetFields();
      setPreviewCode(null);
      setEffectiveRuleCode(null);
      resetFieldValues();
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
    setEffectiveRuleCode(null);
    resetFieldValues();
  };

  const handleWarehouseQuickCreateSuccess = (warehouse: Warehouse) => {
    setWarehouses((prev) => {
      if (prev.some((w) => w.id === warehouse.id)) return prev;
      return [...prev, warehouse];
    });
    formRef.current?.setFieldsValue({ warehouseId: warehouse.id });
    setWarehouseQuickCreateVisible(false);
    void reloadWarehouses();
  };

  const optionsMap = {
    warehouseId: warehouses.map((w) => ({
      label: `${w.code} - ${w.name}`,
      value: w.id,
    })),
  };

  return (
    <>
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
        zIndex={zIndex}
      >
        <SchemaFormRenderer
          schema={storageAreaFormSchema}
          slots={{ customFields: <CustomFieldsFormSection customFields={customFields} customFieldValues={customFieldValues} gridColumns={2} /> }}
          codeField="code"
          codeAutoGenerated={isAutoGenerateEnabled(PAGE_CODE)}
          codeAutoGeneratedKey="field.storageArea.codeAutoGenerated"
          isEdit={isEdit}
          allowEditCodeWhenEdit
          optionsMap={optionsMap}
          dropdownEnhanceMap={{
            warehouseId: {
              quickCreate: {
                label: t('field.storageArea.quickAddWarehouse'),
                onClick: () => setWarehouseQuickCreateVisible(true),
              },
            },
          }}
        />
      </FormModalTemplate>

      {warehouseQuickCreateVisible ? (
        <WarehouseFormModal
          open={warehouseQuickCreateVisible}
          editUuid={null}
          onClose={() => setWarehouseQuickCreateVisible(false)}
          onSuccess={handleWarehouseQuickCreateSuccess}
          zIndex={nestedModalZIndex}
        />
      ) : null}
    </>
  );
};
