/**
 * 提交接口到官方库弹窗
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, App, Button, Form, Input, Modal, Select, Space, Spin } from 'antd';
import {
  getAPIList,
  submitOfficialApiLibrary,
  type API,
} from '../../../services/apiManagement';

export interface ApiLibrarySubmitModalProps {
  open: boolean;
  onClose: () => void;
  onSubmitted?: () => void;
}

interface SubmitFormValues {
  name: string;
  description?: string;
  connector_type: string;
  category_name: string;
  category_code?: string;
  category_description?: string;
  api_uuids: string[];
  submitter_hint?: string;
}

export const ApiLibrarySubmitModal: React.FC<ApiLibrarySubmitModalProps> = ({
  open,
  onClose,
  onSubmitted,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const [form] = Form.useForm<SubmitFormValues>();
  const [loadingApis, setLoadingApis] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [apis, setApis] = useState<API[]>([]);

  const apiOptions = useMemo(
    () =>
      apis.map((api) => ({
        label: `${api.name} (${api.code})`,
        value: api.uuid,
        connectionType: api.connection_type || '',
      })),
    [apis],
  );

  const loadApis = useCallback(async () => {
    try {
      setLoadingApis(true);
      const pageSize = 100;
      const first = await getAPIList({ page: 1, page_size: pageSize });
      const allItems: API[] = [...first.items];
      const totalPages = Math.max(1, Math.ceil((first.total || 0) / pageSize));
      for (let page = 2; page <= totalPages; page += 1) {
        const next = await getAPIList({ page, page_size: pageSize });
        allItems.push(...next.items);
      }
      setApis(allItems);
    } catch (error: unknown) {
      const err = error as { message?: string };
      messageApi.error(err?.message || t('pages.system.apis.librarySubmitLoadApisFailed'));
    } finally {
      setLoadingApis(false);
    }
  }, [messageApi, t]);

  useEffect(() => {
    if (!open) {
      return;
    }
    form.resetFields();
    void loadApis();
  }, [form, loadApis, open]);

  const handleApiSelectionChange = (uuids: string[]) => {
    form.setFieldValue('api_uuids', uuids);
    const selected = apis.filter((api) => uuids.includes(api.uuid));
    const types = [
      ...new Set(selected.map((api) => api.connection_type).filter(Boolean)),
    ] as string[];
    if (types.length === 1) {
      form.setFieldValue('connector_type', types[0]);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const result = await submitOfficialApiLibrary({
        name: values.name,
        description: values.description,
        connector_type: values.connector_type,
        category_name: values.category_name,
        category_code: values.category_code,
        category_description: values.category_description,
        api_uuids: values.api_uuids,
        submitter_hint: values.submitter_hint,
      });
      messageApi.success(
        t('pages.system.apis.librarySubmitSuccess', {
          name: result.name,
          count: result.api_count,
        }),
      );
      onSubmitted?.();
      onClose();
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'errorFields' in error) {
        return;
      }
      const err = error as { message?: string };
      messageApi.error(err?.message || t('pages.system.apis.librarySubmitFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={t('pages.system.apis.librarySubmitTitle')}
      open={open}
      onCancel={onClose}
      destroyOnHidden
      width={640}
      footer={
        <Space>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            type="primary"
            loading={submitting}
            disabled={apis.length === 0}
            onClick={() => void handleSubmit()}
          >
            {t('pages.system.apis.librarySubmitAction')}
          </Button>
        </Space>
      }
    >
      <Spin spinning={loadingApis}>
        {apis.length === 0 && !loadingApis ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            title={t('pages.system.apis.librarySubmitLocalEmpty')}
          />
        ) : null}
        <Form form={form} layout="vertical" requiredMark>
          <Form.Item
            name="name"
            label={t('pages.system.apis.librarySubmitPackName')}
            rules={[{ required: true, message: t('pages.system.apis.librarySubmitPackNameRequired') }]}
          >
            <Input placeholder={t('pages.system.apis.librarySubmitPackNamePlaceholder')} maxLength={100} />
          </Form.Item>
          <Form.Item name="description" label={t('pages.system.apis.librarySubmitPackDescription')}>
            <Input.TextArea
              rows={2}
              placeholder={t('pages.system.apis.librarySubmitPackDescriptionPlaceholder')}
              maxLength={2000}
            />
          </Form.Item>
          <Form.Item
            name="category_name"
            label={t('pages.system.apis.librarySubmitCategoryName')}
            rules={[
              { required: true, message: t('pages.system.apis.librarySubmitCategoryNameRequired') },
            ]}
          >
            <Input placeholder={t('pages.system.apis.librarySubmitCategoryNamePlaceholder')} maxLength={50} />
          </Form.Item>
          <Form.Item
            name="connector_type"
            label={t('pages.system.apis.librarySubmitConnectorType')}
            rules={[
              { required: true, message: t('pages.system.apis.librarySubmitConnectorTypeRequired') },
            ]}
            extra={t('pages.system.apis.librarySubmitConnectorTypeHint')}
          >
            <Input placeholder={t('pages.system.apis.librarySubmitConnectorTypePlaceholder')} maxLength={50} />
          </Form.Item>
          <Form.Item
            name="api_uuids"
            label={t('pages.system.apis.librarySubmitApis')}
            rules={[{ required: true, message: t('pages.system.apis.librarySubmitApisRequired') }]}
          >
            <Select
              mode="multiple"
              allowClear
              optionFilterProp="label"
              placeholder={t('pages.system.apis.librarySubmitApisPlaceholder')}
              options={apiOptions}
              onChange={handleApiSelectionChange}
              maxTagCount="responsive"
              notFoundContent={t('pages.system.apis.librarySubmitLocalEmpty')}
            />
          </Form.Item>
          <Form.Item name="submitter_hint" label={t('pages.system.apis.librarySubmitHint')}>
            <Input placeholder={t('pages.system.apis.librarySubmitHintPlaceholder')} maxLength={200} />
          </Form.Item>
        </Form>
      </Spin>
    </Modal>
  );
};
