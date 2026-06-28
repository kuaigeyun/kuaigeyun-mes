/**
 * 工艺路线新建/编辑弹窗
 */

import React, { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ProFormInstance, ProForm, ProFormDependency } from '@ant-design/pro-components';
import { App, Tag, theme } from 'antd';
import { FormModalTemplate } from '../../../components/layout-templates';
import { MODAL_CONFIG, MODAL_ABOVE_DETAIL_SIDECHAIN_OFFSET, MODAL_NESTED_ABOVE_PARENT_OFFSET } from '../../../components/layout-templates/constants';
import { processRouteApi } from '../services/process';
import { testGenerateCode, generateCode } from '../../../services/codeRule';
import { getCodeRulePageConfig } from '../../../services/codeRule';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../utils/codeRulePage';
import type { ProcessRoute, ProcessRouteCreate, ProcessRouteUpdate } from '../types/process';
import { SchemaFormRenderer } from '../../../components/schema-form';
import { OperationSequenceEditor, type OperationItem } from './OperationSequenceEditor';
import {
  buildOperationSequencePayload,
  parseOperationSequenceFromRoute,
} from '../utils/processRouteSequenceUtils';
import { routeFormSchema } from '../schemas/route';
import { useCustomFields } from '../../../hooks/useCustomFields';
import { CustomFieldsFormSection } from '../../../components/custom-fields';

const PAGE_CODE = 'master-data-process-route';
const CUSTOM_FIELD_TABLE = 'master_data_process_routes';

export interface RouteFormModalProps {
  open: boolean;
  onClose: () => void;
  editUuid: string | null;
  onSuccess: (route: ProcessRoute) => void;
  /** 嵌套在其它 Modal 内时抬高层级 */
  zIndex?: number;
}

