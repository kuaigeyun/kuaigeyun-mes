import React, { useMemo } from 'react';
import { InboxOutlined } from '@ant-design/icons';
import { ProFormUploadDragger } from '@ant-design/pro-components';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import { uploadMultipleFiles } from '../../../services/file';
import { buildDocumentAttachmentUploadHandlers } from '../utils/documentAttachments';

interface DocumentAttachmentsFieldProps {
  /** 上传分类，如 sales_order_attachments */
  category: string;
  /** 表单项标签；外层已有「附件」板块标题时可传 false 隐藏 */
  label?: React.ReactNode | false;
  max?: number;
  name?: string;
}

export const DocumentAttachmentsField: React.FC<DocumentAttachmentsFieldProps> = ({
  category,
  label,
  max = 10,
  name = 'attachments',
}) => {
  const { t } = useTranslation();
  const { message } = App.useApp();

  const attachmentUploadHandlers = useMemo(
    () =>
      buildDocumentAttachmentUploadHandlers({
        onOpenFailed: () => message.error(t('components.documentAttachments.openFailed')),
      }),
    [message, t],
  );

  return (
    <ProFormUploadDragger
      name={name}
      label={label === undefined ? t('components.documentAttachments.label') : label}
      max={max}
      colProps={{ span: 24 }}
      icon={<InboxOutlined />}
      title={t('components.documentAttachments.dragHint')}
      description={t('components.documentAttachments.dragSubHint', { max })}
      fieldProps={{
        multiple: true,
        style: { width: '100%' },
        showUploadList: { showPreviewIcon: true, showDownloadIcon: true },
        ...attachmentUploadHandlers,
        customRequest: async (options) => {
          try {
            const res = await uploadMultipleFiles([options.file as File], { category });
            options.onSuccess?.(res[0], options.file as any);
          } catch (err) {
            options.onError?.(err as Error);
          }
        },
      }}
    />
  );
};

export default DocumentAttachmentsField;
