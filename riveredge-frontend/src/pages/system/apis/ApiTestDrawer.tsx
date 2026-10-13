/**
 * 接口测试抽屉（DetailDrawerTemplate 壳 + 分区布局）
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, App, Button, Input, Result, Space, Tag, Typography } from 'antd';
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
import {
  collapseMaterialRowsToUniqueUnits,
  normalizeApiBodyToRows,
} from '../../../components/sync-from-source-modal/syncSourceUtils';

const { TextArea } = Input;
const { Text } = Typography;

/** 单位同步接口测试：翻页抽物料基础单位，避免只测第 1 页去重后「只剩 1 个」 */
const UNIT_SYNC_TEST_MAX_PAGES = 20;
const UNIT_SYNC_TEST_PAGE_SIZE = 500;

const JSON_PRE_STYLE: React.CSSProperties = {
  margin: 0,
  padding: 8,
  backgroundColor: 'var(--ant-color-fill-quaternary)',
  borderRadius: 4,
  overflow: 'auto',
  fontSize: 12,
  fontFamily: CODE_FONT_FAMILY,
};

const UNIT_SYNC_MATERIAL_SELECT = 'number,name,baseunit.number,baseunit.name';

/** 仅单位同步预置 code（query_measureunits）；禁止用名称/baseunit 推断，以免误伤物料接口测试 */
function isCosmicUnitSyncMaterialApi(api: API): boolean {
  const code = String(api.code || '').toLowerCase();
  return code.includes('query_measureunits');
}

function buildTestRequestPreview(api: API): APITestRequest {
  const preview: APITestRequest = {};
  if (api.request_headers && Object.keys(api.request_headers).length > 0) {
    preview.headers = api.request_headers;
  }
  if (api.request_params && Object.keys(api.request_params).length > 0) {
    preview.params = { ...api.request_params };
  }
  if (api.request_body && Object.keys(api.request_body).length > 0) {
    preview.body = { ...api.request_body };
  }
  // 苍穹单位同步：旧接口未带 select 时测试请求自动补上，表格只显示需要的列
  if (isCosmicUnitSyncMaterialApi(api)) {
    const body =
      preview.body && typeof preview.body === 'object' && !Array.isArray(preview.body)
        ? { ...(preview.body as Record<string, unknown>) }
        : { data: {}, pageNo: 1, pageSize: 100 };
    if (!String(body.select || '').trim()) {
      body.select = UNIT_SYNC_MATERIAL_SELECT;
    }
    if (!body.data || typeof body.data !== 'object') {
      body.data = {};
    }
    body.pageNo = 1;
    body.pageSize = Math.max(Number(body.pageSize) || 0, UNIT_SYNC_TEST_PAGE_SIZE);
    preview.body = body;
    preview.params = {
      ...(preview.params || {}),
      select: String(body.select || UNIT_SYNC_MATERIAL_SELECT),
    };
  }
  return preview;
}

function extractNestedRowArray(body: unknown): Record<string, unknown>[] {
  return normalizeApiBodyToRows(body);
}

