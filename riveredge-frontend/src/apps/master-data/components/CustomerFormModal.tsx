/**
 * 客户新建/编辑弹窗（可复用）
 *
 * 供客户管理页、报价单/销售订单等页面的「快速新建客户」使用。
 */

import React, { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ProFormInstance } from '@ant-design/pro-components';
import { App } from 'antd';
import { FormModalTemplate } from '../../../components/layout-templates';
import { MODAL_CONFIG } from '../../../components/layout-templates/constants';
import { customerApi, getUserOptions, getDictionaryOptions } from '../services/supply-chain';
import { testGenerateCode, generateCode, getCodeRulePageConfig } from '../../../services/codeRule';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../utils/codeRulePage';
import type { Customer, CustomerCreate, CustomerUpdate } from '../types/supply-chain';
import { SchemaFormRenderer } from '../../../components/schema-form';
import { customerFormSchema } from '../schemas/customer';

const PAGE_CODE = 'master-data-supply-chain-customer';

export interface CustomerFormModalProps {
  open: boolean;
  onClose: () => void;
  /** 编辑时传入客户 uuid，为 null 时为新建 */
  editUuid: string | null;
  /** 保存成功回调（新建或编辑后返回当前客户数据） */
  onSuccess: (customer: Customer) => void;
}

export const CustomerFormModal: React.FC<CustomerFormModalProps> = ({
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

  const isEdit = Boolean(editUuid);

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const [users, industry, level, lead] = await Promise.all([
          getUserOptions(),
          getDictionaryOptions('INDUSTRY_SECTOR'),
          getDictionaryOptions('CUSTOMER_LEVEL'),
          getDictionaryOptions('PARTNER_SOURCE_CHANNEL'),
        ]);
        setOptionsMap({
          salesmanId: users,
          industryCode: industry,
          customerLevelCode: level,
          leadSourceCode: lead,
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
    customerApi
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
          industryCode: detail.industryCode,
          customerLevelCode: detail.customerLevelCode,
          leadSourceCode: detail.leadSourceCode,
          estimatedAnnualPurchase:
            detail.estimatedAnnualPurchase != null && detail.estimatedAnnualPurchase !== ''
              ? Number(detail.estimatedAnnualPurchase)
              : undefined,
          creditLimit:
            detail.creditLimit != null && detail.creditLimit !== ''
              ? Number(detail.creditLimit)
              : undefined,
          salesmanId: detail.salesmanId,
          isActive: detail.isActive ?? true,
        });
      })
      .catch((err: any) => {
        messageApi.error(err?.message || t('app.master-data.customers.getDetailFailed'));
      });
  }, [open, editUuid]);

  const handleSubmit = async (values: any) => {
    try {
      setFormLoading(true);
      if (isEdit && editUuid) {
        await customerApi.update(editUuid, values as CustomerUpdate);
        messageApi.success(t('common.updateSuccess'));
        const updated = await customerApi.get(editUuid);
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
        const created = await customerApi.create(values as CustomerCreate);
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
      title={isEdit ? t('field.customer.editTitle') : t('field.customer.createTitle')}
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
        schema={customerFormSchema}
        codeField="code"
        codeAutoGenerated={isAutoGenerateEnabled(PAGE_CODE)}
        isEdit={isEdit}
        optionsMap={optionsMap}
      />
    </FormModalTemplate>
  );
};
