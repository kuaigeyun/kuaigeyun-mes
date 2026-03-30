/**
 * 供应商新建/编辑弹窗（可复用）
 */

import React, { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ProFormInstance } from '@ant-design/pro-components';
import { App } from 'antd';
import { FormModalTemplate } from '../../../components/layout-templates';
import { MODAL_CONFIG } from '../../../components/layout-templates/constants';
import { supplierApi, getUserOptions, getDictionaryOptions } from '../services/supply-chain';
import { testGenerateCode, generateCode, getCodeRulePageConfig } from '../../../services/codeRule';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../utils/codeRulePage';
import type { Supplier, SupplierCreate, SupplierUpdate } from '../types/supply-chain';
import { SchemaFormRenderer } from '../../../components/schema-form';
import { supplierFormSchema } from '../schemas/supplier';

const PAGE_CODE = 'master-data-supply-chain-supplier';

export interface SupplierFormModalProps {
  open: boolean;
  onClose: () => void;
  /** 编辑时传入供应商 uuid，为 null 时为新建 */
  editUuid: string | null;
  /** 保存成功回调 */
  onSuccess: (supplier: Supplier) => void;
}

export const SupplierFormModal: React.FC<SupplierFormModalProps> = ({
  open,
  onClose,
  editUuid,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message: messageApi } = App.useApp();
  const formRef = useRef<ProFormInstance>();
  const [formLoading, setFormLoading] = useState(false);
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [effectiveRuleCode, setEffectiveRuleCode] = useState<string | null>(null);
  const [optionsMap, setOptionsMap] = useState<
    Record<string, Array<{ value: any; label: string }>>
  >({});

  const isEdit = Boolean(editUuid);

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const [users, industry, level, src, category, contactTitle] = await Promise.all([
          getUserOptions(),
          getDictionaryOptions('INDUSTRY_SECTOR'),
          getDictionaryOptions('SUPPLIER_LEVEL'),
          getDictionaryOptions('PARTNER_SOURCE_CHANNEL'),
          getDictionaryOptions('CUSTOMER_CATEGORY'),
          getDictionaryOptions('CONTACT_TITLE'),
        ]);
        setOptionsMap({
          buyerId: users,
          industryCode: industry,
          supplierLevelCode: level,
          sourceChannelCode: src,
          category,
          contactTitle,
        });
      } catch {
        setOptionsMap({});
      }
    })();
  }, [open]);

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
    supplierApi
      .get(editUuid)
      .then((detail) => {
        formRef.current?.setFieldsValue({
          code: detail.code,
          name: detail.name,
          shortName: detail.shortName,
          contactPerson: detail.contactPerson,
          contactTitle: detail.contactTitle,
          phone: detail.phone,
          email: detail.email,
          address: detail.address,
          category: detail.category,
          buyerId: detail.buyerId,
          isActive: detail.isActive ?? true,
        });
      })
      .catch((err: any) => {
        messageApi.error(err?.message || t('app.master-data.suppliers.getDetailFailed'));
      });
  }, [open, editUuid]);

  const handleSubmit = async (values: any) => {
    try {
      setFormLoading(true);
      if (isEdit && editUuid) {
        await supplierApi.update(editUuid, values as SupplierUpdate);
        messageApi.success(t('common.updateSuccess'));
        const updated = await supplierApi.get(editUuid);
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
        const created = await supplierApi.create(values as SupplierCreate);
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

  return (
    <FormModalTemplate
      title={isEdit ? t('field.supplier.editTitle') : t('field.supplier.createTitle')}
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
        schema={supplierFormSchema}
        codeField="code"
        codeAutoGenerated={isAutoGenerateEnabled(PAGE_CODE)}
        codeAutoGeneratedKey="field.supplier.codeAutoGenerated"
        isEdit={isEdit}
        optionsMap={optionsMap}
        dropdownEnhanceMap={{
          category: { quickCreate: { label: '数据字典管理', onClick: () => navigate('/system/data-dictionaries') } },
          contactTitle: { quickCreate: { label: '数据字典管理', onClick: () => navigate('/system/data-dictionaries') } },
          industryCode: { quickCreate: { label: '数据字典管理', onClick: () => navigate('/system/data-dictionaries') } },
          supplierLevelCode: { quickCreate: { label: '数据字典管理', onClick: () => navigate('/system/data-dictionaries') } },
          sourceChannelCode: { quickCreate: { label: '数据字典管理', onClick: () => navigate('/system/data-dictionaries') } },
        }}
      />
    </FormModalTemplate>
  );
};
