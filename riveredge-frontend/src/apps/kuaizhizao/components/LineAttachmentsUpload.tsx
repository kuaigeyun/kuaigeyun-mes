/**
 * 明细行级图片上传（picture-card），写入 attachments [{uid,name,status,url}]
 * 预览/缩略图必须走鉴权 URL；上传后先用本地 blob 立即显示，再后台换鉴权地址。
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { App, Upload } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd/es/upload/interface';
import { useTranslation } from 'react-i18next';
import {
  buildImageUploadFileUrls,
  getFileDownloadUrlWithToken,
  FILE_IMAGE_SIZE_UPLOAD_THUMB,
  uploadMultipleFiles,
} from '../../../services/file';
import { SecureImage } from '../../../components/secure-image';
import {
  buildDocumentAttachmentUploadHandlers,
  mapAttachmentsToUploadList,
  normalizeDocumentAttachments,
  resolveDocumentAttachmentFileUuid,
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

type ResolvedUrls = { thumbUrl?: string; url?: string; local?: boolean };

export const LineAttachmentsUpload: React.FC<Props> = ({
  value,
  onChange,
  category,
  maxCount = 4,
  disabled,
  readOnly,
}) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [resolvedUrls, setResolvedUrls] = useState<Record<string, ResolvedUrls>>({});
  const blobUrlsRef = useRef<Set<string>>(new Set());

  const revokeBlob = (url?: string) => {
    if (!url || !url.startsWith('blob:')) return;
    if (blobUrlsRef.current.has(url)) {
      URL.revokeObjectURL(url);
      blobUrlsRef.current.delete(url);
    }
  };

  useEffect(() => {
    return () => {
      for (const url of blobUrlsRef.current) {
        URL.revokeObjectURL(url);
      }
      blobUrlsRef.current.clear();
    };
  }, []);

  const baseList = useMemo(
    () => mapAttachmentsToUploadList(value) as UploadFile[],
    [value],
  );
  const uidsKey = baseList
    .map((f) => resolveDocumentAttachmentFileUuid(f) || String(f.uid || ''))
    .filter(Boolean)
    .join(',');

  useEffect(() => {
    let cancelled = false;
    const pending = baseList
      .map((f) => resolveDocumentAttachmentFileUuid(f) || String(f.uid || '').trim())
      .filter((uid) => {
        if (!uid) return false;
        const cur = resolvedUrls[uid];
        // 已有非本地鉴权地址则跳过；本地 blob 仅作占位，后台仍可升级
        return !cur || cur.local;
      });
    if (!pending.length) return;

    void (async () => {
      // 先拉小缩略图，尽快出图；再补中等预览图
      const thumbEntries = await Promise.all(
        pending.map(async (uid) => {
          try {
            const thumbUrl = await getFileDownloadUrlWithToken(uid, {
              size: FILE_IMAGE_SIZE_UPLOAD_THUMB,
            });
            return [uid, thumbUrl] as const;
          } catch {
            return [uid, ''] as const;
          }
        }),
      );
      if (cancelled) return;
      setResolvedUrls((prev) => {
        const next = { ...prev };
        for (const [uid, thumbUrl] of thumbEntries) {
          if (!thumbUrl) continue;
          const old = next[uid];
          if (old?.local) revokeBlob(old.thumbUrl);
          next[uid] = {
            thumbUrl,
            url: old?.local ? thumbUrl : old?.url || thumbUrl,
            local: false,
          };
        }
        return next;
      });

      const fullEntries = await Promise.all(
        pending.map(async (uid) => {
          try {
            return [uid, await buildImageUploadFileUrls(uid)] as const;
          } catch {
            return null;
          }
        }),
      );
      if (cancelled) return;
      setResolvedUrls((prev) => {
        const next = { ...prev };
        for (const entry of fullEntries) {
          if (!entry) continue;
          const [uid, urls] = entry;
          next[uid] = { ...urls, local: false };
        }
        return next;
      });
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uidsKey]);

  const attachmentUploadHandlers = useMemo(
    () =>
      buildDocumentAttachmentUploadHandlers({
        onOpenFailed: () =>
          message.error(
            t('components.documentAttachments.openFailed', {
              defaultValue: '打开附件失败',
            }),
          ),
      }),
    [message, t],
  );

  const fileList: UploadFile[] = useMemo(
    () =>
      baseList.map((f) => {
        const uid = resolveDocumentAttachmentFileUuid(f) || String(f.uid || '');
        const resolved = uid ? resolvedUrls[uid] : undefined;
        return {
          ...f,
          uid: uid || f.uid,
          thumbUrl: resolved?.thumbUrl || f.thumbUrl,
          url: resolved?.url || resolved?.thumbUrl || f.url,
        };
      }),
    [baseList, resolvedUrls],
  );

  if (readOnly) {
    if (!fileList.length) return <span>—</span>;
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {fileList.map((f) => {
          const uid = resolveDocumentAttachmentFileUuid(f) || String(f.uid || '').trim();
          if (!uid) return null;
          return (
            <SecureImage
              key={uid}
              fileUuid={uid}
              width={40}
              height={40}
              thumbSize={64}
              previewSize={512}
              style={{ objectFit: 'cover', borderRadius: 4 }}
            />
          );
        })}
      </div>
    );
  }

  const customRequest: UploadProps['customRequest'] = async (options) => {
    const raw = options.file as File;
    const localUrl = URL.createObjectURL(raw);
    blobUrlsRef.current.add(localUrl);
    try {
      const res = await uploadMultipleFiles([raw], { category });
      const uploaded = res[0];
      // 先回写成功，立刻用本地 blob 显示，不阻塞等服务端压缩预览
      if (uploaded?.uuid) {
        setResolvedUrls((prev) => ({
          ...prev,
          [uploaded.uuid]: { thumbUrl: localUrl, url: localUrl, local: true },
        }));
        void buildImageUploadFileUrls(uploaded.uuid)
          .then((urls) => {
            setResolvedUrls((prev) => ({
              ...prev,
              [uploaded.uuid]: { ...urls, local: false },
            }));
            revokeBlob(localUrl);
          })
          .catch(() => {
            /* 保留本地 blob，预览仍可用；点眼睛走鉴权 open */
          });
      } else {
        revokeBlob(localUrl);
      }
      options.onSuccess?.(uploaded, options.file as any);
    } catch (err) {
      revokeBlob(localUrl);
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
      showUploadList={{ showPreviewIcon: true, showRemoveIcon: !disabled }}
      {...attachmentUploadHandlers}
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
