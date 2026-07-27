/**
 * 明细行级图片上传（picture-card），写入 attachments [{uid,name,status,url}]
 */
import React, { useMemo } from 'react';
import { Upload } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd/es/upload/interface';
import { uploadMultipleFiles } from '../../../services/file';
import { SecureImage } from '../../../components/secure-image';
import {
  mapAttachmentsToUploadList,
  normalizeDocumentAttachments,
  type DocumentAttachmentFile,
} from '../utils/documentAttachments';

type Props = {
  value?: DocumentAttachmentFile[] | null;
  onChange?: (next: DocumentAttachmentFile[]) => void;
  category: string;
  maxCount?: number;
  disabled?: boolean;
  /** 只读预览（详情） */
  readOnly?: boolean;
};

export const LineAttachmentsUpload: React.FC<Props> = ({
  value,
  onChange,
  category,
  maxCount = 4,
  disabled,
  readOnly,
}) => {
  const fileList = useMemo(
    () => mapAttachmentsToUploadList(value) as UploadFile[],
    [value],
  );

  if (readOnly) {
    if (!fileList.length) return <span>—</span>;
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {fileList.map((f) => {
          const uid = String(f.uid || '').trim();
          if (!uid) return null;
          return (
            <SecureImage
              key={uid}
              fileUuid={uid}
              width={40}
              height={40}
              thumbSize={64}
              style={{ objectFit: 'cover', borderRadius: 4 }}
            />
          );
        })}
      </div>
    );
  }

  const customRequest: UploadProps['customRequest'] = async (options) => {
    try {
      const res = await uploadMultipleFiles([options.file as File], { category });
      options.onSuccess?.(res[0], options.file as any);
    } catch (err) {
      options.onError?.(err as Error);
    }
  };

  return (
    <Upload
      listType="picture-card"
      accept="image/*"
      multiple
      maxCount={maxCount}
      disabled={disabled}
      fileList={fileList}
      customRequest={customRequest}
      onChange={({ fileList: next }) => {
        onChange?.(normalizeDocumentAttachments(next as DocumentAttachmentFile[]));
      }}
    >
      {fileList.length >= maxCount ? null : (
        <div>
          <PlusOutlined />
          <div style={{ marginTop: 4, fontSize: 12 }}>上传</div>
        </div>
      )}
    </Upload>
  );
};

export default LineAttachmentsUpload;
