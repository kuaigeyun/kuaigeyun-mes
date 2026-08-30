/**
 * 新建/编辑接口弹窗（Postman 式布局）
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ProFormDependency,
  ProFormItem,
  ProFormList,
  ProFormSwitch,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { Col, Row, Tabs } from 'antd';
import SafeProFormSelect from '../../../components/safe-pro-form-select';
import { FormModalTemplate, MODAL_CONFIG } from '../../../components/layout-templates';
import type { DataConnectionGroupOption, IntegrationConfig } from '../../../services/integrationConfig';
import { KingdeeExecuteBillQueryBodyEditor } from './KingdeeExecuteBillQueryBodyEditor';
import { shouldShowKingdeeExecuteBillQueryWizard } from './kingdeeExecuteBillQuery';
import {
  CustomFieldJsonEditor,
  CustomFieldJsonModeSegmented,
  type CustomFieldJsonEditorMode,
} from '../../../components/custom-fields/CustomFieldJsonEditor';
import {
  isEmptyJsonValue,
  isFlatJsonObject,
  normalizeJsonFieldValue,
  parseJsonText,
} from '../../../components/custom-fields/customFieldJsonUtils';
import { FORM_LAYOUT } from '../../../components/layout-templates/constants';
import {
  objectToKeyValueList,
  transformApiFormValues,
  type ApiFormRawValues,
  type ApiFormSubmitValues,
} from './apiFormUtils';
import './apiFormModal.css';

const apiKvFieldFormItemProps = { style: { marginBottom: 0 } };

function renderApiKeyValueListItem({
  listDom,
  action,
}: {
  listDom: React.ReactNode;
  action: React.ReactNode;
}) {
  return (
    <div className="api-form-kv-list-item">
      <div className="api-form-kv-list-item__fields">{listDom}</div>
      <div className="api-form-kv-list-item__actions">{action}</div>
    </div>
  );
}

interface ApiKeyValueListFieldsProps {
  keyPlaceholder: string;
  valuePlaceholder: string;
}

const ApiKeyValueListFields: React.FC<ApiKeyValueListFieldsProps> = ({
  keyPlaceholder,
  valuePlaceholder,
}) => (
  <Row gutter={8} align="middle">
    <Col span={12}>
      <ProFormText
        name="key"
        placeholder={keyPlaceholder}
        formItemProps={apiKvFieldFormItemProps}
      />
    </Col>
    <Col span={12}>
      <ProFormText
        name="value"
        placeholder={valuePlaceholder}
        formItemProps={apiKvFieldFormItemProps}
      />
    </Col>
  </Row>
);

export type { ApiFormSubmitValues };

export interface ApiFormModalProps {
  open: boolean;
  onClose: () => void;
  onFinish: (values: ApiFormSubmitValues) => Promise<void>;
  isEdit: boolean;
  initialValues?: Partial<ApiFormRawValues>;
  loading?: boolean;
  connectionGroups: DataConnectionGroupOption[];
  connectionItems: IntegrationConfig[];
  categorySelectOptions: Array<{ label: string; value: string }>;
  canReadConnection: boolean;
}

interface ApiJsonFormFieldProps {
  name: string;
  label: React.ReactNode;
  placeholder?: string;
}

const resolveJsonEditorMode = (value: unknown): CustomFieldJsonEditorMode =>
  isFlatJsonObject(value) || value == null ? 'kv' : 'source';

const ApiJsonFormFieldContent: React.FC<
  ApiJsonFormFieldProps & { fieldValue: unknown }
> = ({ name, label, placeholder, fieldValue }) => {
  const [mode, setMode] = useState<CustomFieldJsonEditorMode>(() => resolveJsonEditorMode(fieldValue));

  useEffect(() => {
    setMode(resolveJsonEditorMode(fieldValue));
  }, [fieldValue]);

  return (
    <>
      <Row align="middle" gutter={16} style={{ width: '100%', marginBottom: 8 }}>
        <Col flex="auto">
          <div className="ant-form-item-label" style={{ padding: 0, overflow: 'visible' }}>
            <label>{label}</label>
          </div>
        </Col>
        <Col flex="none">
          <CustomFieldJsonModeSegmented mode={mode} onChange={setMode} />
        </Col>
      </Row>
      <ProFormItem
        name={name}
        noStyle
        rules={[
          {
            validator: async (_: unknown, value: unknown) => {
              if (value == null || value === '') return;
              if (typeof value === 'string') {
                const parsed = parseJsonText(value);
                if (!parsed.ok) throw new Error(parsed.error);
                if (
                  parsed.value != null &&
                  (typeof parsed.value !== 'object' || Array.isArray(parsed.value))
                ) {
                  throw new Error('须为 JSON 对象');
                }
                return;
              }
              if (
                !isEmptyJsonValue(value) &&
                (typeof value !== 'object' || Array.isArray(value))
              ) {
                throw new Error('须为 JSON 对象');
              }
            },
          },
        ]}
      >
        <CustomFieldJsonEditor
          placeholder={placeholder}
          mode={mode}
          onModeChange={setMode}
          showModeToggle={false}
        />
      </ProFormItem>
    </>
  );
};

const ApiJsonFormField: React.FC<ApiJsonFormFieldProps> = ({ name, label, placeholder }) => (
  <div
    className="api-form-json-field"
    style={{ marginBottom: FORM_LAYOUT.ITEM_MARGIN_BOTTOM }}
  >
    <ProFormDependency name={[name]}>
      {(values) => (
        <ApiJsonFormFieldContent
          name={name}
          label={label}
          placeholder={placeholder}
          fieldValue={values[name]}
        />
      )}
    </ProFormDependency>
  </div>
);

export const ApiFormModal: React.FC<ApiFormModalProps> = ({
  open,
  onClose,
  onFinish,
  isEdit,
  initialValues,
  loading = false,
  connectionGroups,
  connectionItems,
  categorySelectOptions,
  canReadConnection,
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('params');

  const handleFinish = async (values: ApiFormRawValues) => {
    await onFinish(transformApiFormValues(values));
  };

  const tabItems = useMemo(
    () => [
      {
        key: 'params',
        label: t('pages.system.apis.tabParams'),
        children: (
          <ProFormList
            name="request_params"
            label={t('pages.system.apis.labelRequestParams')}
            creatorButtonProps={{ creatorButtonText: t('pages.system.apis.addParam') }}
            className="api-form-kv-list"
            itemRender={renderApiKeyValueListItem}
            min={0}
          >
            <ApiKeyValueListFields
              keyPlaceholder={t('pages.system.apis.paramKeyPlaceholder')}
              valuePlaceholder={t('pages.system.apis.paramValuePlaceholder')}
            />
          </ProFormList>
        ),
      },
      {
        key: 'headers',
        label: t('pages.system.apis.tabHeaders'),
        children: (
          <ProFormList
            name="request_headers"
            label={t('pages.system.apis.labelRequestHeaders')}
            creatorButtonProps={{ creatorButtonText: t('pages.system.apis.addRequestHeader') }}
            className="api-form-kv-list"
            itemRender={renderApiKeyValueListItem}
            min={0}
          >
            <ApiKeyValueListFields
              keyPlaceholder={t('pages.system.apis.headerKeyPlaceholder')}
              valuePlaceholder={t('pages.system.apis.headerValuePlaceholder')}
            />
          </ProFormList>
        ),
      },
      {
        key: 'body',
        label: t('pages.system.apis.tabBody'),
        children: (
          <ProFormDependency name={['connection_uuid', 'path', 'request_body', 'request_headers']}>
            {(values) => {
              const connectionType = connectionItems.find(
                (item) => item.uuid === values.connection_uuid,
              )?.type;
              if (
                shouldShowKingdeeExecuteBillQueryWizard(
                  values.connection_uuid,
                  values.path,
                  connectionType,
                )
              ) {
                return (
                  <KingdeeExecuteBillQueryBodyEditor
                    connectionUuid={values.connection_uuid}
                    path={values.path}
                    value={values.request_body}
                    requestHeaders={values.request_headers}
                  />
                );
              }
              return (
                <ApiJsonFormField
                  name="request_body"
                  label={t('pages.system.apis.labelRequestBody')}
                  placeholder={t('pages.system.apis.bodyJsonPlaceholder')}
                />
              );
            }}
          </ProFormDependency>
        ),
      },
      {
        key: 'response',
        label: t('pages.system.apis.tabResponse'),
        children: (
          <div className="api-form-response-tab">
            <ApiJsonFormField
              name="response_format"
              label={t('pages.system.apis.labelResponseFormat')}
              placeholder={t('pages.system.apis.responseFormatJsonPlaceholder')}
            />
            <ApiJsonFormField
              name="response_example"
              label={t('pages.system.apis.labelResponseExample')}
              placeholder={t('pages.system.apis.responseExampleJsonPlaceholder')}
            />
          </div>
        ),
      },
    ],
    [t, connectionItems],
  );

  return (
    <FormModalTemplate
      title={isEdit ? t('pages.system.apis.modalEdit') : t('pages.system.apis.modalCreate')}
      open={open}
      onClose={onClose}
      onFinish={handleFinish}
      isEdit={isEdit}
      initialValues={initialValues}
      loading={loading}
      width={MODAL_CONFIG.LARGE_WIDTH}
      grid={false}
      layout="vertical"
    >
      <Row gutter={16}>
        <Col span={12}>
          <ProFormText
            name="code"
            label={t('pages.system.apis.labelCode')}
            rules={[
              { required: true, message: t('pages.system.apis.codeRequired') },
              { pattern: /^[a-z0-9_]+$/, message: t('pages.system.apis.codePattern') },
            ]}
            placeholder={t('pages.system.apis.codePlaceholder')}
            disabled={isEdit}
          />
        </Col>
        <Col span={12}>
          <ProFormText
            name="name"
            label={t('pages.system.apis.labelName')}
            rules={[{ required: true, message: t('pages.system.apis.nameRequired') }]}
            placeholder={t('pages.system.apis.namePlaceholder')}
          />
        </Col>
        {canReadConnection ? (
          <>
            <Col span={12}>
              <SafeProFormSelect
                name="connection_uuid"
                label={t('pages.system.apis.labelConnection')}
                options={connectionGroups}
                allowClear
                placeholder={t('pages.system.apis.connectionPlaceholder')}
              />
            </Col>
            <Col span={12}>
              <SafeProFormSelect
                name="category_uuid"
                label={t('pages.system.resourceCategory.fieldCategory')}
                options={categorySelectOptions}
                allowClear
                placeholder={t('pages.system.resourceCategory.categoryPlaceholder')}
              />
            </Col>
          </>
        ) : (
          <Col span={24}>
            <SafeProFormSelect
              name="category_uuid"
              label={t('pages.system.resourceCategory.fieldCategory')}
              options={categorySelectOptions}
              allowClear
              placeholder={t('pages.system.resourceCategory.categoryPlaceholder')}
            />
          </Col>
        )}
        <Col span={24}>
          <div className="api-form-url-bar">
            <Row gutter={8} align="bottom">
              <Col flex="120px">
                <SafeProFormSelect
                  name="method"
                  label={t('pages.system.apis.labelMethod')}
                  rules={[{ required: true, message: t('pages.system.apis.methodRequired') }]}
                  options={[
                    { label: 'GET', value: 'GET' },
                    { label: 'POST', value: 'POST' },
                    { label: 'PUT', value: 'PUT' },
                    { label: 'DELETE', value: 'DELETE' },
                    { label: 'PATCH', value: 'PATCH' },
                  ]}
                />
              </Col>
              <Col flex="auto">
                <ProFormDependency name={['connection_uuid']}>
                  {({ connection_uuid }) => (
                    <ProFormText
                      name="path"
                      label={t('pages.system.apis.labelPath')}
                      rules={[{ required: true, message: t('pages.system.apis.pathRequired') }]}
                      placeholder={
                        connection_uuid
                          ? t('pages.system.apis.pathPlaceholderRelative')
                          : t('pages.system.apis.pathPlaceholder')
                      }
                    />
                  )}
                </ProFormDependency>
              </Col>
            </Row>
          </div>
        </Col>
      </Row>

      <Tabs
        className="api-form-tabs"
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        destroyOnHidden={false}
      />

      <Row gutter={16} className="api-form-footer-fields">
        <Col span={24}>
          <ProFormTextArea
            name="description"
            label={t('common.remark')}
            placeholder={t('pages.system.apis.descriptionPlaceholder')}
            fieldProps={{ rows: 3 }}
          />
        </Col>
        <Col span={12}>
          <ProFormSwitch name="is_active" label={t('common.enabled')} />
        </Col>
        {!isEdit ? (
          <Col span={12}>
            <ProFormSwitch name="is_system" label={t('pages.system.apis.labelSystem')} />
          </Col>
        ) : null}
      </Row>
    </FormModalTemplate>
  );
};

export function normalizeApiFormInitialValues(
  detail: Partial<{
    name: string;
    code: string;
    description?: string;
    connection_uuid?: string | null;
    category_uuid?: string | null;
    path: string;
    method: string;
    is_active?: boolean;
    is_system?: boolean;
    request_headers?: Record<string, unknown>;
    request_params?: Record<string, unknown>;
    request_body?: Record<string, unknown> | null;
    response_format?: Record<string, unknown> | null;
    response_example?: Record<string, unknown> | null;
  }>,
): Partial<ApiFormRawValues> {
  return {
    name: detail.name,
    code: detail.code,
    description: detail.description,
    connection_uuid: detail.connection_uuid || undefined,
    category_uuid: detail.category_uuid || undefined,
    path: detail.path,
    method: detail.method,
    is_active: detail.is_active,
    is_system: detail.is_system,
    request_headers: objectToKeyValueList(detail.request_headers ?? undefined),
    request_params: objectToKeyValueList(detail.request_params ?? undefined),
    request_body: normalizeJsonFieldValue(detail.request_body) ?? undefined,
    response_format: normalizeJsonFieldValue(detail.response_format) ?? undefined,
    response_example: normalizeJsonFieldValue(detail.response_example) ?? undefined,
  };
}
