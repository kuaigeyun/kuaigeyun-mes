/**
 * 工程图纸新建/编辑弹窗
 */

import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
  ProFormUploadDragger,
  ProFormInstance,
} from '@ant-design/pro-components';
import { App } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import { FormModalTemplate } from '../../../components/layout-templates';
import { MODAL_CONFIG } from '../../../components/layout-templates/constants';
import { drawingApi, type EngineeringDrawing, type EngineeringDrawingCreate } from '../services/drawing';
import { materialApi } from '../services/material';
import { operationApi, processRouteApi, unwrapProcessPagedList } from '../services/process';
import { uploadMultipleFiles, buildImageUploadFileUrls } from '../../../services/file';
import { generateCode, getCodeRulePageConfig, testGenerateCode } from '../../../services/codeRule';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../utils/codeRulePage';
import { useCustomFields } from '../../../hooks/useCustomFields';
import { CustomFieldsFormSection } from '../../../components/custom-fields';

const PAGE_CODE = 'master-data-process-drawing';
const CUSTOM_FIELD_TABLE = 'apps_master_data_engineering_drawings';
const DRAWING_ACCEPT = '.pdf,.dwg,.dxf,.step,.stp,.png,.jpg,.jpeg';
const DRAWING_CATEGORY = 'engineering_drawing';

function extractUploadUuids(fileList: UploadFile[] | undefined): string[] {
  if (!fileList?.length) return [];
  const out: string[] = [];
  for (const f of fileList) {
    const res = f.response as { uuid?: string } | undefined;
    const uid = res?.uuid ?? (typeof f.uid === 'string' && /^[0-9a-f-]{36}$/i.test(f.uid) ? f.uid : null);
    if (uid) out.push(uid);
  }
  return out;
}

async function uuidsToUploadFiles(uuids: string[]): Promise<UploadFile[]> {
  const files: UploadFile[] = [];
  for (const uuid of uuids) {
    try {
      const urls = await buildImageUploadFileUrls(uuid);
      files.push({
        uid: uuid,
        name: uuid,
        status: 'done',
        url: urls.url,
        thumbUrl: urls.thumbUrl,
      });
    } catch {
      files.push({ uid: uuid, name: uuid, status: 'done' });
    }
  }
  return files;
}

export interface DrawingFormModalProps {
  open: boolean;
  onClose: () => void;
  editUuid: string | null;
  onSuccess: (drawing: EngineeringDrawing) => void;
}

