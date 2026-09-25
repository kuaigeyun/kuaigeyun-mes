import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ProFormDigit,
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
  ProFormTextArea,
  type ProFormInstance,
} from '@ant-design/pro-components';
import { Alert, App, Col, Row, Tabs } from 'antd';
import { FormModalTemplate } from '../../../../../components/layout-templates';
import { MODAL_CONFIG } from '../../../../../components/layout-templates/constants';
import type { DrawingSecurityLevel } from '../../../services/drawing';
import {
  drawingWatermarkApi,
  type DrawingWatermarkPolicy,
  type DrawingWatermarkPosition,
} from '../../../services/drawingWatermark';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import {
  applyWatermarkOpacity,
  DEFAULT_DRAWING_WATERMARK_TEMPLATE,
  renderWatermarkTemplate,
  templateForSecurityLevel,
  watermarkPositionCss,
} from './drawingWatermarkUtils';

const PREVIEW_LEVEL: DrawingSecurityLevel = 'internal';
/** 浏览器打印 A4 纵向约 794px 宽（210mm @ 96dpi），用于预览区字号缩放 */
const A4_PRINT_WIDTH_PX = 794;

type Props = {
  open: boolean;
  onClose: () => void;
};

export const DrawingWatermarkSettingsModal: React.FC<Props> = ({ open, onClose }) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const formRef = useRef<ProFormInstance>();
  const paperRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [previewLevel, setPreviewLevel] = useState<DrawingSecurityLevel>(PREVIEW_LEVEL);
  const [formSnapshot, setFormSnapshot] = useState<Partial<DrawingWatermarkPolicy>>({});
  const [paperWidth, setPaperWidth] = useState(280);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    drawingWatermarkApi
      .getPolicy()
      .then((policy) => {
        formRef.current?.setFieldsValue({
          isEnabled: policy.isEnabled,
          forceOnPrint: policy.forceOnPrint,
          opacity: policy.opacity,
          angle: policy.angle,
          fontSize: policy.fontSize,
          color: policy.color,
          position: policy.position,
          templatePublic: policy.templatePublic,
          templateInternal: policy.templateInternal,
          templateSecret: policy.templateSecret,
          templateConfidential: policy.templateConfidential,
        });
        setFormSnapshot(policy);
      })
      .catch((error) => {
        messageApi.error(getApiErrorMessage(error, t('common.loadFailed')));
      })
      .finally(() => setLoading(false));
  }, [open, messageApi, t]);

  useEffect(() => {
    if (!open || !paperRef.current) return;
    const node = paperRef.current;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width > 0) setPaperWidth(width);
    });
    observer.observe(node);
    setPaperWidth(node.clientWidth);
    return () => observer.disconnect();
  }, [open]);

  const previewPolicy = useMemo(() => {
    const values = formSnapshot;
    return {
      isEnabled: values.isEnabled ?? true,
      opacity: values.opacity ?? 0.15,
      angle: values.angle ?? -25,
      fontSize: values.fontSize ?? 48,
      color: values.color ?? 'rgba(200,0,0,1)',
      position: (values.position ?? 'diagonal') as DrawingWatermarkPosition,
      templatePublic: values.templatePublic ?? DEFAULT_DRAWING_WATERMARK_TEMPLATE,
      templateInternal: values.templateInternal ?? DEFAULT_DRAWING_WATERMARK_TEMPLATE,
      templateSecret: values.templateSecret ?? DEFAULT_DRAWING_WATERMARK_TEMPLATE,
      templateConfidential: values.templateConfidential ?? DEFAULT_DRAWING_WATERMARK_TEMPLATE,
    };
  }, [formSnapshot]);

  const previewText = useMemo(() => {
    if (!previewPolicy.isEnabled) return '';
    const template = templateForSecurityLevel(previewPolicy, previewLevel);
    return renderWatermarkTemplate(template, {
      user: t('app.master-data.drawings.watermark.previewUser'),
      time: '2026-09-24 12:00:00',
      code: 'FH02006001',
      revision: 'A',
      securityLevel: previewLevel,
      siteName: t('app.master-data.drawings.watermark.previewSiteName'),
    });
  }, [previewLevel, previewPolicy, t]);

  const previewFontSize = previewPolicy.fontSize * (paperWidth / A4_PRINT_WIDTH_PX);

  const previewStyle = useMemo(() => {
    const pos = watermarkPositionCss(previewPolicy.position);
    const color = applyWatermarkOpacity(previewPolicy.color, previewPolicy.opacity);
    const transform =
      previewPolicy.position === 'center'
        ? `translate(-50%, -50%) rotate(${previewPolicy.angle}deg)`
        : previewPolicy.position === 'diagonal'
          ? `rotate(${previewPolicy.angle}deg)`
          : `rotate(${previewPolicy.angle}deg)`;
    return {
      position: 'absolute' as const,
      ...pos,
      fontSize: previewFontSize,
      color,
      transform,
      pointerEvents: 'none' as const,
      whiteSpace: 'pre-wrap' as const,
      maxWidth: '80%',
      lineHeight: 1.2,
    };
  }, [previewFontSize, previewPolicy]);

  const handleFinish = async (values: Record<string, unknown>) => {
    try {
      setLoading(true);
      await drawingWatermarkApi.updatePolicy({
        isEnabled: Boolean(values.isEnabled),
        forceOnPrint: Boolean(values.forceOnPrint),
        opacity: Number(values.opacity),
        angle: Number(values.angle),
        fontSize: Number(values.fontSize),
        color: String(values.color ?? '').trim(),
        position: values.position as DrawingWatermarkPosition,
        templatePublic: String(values.templatePublic ?? '').trim(),
        templateInternal: String(values.templateInternal ?? '').trim(),
        templateSecret: String(values.templateSecret ?? '').trim(),
        templateConfidential: String(values.templateConfidential ?? '').trim(),
      });
      messageApi.success(t('common.saveSuccess'));
      onClose();
      return true;
    } catch (error) {
      messageApi.error(getApiErrorMessage(error, t('common.saveFailed')));
      return false;
    } finally {
      setLoading(false);
    }
  };

  const positionOptions = [
    { label: t('app.master-data.drawings.watermark.position.diagonal'), value: 'diagonal' },
    { label: t('app.master-data.drawings.watermark.position.center'), value: 'center' },
    { label: t('app.master-data.drawings.watermark.position.topLeft'), value: 'topLeft' },
    { label: t('app.master-data.drawings.watermark.position.topRight'), value: 'topRight' },
    { label: t('app.master-data.drawings.watermark.position.bottomLeft'), value: 'bottomLeft' },
    { label: t('app.master-data.drawings.watermark.position.bottomRight'), value: 'bottomRight' },
  ];

  const templateTab = (name: string, label: string) => (
    <ProFormTextArea
      name={name}
      label={label}
      fieldProps={{
        rows: 8,
        onChange: () => {
          setFormSnapshot((prev) => ({ ...prev, ...formRef.current?.getFieldsValue() }));
        },
      }}
    />
  );

  return (
    <FormModalTemplate
      title={t('app.master-data.drawings.watermark.settingsTitle')}
      open={open}
      onClose={onClose}
      onFinish={handleFinish}
      isEdit
      loading={loading}
      width={MODAL_CONFIG.LARGE_WIDTH}
      formRef={formRef as React.RefObject<ProFormInstance>}
      layout="vertical"
      grid={false}
      onValuesChange={(_, allValues) => {
        setFormSnapshot(allValues as Partial<DrawingWatermarkPolicy>);
      }}
    >
      <Row gutter={24} align="top">
        <Col xs={24} lg={14}>
          <Row gutter={16}>
            <Col span={8}>
              <ProFormDigit
                name="opacity"
                label={t('app.master-data.drawings.watermark.opacity')}
                min={0.05}
                max={0.5}
                step={0.05}
                fieldProps={{ precision: 2 }}
              />
            </Col>
            <Col span={8}>
              <ProFormDigit
                name="angle"
                label={t('app.master-data.drawings.watermark.angle')}
                min={-180}
                max={180}
              />
            </Col>
            <Col span={8}>
              <ProFormDigit
                name="fontSize"
                label={t('app.master-data.drawings.watermark.fontSize')}
                min={12}
                max={120}
              />
            </Col>
            <Col span={12}>
              <ProFormText name="color" label={t('app.master-data.drawings.watermark.color')} />
            </Col>
            <Col span={12}>
              <ProFormSelect
                name="position"
                label={t('app.master-data.drawings.watermark.position.label')}
                options={positionOptions}
              />
            </Col>
            <Col span={24}>
              <Alert
                title={t('app.master-data.drawings.watermark.placeholderHint')}
                type="info"
                showIcon
              />
            </Col>
            <Col span={24}>
              <Tabs
                activeKey={previewLevel}
                onChange={(key) => setPreviewLevel(key as DrawingSecurityLevel)}
                items={[
                  {
                    key: 'public',
                    label: t('app.master-data.drawings.securityLevel.public'),
                    forceRender: true,
                    children: templateTab(
                      'templatePublic',
                      t('app.master-data.drawings.watermark.templateLabel'),
                    ),
                  },
                  {
                    key: 'internal',
                    label: t('app.master-data.drawings.securityLevel.internal'),
                    forceRender: true,
                    children: templateTab(
                      'templateInternal',
                      t('app.master-data.drawings.watermark.templateLabel'),
                    ),
                  },
                  {
                    key: 'secret',
                    label: t('app.master-data.drawings.securityLevel.secret'),
                    forceRender: true,
                    children: templateTab(
                      'templateSecret',
                      t('app.master-data.drawings.watermark.templateLabel'),
                    ),
                  },
                  {
                    key: 'confidential',
                    label: t('app.master-data.drawings.securityLevel.confidential'),
                    forceRender: true,
                    children: templateTab(
                      'templateConfidential',
                      t('app.master-data.drawings.watermark.templateLabel'),
                    ),
                  },
                ]}
              />
            </Col>
            <Col span={12}>
              <ProFormSwitch
                name="isEnabled"
                label={t('app.master-data.drawings.watermark.isEnabled')}
              />
            </Col>
            <Col span={12}>
              <ProFormSwitch
                name="forceOnPrint"
                label={t('app.master-data.drawings.watermark.forceOnPrint')}
              />
            </Col>
          </Row>
        </Col>
        <Col xs={24} lg={10}>
          <div style={{ position: 'sticky', top: 0 }}>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>
              {t('app.master-data.drawings.watermark.preview')}
            </div>
            <div
              style={{
                padding: 16,
                borderRadius: 6,
                border: '1px solid rgba(0,0,0,0.06)',
                background: '#f7f8fa',
              }}
            >
              <div
                ref={paperRef}
                style={{
                  aspectRatio: '210 / 297',
                  width: '100%',
                  margin: '0 auto',
                  position: 'relative',
                  background: '#fff',
                  border: '1px solid rgba(0,0,0,0.08)',
                  borderRadius: 2,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  overflow: 'hidden',
                }}
              >
                {previewText ? (
                  <div style={previewStyle}>{previewText}</div>
                ) : (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 16,
                      color: 'rgba(0,0,0,0.45)',
                      textAlign: 'center',
                    }}
                  >
                    {t('app.master-data.drawings.watermark.previewDisabled')}
                  </div>
                )}
              </div>
              <div
                style={{
                  marginTop: 8,
                  fontSize: 12,
                  color: 'rgba(0,0,0,0.45)',
                  textAlign: 'center',
                }}
              >
                {t('app.master-data.drawings.watermark.previewA4Hint')}
              </div>
            </div>
          </div>
        </Col>
      </Row>
    </FormModalTemplate>
  );
};
