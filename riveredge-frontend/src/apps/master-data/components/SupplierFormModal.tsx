/**
 * 供应商新建/编辑弹窗（可复用）
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ProFormInstance } from '@ant-design/pro-components';
import { App, Input, Tabs, Row, Col } from 'antd';
import { FormModalTemplate } from '../../../components/layout-templates';
import { MODAL_CONFIG, FORM_LAYOUT, MODAL_NESTED_ABOVE_PARENT_OFFSET } from '../../../components/layout-templates/constants';
import { supplierApi, getUserOptions, getDictionaryOptions } from '../services/supply-chain';
import { testGenerateCode, generateCode, fetchEffectivePageCodeRule } from '../../../services/codeRule';
import type { Supplier, SupplierCreate, SupplierUpdate } from '../types/supply-chain';
import { SchemaFormRenderer } from '../../../components/schema-form';
import {
  CompanyNameAsciiParenHint,
  SUPPLIER_FORM_SMART_ANCHOR,
} from './CompanyNameAsciiParenHint';
import {
  supplierFormSchemaBasicHead,
  supplierFormSchemaBasicTail,
  supplierFormSchemaInvoice,
  supplierFormSchemaExtended,
} from '../schemas/supplier';
import { getDataDictionaryByCode, createDictionaryItem } from '../../../services/dataDictionary';
import {
  dedupeDictionaryOptionsByValue,
  dictionaryQuickCreateValueFromLabel,
  findExistingDictionaryOption,
} from '../../../utils/dictionaryQuickCreate';
import { QuickCreateModal } from '../../../components/uni-dropdown';
import { normalizePartnerContactsForSubmit, supplierDetailToFormValues } from '../utils/partner-form-map';
import { SupplierContactsFormTable } from './SupplierContactsFormTable';
import { useCustomFields } from '../../../hooks/useCustomFields';
import { CustomFieldsFormSection } from '../../../components/custom-fields';

const PAGE_CODE = 'master-data-supply-chain-supplier';
const CUSTOM_FIELD_TABLE = 'master_data_suppliers';

export interface SupplierFormModalProps {
  open: boolean;
  onClose: () => void;
  /** 编辑时传入供应商 uuid，为 null 时为新建 */
  editUuid: string | null;
  /** 保存成功回调 */
  onSuccess: (supplier: Supplier) => void;
  zIndex?: number;
}