export const DrawingFormModal: React.FC<DrawingFormModalProps> = ({
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
  const [materialOptions, setMaterialOptions] = useState<{ label: string; value: string }[]>([]);
  const [routeOptions, setRouteOptions] = useState<{ label: string; value: string }[]>([]);
  const [operationOptions, setOperationOptions] = useState<{ label: string; value: string }[]>([]);

  const isEdit = Boolean(editUuid);

  const {
    customFields,
    customFieldValues,
    loadFieldValues,
    extractFormValues,
    saveCustomFieldValues,
    resetFieldValues,
  } = useCustomFields({ tableName: CUSTOM_FIELD_TABLE, loadWhenOpen: true, open });

  const drawingTypeOptions = [
    { label: t('app.master-data.drawings.type.part'), value: 'part' },
    { label: t('app.master-data.drawings.type.assembly'), value: 'assembly' },
    { label: t('app.master-data.drawings.type.process'), value: 'process' },
    { label: t('app.master-data.drawings.type.other'), value: 'other' },
  ];

  const loadRelationOptions = async () => {
    try {
      const [materialsRes, routesRes, opsRes] = await Promise.all([
        materialApi.list({ limit: 500 }),
        processRouteApi.list({ limit: 500 }),
        operationApi.list({ limit: 500 }),
      ]);
      const materials = materialsRes?.items ?? [];
      setMaterialOptions(
        materials.map((m: { uuid: string; mainCode?: string; code?: string; name: string }) => ({
          label: `${m.mainCode || m.code || ''} ${m.name}`.trim(),
          value: m.uuid,
        }))
      );
      const routes = unwrapProcessPagedList(routesRes);
      setRouteOptions(routes.map((r) => ({ label: `${r.code} ${r.name}`, value: r.uuid })));
      const ops = unwrapProcessPagedList(opsRes);
      setOperationOptions(ops.map((o) => ({ label: `${o.code} ${o.name}`, value: o.uuid })));
    } catch {
      /* non-blocking */
    }
  };

  useEffect(() => {
    if (!open) return;
    loadRelationOptions();
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({ revision: 'A', drawingType: 'part' });
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
        } catch {
          /* ignore */
        }
        if (autoGenerate && ruleCode) {
          setEffectiveRuleCode(ruleCode);
          testGenerateCode({ rule_code: ruleCode })
            .then((res) => {
              setPreviewCode(res.code);
              formRef.current?.setFieldsValue({ code: res.code, revision: 'A', drawingType: 'part' });
            })
            .catch(() => setPreviewCode(null));
        } else {
          setPreviewCode(null);
          setEffectiveRuleCode(null);
        }
      })();
      return;
    }

    setPreviewCode(null);
    setEffectiveRuleCode(null);
    drawingApi
      .get(editUuid)
      .then(async (detail) => {
        const mainFiles = detail.fileUuid ? await uuidsToUploadFiles([detail.fileUuid]) : [];
        const suppFiles = detail.supplementaryFileUuids?.length
          ? await uuidsToUploadFiles(detail.supplementaryFileUuids)
          : [];
        formRef.current?.setFieldsValue({
          code: detail.code,
          name: detail.name,
          revision: detail.revision,
          drawingType: detail.drawingType,
          mainFile: mainFiles,
          supplementaryFiles: suppFiles,
          materialUuids: detail.materialUuids ?? [],
          processRouteUuids: detail.processRouteUuids ?? [],
          operationUuids: detail.operationUuids ?? [],
          description: detail.description,
        });
        const fieldFormValues = await loadFieldValues(detail.id);
        formRef.current?.setFieldsValue(fieldFormValues);
      })
      .catch((err: Error) => {
        messageApi.error(err?.message || t('app.master-data.drawings.getDetailFailed'));
      });
  }, [open, editUuid, t, messageApi]);

  const makeUploadFieldProps = (multiple: boolean) => ({
    accept: DRAWING_ACCEPT,
    multiple,
    style: { width: '100%' },
    customRequest: async (options: any) => {
      try {
        const res = await uploadMultipleFiles([options.file as File], { category: DRAWING_CATEGORY });
        options.onSuccess?.(res[0], options.file);
      } catch (err) {
        options.onError?.(err);
      }
    },
  });

  const handleSubmit = async (values: Record<string, unknown>) => {
    const { customData, standardValues } = extractFormValues(values);
    const mainUuids = extractUploadUuids(standardValues.mainFile as UploadFile[]);
    if (!mainUuids.length) {
      messageApi.error(t('app.master-data.drawings.fileRequired'));
      return;
    }
    const suppUuids = extractUploadUuids(standardValues.supplementaryFiles as UploadFile[]);

    try {
      setFormLoading(true);
      if (isEdit && editUuid) {
        await drawingApi.update(editUuid, {
          name: standardValues.name as string,
          drawingType: standardValues.drawingType as EngineeringDrawingCreate['drawingType'],
          fileUuid: mainUuids[0],
          supplementaryFileUuids: suppUuids.length ? suppUuids : [],
          materialUuids: (standardValues.materialUuids as string[]) ?? [],
          processRouteUuids: (standardValues.processRouteUuids as string[]) ?? [],
          operationUuids: (standardValues.operationUuids as string[]) ?? [],
          description: standardValues.description as string | undefined,
        });
        messageApi.success(t('common.updateSuccess'));
        const updated = await drawingApi.get(editUuid);
        await saveCustomFieldValues(updated.id, customData);
        onSuccess(updated);
      } else {
        let code = standardValues.code as string;
        const ruleCodeToUse = effectiveRuleCode || getPageRuleCode(PAGE_CODE);
        if (
          ruleCodeToUse &&
          (isAutoGenerateEnabled(PAGE_CODE) || effectiveRuleCode) &&
          (code === previewCode || !code)
        ) {
          try {
            const codeResponse = await generateCode({ rule_code: ruleCodeToUse });
            code = codeResponse.code;
          } catch {
            /* keep form code */
          }
        }
        const created = await drawingApi.create({
          code,
          name: standardValues.name as string,
          revision: (standardValues.revision as string) || 'A',
          drawingType: (standardValues.drawingType as EngineeringDrawingCreate['drawingType']) || 'part',
          fileUuid: mainUuids[0],
          supplementaryFileUuids: suppUuids.length ? suppUuids : undefined,
          materialUuids: (standardValues.materialUuids as string[]) ?? undefined,
          processRouteUuids: (standardValues.processRouteUuids as string[]) ?? undefined,
          operationUuids: (standardValues.operationUuids as string[]) ?? undefined,
          description: standardValues.description as string | undefined,
        });
        await saveCustomFieldValues(created.id, customData);
        messageApi.success(t('common.createSuccess'));
        onSuccess(created);
      }
      onClose();
      formRef.current?.resetFields();
      setPreviewCode(null);
      resetFieldValues();
    } catch (err: any) {
      messageApi.error(err?.message || (isEdit ? t('common.updateFailed') : t('common.createFailed')));
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

  return (
    <FormModalTemplate
      title={isEdit ? t('app.master-data.drawings.editTitle') : t('app.master-data.drawings.createTitle')}
      open={open}
      onClose={handleClose}
      onFinish={handleSubmit}
      isEdit={isEdit}
      loading={formLoading}
      width={MODAL_CONFIG.STANDARD_WIDTH}
      formRef={formRef as React.RefObject<ProFormInstance>}
      layout="vertical"
      grid
      initialValues={{ revision: 'A', drawingType: 'part' }}
    >
      <ProFormText
        name="code"
        label={t('app.master-data.drawings.code')}
        rules={[{ required: true }]}
        disabled={isEdit}
        fieldProps={{ maxLength: 50 }}
        colProps={{ span: 12 }}
      />
      <ProFormText
        name="name"
        label={t('app.master-data.drawings.name')}
        rules={[{ required: true }]}
        fieldProps={{ maxLength: 200 }}
        colProps={{ span: 12 }}
      />
      <ProFormText
        name="revision"
        label={t('app.master-data.drawings.revision')}
        rules={[{ required: true }]}
        disabled={isEdit}
        fieldProps={{ maxLength: 20 }}
        colProps={{ span: 12 }}
      />
      <ProFormSelect
        name="drawingType"
        label={t('app.master-data.drawings.type')}
        options={drawingTypeOptions}
        rules={[{ required: true }]}
        colProps={{ span: 12 }}
      />
      <CustomFieldsFormSection customFields={customFields} customFieldValues={customFieldValues} gridColumns={2} />
      <ProFormUploadDragger
        name="mainFile"
        label={t('app.master-data.drawings.uploadMain')}
        max={1}
        icon={<InboxOutlined />}
        title={t('app.master-data.drawings.uploadDragHint')}
        description={t('app.master-data.drawings.uploadDragSubHint')}
        fieldProps={makeUploadFieldProps(false)}
        rules={[{ required: true, message: t('app.master-data.drawings.fileRequired') }]}
        colProps={{ span: 12 }}
      />
      <ProFormUploadDragger
        name="supplementaryFiles"
        label={t('app.master-data.drawings.uploadSupplementary')}
        icon={<InboxOutlined />}
        title={t('app.master-data.drawings.uploadDragHint')}
        description={t('app.master-data.drawings.uploadSupplementaryDragSubHint')}
        fieldProps={makeUploadFieldProps(true)}
        colProps={{ span: 12 }}
      />
      <ProFormSelect
        name="materialUuids"
        label={t('app.master-data.drawings.materials')}
        mode="multiple"
        options={materialOptions}
        showSearch
        fieldProps={{ optionFilterProp: 'label' }}
        colProps={{ span: 12 }}
      />
      <ProFormSelect
        name="processRouteUuids"
        label={t('app.master-data.drawings.routes')}
        mode="multiple"
        options={routeOptions}
        showSearch
        fieldProps={{ optionFilterProp: 'label' }}
        colProps={{ span: 12 }}
      />
      <ProFormSelect
        name="operationUuids"
        label={t('app.master-data.drawings.operations')}
        mode="multiple"
        options={operationOptions}
        showSearch
        fieldProps={{ optionFilterProp: 'label' }}
        colProps={{ span: 12 }}
      />
      <ProFormTextArea
        name="description"
        label={t('app.master-data.drawings.description')}
        fieldProps={{ rows: 3 }}
        colProps={{ span: 24 }}
      />
    </FormModalTemplate>
  );
};
