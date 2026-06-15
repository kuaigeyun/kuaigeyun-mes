import React, { useEffect, useMemo, useState } from 'react';
import { App, Button, Input, Modal, Radio, Space, Tabs, Typography, Upload } from 'antd';
import { DownloadOutlined, InboxOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { downloadImportTemplateXlsx } from '../uni-import/uni-import-xlsx';
import { parseImportXlsxFile } from '../uni-import/uni-import-xlsx';
import {
  dedupeSerialNumbers,
  mergeSerialNumbers,
  parseSerialNumbersFromSheetRows,
  parseSerialNumbersFromText,
  validateSerialNumbersCount,
} from './parseSerialNumbersImport';

const { Dragger } = Upload;
const { TextArea } = Input;

export interface SerialNumbersImportModalProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: (serials: string[]) => void;
  /** 明细行入库数量，用于校验个数 */
  expectedCount?: number;
  initialSerials?: string[];
  materialLabel?: string;
  /** 规则生成（可选） */
  onGenerate?: () => Promise<string[] | void>;
  generateLoading?: boolean;
}

const SerialNumbersImportModal: React.FC<SerialNumbersImportModalProps> = ({
  open,
  onCancel,
  onConfirm,
  expectedCount,
  initialSerials = [],
  materialLabel,
  onGenerate,
  generateLoading = false,
}) => {
  const { message: messageApi } = App.useApp();
  const [pasteText, setPasteText] = useState('');
  const [mergeMode, setMergeMode] = useState<'replace' | 'append'>('replace');
  const [previewSerials, setPreviewSerials] = useState<string[]>([]);
  const [fileLoading, setFileLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('paste');

  useEffect(() => {
    if (!open) return;
    setPasteText(initialSerials.join('\n'));
    setPreviewSerials(dedupeSerialNumbers(initialSerials));
    setMergeMode(initialSerials.length > 0 ? 'append' : 'replace');
    setActiveTab('paste');
  }, [open, initialSerials]);

  const expectedHint = useMemo(() => {
    if (expectedCount == null || !(expectedCount > 0)) return null;
    return `明细数量 ${expectedCount}，建议导入相同个数`;
  }, [expectedCount]);

  const applyPreview = (incoming: string[], source: 'paste' | 'file' | 'generate') => {
    if (source === 'generate') {
      setPreviewSerials(dedupeSerialNumbers(incoming));
      setPasteText(incoming.join('\n'));
      return;
    }
    const base =
      mergeMode === 'append' ? (previewSerials.length > 0 ? previewSerials : initialSerials) : [];
    const merged = mergeSerialNumbers(base, incoming, mergeMode);
    setPreviewSerials(merged);
    setPasteText(merged.join('\n'));
  };

  const handleParsePaste = () => {
    const parsed = parseSerialNumbersFromText(pasteText);
    if (!parsed.length) {
      messageApi.warning('未解析到有效序列号');
      return;
    }
    applyPreview(parsed, 'paste');
    messageApi.success(`已解析 ${parsed.length} 个序列号`);
  };

  const handleReadTextFile = async (file: File) => {
    const text = await file.text();
    return parseSerialNumbersFromText(text);
  };

  const handleReadExcelFile = async (file: File) => {
    const rows = await parseImportXlsxFile(file);
    return parseSerialNumbersFromSheetRows(rows);
  };

  const handleFile = async (file: File) => {
    setFileLoading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      let parsed: string[] = [];
      if (ext === 'xlsx' || ext === 'xls') {
        parsed = await handleReadExcelFile(file);
      } else {
        parsed = await handleReadTextFile(file);
      }
      if (!parsed.length) {
        messageApi.warning('文件中未找到有效序列号');
        return;
      }
      applyPreview(parsed, 'file');
      messageApi.success(`已从文件解析 ${parsed.length} 个序列号`);
    } catch (e: any) {
      messageApi.error(e?.message || '文件解析失败');
    } finally {
      setFileLoading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      await downloadImportTemplateXlsx(['序列号'], ['SN202601010001'], '序列号导入模板');
    } catch (e: any) {
      messageApi.error(e?.message || '模板下载失败');
    }
  };

  const handleGenerate = async () => {
    if (!onGenerate) return;
    try {
      const generated = await onGenerate();
      if (!generated?.length) return;
      applyPreview(generated, 'generate');
      setPasteText(generated.join('\n'));
      messageApi.success(`已生成 ${generated.length} 个序列号`);
    } catch {
      /* 父级已提示 */
    }
  };

  const handleOk = () => {
    const serials = dedupeSerialNumbers(previewSerials.length ? previewSerials : parseSerialNumbersFromText(pasteText));
    if (!serials.length) {
      messageApi.warning('请先粘贴、上传或生成序列号');
      return;
    }
    const check = validateSerialNumbersCount(serials, expectedCount);
    if (!check.ok) {
      messageApi.error(check.message);
      return;
    }
    onConfirm(serials);
  };

  const previewCount = previewSerials.length;
  const countStatus =
    expectedCount != null && expectedCount > 0
      ? previewCount === expectedCount
        ? 'success'
        : previewCount > expectedCount
          ? 'danger'
          : 'warning'
      : undefined;

  return (
    <Modal
      title={`批量导入序列号${materialLabel ? ` — ${materialLabel}` : ''}`}
      open={open}
      onCancel={onCancel}
      onOk={handleOk}
      width={640}
      destroyOnHidden
      okText="确定"
    >
      {expectedHint && (
        <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 12 }}>
          {expectedHint}
        </Typography.Text>
      )}

      {initialSerials.length > 0 && (
        <Radio.Group
          value={mergeMode}
          onChange={(e) => setMergeMode(e.target.value)}
          style={{ marginBottom: 12 }}
        >
          <Radio value="replace">覆盖已有序列号</Radio>
          <Radio value="append">追加到已有</Radio>
        </Radio.Group>
      )}

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'paste',
            label: '粘贴文本',
            children: (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  每行一个序列号；也支持同一行用逗号、分号、Tab 分隔多个序列号。
                </Typography.Text>
                <TextArea
                  rows={8}
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder={'SN001\nSN002\nSN003'}
                />
                <Button size="small" onClick={handleParsePaste}>
                  解析预览
                </Button>
              </Space>
            ),
          },
          {
            key: 'file',
            label: '上传文件',
            children: (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Space wrap>
                  <Button size="small" icon={<DownloadOutlined />} onClick={() => void handleDownloadTemplate()}>
                    下载 Excel 模板
                  </Button>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    支持 .txt / .csv / .xlsx；Excel 取第一列，首行可为「序列号」表头
                  </Typography.Text>
                </Space>
                <Dragger
                  accept=".txt,.csv,.xlsx,.xls"
                  multiple={false}
                  showUploadList={false}
                  disabled={fileLoading}
                  beforeUpload={(file) => {
                    void handleFile(file);
                    return false;
                  }}
                >
                  <p className="ant-upload-drag-icon">
                    <InboxOutlined />
                  </p>
                  <p className="ant-upload-text">点击或拖拽文件到此处</p>
                </Dragger>
              </Space>
            ),
          },
          ...(onGenerate
            ? [
                {
                  key: 'generate',
                  label: '规则生成',
                  children: (
                    <Space direction="vertical" size={12}>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        按物料默认序列号规则自动生成，数量与明细行入库数量一致。
                      </Typography.Text>
                      <Button
                        type="primary"
                        icon={<ThunderboltOutlined />}
                        loading={generateLoading}
                        onClick={() => void handleGenerate()}
                      >
                        生成序列号
                      </Button>
                    </Space>
                  ),
                },
              ]
            : []),
        ]}
      />

      <div style={{ marginTop: 16, padding: '8px 12px', background: '#fafafa', borderRadius: 6 }}>
        <Typography.Text type={countStatus}>{`当前共 ${previewCount} 个序列号`}</Typography.Text>
        {previewCount > 0 && previewCount <= 20 && (
          <Typography.Paragraph type="secondary" style={{ margin: '8px 0 0', fontSize: 12, wordBreak: 'break-all' }}>
            {previewSerials.join('、')}
          </Typography.Paragraph>
        )}
        {previewCount > 20 && (
          <Typography.Paragraph type="secondary" style={{ margin: '8px 0 0', fontSize: 12 }}>
            {previewSerials.slice(0, 5).join('、')} … 等 {previewCount} 个
          </Typography.Paragraph>
        )}
      </div>
    </Modal>
  );
};

export default SerialNumbersImportModal;
