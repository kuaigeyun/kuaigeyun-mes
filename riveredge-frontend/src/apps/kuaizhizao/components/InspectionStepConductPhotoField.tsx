import React from 'react';
import { Upload } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { uploadMultipleFiles } from '../../../services/file';
import { getFileDownloadUrl } from '../../../services/file';
import type { StepConductEntry } from '../types/inspectionStepSpec';

type PhotoFile = NonNullable<StepConductEntry['photos']>[number];

type Props = {
  value?: PhotoFile[];
  onChange?: (files: PhotoFile[]) => void;
  category: string;
  required?: boolean;
  label?: string;
};

export const InspectionStepConductPhotoField: React.FC<Props> = ({
  value,
  onChange,
  category,
  required,
  label,
}) => {
  const { t } = useTranslation();
  const fileList = (value ?? []).map((f, idx) => ({
    uid: f.uid || String(idx),
    name: f.name || t('app.kuaizhizao.quality.template.stepPhoto'),
    status: 'done' as const,
    url: f.url || (f.uid ? getFileDownloadUrl(f.uid) : undefined),
  }));

  return (
    <Upload
      listType="picture-card"
      fileList={fileList}
      accept="image/*"
      maxCount={5}
      customRequest={async (options) => {
        try {
          const res = await uploadMultipleFiles([options.file as File], { category });
          const uploaded = res[0];
          const next: PhotoFile = {
            uid: uploaded.uuid,
            name: uploaded.original_name,
            status: 'done',
            url: getFileDownloadUrl(uploaded.uuid),
          };
          onChange?.([...(value ?? []), next]);
          options.onSuccess?.(uploaded, options.file as File);
        } catch (err) {
          options.onError?.(err as Error);
        }
      }}
      onRemove={(file) => {
        onChange?.((value ?? []).filter((f) => f.uid !== file.uid));
        return true;
      }}
    >
      {fileList.length >= 5 ? null : (
        <div>
          <PlusOutlined />
          <div style={{ marginTop: 8 }}>
            {required
              ? t('app.kuaizhizao.quality.template.stepPhotoRequired', {
                  label: label || t('app.kuaizhizao.quality.template.stepPhoto'),
                })
              : t('app.kuaizhizao.quality.template.stepPhoto')}
          </div>
        </div>
      )}
    </Upload>
  );
};

export default InspectionStepConductPhotoField;
