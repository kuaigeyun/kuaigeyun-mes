import React, { useEffect, useState } from 'react';
import { Upload } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { uploadMultipleFiles, buildImageUploadFileUrls } from '../../../services/file';
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
  const [resolvedUrls, setResolvedUrls] = useState<Record<string, { thumbUrl?: string; url?: string }>>({});
  const photoUidsKey = (value ?? []).map((f) => f.uid).filter(Boolean).join(',');

  useEffect(() => {
    let cancelled = false;
    const photos = value ?? [];
    const pending = photos.filter((f) => f.uid && !resolvedUrls[f.uid]);
    if (!pending.length) return;

    void (async () => {
      const entries = await Promise.all(
        pending.map(async (f) => {
          const uid = String(f.uid);
          try {
            const urls = await buildImageUploadFileUrls(uid);
            return [uid, urls] as const;
          } catch {
            return [uid, { thumbUrl: f.url, url: f.url }] as const;
          }
        }),
      );
      if (cancelled) return;
      setResolvedUrls((prev) => {
        const next = { ...prev };
        for (const [uid, urls] of entries) {
          next[uid] = urls;
        }
        return next;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [photoUidsKey, value, resolvedUrls]);

  const fileList = (value ?? []).map((f, idx) => {
    const uid = f.uid || String(idx);
    const resolved = f.uid ? resolvedUrls[f.uid] : undefined;
    return {
      uid,
      name: f.name || t('app.kuaizhizao.quality.template.stepPhoto'),
      status: 'done' as const,
      thumbUrl: resolved?.thumbUrl || f.url,
      url: resolved?.url || f.url,
    };
  });

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
          const urls = await buildImageUploadFileUrls(uploaded.uuid);
          setResolvedUrls((prev) => ({
            ...prev,
            [uploaded.uuid]: urls,
          }));
          const next: PhotoFile = {
            uid: uploaded.uuid,
            name: uploaded.original_name,
            status: 'done',
            url: urls.url,
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
