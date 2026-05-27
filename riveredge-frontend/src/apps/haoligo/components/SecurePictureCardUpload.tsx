import React, { useEffect, useState } from 'react';
import { Upload } from 'antd';
import type { UploadFile, UploadProps } from 'antd/es/upload/interface';

import { normUploadUuids } from '../pages/patrol/shared/uploadHelpers';
import { uuidsToSecureUploadFileList } from '../utils/secureUploadFileList';
import { withMoldPictureCardUploadClass } from '../utils/moldPictureCardUpload';

type SecurePictureCardUploadProps = Omit<UploadProps, 'fileList' | 'onChange'> & {
  uuids?: string[] | null;
  onUuidsChange?: (uuids: string[]) => void;
};

/** picture-card 上传/回显：缩略图使用带 token URL，避免鉴权失败裂图 */
export function SecurePictureCardUpload({
  uuids,
  onUuidsChange,
  disabled,
  className,
  children,
  ...rest
}: SecurePictureCardUploadProps) {
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const uuidKey = (uuids ?? []).join(',');

  useEffect(() => {
    let cancelled = false;
    void uuidsToSecureUploadFileList(uuids ?? undefined).then((fl) => {
      if (!cancelled) setFileList(fl);
    });
    return () => {
      cancelled = true;
    };
  }, [uuidKey]);

  const merged = withMoldPictureCardUploadClass({
    listType: 'picture-card',
    ...rest,
    className,
    disabled,
    fileList,
    onChange: ({ fileList: fl }) => {
      setFileList(fl);
      onUuidsChange?.(normUploadUuids(fl));
    },
  });

  return (
    <Upload {...merged}>
      {disabled ? null : children ?? '+'}
    </Upload>
  );
}