export const RouteFormModal: React.FC<RouteFormModalProps> = ({
  open,
  onClose,
  editUuid,
  onSuccess,
  zIndex,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const { token } = theme.useToken();
  const formRef = useRef<ProFormInstance>();
  const [formLoading, setFormLoading] = useState(false);
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [operationSequence, setOperationSequence] = useState<OperationItem[]>([]);
  const [pickModalOpen, setPickModalOpen] = useState(false);
  const operationPickModalZIndex =
    zIndex != null
      ? zIndex + MODAL_NESTED_ABOVE_PARENT_OFFSET
      : token.zIndexPopupBase + MODAL_ABOVE_DETAIL_SIDECHAIN_OFFSET + MODAL_NESTED_ABOVE_PARENT_OFFSET;

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
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        formRef.current?.submit();
      }
      if (e.key === 'Escape' && !pickModalOpen) {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose, pickModalOpen]);

  useEffect(() => {
    if (!open) return;
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      isActive: true,
      allowOperationJump: false,
      overReportMode: 'none',
      overReportValue: 0,
    });
    setOperationSequence([]);
    resetFieldValues();

    if (!editUuid) {
      getCodeRulePageConfig(PAGE_CODE)
        .then((pageConfig) => {
          const ruleCode = pageConfig?.ruleCode;
          const autoGenerate = !!(pageConfig?.autoGenerate && ruleCode);
          if (autoGenerate && ruleCode) {
            testGenerateCode({ rule_code: ruleCode, check_duplicate: true, entity_type: 'process_route' })
              .then((res) => {
                const previewCodeValue = (res?.code ?? '').trim();
                setPreviewCode(previewCodeValue || null);
                formRef.current?.setFieldsValue({
                  ...(previewCodeValue ? { code: previewCodeValue } : {}),
                  isActive: true,
                  allowOperationJump: false,
                  overReportMode: 'none',
                  overReportValue: 0,
                });
                if (!previewCodeValue) {
                  messageApi.info(t('app.master-data.codeRulePreviewHint'));
                }
              })
              .catch(() => {
                setPreviewCode(null);
                formRef.current?.setFieldsValue({
                  isActive: true,
                  allowOperationJump: false,
                  overReportMode: 'none',
                  overReportValue: 0,
                });
                messageApi.info(t('app.master-data.codeRuleAutoFailed'));
              });
          } else {
            setPreviewCode(null);
            formRef.current?.setFieldsValue({
              isActive: true,
              allowOperationJump: false,
              overReportMode: 'none',
              overReportValue: 0,
            });
          }
        })
        .catch(() => {
          const ruleCode = getPageRuleCode(PAGE_CODE);
          const autoGenerate = isAutoGenerateEnabled(PAGE_CODE);
          if (autoGenerate && ruleCode) {
            testGenerateCode({ rule_code: ruleCode, check_duplicate: true, entity_type: 'process_route' })
              .then((res) => {
                const previewCodeValue = (res?.code ?? '').trim();
                setPreviewCode(previewCodeValue || null);
                formRef.current?.setFieldsValue({
                  ...(previewCodeValue ? { code: previewCodeValue } : {}),
                  isActive: true,
                  allowOperationJump: false,
                  overReportMode: 'none',
                  overReportValue: 0,
                });
                if (!previewCodeValue) {
                  messageApi.info(t('app.master-data.codeRulePreviewHint'));
                }
              })
              .catch(() => {
                setPreviewCode(null);
                formRef.current?.setFieldsValue({
                  isActive: true,
                  allowOperationJump: false,
                  overReportMode: 'none',
                  overReportValue: 0,
                });
                messageApi.info(t('app.master-data.codeRuleAutoFailed'));
              });
          } else {
            setPreviewCode(null);
            formRef.current?.setFieldsValue({
              isActive: true,
              allowOperationJump: false,
              overReportMode: 'none',
              overReportValue: 0,
            });
          }
        });
      return;
    }

    setPreviewCode(null);
    processRouteApi
      .get(editUuid)
      .then(async (detail) => {
        formRef.current?.setFieldsValue({
          code: detail.code,
          name: detail.name,
          description: detail.description,
          isActive: detail.is_active ?? (detail as any).isActive ?? true,
          allowOperationJump:
            (detail as any).allow_operation_jump ?? (detail as any).allowOperationJump ?? false,
          overReportMode: (detail as any).over_report_mode ?? (detail as any).overReportMode ?? 'none',
          overReportValue: Number((detail as any).over_report_value ?? (detail as any).overReportValue ?? 0) || 0,
        });
        const seq = detail.operation_sequence ?? (detail as any).operationSequence;
        const { operationApi, unwrapProcessPagedList } = await import('../services/process');
        const ops = await parseOperationSequenceFromRoute(seq, t, async () =>
          unwrapProcessPagedList(await operationApi.list({ limit: 1000, is_active: true })),
        );
        if (ops.length > 0) setOperationSequence(ops);
        const fieldFormValues = await loadFieldValues(detail.id);
        formRef.current?.setFieldsValue(fieldFormValues);
      })
      .catch((err: any) => {
        messageApi.error(err?.message || t('app.master-data.routes.getDetailFailed'));
      });
  }, [open, editUuid]);

  const handleSubmit = async (values: any) => {
    try {
      setFormLoading(true);
      const { customData, standardValues } = extractFormValues(values);
      if (!standardValues.code?.trim()) {
        messageApi.error(t('app.master-data.routes.codeRequired'));
        return;
      }
      if (!standardValues.name?.trim()) {
        messageApi.error(t('app.master-data.routes.nameRequired'));
        return;
      }
      if (operationSequence.length === 0) {
        messageApi.error(t('app.master-data.routes.operationRequired'));
        return;
      }

      const allowJump = !!standardValues.allowOperationJump;
      const operationSequenceData = buildOperationSequencePayload(operationSequence, allowJump);

      let finalCode = standardValues.code.trim();
      if (!isEdit) {
        let ruleCode: string | undefined;
        let autoGenerate = false;
        try {
          const pageConfig = await getCodeRulePageConfig(PAGE_CODE);
          ruleCode = pageConfig?.ruleCode;
          autoGenerate = !!(pageConfig?.autoGenerate && ruleCode);
        } catch {
          ruleCode = getPageRuleCode(PAGE_CODE);
          autoGenerate = isAutoGenerateEnabled(PAGE_CODE);
        }
        const currentCode = standardValues.code?.trim();
        const useAutoCode = !currentCode || currentCode === previewCode;
        if (autoGenerate && ruleCode && useAutoCode) {
          try {
            const codeResponse = await generateCode({ rule_code: ruleCode, entity_type: 'process_route' });
            finalCode = codeResponse?.code ?? finalCode;
          } catch {
            if (previewCode) finalCode = previewCode;
          }
        }
      }

      const submitData = {
        code: finalCode,
        name: standardValues.name.trim(),
        description: standardValues.description?.trim() || null,
        is_active: standardValues.isActive ?? true,
        allow_operation_jump: !!standardValues.allowOperationJump,
        over_report_mode: standardValues.overReportMode ?? 'none',
        over_report_value: Number(standardValues.overReportValue) || 0,
        operation_sequence: operationSequenceData,
      };

      if (isEdit && editUuid) {
        await processRouteApi.update(editUuid, submitData as ProcessRouteUpdate);
        messageApi.success(t('app.master-data.routes.updateSuccess'));
        const updated = await processRouteApi.get(editUuid);
        await saveCustomFieldValues(updated.id, customData);
        onSuccess(updated);
      } else {
        const created = await processRouteApi.create(submitData as ProcessRouteCreate);
        await saveCustomFieldValues(created.id, customData);
        messageApi.success(t('app.master-data.routes.createSuccess'));
        onSuccess(created);
      }

      onClose();
      formRef.current?.resetFields();
      setPreviewCode(null);
      setOperationSequence([]);
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
    setOperationSequence([]);
    resetFieldValues();
  };

  return (
    <FormModalTemplate
      title={isEdit ? t('field.route.editTitle') : t('field.route.createTitle')}
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
      className="process-route-modal"
      zIndex={zIndex}
    >
      <style>{`
        .process-route-modal .modal-content-scroll { overflow-x: auto; }
        .process-route-modal .operation-sequence-form-item .ant-form-item-control-input { padding-left: 8px; padding-right: 8px; width: 100%; min-width: 0; }
        .process-route-modal .operation-sequence-form-item .ant-form-item-control-input-content { width: 100%; min-width: 0; }
        .process-route-modal .operation-sequence-form-item .ant-form-item-label { padding-left: 8px; }
      `}</style>
      <SchemaFormRenderer
        schema={routeFormSchema.filter((f) => ['code', 'name'].includes(f.name))}
        codeField="code"
        codeAutoGenerated={isAutoGenerateEnabled(PAGE_CODE)}
        codeAutoGeneratedKey="field.route.codeAutoGenerated"
        isEdit={isEdit}
      />
      <CustomFieldsFormSection customFields={customFields} customFieldValues={customFieldValues} gridColumns={2} />
      <ProForm.Item
        label={t('field.route.operationSequence')}
        colProps={{ span: 24 }}
        className="operation-sequence-form-item"
        style={{ width: '100%', minWidth: 0 }}
      >
        <div style={{ width: '100%', minWidth: 0 }}>
          <div style={{ marginBottom: 16 }}>
            <Tag color={operationSequence.length > 0 ? 'processing' : 'default'}>
              {t('app.master-data.operationsConfigured', { count: operationSequence.length })}
            </Tag>
          </div>
          <ProFormDependency name={['allowOperationJump']}>
            {({ allowOperationJump }) => (
              <OperationSequenceEditor
                value={operationSequence}
                onChange={setOperationSequence}
                showNodeOperationColumn={!!allowOperationJump}
                nestedModalZIndex={operationPickModalZIndex}
                onPickModalOpenChange={setPickModalOpen}
              />
            )}
          </ProFormDependency>
        </div>
      </ProForm.Item>
      <SchemaFormRenderer
        schema={routeFormSchema.filter((f) =>
          [
            'allowOperationJump',
            'overReportMode',
            'overReportValue',
            'description',
            'isActive',
          ].includes(f.name)
        )}
        isEdit={isEdit}
      />
    </FormModalTemplate>
  );
};
