import React from 'react';
import { InboxOutlined } from '@ant-design/icons';
import { ProFormUploadDragger } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import { uploadMultipleFiles } from '../../../services/file';

interface DocumentAttachmentsFieldProps {
  /** 上传分类，如 sales_order_attachments */
  category: string;
  label?: string;
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

  return (
    <ProFormUploadDragger
      name={name}
      label={label ?? t('components.documentAttachments.label')}
      max={max}
      colProps={{ span: 24 }}
      icon={<InboxOutlined />}
      title={t('components.documentAttachments.dragHint')}
      description={t('components.documentAttachments.dragSubHint', { max })}
      fieldProps={{
        multiple: true,
        style: { width: '100%' },
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
