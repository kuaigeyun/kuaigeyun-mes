/**
 * 接口测试抽屉（DetailDrawerTemplate 壳 + 分区布局）
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { App, Button, Input, Result, Space, Tag, Typography } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import { DetailDrawerTemplate, DRAWER_CONFIG } from '../../../components/layout-templates';
import { CODE_FONT_FAMILY } from '../../../constants/fonts';
import { getApiErrorMessage } from '../../../utils/errorHandler';
import {
  getAPIByUuid,
  testAPI,
  type API,
  type APITestRequest,
  type APITestResponse,
} from '../../../services/apiManagement';
import { ApiTestResultBodyPreview } from './ApiTestResultBodyPreview';

const { TextArea } = Input;
const { Text } = Typography;

const JSON_PRE_STYLE: React.CSSProperties = {
  margin: 0,
  padding: 8,
  backgroundColor: 'var(--ant-color-fill-quaternary)',
  borderRadius: 4,
  overflow: 'auto',
  fontSize: 12,
  fontFamily: CODE_FONT_FAMILY,
};

function buildTestRequestPreview(api: API): APITestRequest {
  const preview: APITestRequest = {};
  if (api.request_headers && Object.keys(api.request_headers).length > 0) {
    preview.headers = api.request_headers;
  }
  if (api.request_params && Object.keys(api.request_params).length > 0) {
    preview.params = api.request_params;
  }
  if (api.request_body && Object.keys(api.request_body).length > 0) {
    preview.body = api.request_body;
  }
  return preview;
}

function formatTestRequestPreview(api: API): string {
  return JSON.stringify(buildTestRequestPreview(api), null, 2);
}

export interface ApiTestDrawerProps {
  open: boolean;
  apiUuid: string | null;
  onClose: () => void;
}

export const ApiTestDrawer: React.FC<ApiTestDrawerProps> = ({ open, apiUuid, onClose }) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();

  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [testRequestJson, setTestRequestJson] = useState('{}');
  const [testResult, setTestResult] = useState<APITestResponse | null>(null);
  const [testLoading, setTestLoading] = useState(false);

  useEffect(() => {
    if (!open || !apiUuid) {
      return;
    }

    setTestResult(null);
    setTestLoading(false);
    setPreviewError(null);
    setPreviewLoading(true);
    setTestRequestJson('{}');

    let cancelled = false;

    void (async () => {
      try {
        const detail = await getAPIByUuid(apiUuid);
        if (cancelled) {
          return;
        }
        setTestRequestJson(formatTestRequestPreview(detail));
      } catch (error) {
        if (cancelled) {
          return;
        }
        setPreviewError(getApiErrorMessage(error, t('pages.system.apis.getDetailFailed')));
        setTestRequestJson('{}');
      } finally {
        if (!cancelled) {
          setPreviewLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [apiUuid, open, t]);

  const handleClose = () => {
    setPreviewError(null);
    setTestRequestJson('{}');
    setTestResult(null);
    setTestLoading(false);
    onClose();
  };

  const handleReloadPreview = async () => {
    if (!apiUuid) {
      return;
    }
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const detail = await getAPIByUuid(apiUuid);
      setTestRequestJson(formatTestRequestPreview(detail));
      setTestResult(null);
    } catch (error) {
      setPreviewError(getApiErrorMessage(error, t('pages.system.apis.getDetailFailed')));
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleExecuteTest = async () => {
    if (!apiUuid) {
      return;
    }
    let testRequest: APITestRequest = {};
    try {
      testRequest = JSON.parse(testRequestJson);
    } catch {
      messageApi.error(t('pages.system.apis.testRequestJsonInvalid'));
      return;
    }

    try {
      setTestLoading(true);
      const result = await testAPI(apiUuid, testRequest);
      setTestResult(result);
      if (result.status_code >= 200 && result.status_code < 300) {
        messageApi.success(t('pages.system.apis.testSuccess'));
      } else {
        messageApi.warning(t('pages.system.apis.testCompleteStatus', { code: result.status_code }));
      }
    } catch (error: unknown) {
      const err = error as { message?: string };
      messageApi.error(err?.message || t('pages.system.apis.testFailed'));
    } finally {
      setTestLoading(false);
    }
  };

  const contentReady = Boolean(apiUuid) && !previewLoading && !previewError;
  const showError = Boolean(previewError) && !previewLoading;

  if (!open) {
    return null;
  }

  return (
    <DetailDrawerTemplate
      title={t('pages.system.apis.testDrawerTitle')}
      open={open}
      onClose={handleClose}
      width={DRAWER_CONFIG.STANDARD_WIDTH}
      loading={previewLoading}
      extra={
        contentReady ? (
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            loading={testLoading}
            onClick={() => void handleExecuteTest()}
          >
            {t('pages.system.apis.executeTest')}
          </Button>
        ) : null
      }
      plainBody={
        showError ? (
          <Result
            status="error"
            title={previewError}
            extra={
              apiUuid ? (
                <Button type="primary" onClick={() => void handleReloadPreview()}>
                  {t('common.retry')}
                </Button>
              ) : null
            }
          />
        ) : undefined
      }
      basicTitle={contentReady ? t('pages.system.apis.testRequestLabel') : undefined}
      basic={
        contentReady ? (
          <TextArea
            value={testRequestJson}
            onChange={(event) => setTestRequestJson(event.target.value)}
            rows={14}
            placeholder={t('pages.system.apis.testRequestPlaceholder')}
            style={{ fontFamily: CODE_FONT_FAMILY, fontSize: 12 }}
          />
        ) : showError ? null : (
          <div style={{ minHeight: 120 }} />
        )
      }
      linesTitle={contentReady && testResult ? t('pages.system.apis.testResultLabel') : undefined}
      lines={
        contentReady && testResult ? (
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <Space wrap>
              <Text>{t('pages.system.apis.statusCodeLabel')}</Text>
              <Tag color={testResult.status_code >= 200 && testResult.status_code < 300 ? 'success' : 'error'}>
                {testResult.status_code}
              </Tag>
              <Text>{t('pages.system.apis.elapsedLabel')}</Text>
              <Tag>{testResult.elapsed_time}s</Tag>
            </Space>
            <div>
              <Text strong>{t('pages.system.apis.responseHeadersLabel')}</Text>
              <pre style={{ ...JSON_PRE_STYLE, marginTop: 8, maxHeight: 200 }}>
                {JSON.stringify(testResult.headers, null, 2)}
              </pre>
            </div>
            <ApiTestResultBodyPreview body={testResult.body} testRequestJson={testRequestJson} />
          </Space>
        ) : undefined
      }
    />
  );
};
