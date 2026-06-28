/**
 * 物料分组新建/编辑弹窗（可复用）
 *
 * 供物料管理页、物料表单内「快速新增分组」等场景使用。
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { App, Tabs, Tooltip } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';
import {
  ProFormInstance,
  ProFormText,
  ProFormTextArea,
  ProFormSwitch,
  ProFormItem,
} from '@ant-design/pro-components';
import { FormModalTemplate } from '../../../components/layout-templates';
import { MODAL_CONFIG } from '../../../components/layout-templates/constants';
import SafeProFormSelect from '../../../components/safe-pro-form-select';
import { CustomFieldsFormSection } from '../../../components/custom-fields';
import { useCustomFields } from '../../../hooks/useCustomFields';
import { materialGroupApi } from '../services/material';
import { processRouteApi } from '../services/process';
import {
  formatMaterialGroupLabel,
  type MaterialGroup,
  type MaterialGroupCreate,
  type MaterialGroupUpdate,
} from '../types/material';
import type { ProcessRoute } from '../types/process';
import {
  normalizeStagesInput,
  materialStagesToApiPayload,
  InspectionStagesEditor,
} from './InspectionStagesEditor';
import { QualityMasterDataHint } from '../../kuaizhizao/pages/quality-management/components/QualityMasterDataHint';

export interface MaterialGroupFormModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (group: MaterialGroup) => void;
  isEdit?: boolean;
  group?: MaterialGroup | null;
  /** 新建子分组时预填父分组 ID */
  parentIdPreset?: number;
  /** 父分组下拉选项；不传则在 open 时自行拉取 */
  materialGroups?: MaterialGroup[];
  zIndex?: number;
}

