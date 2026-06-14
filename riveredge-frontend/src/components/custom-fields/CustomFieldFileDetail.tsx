/**
 * 自定义字段详情：图片/附件展示
 */

import React, { useEffect, useState } from 'react';
import { Space, Typography } from 'antd';
import { SecureImage } from '../secure-image';
import { getFileByUuid, getFileDownloadUrlWithToken } from '../../services/file';
import { normalizeCustomFieldFileUuids } from './customFieldFileUtils';

interface CustomFieldFileDetailProps {
  value: unknown;
  image?: boolean;
}

export const CustomFieldFileDetail: React.FC<CustomFieldFileDetailProps> = ({
  value,
  image = false,
}) => {
  const uuids = normalizeCustomFieldFileUuids(value);
  const [fileNames, setFileNames] = useState<Record<string, string>>({});
  const [fileUrls, setFileUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const names: Record<string, string> = {};
      const urls: Record<string, string> = {};
      await Promise.all(
        uuids.map(async (uuid) => {
          try {
            const meta = await getFileByUuid(uuid);
            names[uuid] = meta.original_name || meta.name || uuid;
            if (!image) {
              urls[uuid] = await getFileDownloadUrlWithToken(uuid);
            }
          } catch {
            names[uuid] = uuid;
          }
        }),
      );
      if (!cancelled) {
        setFileNames(names);
        setFileUrls(urls);
      }
    };
    if (uuids.length > 0) void load();
    else {
      setFileNames({});
      setFileUrls({});
    }
    return () => {
      cancelled = true;
    };
  }, [uuids.join(','), image]);

  if (uuids.length === 0) {
    return <Typography.Text type="secondary">-</Typography.Text>;
  }

  if (image) {
    return (
      <Space wrap size={8}>
        {uuids.map((uuid) => (
          <SecureImage
            key={uuid}
            fileUuid={uuid}
            width={64}
            height={64}
            style={{ objectFit: 'cover', borderRadius: 4 }}
          />
        ))}
      </Space>
    );
  }

  return (
    <Space orientation="vertical" size={4}>
      {uuids.map((uuid) => (
        <Typography.Link key={uuid} href={fileUrls[uuid]} target="_blank" rel="noopener noreferrer">
          {fileNames[uuid] ?? uuid}
        </Typography.Link>
      ))}
    </Space>
  );
};
