/**
 * 从工程图纸库选取可用于气泡标注的图片文件。
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Empty, Input, Modal, Spin, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  drawingApi,
  type EngineeringDrawing,
  type FileBrief,
} from '../../../../master-data/services/drawing';
import { getFileDownloadUrlWithToken } from '../../../../../services/file';
import { toRelativeIfLocalhost } from '../../../../../utils/avatar';

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp']);

export type FaiDrawingPickResult = {
  fileUuid: string;
  fileName: string;
  drawingCode: string;
  drawingName: string;
  drawingRevision: string;
};

export type FaiDrawingPickerModalProps = {
  open: boolean;
  onCancel: () => void;
  onSelect: (picked: FaiDrawingPickResult) => void | Promise<void>;
  currentFileUuid?: string;
};

type PickItem = FaiDrawingPickResult & {
  key: string;
  previewUrl?: string;
};

function fileExt(file: FileBrief): string {
  const fromField = String(file.fileExtension || '').replace(/^\./, '').toLowerCase();
  if (fromField) return fromField;
  const name = String(file.originalName || '');
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
}

function isImageBrief(file: FileBrief | null | undefined): file is FileBrief {
  if (!file?.uuid) return false;
  return IMAGE_EXTS.has(fileExt(file));
}

function collectImageItems(drawings: EngineeringDrawing[]): PickItem[] {
  const out: PickItem[] = [];
  for (const d of drawings) {
    const files: FileBrief[] = [];
    if (isImageBrief(d.file)) files.push(d.file);
    for (const f of d.supplementaryFiles || []) {
      if (isImageBrief(f)) files.push(f);
    }
    for (const f of files) {
      out.push({
        key: `${d.uuid}:${f.uuid}`,
        fileUuid: f.uuid,
        fileName: f.originalName || d.name,
        drawingCode: d.code,
        drawingName: d.name,
        drawingRevision: d.revision,
        previewUrl: f.previewUrl,
      });
    }
  }
  return out;
}

export const FaiDrawingPickerModal: React.FC<FaiDrawingPickerModalProps> = ({
  open,
  onCancel,
  onSelect,
  currentFileUuid,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [items, setItems] = useState<PickItem[]>([]);
  const [previewMap, setPreviewMap] = useState<Record<string, string>>({});

  const loadItems = useCallback(
    async (q?: string) => {
      setLoading(true);
      try {
        const res = await drawingApi.list({
          skip: 0,
          limit: 100,
          view: 'current',
          keyword: q?.trim() || undefined,
          sortBy: 'updated_at',
          sortOrder: 'desc',
        });
        setItems(collectImageItems(res.data ?? []));
      } catch (error: any) {
        messageApi.error(error?.message || t('app.kuaizhizao.quality.fai.balloon.messages.pickDrawingLoadFailed'));
        setItems([]);
      } finally {
        setLoading(false);
      }
    },
    [messageApi, t],
  );

  useEffect(() => {
    if (!open) return;
    setKeyword('');
    void loadItems();
  }, [open, loadItems]);

  useEffect(() => {
    if (!open || items.length === 0) return;
    let cancelled = false;
    (async () => {
      const next: Record<string, string> = {};
      await Promise.all(
        items.map(async (item) => {
          if (item.previewUrl) {
            next[item.fileUuid] = toRelativeIfLocalhost(item.previewUrl);
            return;
          }
          try {
            const url = await getFileDownloadUrlWithToken(item.fileUuid);
            if (url) next[item.fileUuid] = url;
          } catch {
            /* ignore preview miss */
          }
        }),
      );
      if (!cancelled) setPreviewMap(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [items, open]);

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) =>
      `${item.drawingCode} ${item.drawingName} ${item.drawingRevision} ${item.fileName}`
        .toLowerCase()
        .includes(q),
    );
  }, [items, keyword]);

  const handlePick = async (item: PickItem) => {
    if (selecting) return;
    setSelecting(true);
    try {
      await onSelect({
        fileUuid: item.fileUuid,
        fileName: item.fileName,
        drawingCode: item.drawingCode,
        drawingName: item.drawingName,
        drawingRevision: item.drawingRevision,
      });
    } finally {
      setSelecting(false);
    }
  };

  return (
    <Modal
      title={t('app.kuaizhizao.quality.fai.balloon.pickDrawingTitle')}
      open={open}
      onCancel={onCancel}
      footer={null}
      width={820}
      destroyOnHidden
      mask={{ closable: !selecting }}
    >
      <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
        {t('app.kuaizhizao.quality.fai.balloon.pickDrawingHint')}
      </Typography.Paragraph>
      <Input.Search
        allowClear
        placeholder={t('app.kuaizhizao.quality.fai.balloon.pickDrawingSearch')}
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        onSearch={(v) => void loadItems(v)}
        style={{ marginBottom: 12 }}
      />
      <Spin
        spinning={loading || selecting}
        description={selecting ? t('app.kuaizhizao.quality.fai.balloon.pickDrawingApplying') : undefined}
      >
        {!loading && filtered.length === 0 ? (
          <Empty description={t('app.kuaizhizao.quality.fai.balloon.pickDrawingEmpty')} />
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: 12,
              maxHeight: 440,
              overflowY: 'auto',
              padding: '4px 2px 8px',
            }}
          >
            {filtered.map((item) => {
              const preview = previewMap[item.fileUuid];
              const selected = Boolean(currentFileUuid && currentFileUuid === item.fileUuid);
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => void handlePick(item)}
                  disabled={selecting}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    gap: 8,
                    padding: 10,
                    borderRadius: 8,
                    border: selected
                      ? '2px solid var(--ant-color-primary, #1677ff)'
                      : '1px solid var(--ant-color-border-secondary, #d9d9d9)',
                    background: 'var(--ant-color-bg-container, #fff)',
                    cursor: selecting ? 'wait' : 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div
                    style={{
                      height: 96,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'var(--ant-color-fill-quaternary, #f5f5f5)',
                      borderRadius: 6,
                      overflow: 'hidden',
                    }}
                  >
                    {preview ? (
                      <img
                        src={preview}
                        alt={item.fileName}
                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                      />
                    ) : (
                      <Typography.Text type="secondary">IMG</Typography.Text>
                    )}
                  </div>
                  <Typography.Text strong ellipsis style={{ fontSize: 12 }}>
                    {item.drawingCode}
                  </Typography.Text>
                  <Typography.Text type="secondary" ellipsis style={{ fontSize: 12 }}>
                    {item.drawingName} / {item.drawingRevision}
                  </Typography.Text>
                  <Typography.Text type="secondary" ellipsis style={{ fontSize: 11 }}>
                    {item.fileName}
                  </Typography.Text>
                </button>
              );
            })}
          </div>
        )}
      </Spin>
    </Modal>
  );
};

export default FaiDrawingPickerModal;
