/**
 * 工程图纸批量上传：多文件一次创建多条草稿图纸。
 */

import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ProFormSelect, ProFormUploadDragger, ProFormInstance } from '@ant-design/pro-components';
import { App, Progress, Upload } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import type { UploadChangeParam, UploadFile } from 'antd/es/upload/interface';
import { FormModalTemplate } from '../../../components/layout-templates';
import { MODAL_CONFIG } from '../../../components/layout-templates/constants';
import { drawingApi, DRAWING_TYPE_DICTIONARY_CODE, type EngineeringDrawingCreate } from '../services/drawing';
import { DictionarySelect } from '../../../components/dictionary-select';
import type { DrawingFolder } from '../services/drawingFolder';
import { FolderTreeSelectField } from '../pages/process/drawings/drawingFolderModals';
import { uploadMultipleFiles } from '../../../services/file';
import {
  getBusinessConfig,
  resolveDrawingMaxUploadBytes,
  resolveDrawingMaxUploadSizeMb,
  type BusinessConfig,
} from '../../../services/businessConfig';
import { generateCode, getCodeRulePageConfig } from '../../../services/codeRule';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../utils/codeRulePage';
import { getApiErrorMessage } from '../../../utils/errorHandler';

const PAGE_CODE = 'master-data-process-drawing';
const DRAWING_ACCEPT =
  '.pdf,.dwg,.dxf,.step,.stp,.STEP,.STP,.png,.jpg,.jpeg,.pcbdoc,.schdoc';
const DRAWING_CATEGORY = 'engineering_drawing';

function baseNameFromFileName(fileName: string): string {
  const trimmed = fileName.trim();
  const dot = trimmed.lastIndexOf('.');
  const stem = dot > 0 ? trimmed.slice(0, dot) : trimmed;
  return stem.trim() || trimmed;
}

function sanitizeDrawingCode(raw: string): string {
  const normalized = raw.replace(/[^\w\-.]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  return (normalized || `DRW${Date.now()}`).slice(0, 50);
}

export type DrawingBatchUploadModalProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  folders?: DrawingFolder[];
  defaultFolderUuid?: string | null;
};

