/**
 * 工序新建/编辑弹窗
 */

import React, { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ProFormInstance } from '@ant-design/pro-components';
import { App } from 'antd';
import { FormModalTemplate } from '../../../components/layout-templates';
import { MODAL_CONFIG } from '../../../components/layout-templates/constants';
import { operationApi, defectTypeApi } from '../services/process';
import { getUserList } from '../../../services/user';
import { testGenerateCode, generateCode } from '../../../services/codeRule';
import { getCodeRulePageConfig } from '../../../services/codeRule';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../utils/codeRulePage';
import type { Operation, OperationCreate, OperationUpdate, DefectTypeMinimal } from '../types/process';
import { SchemaFormRenderer } from '../../../components/schema-form';
import { operationFormSchema } from '../schemas/operation';

const PAGE_CODE = 'master-data-process-operation';

export interface OperationFormModalProps {
  open: boolean;
  onClose: () => void;
  editUuid: string | null;
  onSuccess: (operation: Operation) => void;
}

export const OperationFormModal: React.FC<OperationFormModalProps> = ({
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
  const [defectTypeOptions, setDefectTypeOptions] = useState<{ label: string; value: string }[]>([]);
  const [userOptions, setUserOptions] = useState<{ label: string; value: string }[]>([]);

  const isEdit = Boolean(editUuid);

  const loadFormOptions = async () => {
    try {
      const [defectsRes, usersRes] = await Promise.all([
        defectTypeApi.list({ limit: 500, isActive: true }),
        getUserList({ is_active: true, page_size: 100 }),
      ]);
      const defects = Array.isArray(defectsRes) ? defectsRes : (defectsRes?.data ?? []);
      setDefectTypeOptions(
        defects.map((d) => ({ label: `${d.code} ${d.name}`, value: d.uuid }))
      );
      const items = usersRes?.items || [];
      setUserOptions(
        items.map((u: any) => ({
          label: (u.full_name || u.username || u.uuid) as string,
          value: u.uuid as string,
        }))
      );
    } catch (e) {
      console.warn('加载不良品项/用户选项失败:', e);
    }
  };

  useEffect(() => {
    if (!open) return;
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      isActive: true,
      reportingType: 'quantity',
      allowJump: false,
    });
    loadFormOptions();

    if (!editUuid) {
      let ruleCode: string | undefined;
      let autoGenerate = false;
      const initValues = { isActive: true, reportingType: 'quantity', allowJump: false };
      (async () => {
        try {
          const pageConfig = await getCodeRulePageConfig(PAGE_CODE);
          ruleCode = pageConfig?.ruleCode;
          autoGenerate = !!(pageConfig?.autoGenerate && ruleCode);
        } catch {
          ruleCode = getPageRuleCode(PAGE_CODE);
          autoGenerate = isAutoGenerateEnabled(PAGE_CODE);
        }
        if (autoGenerate && ruleCode) {
          testGenerateCode({ rule_code: ruleCode })
            .then((res) => {
              const previewCodeValue = (res?.code ?? '').trim();
              setPreviewCode(previewCodeValue || null);
              formRef.current?.setFieldsValue({
                ...initValues,
                ...(previewCodeValue ? { code: previewCodeValue } : {}),
              });
              if (!previewCodeValue) {
                messageApi.info('未获取到工序编码预览，请检查「编码规则」中是否已为当前组织配置并启用「工序管理」规则；也可直接手动输入编码。');
              }
            })
            .catch(() => {
              setPreviewCode(null);
              formRef.current?.setFieldsValue(initValues);
              messageApi.info('自动编码获取失败，请手动输入工序编码，或在「编码规则」中配置「工序管理」后重试。');
            });
        } else {
          setPreviewCode(null);
          formRef.current?.setFieldsValue(initValues);
        }
      })();
      return;
    }

    setPreviewCode(null);
    operationApi
      .get(editUuid)
      .then((detail) => {
        const dts = detail.defectTypes ?? detail.defect_types ?? [];
        const defectTypeUuids = Array.isArray(dts) ? dts.map((d: DefectTypeMinimal) => d.uuid) : [];
        const defaultOperatorUuids = detail.defaultOperatorUuids ?? detail.default_operator_uuids ?? [];
        const defaultOperatorUuidsArr = Array.isArray(defaultOperatorUuids) ? defaultOperatorUuids : [];
        formRef.current?.setFieldsValue({
          code: detail.code,
          name: detail.name,
          description: detail.description,
          reportingType: detail.reportingType || 'quantity',
          allowJump: detail.allowJump ?? false,
          isActive: detail.isActive ?? true,
          defectTypeUuids: defectTypeUuids.length ? defectTypeUuids : undefined,
          defaultOperatorUuids: defaultOperatorUuidsArr.length ? defaultOperatorUuidsArr : undefined,
        });
      })
      .catch((err: any) => {
        messageApi.error(err?.message || '获取工序详情失败');
      });
  }, [open, editUuid]);

  const handleSubmit = async (values: any) => {
    try {
      setFormLoading(true);
      const formValues = formRef.current?.getFieldsValue?.() ?? {};
      const defectTypeUuids = Array.isArray(formValues.defectTypeUuids) ? formValues.defectTypeUuids : (Array.isArray(values?.defectTypeUuids) ? values.defectTypeUuids : []);
      const defaultOperatorUuids = Array.isArray(formValues.defaultOperatorUuids) ? formValues.defaultOperatorUuids : (Array.isArray(values?.defaultOperatorUuids) ? values.defaultOperatorUuids : []);

      if (isEdit && editUuid) {
        const updatePayload: OperationUpdate = {
          ...formValues,
          ...values,
          defectTypeUuids,
          defaultOperatorUuids,
        };
        await operationApi.update(editUuid, updatePayload);
        messageApi.success('更新成功');
        const updated = await operationApi.get(editUuid);
        onSuccess(updated);
      } else {
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
        if (autoGenerate && ruleCode) {
          const currentCode = values.code?.trim?.() ?? '';
          const useAutoCode = !currentCode || currentCode === previewCode;
          if (useAutoCode) {
            try {
              const codeResponse = await generateCode({ rule_code: ruleCode });
              values.code = codeResponse.code;
            } catch {
              if (previewCode) values.code = previewCode;
            }
          }
        }
        if (!values.code?.trim?.()) {
          messageApi.error('工序编码不能为空');
          return;
        }
        const createPayload: OperationCreate = {
          ...formValues,
          ...values,
          defectTypeUuids,
          defaultOperatorUuids,
        };
        const created = await operationApi.create(createPayload);
        messageApi.success('创建成功');
        onSuccess(created);
      }
      onClose();
      formRef.current?.resetFields();
      setPreviewCode(null);
    } catch (error: any) {
      messageApi.error(error?.message || (isEdit ? '更新失败' : '创建失败'));
    } finally {
      setFormLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
    formRef.current?.resetFields();
    setPreviewCode(null);
  };

  const optionsMap: Record<string, Array<{ value: any; label: string }>> = {
    defectTypeUuids: defectTypeOptions,
    defaultOperatorUuids: userOptions,
  };

  return (
    <FormModalTemplate
      title={isEdit ? t('field.operation.editTitle') : t('field.operation.createTitle')}
      open={open}
      onClose={handleClose}
      onFinish={handleSubmit}
      isEdit={isEdit}
      loading={formLoading}
      width={MODAL_CONFIG.STANDARD_WIDTH}
      formRef={formRef as React.RefObject<ProFormInstance>}
      initialValues={{ isActive: true, reportingType: 'quantity', allowJump: false }}
      layout="vertical"
      grid
    >
      <SchemaFormRenderer
        schema={operationFormSchema}
        codeField="code"
        codeAutoGenerated={isAutoGenerateEnabled(PAGE_CODE)}
        codeAutoGeneratedKey="field.operation.codeAutoGenerated"
        isEdit={isEdit}
        optionsMap={optionsMap}
      />
    </FormModalTemplate>
  );
};
