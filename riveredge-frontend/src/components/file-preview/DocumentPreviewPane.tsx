import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Spin, Table, Tabs } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  getFileExt,
  isAudioFile,
  isSpreadsheetFile,
  isTextFile,
  isVideoFile,
  type FilePreviewSource,
} from '../../utils/filePreviewKind';

const TEXT_PREVIEW_MAX_BYTES = 512 * 1024;
const SPREADSHEET_MAX_ROWS = 500;

type SheetData = {
  name: string;
  rows: string[][];
};

export interface DocumentPreviewPaneProps {
  fileUrl: string;
  fileSource: FilePreviewSource;
  height?: string | number;
}

function normalizeRow(row: unknown, columnCount: number): string[] {
  const arr = Array.isArray(row) ? row : [];
  return Array.from({ length: columnCount }, (_, i) => {
    const v = arr[i];
    return v === null || v === undefined ? '' : String(v);
  });
}

function trimTrailingEmptyRows(rows: unknown[][]): unknown[][] {
  let end = rows.length;
  while (end > 0) {
    const row = rows[end - 1];
    const hasValue = row?.some((cell) => String(cell ?? '').trim() !== '');
    if (hasValue) break;
    end -= 1;
  }
  return rows.slice(0, end);
}

function formatTextContent(text: string, source: FilePreviewSource): string {
  const ext = getFileExt(source);
  const mime = (source.fileType ?? '').toLowerCase();
  if (ext === 'json' || mime.includes('json')) {
    try {
      return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      return text;
    }
  }
  return text;
}

async function decodeTextPreview(buffer: ArrayBuffer): Promise<{ text: string; truncated: boolean }> {
  const slice = buffer.byteLength > TEXT_PREVIEW_MAX_BYTES
    ? buffer.slice(0, TEXT_PREVIEW_MAX_BYTES)
    : buffer;
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const text = decoder.decode(slice);
  return {
    text,
    truncated: buffer.byteLength > TEXT_PREVIEW_MAX_BYTES,
  };
}

async function parseSpreadsheet(buffer: ArrayBuffer): Promise<SheetData[]> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(buffer, { type: 'array' });
  return workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    const raw = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
      raw: false,
    }) as unknown[][];
    const trimmed = trimTrailingEmptyRows(raw);
    const columnCount = trimmed.length
      ? Math.max(1, ...trimmed.map((row) => (Array.isArray(row) ? row.length : 0)))
      : 1;
    const rows = trimmed.map((row) => normalizeRow(row, columnCount));
    return { name, rows };
  });
}

