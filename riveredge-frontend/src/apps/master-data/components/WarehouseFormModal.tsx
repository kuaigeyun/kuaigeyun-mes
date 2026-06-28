/**
 * 仓库新建/编辑弹窗
 */

import React, { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ProFormInstance, ProFormSelect, ProFormDependency } from '@ant-design/pro-components';
import { App } from 'antd';
import { FormModalTemplate } from '../../../components/layout-templates';
import { MODAL_CONFIG } from '../../../components/layout-templates/constants';
import { warehouseApi } from '../services/warehouse';
import { workshopApi, workCenterApi, workstationApi, factoryListItems } from '../services/factory';
import { testGenerateCode, generateCode, getCodeRulePageConfig } from '../../../services/codeRule';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../utils/codeRulePage';
import type { Warehouse, WarehouseCreate, WarehouseUpdate } from '../types/warehouse';
import type { Workshop, WorkCenter, Workstation } from '../types/factory';
import { SchemaFormRenderer } from '../../../components/schema-form';
import { warehouseFormSchemaBasic, warehouseFormSchemaRest } from '../schemas/warehouse';
import { useCustomFields } from '../../../hooks/useCustomFields';
import { CustomFieldsFormSection } from '../../../components/custom-fields';

const PAGE_CODE = 'master-data-warehouse-warehouse';
const CUSTOM_FIELD_TABLE = 'master_data_warehouse_warehouses';

export interface WarehouseFormModalProps {
  open: boolean;
  onClose: () => void;
  editUuid: string | null;
  onSuccess: (warehouse: Warehouse) => void;
  zIndex?: number;
}

export const WarehouseFormModal: React.FC<WarehouseFormModalProps> = ({
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
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [workstations, setWorkstations] = useState<Workstation[]>([]);
  const [workCenters, setWorkCenters] = useState<WorkCenter[]>([]);

  const {
    customFields,
    customFieldValues,
    loadFieldValues,
    extractFormValues,
    saveCustomFieldValues,
    resetFieldValues,
  } = useCustomFields({ tableName: CUSTOM_FIELD_TABLE, loadWhenOpen: true, open });

  const isEdit = Boolean(editUuid);

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [wsList, wstList, wcList] = await Promise.all([
          workshopApi.list({ limit: 1000, is_active: true }),
          workstationApi.list({ limit: 1000, is_active: true }),
          workCenterApi.list({ limit: 1000, is_active: true }),
        ]);
        setWorkshops(factoryListItems(wsList));
        setWorkstations(factoryListItems(wstList));
        setWorkCenters(factoryListItems(wcList));
      } catch (e) {
        console.error('加载车间/工位/工作中心列表失败:', e);
      }
    };
    loadOptions();
  }, []);

  useEffect(() => {
    if (!open) return;
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({ isActive: true, warehouseType: 'normal' });
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
              formRef.current?.setFieldsValue({ code: res.code, isActive: true, warehouseType: 'normal' });
            })
            .catch(() => {
              setPreviewCode(null);
              formRef.current?.setFieldsValue({ isActive: true, warehouseType: 'normal' });
            });
        } else {
          setPreviewCode(null);
          setEffectiveRuleCode(null);
          formRef.current?.setFieldsValue({ isActive: true, warehouseType: 'normal' });
        }
      })();
      return;
    }
    setPreviewCode(null);
    setEffectiveRuleCode(null);
    warehouseApi
      .get(editUuid)
      .then(async (detail) => {
        formRef.current?.setFieldsValue({
          code: detail.code,
          name: detail.name,
          description: detail.description,
          isActive: detail.isActive ?? true,
          warehouseType: detail.warehouseType ?? 'normal',
          workshopId: detail.workshopId,
          workstationId: detail.workstationId,
          workCenterId: detail.workCenterId,
        });
        const fieldFormValues = await loadFieldValues(detail.id);
        formRef.current?.setFieldsValue(fieldFormValues);
      })
      .catch((err: any) => {
        messageApi.error(err?.message || t('app.master-data.warehouses.getDetailFailed'));
      });
  }, [open, editUuid]);

  const handleSubmit = async (values: any) => {
    try {
      setFormLoading(true);
      const { customData, standardValues } = extractFormValues(values);

      if (isEdit && editUuid) {
        await warehouseApi.update(editUuid, standardValues as WarehouseUpdate);
        messageApi.success(t('common.updateSuccess'));
        const updated = await warehouseApi.get(editUuid);
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
        const created = await warehouseApi.create(standardValues as WarehouseCreate);
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

  return (
    <FormModalTemplate
      title={isEdit ? t('field.warehouse.editTitle') : t('field.warehouse.createTitle')}
      open={open}
      onClose={handleClose}
      onFinish={handleSubmit}
      isEdit={isEdit}
      loading={formLoading}
      width={MODAL_CONFIG.STANDARD_WIDTH}
      formRef={formRef as React.RefObject<ProFormInstance>}
      initialValues={{ isActive: true, warehouseType: 'normal' }}
      layout="vertical"
      grid
      zIndex={zIndex}
    >
      <SchemaFormRenderer
        schema={warehouseFormSchemaBasic}
        codeField="code"
        codeAutoGenerated={isAutoGenerateEnabled(PAGE_CODE)}
        codeAutoGeneratedKey="field.warehouse.codeAutoGenerated"
        isEdit={isEdit}
        allowEditCodeWhenEdit
      />
      <ProFormDependency name={['warehouseType']}>
        {({ warehouseType }) =>
          warehouseType === 'line_side' ? (
            <>
              <ProFormSelect
                name="workshopId"
                label={t('field.warehouse.workshopId')}
                placeholder={t('field.warehouse.workshopIdPlaceholder')}
                rules={[{ required: true, message: t('field.warehouse.workshopIdRequired') }]}
                options={workshops.map((w) => ({ label: `${w.code} - ${w.name}`, value: w.id }))}
                fieldProps={{ showSearch: true, allowClear: true }}
                colProps={{ span: 12 }}
              />
              <ProFormSelect
                name="workstationId"
                label={t('field.warehouse.workstationId')}
                placeholder={t('field.warehouse.workstationIdPlaceholder')}
                options={workstations.map((w) => ({ label: `${w.code} - ${w.name}`, value: w.id }))}
                fieldProps={{ showSearch: true, allowClear: true }}
                colProps={{ span: 12 }}
              />
              <ProFormSelect
                name="workCenterId"
                label={t('field.warehouse.workCenterId')}
                placeholder={t('field.warehouse.workCenterIdPlaceholder')}
                options={workCenters.map((wc) => ({ label: `${wc.code} - ${wc.name}`, value: wc.id }))}
                fieldProps={{ showSearch: true, allowClear: true }}
                colProps={{ span: 12 }}
              />
            </>
          ) : null
        }
      </ProFormDependency>
      <SchemaFormRenderer
        schema={warehouseFormSchemaRest}
        slots={{ customFields: <CustomFieldsFormSection customFields={customFields} customFieldValues={customFieldValues} gridColumns={2} /> }}
        codeField="code"
        codeAutoGenerated={isAutoGenerateEnabled(PAGE_CODE)}
        codeAutoGeneratedKey="field.warehouse.codeAutoGenerated"
        isEdit={isEdit}
      />
    </FormModalTemplate>
  );
};
