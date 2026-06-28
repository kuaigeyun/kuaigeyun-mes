/**
 * 供应商新建/编辑弹窗（可复用）
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ProFormInstance } from '@ant-design/pro-components';
import { App, Input, Tabs, Row, Col, Button, Space } from 'antd';
import { FormModalTemplate } from '../../../components/layout-templates';
import { MODAL_CONFIG, FORM_LAYOUT } from '../../../components/layout-templates/constants';
import { supplierApi, getUserOptions, getDictionaryOptions } from '../services/supply-chain';
import { testGenerateCode, generateCode, getCodeRulePageConfig } from '../../../services/codeRule';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../utils/codeRulePage';
import type { Supplier, SupplierCreate, SupplierUpdate } from '../types/supply-chain';
import { SchemaFormRenderer } from '../../../components/schema-form';
import {
  supplierFormSchemaBasicHead,
  supplierFormSchemaBasicTail,
  supplierFormSchemaInvoice,
  supplierFormSchemaExtended,
} from '../schemas/supplier';
import { getDataDictionaryByCode, createDictionaryItem } from '../../../services/dataDictionary';
import { QuickCreateAnchorPopover } from '../../../components/uni-dropdown';
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
  const [optionsMap, setOptionsMap] = useState<
    Record<string, Array<{ value: any; label: string }>>
  >({});
  const [quickCreateTarget, setQuickCreateTarget] = useState<{
    field: string;
    dictionaryCode: string;
    label: string;
  } | null>(null);
  const [quickCreateName, setQuickCreateName] = useState('');
  const [quickCreateAnchorEl, setQuickCreateAnchorEl] = useState<HTMLElement | null>(null);
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
      getUserOptions(),
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
        const ruleCodeToUse = effectiveRuleCode || getPageRuleCode(PAGE_CODE);
        if (
          ruleCodeToUse &&
          (isAutoGenerateEnabled(PAGE_CODE) || effectiveRuleCode) &&
          (standardValues.code === previewCode || !standardValues.code)
        ) {
          try {
            const codeResponse = await generateCode({ rule_code: ruleCodeToUse });
            payload.code = codeResponse.code;
          } catch {
            // keep form code
          }
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
    try {
      setQuickCreateLoading(true);
      const dict = await getDataDictionaryByCode(quickCreateTarget.dictionaryCode);
      await createDictionaryItem(dict.uuid, {
        label,
        value: label,
        is_active: true,
      });
      await loadOptions();
      if (quickCreateTarget.field !== 'contactTitle') {
        formRef.current?.setFieldsValue({ [quickCreateTarget.field]: label });
      }
      messageApi.success(t('common.createSuccess'));
      setQuickCreateTarget(null);
      setQuickCreateAnchorEl(null);
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
      >
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
                      codeAutoGenerated={isAutoGenerateEnabled(PAGE_CODE)}
                      codeAutoGeneratedKey="field.supplier.codeAutoGenerated"
                      isEdit={isEdit}
                      optionsMap={optionsMap}
                      dropdownEnhanceMap={{
                        category: {
                          quickCreate: {
                            label: '快速新增',
                            onClick: (anchor) => {
                              setQuickCreateAnchorEl(anchor ?? null);
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
                        onQuickCreateContactTitle={(anchor) => {
                          setQuickCreateAnchorEl(anchor ?? null);
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
                            onClick: (anchor) => {
                              setQuickCreateAnchorEl(anchor ?? null);
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
                            onClick: (anchor) => {
                              setQuickCreateAnchorEl(anchor ?? null);
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
      <QuickCreateAnchorPopover
        open={!!quickCreateTarget}
        anchorEl={quickCreateAnchorEl}
        title={quickCreateTarget ? `快速新增${quickCreateTarget.label}` : '快速新增'}
        onClose={() => {
          setQuickCreateTarget(null);
          setQuickCreateAnchorEl(null);
          setQuickCreateName('');
        }}
      >
        <>
          <Input
            placeholder="请输入新选项"
            value={quickCreateName}
            onChange={(e) => setQuickCreateName(e.target.value)}
            maxLength={100}
            autoFocus
          />
          <Space style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
            <Button
              onClick={() => {
                setQuickCreateTarget(null);
                setQuickCreateAnchorEl(null);
                setQuickCreateName('');
              }}
            >
              取消
            </Button>
            <Button type="primary" loading={quickCreateLoading} onClick={() => void handleQuickCreateSubmit()}>
              确定
            </Button>
          </Space>
        </>
      </QuickCreateAnchorPopover>
    </>
  );
};
