/**
 * 客户新建/编辑弹窗（可复用）
 *
 * 供客户管理页、报价单/销售订单等页面的「快速新建客户」使用。
 */

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ProFormInstance } from '@ant-design/pro-components';
import { App, Input, Tabs, Row, Col } from 'antd';
import { FormModalTemplate } from '../../../components/layout-templates';
import {
  MODAL_CONFIG,
  MODAL_NESTED_ABOVE_PARENT_OFFSET,
  FORM_LAYOUT,
} from '../../../components/layout-templates/constants';
import { customerApi, getUserOptions, getDictionaryOptions } from '../services/supply-chain';
import { getDataDictionaryByCode, createDictionaryItem } from '../../../services/dataDictionary';
import { testGenerateCode, generateCode, fetchEffectivePageCodeRule } from '../../../services/codeRule';
import { useGlobalStore } from '../../../stores/globalStore';
import { ReferenceDisplayAccessError } from '../../../services/displayContract';
import { getSessionCurrentUser } from '../../../utils/sessionCurrentUser';
import type { Customer, CustomerCreate, CustomerUpdate } from '../types/supply-chain';
import { SchemaFormRenderer } from '../../../components/schema-form';
import {
  CompanyNameAsciiParenHint,
  CUSTOMER_FORM_SMART_ANCHOR,
} from './CompanyNameAsciiParenHint';
import {
  customerFormSchemaBasicHead,
  customerFormSchemaBasicTail,
  customerFormSchemaBasicTailEdit,
  customerFormSchemaInvoice,
  customerFormSchemaExtended,
} from '../schemas/customer';
import {
  dedupeDictionaryOptionsByValue,
  dictionaryQuickCreateValueFromLabel,
  findExistingDictionaryOption,
} from '../../../utils/dictionaryQuickCreate';
import { QuickCreateModal } from '../../../components/uni-dropdown';
import {
  customerDetailToFormValues,
  normalizeCustomerContactsForSubmit,
} from '../utils/partner-form-map';
import { CustomerContactsFormTable } from './CustomerContactsFormTable';
import { useCustomFields } from '../../../hooks/useCustomFields';
import { CustomFieldsFormSection } from '../../../components/custom-fields';

const PAGE_CODE = 'master-data-supply-chain-customer';
const CUSTOM_FIELD_TABLE = 'master_data_customers';
/** 主数据客户页默认宿主；客户池等业务页应显式传入自身 resource */
export const CUSTOMER_FORM_DEFAULT_HOST_RESOURCE = 'master-data:supply-chain:customer';

export interface CustomerFormModalProps {
  open: boolean;
  onClose: () => void;
  /** 编辑时传入客户 uuid，为 null 时为新建 */
  editUuid: string | null;
  /** 保存成功回调（新建或编辑后返回当前客户数据） */
  onSuccess: (customer: Customer) => void;
  /** 与详情抽屉、追溯浮层或已抬升的表单 Modal 同屏时使用 */
  zIndex?: number;
  /** 选人 display 宿主 {app}:{module} */
  hostResource?: string;
  /**
   * 客户池协作人：传入后在「归属业务员」后展示多选，并在保存后同步协作人。
   * 主数据客户页可不传。
   */
  collaboratorSupport?: {
    load: (customerId: number) => Promise<number[]>;
    save: (customerId: number, userIds: number[]) => Promise<void>;
    maxCount?: number;
  };
}

const MAX_COLLABORATORS_DEFAULT = 10;

