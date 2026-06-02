import React from 'react';
import { ProFormUploadButton } from '@ant-design/pro-components';
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
  label = '附件',
  max = 10,
  name = 'attachments',
}) => (
  <ProFormUploadButton
    name={name}
    label={label}
    max={max}
    fieldProps={{
      multiple: true,
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

export default DocumentAttachmentsField;
