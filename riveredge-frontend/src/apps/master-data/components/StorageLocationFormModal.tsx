/**
 * 库位新建/编辑弹窗
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ProFormInstance } from '@ant-design/pro-components';
import { App, theme } from 'antd';
import { FormModalTemplate } from '../../../components/layout-templates';
import { MODAL_CONFIG, MODAL_NESTED_ABOVE_PARENT_OFFSET } from '../../../components/layout-templates/constants';
import { storageLocationApi, storageAreaApi } from '../services/warehouse';
import { testGenerateCode, generateCode, getCodeRulePageConfig } from '../../../services/codeRule';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../utils/codeRulePage';
import type { StorageLocation, StorageLocationCreate, StorageLocationUpdate, StorageArea } from '../types/warehouse';
import { SchemaFormRenderer } from '../../../components/schema-form';
import { storageLocationFormSchema } from '../schemas/storage-location';
import { useCustomFields } from '../../../hooks/useCustomFields';
import { CustomFieldsFormSection } from '../../../components/custom-fields';
import { StorageAreaFormModal } from './StorageAreaFormModal';

const PAGE_CODE = 'master-data-warehouse-storage-location';
const CUSTOM_FIELD_TABLE = 'master_data_warehouse_storage_locations';

export interface StorageLocationFormModalProps {
  open: boolean;
  onClose: () => void;
  editUuid: string | null;
  onSuccess: (storageLocation: StorageLocation) => void;
  zIndex?: number;
}

export const StorageLocationFormModal: React.FC<StorageLocationFormModalProps> = ({
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
  const [storageAreas, setStorageAreas] = useState<StorageArea[]>([]);
  const [storageAreaQuickCreateVisible, setStorageAreaQuickCreateVisible] = useState(false);

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

  const reloadStorageAreas = useCallback(async () => {
    try {
      const result = await storageAreaApi.list({ limit: 1000, is_active: true });
      setStorageAreas(result.items);
    } catch (error) {
      console.error('加载库区列表失败:', error);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void reloadStorageAreas();
  }, [open, reloadStorageAreas]);

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
    storageLocationApi
      .get(editUuid)
      .then(async (detail) => {
        formRef.current?.setFieldsValue({
          code: detail.code,
          name: detail.name,
          storageAreaId: detail.storageAreaId,
          description: detail.description,
          isActive: detail.isActive ?? true,
        });
        const fieldFormValues = await loadFieldValues(detail.id);
        formRef.current?.setFieldsValue(fieldFormValues);
      })
      .catch((err: any) => {
        messageApi.error(err?.message || t('app.master-data.storageLocations.getDetailFailed'));
      });
  }, [open, editUuid]);

  const handleSubmit = async (values: any) => {
    try {
      setFormLoading(true);
      const { customData, standardValues } = extractFormValues(values);

      if (isEdit && editUuid) {
        await storageLocationApi.update(editUuid, standardValues as StorageLocationUpdate);
        messageApi.success(t('common.updateSuccess'));
        const updated = await storageLocationApi.get(editUuid);
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
        const created = await storageLocationApi.create(standardValues as StorageLocationCreate);
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

  const handleStorageAreaQuickCreateSuccess = (storageArea: StorageArea) => {
    setStorageAreas((prev) => {
      if (prev.some((s) => s.id === storageArea.id)) return prev;
      return [...prev, storageArea];
    });
    formRef.current?.setFieldsValue({ storageAreaId: storageArea.id });
    setStorageAreaQuickCreateVisible(false);
    void reloadStorageAreas();
  };

  const optionsMap = {
    storageAreaId: storageAreas.map((s) => ({
      label: `${s.code} - ${s.name}`,
      value: s.id,
    })),
  };

  return (
    <>
      <FormModalTemplate
        title={isEdit ? t('field.storageLocation.editTitle') : t('field.storageLocation.createTitle')}
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
          schema={storageLocationFormSchema}
          slots={{ customFields: <CustomFieldsFormSection customFields={customFields} customFieldValues={customFieldValues} gridColumns={2} /> }}
          codeField="code"
          codeAutoGenerated={isAutoGenerateEnabled(PAGE_CODE)}
          codeAutoGeneratedKey="field.storageLocation.codeAutoGenerated"
          isEdit={isEdit}
          allowEditCodeWhenEdit
          optionsMap={optionsMap}
          dropdownEnhanceMap={{
            storageAreaId: {
              quickCreate: {
                label: t('field.storageLocation.quickAddStorageArea'),
                onClick: () => setStorageAreaQuickCreateVisible(true),
              },
            },
          }}
        />
      </FormModalTemplate>

      {storageAreaQuickCreateVisible ? (
        <StorageAreaFormModal
          open={storageAreaQuickCreateVisible}
          editUuid={null}
          onClose={() => setStorageAreaQuickCreateVisible(false)}
          onSuccess={handleStorageAreaQuickCreateSuccess}
          zIndex={nestedModalZIndex}
        />
      ) : null}
    </>
  );
};