export const DrawingBatchUploadModal: React.FC<DrawingBatchUploadModalProps> = ({
  open,
  onClose,
  folders = [],
  defaultFolderUuid,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const formRef = useRef<ProFormInstance>();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [effectiveRuleCode, setEffectiveRuleCode] = useState<string | null>(null);
  const [autoGenerate, setAutoGenerate] = useState(isAutoGenerateEnabled(PAGE_CODE));
  const [businessConfig, setBusinessConfig] = useState<BusinessConfig | null>(null);

  const drawingMaxUploadMb = resolveDrawingMaxUploadSizeMb(businessConfig);
  const drawingMaxUploadBytes = resolveDrawingMaxUploadBytes(businessConfig);

  useEffect(() => {
    if (!open) {
      setProgress(null);
      setBusinessConfig(null);
      return;
    }
    void getBusinessConfig()
      .then(setBusinessConfig)
      .catch(() => setBusinessConfig(null));
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      drawingType: 'part',
      securityLevel: 'internal',
      folderUuid: defaultFolderUuid ?? undefined,
      files: [],
    });
    void (async () => {
      let ruleCode = getPageRuleCode(PAGE_CODE);
      let auto = isAutoGenerateEnabled(PAGE_CODE);
      try {
        const pageConfig = await getCodeRulePageConfig(PAGE_CODE);
        if (pageConfig?.ruleCode) {
          ruleCode = pageConfig.ruleCode;
          auto = !!pageConfig.autoGenerate;
        }
      } catch {
        /* ignore */
      }
      setAutoGenerate(auto);
      setEffectiveRuleCode(ruleCode || null);
    })();
  }, [open, defaultFolderUuid]);

  const syncFiles = (info: UploadChangeParam) => {
    formRef.current?.setFieldValue('files', info.fileList);
  };

  const resolveCode = async (fileName: string, usedCodes: Set<string>): Promise<string> => {
    const ruleCode = effectiveRuleCode || getPageRuleCode(PAGE_CODE);
    if (autoGenerate && ruleCode) {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const res = await generateCode({ rule_code: ruleCode });
        const code = res.code?.trim();
        if (code && !usedCodes.has(code)) return code;
      }
    }
    let base = sanitizeDrawingCode(baseNameFromFileName(fileName));
    if (!usedCodes.has(base)) return base;
    for (let i = 2; i <= 99; i += 1) {
      const candidate = `${base.slice(0, 46)}_${i}`.slice(0, 50);
      if (!usedCodes.has(candidate)) return candidate;
    }
    return sanitizeDrawingCode(`${base}_${Date.now()}`);
  };

  const handleFinish = async (values: Record<string, unknown>) => {
    const fileList = (values.files as UploadFile[] | undefined) ?? [];
    const pendingFiles = fileList
      .map((item) => item.originFileObj as File | undefined)
      .filter((file): file is File => file instanceof File);
    if (!pendingFiles.length) {
      messageApi.error(t('app.master-data.drawings.batchUploadFilesRequired'));
      return;
    }
    if (fileList.some((item) => item.status === 'uploading')) {
      messageApi.error(t('app.master-data.drawings.fileUploading'));
      return;
    }
    const oversized = pendingFiles.find((file) => file.size > drawingMaxUploadBytes);
    if (oversized) {
      messageApi.error(
        t('components.fileUpload.sizeExceeded', { size: drawingMaxUploadMb }),
      );
      return;
    }

    const drawingType = (values.drawingType as EngineeringDrawingCreate['drawingType']) || 'part';
    const securityLevel =
      (values.securityLevel as EngineeringDrawingCreate['securityLevel']) || 'internal';
    const folderUuid = (values.folderUuid as string | undefined) ?? defaultFolderUuid ?? null;

    setLoading(true);
    setProgress({ done: 0, total: pendingFiles.length });
    const usedCodes = new Set<string>();
    let success = 0;
    let failed = 0;
    let lastError: unknown = null;

    try {
      for (let index = 0; index < pendingFiles.length; index += 1) {
        const file = pendingFiles[index];
        try {
          const uploaded = await uploadMultipleFiles([file], { category: DRAWING_CATEGORY });
          const fileUuid = uploaded[0]?.uuid;
          if (!fileUuid) {
            throw new Error(t('app.master-data.drawings.batchUploadFileFailed'));
          }
          const name = baseNameFromFileName(file.name);
          const code = await resolveCode(file.name, usedCodes);
          usedCodes.add(code);
          await drawingApi.create({
            code,
            name: name.slice(0, 200),
            revision: 'A',
            drawingType,
            fileUuid,
            folderUuid,
            securityLevel,
          });
          success += 1;
        } catch (error) {
          failed += 1;
          lastError = error;
        } finally {
          setProgress({ done: index + 1, total: pendingFiles.length });
        }
      }

      if (success > 0) {
        messageApi.success(t('app.master-data.drawings.batchUploadSuccess', { count: success }));
        onSuccess();
        onClose();
        formRef.current?.resetFields();
      }
      if (failed > 0) {
        messageApi.warning(
          getApiErrorMessage(
            lastError,
            t('app.master-data.drawings.batchUploadPartial', { count: failed }),
          ),
        );
      }
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  const handleClose = () => {
    if (loading) return;
    onClose();
    formRef.current?.resetFields();
    setProgress(null);
  };

  return (
    <FormModalTemplate
      title={t('app.master-data.drawings.batchUploadTitle')}
      open={open}
      onClose={handleClose}
      onFinish={handleFinish}
      loading={loading}
      width={MODAL_CONFIG.STANDARD_WIDTH}
      formRef={formRef as React.RefObject<ProFormInstance>}
      layout="vertical"
      grid
      initialValues={{ drawingType: 'part', securityLevel: 'internal' }}
    >
      <DictionarySelect
        name="drawingType"
        label={t('app.master-data.drawings.type')}
        dictionaryCode={DRAWING_TYPE_DICTIONARY_CODE}
        required
        simpleQuickCreate
        formRef={formRef}
        hostResource="master-data:process:drawing"
        colProps={{ span: 12 }}
      />
      <ProFormSelect
        name="securityLevel"
        label={t('app.master-data.drawings.securityLevel')}
        rules={[{ required: true }]}
        options={[
          { label: t('app.master-data.drawings.securityLevel.public'), value: 'public' },
          { label: t('app.master-data.drawings.securityLevel.internal'), value: 'internal' },
          { label: t('app.master-data.drawings.securityLevel.secret'), value: 'secret' },
          { label: t('app.master-data.drawings.securityLevel.confidential'), value: 'confidential' },
        ]}
        colProps={{ span: 12 }}
      />
      <FolderTreeSelectField folders={folders} />
      <ProFormUploadDragger
        name="files"
        label={t('app.master-data.drawings.batchUploadFiles')}
        rules={[{ required: true, message: t('app.master-data.drawings.batchUploadFilesRequired') }]}
        icon={<InboxOutlined />}
        description={t('app.master-data.drawings.uploadDragSubHintWithLimit', {
          maxMb: drawingMaxUploadMb,
        })}
        fieldProps={{
          accept: DRAWING_ACCEPT,
          multiple: true,
          beforeUpload: (file) => {
            if (file.size > drawingMaxUploadBytes) {
              messageApi.error(
                t('components.fileUpload.sizeExceeded', { size: drawingMaxUploadMb }),
              );
              return Upload.LIST_IGNORE;
            }
            return false;
          },
          onChange: syncFiles,
          listType: 'text',
        }}
        colProps={{ span: 24 }}
      />
      {progress ? (
        <div style={{ gridColumn: '1 / -1', marginTop: 8 }}>
          <Progress
            percent={Math.round((progress.done / progress.total) * 100)}
            status={loading ? 'active' : 'normal'}
            format={() => `${progress.done}/${progress.total}`}
          />
        </div>
      ) : null}
    </FormModalTemplate>
  );
};

export default DrawingBatchUploadModal;
