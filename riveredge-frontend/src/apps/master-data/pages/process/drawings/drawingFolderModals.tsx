/**
 * 图纸仓库：新建/重命名文件夹、图纸移入仓库
 */

import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ProFormText, ProFormTreeSelect, type ProFormInstance } from '@ant-design/pro-components';
import { App } from 'antd';
import { FormModalTemplate } from '../../../../../components/layout-templates';
import { MODAL_CONFIG } from '../../../../../components/layout-templates/constants';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import {
  drawingFolderApi,
  type DrawingFolder,
  type DrawingFolderCreate,
} from '../../../services/drawingFolder';
import { drawingApi } from '../../../services/drawing';

export function foldersToTreeSelect(folders: DrawingFolder[]): { title: string; value: string; children?: { title: string; value: string }[] }[] {
  return folders.map((folder) => ({
    title: folder.name,
    value: folder.uuid,
    children: folder.children?.length ? foldersToTreeSelect(folder.children) : undefined,
  }));
}

type FolderFormModalProps = {
  open: boolean;
  mode: 'create' | 'rename';
  parentUuid?: string | null;
  folderUuid?: string | null;
  initialName?: string;
  onClose: () => void;
  onSuccess: () => void;
};

export const DrawingFolderFormModal: React.FC<FolderFormModalProps> = ({
  open,
  mode,
  parentUuid,
  folderUuid,
  initialName,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const formRef = useRef<ProFormInstance>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    formRef.current?.setFieldsValue({ name: initialName ?? '' });
  }, [open, initialName]);

  const handleFinish = async (values: { name: string }) => {
    try {
      setLoading(true);
      if (mode === 'rename' && folderUuid) {
        await drawingFolderApi.update(folderUuid, { name: values.name });
      } else {
        const payload: DrawingFolderCreate = { name: values.name };
        if (parentUuid) payload.parentUuid = parentUuid;
        await drawingFolderApi.create(payload);
      }
      messageApi.success(mode === 'rename' ? t('common.updateSuccess') : t('common.createSuccess'));
      onSuccess();
      onClose();
    } catch (error) {
      messageApi.error(getApiErrorMessage(error, mode === 'rename' ? t('common.updateFailed') : t('common.createFailed')));
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormModalTemplate
      title={
        mode === 'rename'
          ? t('app.master-data.drawings.folder.rename')
          : t('app.master-data.drawings.folder.create')
      }
      open={open}
      onClose={onClose}
      onFinish={handleFinish}
      isEdit={mode === 'rename'}
      loading={loading}
      width={MODAL_CONFIG.SMALL_WIDTH}
      formRef={formRef as React.RefObject<ProFormInstance>}
      layout="vertical"
    >
      <ProFormText
        name="name"
        label={t('app.master-data.drawings.folder.name')}
        rules={[{ required: true }]}
        fieldProps={{ maxLength: 100 }}
      />
    </FormModalTemplate>
  );
};

type MoveFolderModalProps = {
  open: boolean;
  drawingUuid: string | null;
  folders: DrawingFolder[];
  currentFolderUuid?: string | null;
  onClose: () => void;
  onSuccess: () => void;
};

export const DrawingMoveFolderModal: React.FC<MoveFolderModalProps> = ({
  open,
  drawingUuid,
  folders,
  currentFolderUuid,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const formRef = useRef<ProFormInstance>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    formRef.current?.setFieldsValue({ folderUuid: currentFolderUuid ?? undefined });
  }, [open, currentFolderUuid]);

  const handleFinish = async (values: { folderUuid?: string }) => {
    if (!drawingUuid) return;
    try {
      setLoading(true);
      await drawingApi.moveFolder(drawingUuid, values.folderUuid ?? null);
      messageApi.success(t('app.master-data.drawings.folder.moveSuccess'));
      onSuccess();
      onClose();
    } catch (error) {
      messageApi.error(getApiErrorMessage(error, t('common.operationFailed')));
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormModalTemplate
      title={t('app.master-data.drawings.folder.move')}
      open={open}
      onClose={onClose}
      onFinish={handleFinish}
      isEdit
      loading={loading}
      width={MODAL_CONFIG.SMALL_WIDTH}
      formRef={formRef as React.RefObject<ProFormInstance>}
      layout="vertical"
    >
      <ProFormTreeSelect
        name="folderUuid"
        label={t('app.master-data.drawings.folder')}
        allowClear
        fieldProps={{
          treeData: foldersToTreeSelect(folders),
          treeDefaultExpandAll: true,
          showSearch: true,
          treeNodeFilterProp: 'title',
          placeholder: t('app.master-data.drawings.tree.unclassified'),
          popupMatchSelectWidth: true,
        }}
      />
    </FormModalTemplate>
  );
};

export function FolderTreeSelectField({
  folders,
  name = 'folderUuid',
}: {
  folders: DrawingFolder[];
  name?: string;
}) {
  const { t } = useTranslation();
  return (
    <ProFormTreeSelect
      name={name}
      label={t('app.master-data.drawings.folder')}
      allowClear
      colProps={{ span: 12 }}
      fieldProps={{
        treeData: foldersToTreeSelect(folders),
        treeDefaultExpandAll: true,
        showSearch: true,
        treeNodeFilterProp: 'title',
        placeholder: t('app.master-data.drawings.tree.unclassified'),
        popupMatchSelectWidth: true,
      }}
    />
  );
}