async function executeUnitSyncPagedTest(
  apiUuid: string,
  testRequest: APITestRequest,
): Promise<APITestResponse> {
  const baseBody =
    testRequest.body && typeof testRequest.body === 'object' && !Array.isArray(testRequest.body)
      ? { ...(testRequest.body as Record<string, unknown>) }
      : { data: {}, pageNo: 1, pageSize: UNIT_SYNC_TEST_PAGE_SIZE };
  const pageSize = Math.max(Number(baseBody.pageSize) || 0, UNIT_SYNC_TEST_PAGE_SIZE);
  const allMaterialRows: Record<string, unknown>[] = [];
  let lastResult: APITestResponse | null = null;
  let elapsed = 0;

  for (let pageNo = 1; pageNo <= UNIT_SYNC_TEST_MAX_PAGES; pageNo += 1) {
    const pageBody = {
      ...baseBody,
      data: (baseBody.data as Record<string, unknown>) || {},
      pageNo,
      pageSize,
      select: baseBody.select || UNIT_SYNC_MATERIAL_SELECT,
    };
    const result = await testAPI(apiUuid, {
      ...testRequest,
      body: pageBody,
      params: {
        ...(testRequest.params || {}),
        select: String(pageBody.select),
      },
    });
    lastResult = result;
    elapsed += Number(result.elapsed_time || 0);
    if (result.status_code < 200 || result.status_code >= 300) {
      return result;
    }
    const chunk = extractNestedRowArray(result.body);
    if (!chunk.length) break;
    allMaterialRows.push(...chunk);
    if (chunk.length < pageSize) break;
  }

  const units = collapseMaterialRowsToUniqueUnits(allMaterialRows);
  return {
    status_code: lastResult?.status_code ?? 0,
    headers: lastResult?.headers ?? {},
    body: {
      data: units,
      pageNo: 1,
      pageSize: units.length,
      _unit_sync_test: {
        material_rows: allMaterialRows.length,
        unique_units: units.length,
        pages: Math.min(
          UNIT_SYNC_TEST_MAX_PAGES,
          Math.max(1, Math.ceil(allMaterialRows.length / pageSize) || 1),
        ),
        note: '已按物料翻页抽取基础单位并去重；正式同步会继续翻完全部分页。',
      },
    },
    elapsed_time: Math.round(elapsed * 1000) / 1000,
  };
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
  const [apiPath, setApiPath] = useState('');

  useEffect(() => {
    if (!open || !apiUuid) {
      return;
    }

    setTestResult(null);
    setTestLoading(false);
    setPreviewError(null);
    setPreviewLoading(true);
    setTestRequestJson('{}');
    setApiPath('');

    let cancelled = false;

    void (async () => {
      try {
        const detail = await getAPIByUuid(apiUuid);
        if (cancelled) {
          return;
        }
        setApiPath(detail.path || '');
        setTestRequestJson(formatTestRequestPreview(detail));
      } catch (error) {
        if (cancelled) {
          return;
        }
        setPreviewError(getApiErrorMessage(error, t('pages.system.apis.getDetailFailed')));
        setTestRequestJson('{}');
        setApiPath('');
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
      setApiPath(detail.path || '');
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
      const detail = await getAPIByUuid(apiUuid);
      const result = isCosmicUnitSyncMaterialApi(detail)
        ? await executeUnitSyncPagedTest(apiUuid, testRequest)
        : await testAPI(apiUuid, testRequest);
      setTestResult(result);
      if (result.status_code >= 200 && result.status_code < 300) {
        const meta =
          result.body &&
          typeof result.body === 'object' &&
          !Array.isArray(result.body) &&
          (result.body as { _unit_sync_test?: { unique_units?: number; material_rows?: number } })
            ._unit_sync_test;
        if (meta?.unique_units != null) {
          messageApi.success(
            t('pages.system.apis.testUnitSyncCollapsed', {
              materials: meta.material_rows ?? 0,
              units: meta.unique_units,
            }),
          );
        } else {
          messageApi.success(t('pages.system.apis.testSuccess'));
        }
      } else if (
        result.status_code === 0 &&
        result.body &&
        typeof result.body === 'object' &&
        'error' in result.body
      ) {
        messageApi.warning(String((result.body as { error: string }).error));
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
  const cosmicPathNeedsEdit = contentReady && apiPath.includes('__API_NUMBER__');

  if (!open) {
    return null;
  }

  return (
    <DetailDrawerTemplate
      title={t('pages.system.apis.testDrawerTitle')}
      open={open}
      onClose={handleClose}
      size={DRAWER_CONFIG.STANDARD_WIDTH}
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
          <Space orientation="vertical" size={12} style={{ width: '100%' }}>
            {cosmicPathNeedsEdit ? (
              <Alert type="warning" showIcon title={t('pages.system.apis.testCosmicPathPlaceholderHint')} />
            ) : null}
            <TextArea
              value={testRequestJson}
              onChange={(event) => setTestRequestJson(event.target.value)}
              rows={14}
              placeholder={t('pages.system.apis.testRequestPlaceholder')}
              style={{ fontFamily: CODE_FONT_FAMILY, fontSize: 12 }}
            />
          </Space>
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