export const MaterialGroupFormModal: React.FC<MaterialGroupFormModalProps> = ({
  open,
  onClose,
  onSuccess,
  isEdit = false,
  group = null,
  parentIdPreset,
  materialGroups: materialGroupsProp,
  zIndex,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const formRef = useRef<ProFormInstance>();
  const [formLoading, setFormLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const [materialGroups, setMaterialGroups] = useState<MaterialGroup[]>(materialGroupsProp ?? []);
  const [materialGroupsLoading, setMaterialGroupsLoading] = useState(false);
  const [processRoutes, setProcessRoutes] = useState<ProcessRoute[]>([]);
  const [processRoutesLoading, setProcessRoutesLoading] = useState(false);

  const {
    customFields,
    customFieldValues,
    loadFieldValues,
    extractFormValues,
    saveCustomFieldValues,
    resetFieldValues,
  } = useCustomFields({
    tableName: 'master_data_material_groups',
    loadWhenOpen: true,
    open,
  });

  useEffect(() => {
    if (materialGroupsProp) {
      setMaterialGroups(materialGroupsProp);
    }
  }, [materialGroupsProp]);

  const loadMaterialGroups = useCallback(async () => {
    if (materialGroupsProp) return;
    setMaterialGroupsLoading(true);
    try {
      const list = await materialGroupApi.list({ limit: 1000 });
      setMaterialGroups(list);
    } catch {
      setMaterialGroups([]);
    } finally {
      setMaterialGroupsLoading(false);
    }
  }, [materialGroupsProp]);

  const loadProcessRoutes = useCallback(() => {
    setProcessRoutesLoading(true);
    processRouteApi
      .list({ limit: 1000, isActive: true })
      .then((result) => {
        const list = Array.isArray(result) ? result : result?.data ?? [];
        setProcessRoutes(list);
      })
      .catch(() => {
        messageApi.error(t('app.master-data.materialForm.fetchProcessRoutesFailed'));
        setProcessRoutes([]);
      })
      .finally(() => setProcessRoutesLoading(false));
  }, [messageApi, t]);

  useEffect(() => {
    if (!open) return;
    setActiveTab('basic');
    void loadMaterialGroups();
    loadProcessRoutes();
  }, [open, loadMaterialGroups, loadProcessRoutes]);

  useEffect(() => {
    if (!open) return;
    if (isEdit && group?.id) {
      void loadFieldValues(group.id).then((fieldFormValues) => {
        formRef.current?.setFieldsValue(fieldFormValues);
      });
    }
  }, [open, isEdit, group?.id, loadFieldValues]);

  const handleClose = () => {
    setActiveTab('basic');
    resetFieldValues();
    onClose();
  };

  const handleSubmit = async (values: any) => {
    try {
      setFormLoading(true);
      const { customData, standardValues } = extractFormValues(values);
      const payload = {
        ...standardValues,
        processRouteId: standardValues.processRouteId ?? null,
        inspectionStages: materialStagesToApiPayload(
          normalizeStagesInput(standardValues.inspectionStages),
        ),
      };

      if (isEdit && group) {
        await materialGroupApi.update(group.uuid, payload as MaterialGroupUpdate);
        const updated = await materialGroupApi.get(group.uuid);
        await saveCustomFieldValues(updated.id, customData);
        messageApi.success(t('common.updateSuccess'));
        handleClose();
        onSuccess(updated);
      } else {
        const created = await materialGroupApi.create(payload as MaterialGroupCreate);
        await saveCustomFieldValues(created.id, customData);
        messageApi.success(t('common.createSuccess'));
        handleClose();
        onSuccess(created);
      }
    } catch (error: any) {
      messageApi.error(error.message || (isEdit ? t('common.updateFailed') : t('common.createFailed')));
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <FormModalTemplate
      title={
        isEdit
          ? t('app.master-data.materials.editGroup')
          : parentIdPreset != null
            ? t('app.master-data.materials.createSubGroup')
            : t('app.master-data.materials.createGroup')
      }
      open={open}
      onClose={handleClose}
      onFinish={handleSubmit}
      isEdit={isEdit}
      loading={formLoading}
      formRef={formRef as React.RefObject<ProFormInstance>}
      width={MODAL_CONFIG.STANDARD_WIDTH}
      zIndex={zIndex}
      initialValues={
        isEdit && group
          ? {
              code: group.code,
              alias: group.alias,
              name: group.name,
              parentId: group.parentId,
              description: group.description,
              isActive: group.isActive,
              processRouteId:
                group.processRouteId ??
                (group as { process_route_id?: number }).process_route_id ??
                null,
              inspectionStages: normalizeStagesInput(
                group.inspectionStages ??
                  (group as { inspection_stages?: unknown }).inspection_stages,
              ),
            }
          : {
              isActive: true,
              ...(parentIdPreset != null ? { parentId: parentIdPreset } : {}),
            }
      }
    >
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        destroyInactiveTabPane={false}
        items={[
          {
            key: 'basic',
            label: t('app.master-data.materialForm.basicInfo'),
            children: (
              <>
                <SafeProFormSelect
                  name="parentId"
                  label={t('app.master-data.materials.parentGroup')}
                  placeholder={t('app.master-data.materials.parentGroupPlaceholder')}
                  options={materialGroups
                    .filter((g) => !isEdit || g.id !== group?.id)
                    .map((g) => ({
                      label: formatMaterialGroupLabel(g),
                      value: g.id,
                    }))}
                  fieldProps={{
                    loading: materialGroupsLoading,
                    showSearch: true,
                    allowClear: true,
                    filterOption: (input: string, option: any) =>
                      (option?.label ?? '').toLowerCase().includes(input.toLowerCase()),
                  }}
                />
                <ProFormText
                  name="code"
                  label={t('app.master-data.materials.groupCode')}
                  placeholder={t('app.master-data.materials.groupCodePlaceholder')}
                  extra={t('app.master-data.materials.groupCodeExtra')}
                  rules={[
                    { required: true, message: t('app.master-data.materials.groupCodeRequired') },
                    { max: 50, message: t('app.master-data.materials.groupCodeMax') },
                  ]}
                  fieldProps={{
                    style: { textTransform: 'uppercase' },
                  }}
                />
                <ProFormText
                  name="name"
                  label={t('app.master-data.materials.groupName')}
                  placeholder={t('app.master-data.materials.groupNamePlaceholder')}
                  rules={[
                    { required: true, message: t('app.master-data.materials.groupNameRequired') },
                    { max: 200, message: t('app.master-data.materials.groupNameMax') },
                  ]}
                />
                <ProFormText
                  name="alias"
                  label={t('app.master-data.materials.groupAlias')}
                  placeholder={t('app.master-data.materials.groupAliasPlaceholder')}
                  rules={[{ max: 100, message: t('app.master-data.materials.groupAliasMax') }]}
                />
                <CustomFieldsFormSection
                  customFields={customFields}
                  customFieldValues={customFieldValues}
                  gridColumns={1}
                />
                <ProFormTextArea
                  name="description"
                  label={t('app.master-data.materials.description')}
                  placeholder={t('app.master-data.materials.descriptionPlaceholder')}
                  rows={3}
                  fieldProps={{
                    maxLength: 500,
                  }}
                />
                <ProFormSwitch
                  name="isActive"
                  label={t('app.master-data.materials.enabledStatusLabel')}
                  checkedChildren={t('app.master-data.materials.checkedChildren')}
                  unCheckedChildren={t('app.master-data.materials.unCheckedChildren')}
                />
              </>
            ),
          },
          {
            key: 'processQuality',
            label: t('app.master-data.materials.groupTabProcessQuality'),
            children: (
              <>
                <SafeProFormSelect
                  name="processRouteId"
                  label={t('app.master-data.source.defaultProcessRoute')}
                  placeholder={t('app.master-data.source.selectProcessRoute')}
                  tooltip={t('app.master-data.source.defaultProcessRouteGroupHint')}
                  options={processRoutes.map((r) => ({
                    label: `${r.code} ${r.name}`.trim(),
                    value: r.id,
                  }))}
                  fieldProps={{
                    allowClear: true,
                    showSearch: true,
                    loading: processRoutesLoading,
                    optionFilterProp: 'label',
                  }}
                />
                <QualityMasterDataHint scope="material" />
                <ProFormItem
                  name="inspectionStages"
                  label={
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span>{t('app.master-data.materialForm.inspectionStagesTitle')}</span>
                      <Tooltip title={t('app.master-data.materials.groupInspectionStagesHint')}>
                        <QuestionCircleOutlined
                          style={{ color: 'rgba(0,0,0,.45)', fontSize: 14, cursor: 'help' }}
                        />
                      </Tooltip>
                    </span>
                  }
                >
                  <InspectionStagesEditor scope="material" />
                </ProFormItem>
              </>
            ),
          },
        ]}
      />
    </FormModalTemplate>
  );
};

export default MaterialGroupFormModal;
