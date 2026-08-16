/**
 * 轻办公单文件字段：上传后存 file_uuid
 */
import React, { useEffect, useState } from 'react';
import { Upload } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import { UploadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import {
  customFieldFileValueToUploadFiles,
  extractUploadFileUuids,
  normalizeUploadFileList,
} from '../../../components/custom-fields/customFieldFileUtils';
import { uploadFile } from '../../../services/file';

type Props = {
  value?: string | UploadFile[] | null;
  onChange?: (value: UploadFile[]) => void;
  disabled?: boolean;
};

const OaSingleFileField: React.FC<Props> = ({ value, onChange, disabled }) => {
  const { t } = useTranslation();
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const list = normalizeUploadFileList(value);
      if (list.length) {
        if (!cancelled) setFileList(list);
        return;
      }
      const files = await customFieldFileValueToUploadFiles(value);
      if (!cancelled) setFileList(files.slice(0, 1));
    })();
    return () => {
      cancelled = true;
    };
  }, [value]);

  return (
    <Upload
      maxCount={1}
      fileList={fileList}
      disabled={disabled}
      onChange={({ fileList: next }) => {
        const trimmed = next.slice(-1);
        setFileList(trimmed);
        onChange?.(trimmed);
      }}
      customRequest={async ({ file, onSuccess, onError }) => {
        try {
          const res = await uploadFile(file as File);
          const uuid = res.uuid;
          const done: UploadFile = {
            uid: uuid,
            name: (file as File).name,
            status: 'done',
            response: { uuid },
          };
          setFileList([done]);
          onChange?.([done]);
          onSuccess?.(res);
        } catch (error) {
          onError?.(error as Error);
        }
      }}
    >
      <button type="button" disabled={disabled} style={{ border: 0, background: 'none', padding: 0 }}>
        <UploadOutlined /> {t('app.kuaioa.common.uploadFile')}
      </button>
    </Upload>
  );
};

export function extractOaSingleFileUuid(value: unknown): string | null {
  const uuids = extractUploadFileUuids(normalizeUploadFileList(value));
  return uuids[0] ?? null;
}

export default OaSingleFileField;
