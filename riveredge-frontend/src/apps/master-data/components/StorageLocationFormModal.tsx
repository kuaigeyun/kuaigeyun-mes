/**
 * 库位新建/编辑弹窗
 */

import React, { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ProFormInstance } from '@ant-design/pro-components';
import { App } from 'antd';
import { FormModalTemplate } from '../../../components/layout-templates';
import { MODAL_CONFIG } from '../../../components/layout-templates/constants';
import { storageLocationApi, storageAreaApi } from '../services/warehouse';
import { testGenerateCode, generateCode } from '../../../services/codeRule';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../utils/codeRulePage';
import type { StorageLocation, StorageLocationCreate, StorageLocationUpdate, StorageArea } from '../types/warehouse';
import { SchemaFormRenderer } from '../../../components/schema-form';
import { storageLocationFormSchema } from '../schemas/storage-location';

const PAGE_CODE = 'master-data-warehouse-storage-location';

export interface StorageLocationFormModalProps {
  open: boolean;
  onClose: () => void;
  editUuid: string | null;
  onSuccess: (storageLocation: StorageLocation) => void;
}

export const StorageLocationFormModal: React.FC<StorageLocationFormModalProps> = ({
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
  const [storageAreas, setStorageAreas] = useState<StorageArea[]>([]);

  const isEdit = Boolean(editUuid);

  useEffect(() => {
    const loadStorageAreas = async () => {
      try {
        const result = await storageAreaApi.list({ limit: 1000, isActive: true });
        setStorageAreas(result);
      } catch (error) {
        console.error('加载库区列表失败:', error);
      }
    };
    loadStorageAreas();
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
    storageLocationApi
      .get(editUuid)
      .then((detail) => {
        formRef.current?.setFieldsValue({
          code: detail.code,
          name: detail.name,
          storageAreaId: detail.storageAreaId,
          description: detail.description,
          isActive: detail.isActive ?? true,
        });
      })
      .catch((err: any) => {
        messageApi.error(err?.message || '获取库位详情失败');
      });
  }, [open, editUuid]);

  const handleSubmit = async (values: any) => {
    try {
      setFormLoading(true);
      if (isEdit && editUuid) {
        await storageLocationApi.update(editUuid, values as StorageLocationUpdate);
        messageApi.success('更新成功');
        const updated = await storageLocationApi.get(editUuid);
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
        const created = await storageLocationApi.create(values as StorageLocationCreate);
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
    storageAreaId: storageAreas.map((s) => ({
      label: `${s.code} - ${s.name}`,
      value: s.id,
    })),
  };

  return (
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
    >
      <SchemaFormRenderer
        schema={storageLocationFormSchema}
        codeField="code"
        codeAutoGenerated={isAutoGenerateEnabled(PAGE_CODE)}
        codeAutoGeneratedKey="field.storageLocation.codeAutoGenerated"
        isEdit={isEdit}
        optionsMap={optionsMap}
      />
    </FormModalTemplate>
  );
};
