import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  App,
  Alert,
  Button,
  Empty,
  Input,
  InputNumber,
  Space,
  Table,
  Upload,
  theme,
} from 'antd';
import { useTranslation } from 'react-i18next';
import { DeleteOutlined } from '@ant-design/icons';
import { getAntdModal } from '../../../../../utils/antdAppApis';
import { getFileDownloadUrlWithToken, uploadFile } from '../../../../../services/file';
import { useThemeStore } from '../../../../../stores/themeStore';
import { faiOrderApi, FaiBalloonCandidate, FaiOrder } from '../../../services/fai-order';
import FaiDrawingPickerModal from './FaiDrawingPickerModal';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isFileUuid(value?: string | null): boolean {
  return !!value && UUID_RE.test(value.trim());
}

function createBalloonId(): string {
  return `bl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeCandidates(raw: unknown[]): FaiBalloonCandidate[] {
  return (raw || [])
    .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
    .map((row, idx) => {
      const name = String(row.characteristic_name || row.characteristicName || '').trim();
      const x = Number(row.x);
      const y = Number(row.y);
      return {
        id: String(row.id || createBalloonId()),
        balloon_no: String(row.balloon_no || row.balloonNo || idx + 1),
        characteristic_name: name || `特性${idx + 1}`,
        nominal_value: row.nominal_value != null ? Number(row.nominal_value) : null,
        upper_tolerance: row.upper_tolerance != null ? Number(row.upper_tolerance) : null,
        lower_tolerance: row.lower_tolerance != null ? Number(row.lower_tolerance) : null,
        unit: row.unit != null ? String(row.unit) : undefined,
        remarks: row.remarks != null ? String(row.remarks) : undefined,
        x: Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0.85,
        y: Number.isFinite(y) ? Math.min(1, Math.max(0, y)) : Math.min(0.12 + idx * 0.08, 0.9),
        anchor_x: row.anchor_x != null && Number.isFinite(Number(row.anchor_x)) ? Number(row.anchor_x) : undefined,
        anchor_y: row.anchor_y != null && Number.isFinite(Number(row.anchor_y)) ? Number(row.anchor_y) : undefined,
        source: (row.source as FaiBalloonCandidate['source']) || 'manual',
      };
    });
}

export type FaiBalloonEditorProps = {
  order: FaiOrder;
  editable: boolean;
  onClose: () => void;
  onApplied: (order: FaiOrder) => void;
};

export const FaiBalloonEditor: React.FC<FaiBalloonEditorProps> = ({
  order,
  editable,
  onClose,
  onApplied,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const { token } = theme.useToken();
  const isDark = useThemeStore((s) => s.resolved.isDark);
  const stageRef = useRef<HTMLDivElement>(null);
  const [drawingRef, setDrawingRef] = useState(order.drawing_file_url || '');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageNatural, setImageNatural] = useState<{ w: number; h: number } | null>(null);
  const [candidates, setCandidates] = useState<FaiBalloonCandidate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [placeMode, setPlaceMode] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [drawingPickerOpen, setDrawingPickerOpen] = useState(false);
  const dragRef = useRef<{ id: string; moved: boolean } | null>(null);

  useEffect(() => {
    setDrawingRef(order.drawing_file_url || '');
    setCandidates(normalizeCandidates(order.balloon_candidates || []));
    setSelectedId(null);
    setPlaceMode(true);
  }, [order.id, order.drawing_file_url, order.balloon_candidates]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const ref = (drawingRef || '').trim();
      if (!ref) {
        setImageUrl(null);
        return;
      }
      try {
        if (isFileUuid(ref)) {
          const url = await getFileDownloadUrlWithToken(ref.trim());
          if (!cancelled) setImageUrl(url);
        } else if (/^https?:\/\//i.test(ref) || ref.startsWith('/')) {
          if (!cancelled) setImageUrl(ref);
        } else {
          if (!cancelled) setImageUrl(null);
        }
      } catch {
        if (!cancelled) {
          setImageUrl(null);
          messageApi.error(t('app.kuaizhizao.quality.fai.balloon.messages.drawingLoadFailed'));
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [drawingRef, messageApi, t]);

  const selected = useMemo(
    () => candidates.find((c) => c.id === selectedId) || null,
    [candidates, selectedId],
  );

  const updateCandidate = (id: string, patch: Partial<FaiBalloonCandidate>) => {
    setCandidates((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const addAtNormalized = useCallback(
    (nx: number, ny: number) => {
      if (!editable) return;
      const nextNo = String(candidates.length + 1);
      const item: FaiBalloonCandidate = {
        id: createBalloonId(),
        balloon_no: nextNo,
        characteristic_name: `${t('app.kuaizhizao.quality.fai.characteristicName')}${nextNo}`,
        x: Math.min(1, Math.max(0, nx)),
        y: Math.min(1, Math.max(0, ny)),
        source: 'manual',
      };
      setCandidates((prev) => [...prev, item]);
      setSelectedId(item.id!);
    },
    [candidates.length, editable, t],
  );

  const clientToNormalized = (clientX: number, clientY: number) => {
    const el = stageRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return {
      x: Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)),
    };
  };

  const onStageClick = (e: React.MouseEvent) => {
    if (!editable || !placeMode || !imageUrl) return;
    if (dragRef.current?.moved) return;
    const pt = clientToNormalized(e.clientX, e.clientY);
    if (!pt) return;
    addAtNormalized(pt.x, pt.y);
  };

  const onBalloonPointerDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    setSelectedId(id);
    if (!editable) return;
    dragRef.current = { id, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onBalloonPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current || !editable) return;
    const pt = clientToNormalized(e.clientX, e.clientY);
    if (!pt) return;
    dragRef.current.moved = true;
    updateCandidate(dragRef.current.id, { x: pt.x, y: pt.y });
  };

  const onBalloonPointerUp = () => {
    dragRef.current = null;
  };

  const handleUploadDrawing = async (file: File) => {
    if (!editable) return false;
    try {
      const uploaded = await uploadFile(file, { category: 'fai-drawing', description: `FAI ${order.fai_code}` });
      setDrawingRef(uploaded.uuid);
      const updated = await faiOrderApi.saveBalloonCandidates(order.id, candidates, uploaded.uuid);
      onApplied(updated);
      messageApi.success(t('app.kuaizhizao.quality.fai.balloon.messages.drawingUploaded'));
    } catch (err: any) {
      messageApi.error(err?.message || t('app.kuaizhizao.quality.fai.balloon.messages.drawingUploadFailed'));
    }
    return false;
  };

  const handlePickFromDrawingLibrary = async (picked: {
    fileUuid: string;
    drawingCode: string;
    drawingRevision: string;
  }) => {
    if (!editable) return;
    try {
      setDrawingRef(picked.fileUuid);
      const updated = await faiOrderApi.update(order.id, {
        drawing_file_url: picked.fileUuid,
        drawing_no: picked.drawingCode,
        drawing_revision: picked.drawingRevision,
      });
      const withCandidates = await faiOrderApi.saveBalloonCandidates(
        order.id,
        candidates,
        picked.fileUuid,
      );
      onApplied({
        ...updated,
        ...withCandidates,
        drawing_file_url: picked.fileUuid,
        drawing_no: picked.drawingCode,
        drawing_revision: picked.drawingRevision,
      });
      setDrawingPickerOpen(false);
      messageApi.success(t('app.kuaizhizao.quality.fai.balloon.messages.pickDrawingSuccess'));
    } catch (err: any) {
      messageApi.error(err?.message || t('app.kuaizhizao.quality.fai.balloon.messages.drawingUploadFailed'));
    }
  };

  const handleOcr = async (file?: File) => {
    if (!editable) return;
    setOcrLoading(true);
    try {
      let blob: Blob | File | null = file || null;
      if (!blob) {
        if (!imageUrl) {
          messageApi.warning(t('app.kuaizhizao.quality.fai.balloon.messages.needDrawing'));
          return;
        }
        const res = await fetch(imageUrl);
        blob = await res.blob();
      }
      const result = await faiOrderApi.balloonOcr(order.id, blob, true);
      const next = normalizeCandidates(result.candidates || []);
      setCandidates(next);
      if (next[0]?.id) setSelectedId(next[0].id);
      onApplied({
        ...order,
        balloon_candidates: next,
        drawing_file_url: drawingRef || order.drawing_file_url,
      });
      messageApi.success(
        t('app.kuaizhizao.quality.fai.balloon.messages.ocrSuccess', { count: next.length }),
      );
    } catch (err: any) {
      messageApi.error(err?.message || t('app.kuaizhizao.quality.fai.balloon.messages.ocrFailed'));
    } finally {
      setOcrLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await faiOrderApi.saveBalloonCandidates(order.id, candidates, drawingRef || undefined);
      onApplied(updated);
      messageApi.success(t('app.kuaizhizao.quality.fai.messages.candidatesSaved'));
    } catch (err: any) {
      messageApi.error(err?.message || t('app.kuaizhizao.quality.fai.balloon.messages.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleConfirm = () => {
    if (!candidates.length) {
      messageApi.warning(t('app.kuaizhizao.quality.fai.balloon.messages.emptyCandidates'));
      return;
    }
    getAntdModal().confirm({
      title: t('app.kuaizhizao.quality.fai.confirmBalloonsTitle'),
      content: t('app.kuaizhizao.quality.fai.confirmBalloonsContent'),
      onOk: async () => {
        setSaving(true);
        try {
          await faiOrderApi.saveBalloonCandidates(order.id, candidates, drawingRef || undefined);
          const updated = await faiOrderApi.confirmBalloons(order.id, candidates, true);
          onApplied(updated);
          messageApi.success(t('app.kuaizhizao.quality.fai.messages.balloonsConfirmed'));
          onClose();
        } catch (err: any) {
          messageApi.error(err?.message || t('app.kuaizhizao.quality.fai.balloon.messages.confirmFailed'));
        } finally {
          setSaving(false);
        }
      },
    });
  };

  const columns = [
    {
      title: t('app.kuaizhizao.quality.fai.balloonNo'),
      dataIndex: 'balloon_no',
      width: 72,
      render: (_: unknown, row: FaiBalloonCandidate) =>
        editable ? (
          <Input
            size="small"
            value={row.balloon_no}
            onChange={(e) => updateCandidate(row.id!, { balloon_no: e.target.value })}
          />
        ) : (
          row.balloon_no
        ),
    },
    {
      title: t('app.kuaizhizao.quality.fai.characteristicName'),
      dataIndex: 'characteristic_name',
      render: (_: unknown, row: FaiBalloonCandidate) =>
        editable ? (
          <Input
            size="small"
            value={row.characteristic_name}
            onChange={(e) => updateCandidate(row.id!, { characteristic_name: e.target.value })}
          />
        ) : (
          row.characteristic_name
        ),
    },
    {
      title: t('app.kuaizhizao.quality.fai.nominal'),
      dataIndex: 'nominal_value',
      width: 88,
      render: (_: unknown, row: FaiBalloonCandidate) =>
        editable ? (
          <InputNumber
            size="small"
            style={{ width: '100%' }}
            value={row.nominal_value ?? undefined}
            onChange={(v) => updateCandidate(row.id!, { nominal_value: v == null ? null : Number(v) })}
          />
        ) : (
          row.nominal_value
        ),
    },
    {
      title: t('app.kuaizhizao.quality.fai.upperTol'),
      dataIndex: 'upper_tolerance',
      width: 80,
      render: (_: unknown, row: FaiBalloonCandidate) =>
        editable ? (
          <InputNumber
            size="small"
            style={{ width: '100%' }}
            value={row.upper_tolerance ?? undefined}
            onChange={(v) => updateCandidate(row.id!, { upper_tolerance: v == null ? null : Number(v) })}
          />
        ) : (
          row.upper_tolerance
        ),
    },
    {
      title: t('app.kuaizhizao.quality.fai.lowerTol'),
      dataIndex: 'lower_tolerance',
      width: 80,
      render: (_: unknown, row: FaiBalloonCandidate) =>
        editable ? (
          <InputNumber
            size="small"
            style={{ width: '100%' }}
            value={row.lower_tolerance ?? undefined}
            onChange={(v) => updateCandidate(row.id!, { lower_tolerance: v == null ? null : Number(v) })}
          />
        ) : (
          row.lower_tolerance
        ),
    },
    {
      title: t('common.actions'),
      key: 'operation',
      width: 48,
      align: 'center' as const,
      render: (_: unknown, row: FaiBalloonCandidate) =>
        editable ? (
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            aria-label={t('common.delete')}
            onClick={() => {
              setCandidates((prev) => prev.filter((c) => c.id !== row.id));
              if (selectedId === row.id) setSelectedId(null);
            }}
          />
        ) : null,
    },
  ];

  return (
    <div
      className="kuaiiot-fai-balloon-page"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        gap: 12,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          flexShrink: 0,
        }}
      >
        <Space wrap>
          <Button disabled={!editable} onClick={() => setDrawingPickerOpen(true)}>
            {t('app.kuaizhizao.quality.fai.balloon.pickDrawing')}
          </Button>
          <Upload
            accept="image/png,image/jpeg,image/webp"
            showUploadList={false}
            disabled={!editable}
            beforeUpload={handleUploadDrawing}
          >
            <Button disabled={!editable}>{t('app.kuaizhizao.quality.fai.balloon.uploadDrawing')}</Button>
          </Upload>
          <Upload
            accept="image/png,image/jpeg,image/webp"
            showUploadList={false}
            disabled={!editable}
            beforeUpload={(file) => {
              void handleOcr(file);
              return false;
            }}
          >
            <Button disabled={!editable} loading={ocrLoading}>
              {t('app.kuaizhizao.quality.fai.balloon.ocrFromFile')}
            </Button>
          </Upload>
          <Button
            disabled={!editable || !imageUrl}
            loading={ocrLoading}
            onClick={() => void handleOcr()}
          >
            {t('app.kuaizhizao.quality.fai.balloon.ocrCurrent')}
          </Button>
          <Button
            disabled={!editable}
            type={placeMode ? 'primary' : 'default'}
            onClick={() => setPlaceMode((v) => !v)}
          >
            {placeMode
              ? t('app.kuaizhizao.quality.fai.balloon.placeModeOn')
              : t('app.kuaizhizao.quality.fai.balloon.placeModeOff')}
          </Button>
          <span style={{ color: token.colorTextSecondary }}>
            {editable
              ? t('app.kuaizhizao.quality.fai.balloon.hint')
              : t('app.kuaizhizao.quality.fai.balloon.readOnlyHint')}
          </span>
        </Space>
        <Space wrap>
          <Button onClick={onClose}>{t('common.back')}</Button>
          {editable ? (
            <>
              <Button loading={saving} onClick={handleSave}>
                {t('app.kuaizhizao.quality.fai.saveCandidates')}
              </Button>
              <Button type="primary" loading={saving} onClick={handleConfirm}>
                {t('app.kuaizhizao.quality.fai.confirmBalloons')}
              </Button>
            </>
          ) : null}
        </Space>
      </div>

      {!editable ? (
        <Alert
          type="info"
          showIcon
          style={{ flexShrink: 0 }}
          title={t('app.kuaizhizao.quality.fai.balloon.readOnlyTitle')}
        />
      ) : null}

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.4fr) minmax(320px, 1fr)',
          gap: 16,
        }}
      >
        <div
          ref={stageRef}
          onClick={onStageClick}
          style={{
            position: 'relative',
            minHeight: 0,
            height: '100%',
            overflow: 'auto',
            border: `1px solid ${token.colorBorder}`,
            borderRadius: token.borderRadiusLG ?? 8,
            background: isDark ? token.colorFillSecondary : token.colorFillQuaternary,
            cursor: editable && placeMode ? 'crosshair' : 'default',
          }}
        >
          {!imageUrl ? (
            <div style={{ padding: 48 }}>
              <Empty description={t('app.kuaizhizao.quality.fai.balloon.noDrawing')} />
            </div>
          ) : (
            <div style={{ position: 'relative', display: 'inline-block', minWidth: '100%' }}>
              <img
                src={imageUrl}
                alt="drawing"
                style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
                onLoad={(e) => {
                  const img = e.currentTarget;
                  setImageNatural({ w: img.naturalWidth, h: img.naturalHeight });
                }}
                draggable={false}
              />
              <svg
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
                viewBox={imageNatural ? `0 0 ${imageNatural.w} ${imageNatural.h}` : '0 0 100 100'}
                preserveAspectRatio="none"
              >
                {candidates.map((c) => {
                  if (c.x == null || c.y == null || !imageNatural) return null;
                  const bx = c.x * imageNatural.w;
                  const by = c.y * imageNatural.h;
                  const ax = (c.anchor_x ?? c.x) * imageNatural.w;
                  const ay = (c.anchor_y ?? c.y) * imageNatural.h;
                  const active = c.id === selectedId;
                  const r = Math.max(imageNatural.w, imageNatural.h) * 0.018;
                  return (
                    <g key={c.id}>
                      <line
                        x1={ax}
                        y1={ay}
                        x2={bx}
                        y2={by}
                        stroke={active ? '#1677ff' : '#fa541c'}
                        strokeWidth={Math.max(1.5, r * 0.12)}
                      />
                      <circle
                        cx={bx}
                        cy={by}
                        r={r}
                        fill={active ? '#1677ff' : '#fa541c'}
                        stroke="#fff"
                        strokeWidth={Math.max(1, r * 0.1)}
                        style={{ pointerEvents: 'auto', cursor: editable ? 'grab' : 'pointer' }}
                        onPointerDown={(e) => onBalloonPointerDown(e as any, c.id!)}
                        onPointerMove={onBalloonPointerMove as any}
                        onPointerUp={onBalloonPointerUp}
                      />
                      <text
                        x={bx}
                        y={by}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill="#fff"
                        fontSize={r * 0.95}
                        fontWeight={700}
                        style={{ pointerEvents: 'none' }}
                      >
                        {c.balloon_no}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          )}
        </div>

        <div style={{ minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <Table
            size="small"
            pagination={false}
            rowKey={(r) => r.id || r.balloon_no || String(Math.random())}
            dataSource={candidates}
            columns={columns as any}
            scroll={{ y: 'calc(100vh - 320px)', x: 480 }}
            onRow={(row) => ({
              onClick: () => setSelectedId(row.id || null),
              style: row.id === selectedId ? { background: 'var(--ant-color-primary-bg)' } : undefined,
            })}
          />
          {selected && editable ? (
            <div style={{ marginTop: 12, flexShrink: 0 }}>
              <div style={{ marginBottom: 4 }}>{t('app.kuaizhizao.quality.fai.balloon.anchorHint')}</div>
              <Space>
                <Button
                  size="small"
                  onClick={() => {
                    if (selected.x == null || selected.y == null) return;
                    updateCandidate(selected.id!, {
                      anchor_x: selected.x,
                      anchor_y: selected.y,
                    });
                    messageApi.info(t('app.kuaizhizao.quality.fai.balloon.messages.setAnchorNext'));
                    setPlaceMode(false);
                  }}
                >
                  {t('app.kuaizhizao.quality.fai.balloon.useBalloonAsAnchor')}
                </Button>
                <Button
                  size="small"
                  onClick={() => {
                    const el = stageRef.current;
                    if (!el) return;
                    const once = (ev: MouseEvent) => {
                      el.removeEventListener('click', once, true);
                      const pt = clientToNormalized(ev.clientX, ev.clientY);
                      if (!pt || !selected.id) return;
                      updateCandidate(selected.id, { anchor_x: pt.x, anchor_y: pt.y });
                    };
                    el.addEventListener('click', once, true);
                    messageApi.info(t('app.kuaizhizao.quality.fai.balloon.messages.clickAnchor'));
                  }}
                >
                  {t('app.kuaizhizao.quality.fai.balloon.pickAnchor')}
                </Button>
              </Space>
            </div>
          ) : null}
        </div>
      </div>

      <FaiDrawingPickerModal
        open={drawingPickerOpen}
        currentFileUuid={drawingRef}
        onCancel={() => setDrawingPickerOpen(false)}
        onSelect={handlePickFromDrawingLibrary}
      />
    </div>
  );
};

export default FaiBalloonEditor;
