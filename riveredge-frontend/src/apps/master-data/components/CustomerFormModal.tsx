/**
 * 客户新建/编辑弹窗（可复用）
 *
 * 供客户管理页、报价单/销售订单等页面的「快速新建客户」使用。
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ProFormInstance } from '@ant-design/pro-components';
import { App, Modal, Input, Tabs, Row, Col } from 'antd';
import { FormModalTemplate } from '../../../components/layout-templates';
import {
  MODAL_CONFIG,
  MODAL_NESTED_ABOVE_PARENT_OFFSET,
  FORM_LAYOUT,
} from '../../../components/layout-templates/constants';
import { customerApi, getUserOptions, getDictionaryOptions } from '../services/supply-chain';
import { testGenerateCode, generateCode, getCodeRulePageConfig } from '../../../services/codeRule';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../utils/codeRulePage';
import { useGlobalStore } from '../../../stores/globalStore';
import type { Customer, CustomerCreate, CustomerUpdate } from '../types/supply-chain';
import { SchemaFormRenderer } from '../../../components/schema-form';
import {
  customerFormSchemaBasic,
  customerFormSchemaInvoice,
  customerFormSchemaExtended,
} from '../schemas/customer';
import { getDataDictionaryByCode, createDictionaryItem } from '../../../services/dataDictionary';
import { customerDetailToFormValues } from '../utils/partner-form-map';

const PAGE_CODE = 'master-data-supply-chain-customer';

export interface CustomerFormModalProps {
  open: boolean;
  onClose: () => void;
  /** 编辑时传入客户 uuid，为 null 时为新建 */
  editUuid: string | null;
  /** 保存成功回调（新建或编辑后返回当前客户数据） */
  onSuccess: (customer: Customer) => void;
  /** 与详情抽屉、追溯浮层或已抬升的表单 Modal 同屏时使用 */
  zIndex?: number;
}

export const CustomerFormModal: React.FC<CustomerFormModalProps> = ({
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
  const [quickCreateValue, setQuickCreateValue] = useState('');
  const [quickCreateName, setQuickCreateName] = useState('');
  const [quickCreateLoading, setQuickCreateLoading] = useState(false);

  const isEdit = Boolean(editUuid);

  const loadOptions = useCallback(async () => {
    const [users, industry, level, lead, category, contactTitle] = await Promise.all([
      getUserOptions(),
      getDictionaryOptions('INDUSTRY_SECTOR'),
      getDictionaryOptions('CUSTOMER_LEVEL'),
      getDictionaryOptions('PARTNER_SOURCE_CHANNEL'),
      getDictionaryOptions('CUSTOMER_CATEGORY'),
      getDictionaryOptions('CONTACT_TITLE'),
    ]);
    setOptionsMap({
      salesmanId: users,
      industryCode: industry,
      customerLevelCode: level,
      leadSourceCode: lead,
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
    const currentUser = useGlobalStore.getState().currentUser;
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      isActive: true,
      isPublic: false,
      salesmanId: currentUser?.id,
    });
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
              formRef.current?.setFieldsValue({
                code: res.code,
                isActive: true,
                isPublic: false,
                salesmanId: currentUser?.id,
              });
            })
            .catch(() => {
              setPreviewCode(null);
              formRef.current?.setFieldsValue({
                isActive: true,
                isPublic: false,
                salesmanId: currentUser?.id,
              });
            });
        } else {
          setPreviewCode(null);
          setEffectiveRuleCode(null);
          formRef.current?.setFieldsValue({
            isActive: true,
            isPublic: false,
            salesmanId: currentUser?.id,
          });
        }
      })();
      return;
    }
    setPreviewCode(null);
    setEffectiveRuleCode(null);
    customerApi
      .get(editUuid)
      .then((detail) => {
        formRef.current?.setFieldsValue(customerDetailToFormValues(detail));
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
        if (values.isPublic === undefined) {
          values.isPublic = false;
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
        title={isEdit ? t('field.customer.editTitle') : t('field.customer.createTitle')}
        open={open}
        onClose={handleClose}
        onFinish={handleSubmit}
        isEdit={isEdit}
        loading={formLoading}
        width={MODAL_CONFIG.LARGE_WIDTH}
        formRef={formRef as React.RefObject<ProFormInstance>}
        initialValues={{ isActive: true, isPublic: false }}
        layout="vertical"
        grid
        zIndex={zIndex}
      >
        {/*
         * ProForm grid 只给「直接子级」包一层 Row；若唯一子节点是 Tabs，表单项的 Col 在 Tab 内，
         * 不在这层 Row 下会导致整表挤成窄列。用 Col span=24 占满外排行，Tab 内再用 Row 承接各字段的 Col。
         */}
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
                      schema={customerFormSchemaBasic}
                      codeField="code"
                      codeAutoGenerated={isAutoGenerateEnabled(PAGE_CODE)}
                      isEdit={isEdit}
                      optionsMap={optionsMap}
                      dropdownEnhanceMap={{
                        category: {
                          quickCreate: {
                            label: '快速新增',
                            onClick: () =>
                              setQuickCreateTarget({
                                field: 'category',
                                dictionaryCode: 'CUSTOMER_CATEGORY',
                                label: t('field.customer.category'),
                              }),
                          },
                        },
                        contactTitle: {
                          quickCreate: {
                            label: '快速新增',
                            onClick: () =>
                              setQuickCreateTarget({
                                field: 'contactTitle',
                                dictionaryCode: 'CONTACT_TITLE',
                                label: t('field.customer.contactTitle'),
                              }),
                          },
                        },
                      }}
                    />
                  </Row>
                ),
              },
              {
                key: 'invoice',
                label: t('field.partner.tabInvoice'),
                children: (
                  <Row gutter={FORM_LAYOUT.GRID_GUTTER} wrap>
                    <SchemaFormRenderer schema={customerFormSchemaInvoice} optionsMap={optionsMap} isEdit={isEdit} />
                  </Row>
                ),
              },
              {
                key: 'extended',
                label: t('field.partner.tabExtended'),
                children: (
                  <Row gutter={FORM_LAYOUT.GRID_GUTTER} wrap>
                    <SchemaFormRenderer
                      schema={customerFormSchemaExtended}
                      optionsMap={optionsMap}
                      isEdit={isEdit}
                      dropdownEnhanceMap={{
                        industryCode: {
                          quickCreate: {
                            label: '快速新增',
                            onClick: () =>
                              setQuickCreateTarget({
                                field: 'industryCode',
                                dictionaryCode: 'INDUSTRY_SECTOR',
                                label: t('field.customer.industry'),
                              }),
                          },
                        },
                        customerLevelCode: {
                          quickCreate: {
                            label: '快速新增',
                            onClick: () =>
                              setQuickCreateTarget({
                                field: 'customerLevelCode',
                                dictionaryCode: 'CUSTOMER_LEVEL',
                                label: t('field.customer.level'),
                              }),
                          },
                        },
                        leadSourceCode: {
                          quickCreate: {
                            label: '快速新增',
                            onClick: () =>
                              setQuickCreateTarget({
                                field: 'leadSourceCode',
                                dictionaryCode: 'PARTNER_SOURCE_CHANNEL',
                                label: t('field.customer.leadSource'),
                              }),
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
      <Modal
        title={quickCreateTarget ? `快速新增${quickCreateTarget.label}` : '快速新增'}
        open={!!quickCreateTarget}
        onOk={handleQuickCreateSubmit}
        confirmLoading={quickCreateLoading}
        zIndex={zIndex != null ? zIndex + MODAL_NESTED_ABOVE_PARENT_OFFSET : undefined}
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