export const SupplierFormModal: React.FC<SupplierFormModalProps> = ({
  open,
  onClose,
  editUuid,
  onSuccess,
  zIndex,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const formRef = useRef<ProFormInstance>();
  const [formLoading, setFormLoading] = useState(false);
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [effectiveRuleCode, setEffectiveRuleCode] = useState<string | null>(null);
  const [effectiveAutoGenerate, setEffectiveAutoGenerate] = useState(false);
  const [optionsMap, setOptionsMap] = useState<
    Record<string, Array<{ value: any; label: string }>>
  >({});
  const [quickCreateTarget, setQuickCreateTarget] = useState<{
    field: string;
    dictionaryCode: string;
    label: string;
  } | null>(null);
  const [quickCreateName, setQuickCreateName] = useState('');
  const [quickCreateLoading, setQuickCreateLoading] = useState(false);

  const {
    customFields,
    customFieldValues,
    loadFieldValues,
    extractFormValues,
    saveCustomFieldValues,
    resetFieldValues,
  } = useCustomFields({ tableName: CUSTOM_FIELD_TABLE, loadWhenOpen: true, open });

  const isEdit = Boolean(editUuid);

  const loadOptions = useCallback(async () => {
    const [users, industry, src, category, contactTitle] = await Promise.all([
      getUserOptions('master-data:supply-chain:supplier'),
      getDictionaryOptions('INDUSTRY_SECTOR'),
      getDictionaryOptions('PARTNER_SOURCE_CHANNEL'),
      getDictionaryOptions('CUSTOMER_CATEGORY'),
      getDictionaryOptions('CONTACT_TITLE'),
    ]);
    setOptionsMap({
      buyerId: users,
      industryCode: industry,
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
    resetFieldValues();
    if (!editUuid) {
      let cancelled = false;
      (async () => {
        try {
          const { ruleCode, autoGenerate } = await fetchEffectivePageCodeRule(PAGE_CODE);
          if (cancelled) return;
          setEffectiveRuleCode(ruleCode);
          setEffectiveAutoGenerate(autoGenerate);
          if (!autoGenerate) {
            setPreviewCode(null);
            return;
          }
          const res = await testGenerateCode({ rule_code: ruleCode });
          if (cancelled) return;
          const code = (res?.code ?? '').trim();
          if (!code) {
            messageApi.error(t('app.master-data.codeRulePreviewHint'));
            setPreviewCode(null);
            return;
          }
          setPreviewCode(code);
          formRef.current?.setFieldsValue({ code, isActive: true });
        } catch (err: any) {
          if (cancelled) return;
          setPreviewCode(null);
          setEffectiveRuleCode(null);
          setEffectiveAutoGenerate(false);
          messageApi.error(err?.message || t('app.master-data.codeRuleAutoFailed'));
        }
      })();
      return () => {
        cancelled = true;
      };
    }
    setPreviewCode(null);
    setEffectiveRuleCode(null);
    supplierApi
      .get(editUuid)
      .then(async (detail) => {
        formRef.current?.setFieldsValue(supplierDetailToFormValues(detail));
        const fieldFormValues = await loadFieldValues(detail.id);
        formRef.current?.setFieldsValue(fieldFormValues);
      })
      .catch((err: any) => {
        messageApi.error(err?.message || t('app.master-data.suppliers.getDetailFailed'));
      });
  }, [open, editUuid]);

  const handleSubmit = async (values: any) => {
    try {
      setFormLoading(true);
      const { customData, standardValues } = extractFormValues(values);
      const payload = {
        ...standardValues,
        contacts: normalizePartnerContactsForSubmit(standardValues.contacts ?? values.contacts),
      };
      if (isEdit && editUuid) {
        await supplierApi.update(editUuid, payload as SupplierUpdate);
        messageApi.success(t('common.updateSuccess'));
        const updated = await supplierApi.get(editUuid);
        await saveCustomFieldValues(updated.id, customData);
        onSuccess(updated);
      } else {
        const ruleCodeToUse = effectiveRuleCode;
        if (
          ruleCodeToUse &&
          effectiveAutoGenerate &&
          (standardValues.code === previewCode || !standardValues.code)
        ) {
          const codeResponse = await generateCode({ rule_code: ruleCodeToUse });
          payload.code = codeResponse.code;
        }
        if (payload.isActive === undefined) {
          payload.isActive = true;
        }
        const created = await supplierApi.create(payload as SupplierCreate);
        await saveCustomFieldValues(created.id, customData);
        messageApi.success(t('common.createSuccess'));
        onSuccess(created);
      }
      onClose();
      formRef.current?.resetFields();
      setPreviewCode(null);
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
    resetFieldValues();
  };

  const handleQuickCreateSubmit = async () => {
    if (!quickCreateTarget) return;
    const label = quickCreateName.trim();
    if (!label) {
      messageApi.warning('请填写新选项');
      return;
    }
    const value = dictionaryQuickCreateValueFromLabel(label);
    try {
      setQuickCreateLoading(true);
      const existingOptions = dedupeDictionaryOptionsByValue(
        await getDictionaryOptions(quickCreateTarget.dictionaryCode),
      );
      if (findExistingDictionaryOption(existingOptions, { label, value })) {
        messageApi.warning(t('components.dictionarySelect.valueExists'));
        return;
      }
      const dict = await getDataDictionaryByCode(quickCreateTarget.dictionaryCode);
      await createDictionaryItem(dict.uuid, {
        label,
        value,
        is_active: true,
      });
      await loadOptions();
      if (quickCreateTarget.field !== 'contactTitle') {
        formRef.current?.setFieldsValue({ [quickCreateTarget.field]: value });
      }
      messageApi.success(t('common.createSuccess'));
      setQuickCreateTarget(null);
      setQuickCreateName('');
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
        width={MODAL_CONFIG.LARGE_WIDTH}
        formRef={formRef as React.RefObject<ProFormInstance>}
        initialValues={{ isActive: true }}
        layout="vertical"
        grid
        zIndex={zIndex}
        modalRender={(modal) => (
          <div data-smart-suggestion-anchor="supplier-form">{modal}</div>
        )}
      >
        <CompanyNameAsciiParenHint open={open} anchorSelector={SUPPLIER_FORM_SMART_ANCHOR} />
        <Col span={24}>
          <Tabs
            destroyInactiveTabPane={false}
            style={{ width: '100%' }}
            items={[
              {
                key: 'basic',
                label: t('field.partner.tabBasic'),
                children: (
                  <Row gutter={FORM_LAYOUT.GRID_GUTTER} wrap>
                    <SchemaFormRenderer
                      schema={supplierFormSchemaBasicHead}
                      codeField="code"
                      codeAutoGenerated={effectiveAutoGenerate}
                      codeAutoGeneratedKey="field.supplier.codeAutoGenerated"
                      isEdit={isEdit}
                      optionsMap={optionsMap}
                      dropdownEnhanceMap={{
                        category: {
                          quickCreate: {
                            label: '快速新增',
                            onClick: () => {
                              setQuickCreateTarget({
                                field: 'category',
                                dictionaryCode: 'CUSTOMER_CATEGORY',
                                label: t('field.supplier.category'),
                              });
                            },
                          },
                        },
                      }}
                    />
                    <CustomFieldsFormSection
                      customFields={customFields}
                      customFieldValues={customFieldValues}
                      gridColumns={2}
                    />
                    <Col span={24}>
                      <SupplierContactsFormTable
                        contactTitleOptions={optionsMap.contactTitle ?? []}
                        onQuickCreateContactTitle={() => {
                          setQuickCreateTarget({
                            field: 'contactTitle',
                            dictionaryCode: 'CONTACT_TITLE',
                            label: t('field.supplier.contactTitle'),
                          });
                        }}
                      />
                    </Col>
                    <SchemaFormRenderer
                      schema={supplierFormSchemaBasicTail}
                      isEdit={isEdit}
                      optionsMap={optionsMap}
                    />
                  </Row>
                ),
              },
              {
                key: 'invoice',
                label: t('field.partner.tabInvoice'),
                children: (
                  <Row gutter={FORM_LAYOUT.GRID_GUTTER} wrap>
                    <SchemaFormRenderer schema={supplierFormSchemaInvoice} optionsMap={optionsMap} isEdit={isEdit} />
                  </Row>
                ),
              },
              {
                key: 'extended',
                label: t('field.partner.tabExtended'),
                children: (
                  <Row gutter={FORM_LAYOUT.GRID_GUTTER} wrap>
                    <SchemaFormRenderer
                      schema={supplierFormSchemaExtended}
                      optionsMap={optionsMap}
                      isEdit={isEdit}
                      dropdownEnhanceMap={{
                        industryCode: {
                          quickCreate: {
                            label: '快速新增',
                            onClick: () => {
                              setQuickCreateTarget({
                                field: 'industryCode',
                                dictionaryCode: 'INDUSTRY_SECTOR',
                                label: t('field.supplier.industry'),
                              });
                            },
                          },
                        },
                        sourceChannelCode: {
                          quickCreate: {
                            label: '快速新增',
                            onClick: () => {
                              setQuickCreateTarget({
                                field: 'sourceChannelCode',
                                dictionaryCode: 'PARTNER_SOURCE_CHANNEL',
                                label: t('field.supplier.sourceChannel'),
                              });
                            },
                          },
                        },
                      }}
                    />
                  </Row>
                ),
              },
            ]}
          />
        </Col>
      </FormModalTemplate>
      <QuickCreateModal
        open={!!quickCreateTarget}
        title={quickCreateTarget ? `快速新增${quickCreateTarget.label}` : '快速新增'}
        zIndex={zIndex != null ? zIndex + MODAL_NESTED_ABOVE_PARENT_OFFSET : undefined}
        confirmLoading={quickCreateLoading}
        onClose={() => {
          setQuickCreateTarget(null);
          setQuickCreateName('');
        }}
        onConfirm={handleQuickCreateSubmit}
      >
        <Input
          placeholder="请输入新选项"
          value={quickCreateName}
          onChange={(e) => setQuickCreateName(e.target.value)}
          maxLength={100}
          autoFocus
        />
      </QuickCreateModal>
    </>
  );
};