export const CustomerFormModal: React.FC<CustomerFormModalProps> = ({
  open,
  onClose,
  editUuid,
  onSuccess,
  zIndex,
  hostResource = CUSTOMER_FORM_DEFAULT_HOST_RESOURCE,
  collaboratorSupport,
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
  const [isPublicMode, setIsPublicMode] = useState(true);

  const {
    customFields,
    customFieldValues,
    loadFieldValues,
    extractFormValues,
    saveCustomFieldValues,
    resetFieldValues,
  } = useCustomFields({ tableName: CUSTOM_FIELD_TABLE, loadWhenOpen: true, open });

  const isEdit = Boolean(editUuid);
  const collaboratorSupportRef = useRef(collaboratorSupport);
  collaboratorSupportRef.current = collaboratorSupport;
  const resolvedHostResource = (hostResource || CUSTOMER_FORM_DEFAULT_HOST_RESOURCE).trim();

  const syncSalesmanWithVisibility = useCallback((isPublic: boolean | undefined) => {
    setIsPublicMode(isPublic !== false);
    const currentUser = getSessionCurrentUser() ?? useGlobalStore.getState().currentUser;
    if (isPublic === true) {
      formRef.current?.setFieldsValue({ salesmanId: undefined, collaboratorIds: [] });
      return;
    }
    if (isPublic === false && currentUser?.id) {
      const salesmanId = formRef.current?.getFieldValue('salesmanId');
      if (!salesmanId) {
        formRef.current?.setFieldsValue({ salesmanId: currentUser.id });
      }
    }
  }, []);

  const loadOptions = useCallback(async () => {
    let users: Array<{ value: any; label: string }> = [];
    try {
      users = await getUserOptions(resolvedHostResource);
    } catch (err) {
      const msg =
        err instanceof ReferenceDisplayAccessError
          ? err.message
          : err instanceof Error
            ? err.message
            : t('app.master-data.customers.loadUsersFailed', { defaultValue: '加载业务员列表失败' });
      messageApi.error(msg);
    }
    const [industry, level, lead, category, contactTitle] = await Promise.all([
      getDictionaryOptions('INDUSTRY_SECTOR'),
      getDictionaryOptions('CUSTOMER_LEVEL'),
      getDictionaryOptions('PARTNER_SOURCE_CHANNEL'),
      getDictionaryOptions('CUSTOMER_CATEGORY'),
      getDictionaryOptions('CONTACT_TITLE'),
    ]);
    setOptionsMap({
      salesmanId: users,
      collaboratorIds: users,
      industryCode: industry,
      customerLevelCode: level,
      leadSourceCode: lead,
      category,
      contactTitle,
    });
  }, [messageApi, resolvedHostResource, t]);

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

    let cancelled = false;

    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      isActive: true,
      isPublic: true,
      salesmanId: undefined,
      collaboratorIds: [],
    });
    setIsPublicMode(true);
    resetFieldValues();

    if (!editUuid) {
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
          formRef.current?.setFieldsValue({
            code,
            isActive: true,
            isPublic: true,
            salesmanId: undefined,
            collaboratorIds: [],
          });
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
    customerApi
      .get(editUuid)
      .then(async (detail) => {
        if (cancelled) return;
        const isPublic = detail.poolStatus === 'pool' || !detail.salesmanId;
        formRef.current?.setFieldsValue({
          ...customerDetailToFormValues(detail),
          collaboratorIds: [],
        });
        setIsPublicMode(isPublic);
        const fieldFormValues = await loadFieldValues(detail.id);
        if (cancelled) return;
        formRef.current?.setFieldsValue(fieldFormValues);
        const collabSupport = collaboratorSupportRef.current;
        if (collabSupport && !isPublic && detail.id) {
          try {
            const ids = await collabSupport.load(detail.id);
            if (cancelled) return;
            formRef.current?.setFieldsValue({ collaboratorIds: ids });
          } catch {
            if (!cancelled) {
              formRef.current?.setFieldsValue({ collaboratorIds: [] });
            }
          }
        }
      })
      .catch((err: any) => {
        if (cancelled) return;
        messageApi.error(err?.message || t('app.master-data.customers.getDetailFailed'));
      });

    return () => {
      cancelled = true;
    };
  }, [open, editUuid, loadFieldValues, messageApi, resetFieldValues, t]);

  const customerBasicTailSchema = useMemo(() => {
    const source = isEdit ? customerFormSchemaBasicTailEdit : customerFormSchemaBasicTail;
    const maxCount = collaboratorSupport?.maxCount ?? MAX_COLLABORATORS_DEFAULT;
    return source
      .filter((field) => field.name !== 'collaboratorIds' || Boolean(collaboratorSupport))
      .map((field) => {
        if (field.name === 'salesmanId') {
          return {
            ...field,
            fieldProps: {
              ...(field.fieldProps || {}),
              disabled: isPublicMode,
            },
          };
        }
        if (field.name === 'collaboratorIds') {
          return {
            ...field,
            fieldProps: {
              ...(field.fieldProps || {}),
              disabled: isPublicMode,
              maxCount,
            },
          };
        }
        return field;
      });
  }, [isEdit, isPublicMode, collaboratorSupport]);

  const handleSubmit = async (values: any) => {
    try {
      setFormLoading(true);
      const currentUser = useGlobalStore.getState().currentUser;
      const { customData, standardValues } = extractFormValues(values);
      const { isPublic: _isPublic, collaboratorIds: rawCollaboratorIds, ...restValues } = standardValues;
      const payload: Record<string, unknown> = {
        ...restValues,
        contacts: normalizeCustomerContactsForSubmit(standardValues.contacts ?? values.contacts),
      };
      if (standardValues.isPublic === true) {
        // 显式传 null，后端才能识别为“清空归属业务员”
        payload.salesmanId = null;
      } else if (!payload.salesmanId && currentUser?.id) {
        payload.salesmanId = currentUser.id;
      }

      const salesmanIdNum = payload.salesmanId != null ? Number(payload.salesmanId) : null;
      const collaboratorIds = Array.isArray(rawCollaboratorIds)
        ? (rawCollaboratorIds as unknown[])
            .map((id) => Number(id))
            .filter((id) => Number.isFinite(id) && id > 0 && id !== salesmanIdNum)
        : [];
      const maxCount = collaboratorSupport?.maxCount ?? MAX_COLLABORATORS_DEFAULT;
      if (collaboratorSupport && collaboratorIds.length > maxCount) {
        messageApi.error(t('field.customer.collaboratorsMax', { max: maxCount }));
        throw new Error('collaborators max');
      }

      let saved: Customer;
      if (isEdit && editUuid) {
        await customerApi.update(editUuid, payload as CustomerUpdate);
        saved = await customerApi.get(editUuid);
        await saveCustomFieldValues(saved.id, customData);
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
        saved = await customerApi.create(payload as CustomerCreate);
        await saveCustomFieldValues(saved.id, customData);
      }

      let collaboratorsFailed = false;
      if (collaboratorSupport) {
        const owned = standardValues.isPublic !== true && salesmanIdNum != null;
        try {
          await collaboratorSupport.save(saved.id, owned ? collaboratorIds : []);
        } catch (collabError: any) {
          collaboratorsFailed = true;
          messageApi.error(
            collabError?.message || t('app.kuaizhizao.customerPool.collaboratorsSaveFailed'),
          );
        }
      }

      messageApi.success(
        collaboratorsFailed
          ? t('field.customer.savedButCollaboratorsFailed')
          : t(isEdit ? 'common.updateSuccess' : 'common.createSuccess'),
      );

      onSuccess(saved);
      onClose();
      formRef.current?.resetFields();
      setPreviewCode(null);
      resetFieldValues();
    } catch (error: any) {
      if (error?.message === 'collaborators max') {
        return;
      }
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
        title={isEdit ? t('field.customer.editTitle') : t('field.customer.createTitle')}
        open={open}
        onClose={handleClose}
        onFinish={handleSubmit}
        isEdit={isEdit}
        loading={formLoading}
        width={MODAL_CONFIG.LARGE_WIDTH}
        formRef={formRef as React.RefObject<ProFormInstance>}
        layout="vertical"
        grid
        zIndex={zIndex}
        modalRender={(modal) => (
          <div data-smart-suggestion-anchor="customer-form">{modal}</div>
        )}
        onValuesChange={(changed, all) => {
          if ('isPublic' in changed) {
            syncSalesmanWithVisibility(changed.isPublic);
          }
          if ('salesmanId' in changed) {
            const ownerId = Number(changed.salesmanId);
            const currentIds = Array.isArray(all?.collaboratorIds) ? all.collaboratorIds : [];
            if (Number.isFinite(ownerId) && ownerId > 0 && currentIds.some((id: unknown) => Number(id) === ownerId)) {
              formRef.current?.setFieldsValue({
                collaboratorIds: currentIds.filter((id: unknown) => Number(id) !== ownerId),
              });
            }
          }
        }}
      >
        <CompanyNameAsciiParenHint open={open} anchorSelector={CUSTOMER_FORM_SMART_ANCHOR} />
        {/*
         * ProForm grid 只给「直接子级」包一层 Row；若唯一子节点是 Tabs，表单项的 Col 在 Tab 内，
         * 不在这层 Row 下会导致整表挤成窄列。用 Col span=24 占满外排行，Tab 内再用 Row 承接各字段的 Col。
         */}
        <Col span={24}>
          <Tabs
            destroyOnHidden={false}
            style={{ width: '100%' }}
            items={[
              {
                key: 'basic',
                label: t('field.partner.tabBasic'),
                children: (
                  <Row gutter={FORM_LAYOUT.GRID_GUTTER} wrap>
                    <SchemaFormRenderer
                      schema={customerFormSchemaBasicHead}
                      codeField="code"
                      codeAutoGenerated={effectiveAutoGenerate}
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
                                label: t('field.customer.category'),
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
                      <CustomerContactsFormTable
                        contactTitleOptions={optionsMap.contactTitle ?? []}
                        onQuickCreateContactTitle={() => {
                          setQuickCreateTarget({
                            field: 'contactTitle',
                            dictionaryCode: 'CONTACT_TITLE',
                            label: t('field.customer.contactTitle'),
                          });
                        }}
                      />
                    </Col>
                    <SchemaFormRenderer
                      schema={customerBasicTailSchema}
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
                            onClick: () => {
                              setQuickCreateTarget({
                                field: 'industryCode',
                                dictionaryCode: 'INDUSTRY_SECTOR',
                                label: t('field.customer.industry'),
                              });
                            },
                          },
                        },
                        customerLevelCode: {
                          quickCreate: {
                            label: '快速新增',
                            onClick: () => {
                              setQuickCreateTarget({
                                field: 'customerLevelCode',
                                dictionaryCode: 'CUSTOMER_LEVEL',
                                label: t('field.customer.level'),
                              });
                            },
                          },
                        },
                        leadSourceCode: {
                          quickCreate: {
                            label: '快速新增',
                            onClick: () => {
                              setQuickCreateTarget({
                                field: 'leadSourceCode',
                                dictionaryCode: 'PARTNER_SOURCE_CHANNEL',
                                label: t('field.customer.leadSource'),
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
