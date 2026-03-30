/**
 * 供应商新建/编辑弹窗（可复用）
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ProFormInstance } from '@ant-design/pro-components';
import { App, Modal, Input } from 'antd';
import { FormModalTemplate } from '../../../components/layout-templates';
import { MODAL_CONFIG } from '../../../components/layout-templates/constants';
import { supplierApi, getUserOptions, getDictionaryOptions } from '../services/supply-chain';
import { testGenerateCode, generateCode, getCodeRulePageConfig } from '../../../services/codeRule';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../utils/codeRulePage';
import type { Supplier, SupplierCreate, SupplierUpdate } from '../types/supply-chain';
import { SchemaFormRenderer } from '../../../components/schema-form';
import { supplierFormSchema } from '../schemas/supplier';
import { getDataDictionaryByCode, createDictionaryItem } from '../../../services/dataDictionary';

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
  const { message: messageApi } = App.useApp();
  const formRef = useRef<ProFormInstance>();
  const [formLoading, setFormLoading] = useState(false);
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [effectiveRuleCode, setEffectiveRuleCode] = useState<string | null>(null);
  const [optionsMap, setOptionsMap] = useState<
    Record<string, Array<{ value: any; label: string }>>
  >({});
  const [quickCreateTarget, setQuickCreateTarget] = useState<{
    field: string;
    dictionaryCode: string;
    label: string;
  } | null>(null);
  const [quickCreateName, setQuickCreateName] = useState('');
  const [quickCreateValue, setQuickCreateValue] = useState('');
  const [quickCreateLoading, setQuickCreateLoading] = useState(false);

  const isEdit = Boolean(editUuid);

  const loadOptions = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        await loadOptions();
      } catch {
        setOptionsMap({});
      }
    })();
  }, [open, loadOptions]);

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

  const handleQuickCreateSubmit = async () => {
    if (!quickCreateTarget) return;
    if (!quickCreateName.trim() || !quickCreateValue.trim()) {
      messageApi.warning('请填写名称和值');
      return;
    }
    try {
      setQuickCreateLoading(true);
      const dict = await getDataDictionaryByCode(quickCreateTarget.dictionaryCode);
      await createDictionaryItem(dict.uuid, {
        label: quickCreateName.trim(),
        value: quickCreateValue.trim(),
        is_active: true,
      });
      await loadOptions();
      formRef.current?.setFieldsValue({ [quickCreateTarget.field]: quickCreateValue.trim() });
      messageApi.success(t('common.createSuccess'));
      setQuickCreateTarget(null);
      setQuickCreateName('');
      setQuickCreateValue('');
    } catch (error: any) {
      messageApi.error(error?.message || '新增字典项失败');
    } finally {
      setQuickCreateLoading(false);
    }
  };

  return (
    <>
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
            category: { quickCreate: { label: '快速新增', onClick: () => setQuickCreateTarget({ field: 'category', dictionaryCode: 'CUSTOMER_CATEGORY', label: t('field.supplier.category') }) } },
            contactTitle: { quickCreate: { label: '快速新增', onClick: () => setQuickCreateTarget({ field: 'contactTitle', dictionaryCode: 'CONTACT_TITLE', label: t('field.supplier.contactTitle') }) } },
            industryCode: { quickCreate: { label: '快速新增', onClick: () => setQuickCreateTarget({ field: 'industryCode', dictionaryCode: 'INDUSTRY_SECTOR', label: t('field.supplier.industry') }) } },
            supplierLevelCode: { quickCreate: { label: '快速新增', onClick: () => setQuickCreateTarget({ field: 'supplierLevelCode', dictionaryCode: 'SUPPLIER_LEVEL', label: t('field.supplier.level') }) } },
            sourceChannelCode: { quickCreate: { label: '快速新增', onClick: () => setQuickCreateTarget({ field: 'sourceChannelCode', dictionaryCode: 'PARTNER_SOURCE_CHANNEL', label: t('field.supplier.sourceChannel') }) } },
          }}
        />
      </FormModalTemplate>
      <Modal
        title={quickCreateTarget ? `快速新增${quickCreateTarget.label}` : '快速新增'}
        open={!!quickCreateTarget}
        onOk={handleQuickCreateSubmit}
        confirmLoading={quickCreateLoading}
        onCancel={() => {
          setQuickCreateTarget(null);
          setQuickCreateName('');
          setQuickCreateValue('');
        }}
      >
        <Input
          style={{ marginBottom: 12 }}
          placeholder="名称（显示文本）"
          value={quickCreateName}
          onChange={(e) => setQuickCreateName(e.target.value)}
        />
        <Input
          placeholder="值（唯一编码）"
          value={quickCreateValue}
          onChange={(e) => setQuickCreateValue(e.target.value)}
        />
      </Modal>
    </>
  );
};