export const DocumentPreviewPane: React.FC<DocumentPreviewPaneProps> = ({
  fileUrl,
  fileSource,
  height = '72vh',
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [textContent, setTextContent] = useState('');
  const [textTruncated, setTextTruncated] = useState(false);
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [rowsTruncated, setRowsTruncated] = useState(false);
  const [activeSheet, setActiveSheet] = useState('0');

  const isSpreadsheet = isSpreadsheetFile(fileSource);
  const isText = isTextFile(fileSource) && !isSpreadsheet;
  const isVideo = isVideoFile(fileSource);
  const isAudio = isAudioFile(fileSource);

  const resolvedHeight = typeof height === 'number' ? `${height}px` : height;

  useEffect(() => {
    if (!fileUrl || isVideo || isAudio) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError('');
      setTextContent('');
      setTextTruncated(false);
      setSheets([]);
      setRowsTruncated(false);

      try {
        const response = await fetch(fileUrl, { method: 'GET' });
        if (!response.ok) {
          throw new Error(`${response.status}`);
        }
        const buffer = await response.arrayBuffer();

        if (cancelled) return;

        if (isSpreadsheet) {
          const parsed = await parseSpreadsheet(buffer);
          if (parsed.length === 0) {
            throw new Error(t('pages.system.files.previewSheetEmpty'));
          }
          const limited = parsed.map((sheet) => {
            if (sheet.rows.length > SPREADSHEET_MAX_ROWS) {
              setRowsTruncated(true);
              return { ...sheet, rows: sheet.rows.slice(0, SPREADSHEET_MAX_ROWS) };
            }
            return sheet;
          });
          setSheets(limited);
          setActiveSheet('0');
          return;
        }

        if (isText) {
          const { text, truncated } = await decodeTextPreview(buffer);
          setTextContent(formatTextContent(text, fileSource));
          setTextTruncated(truncated);
          return;
        }

        throw new Error(t('app.master-data.drawings.previewUnsupported'));
      } catch (e: unknown) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : t('pages.system.files.previewLoadFailed');
          setError(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [fileUrl, fileSource, isSpreadsheet, isText, isVideo, isAudio, t]);

  const sheetTabs = useMemo(
    () =>
      sheets.map((sheet, index) => {
        const colCount = sheet.rows.length
          ? Math.max(...sheet.rows.map((row) => row.length))
          : 1;
        const columns = Array.from({ length: colCount }, (_, colIndex) => ({
          title: String(colIndex + 1),
          dataIndex: colIndex,
          key: colIndex,
          ellipsis: true,
          width: 120,
          render: (value: string) => value || ' ',
        }));
        const dataSource = sheet.rows.map((row, rowIndex) => {
          const record: Record<string, string> = { key: String(rowIndex) };
          row.forEach((cell, colIndex) => {
            record[colIndex] = cell;
          });
          return record;
        });

        return {
          key: String(index),
          label: sheet.name,
          children: (
            <Table
              size="small"
              bordered
              pagination={false}
              scroll={{ x: 'max-content', y: `calc(${resolvedHeight} - 120px)` }}
              columns={columns}
              dataSource={dataSource}
            />
          ),
        };
      }),
    [sheets, resolvedHeight],
  );

  if (isVideo) {
    return (
      <div
        style={{
          minHeight: resolvedHeight,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#000',
        }}
      >
        <video
          controls
          src={fileUrl}
          style={{ maxWidth: '100%', maxHeight: resolvedHeight }}
        >
          <track kind="captions" />
        </video>
      </div>
    );
  }

  if (isAudio) {
    return (
      <div
        style={{
          minHeight: resolvedHeight,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <audio controls src={fileUrl} style={{ width: '100%' }}>
          <track kind="captions" />
        </audio>
      </div>
    );
  }

  if (loading) {
    return (
      <div
        style={{
          minHeight: resolvedHeight,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Spin tip={t('pages.system.files.previewLoading')}>
          <div style={{ minHeight: 24 }} />
        </Spin>
      </div>
    );
  }

  if (error) {
    return <Alert type="error" title={error} showIcon style={{ margin: 16 }} />;
  }

  if (isSpreadsheet && sheets.length > 0) {
    return (
      <div style={{ padding: '8px 12px 12px' }}>
        {rowsTruncated ? (
          <Alert
            type="info"
            showIcon
            message={t('pages.system.files.previewRowsTruncated', { count: SPREADSHEET_MAX_ROWS })}
            style={{ marginBottom: 8 }}
          />
        ) : null}
        {sheets.length === 1 ? (
          sheetTabs[0].children
        ) : (
          <Tabs activeKey={activeSheet} items={sheetTabs} onChange={setActiveSheet} />
        )}
      </div>
    );
  }

  if (isText) {
    return (
      <div style={{ padding: 12 }}>
        {textTruncated ? (
          <Alert
            type="info"
            showIcon
            message={t('pages.system.files.previewTextTruncated')}
            style={{ marginBottom: 8 }}
          />
        ) : null}
        <pre
          style={{
            margin: 0,
            padding: 12,
            maxHeight: `calc(${resolvedHeight} - 48px)`,
            overflow: 'auto',
            background: 'var(--ant-color-fill-quaternary, #fafafa)',
            borderRadius: 6,
            fontSize: 13,
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {textContent}
        </pre>
      </div>
    );
  }

  return (
    <Alert
      type="warning"
      showIcon
      message={t('app.master-data.drawings.previewUnsupported')}
      style={{ margin: 16 }}
    />
  );
};
