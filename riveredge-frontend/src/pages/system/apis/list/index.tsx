/**
 * 接口管理列表页面
 *
 * 用于系统管理员查看和管理组织内的接口。
 * 支持接口的 CRUD 操作和接口测试功能。
 */

import React, { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActionType,
  ProColumns,
  ProFormText,
  ProFormTextArea,
  ProFormSwitch,
  ProFormList,
  ProFormGroup,
} from '@ant-design/pro-components'
import SafeProFormSelect from '../../../../components/safe-pro-form-select'
import {
  App,
  Popconfirm,
  Button,
  Tag,
  Space,
  Drawer,
  Input,
  Typography,
  Modal,
} from 'antd'
import {
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import { UniTable } from '../../../../components/uni-table'
import {
  ListPageTemplate,
  FormModalTemplate,
  DetailDrawerTemplate,
  MODAL_CONFIG,
  DRAWER_CONFIG,
} from '../../../../components/layout-templates'
import {
  getAPIList,
  getAPIByUuid,
  createAPI,
  updateAPI,
  deleteAPI,
  testAPI,
  API,
  CreateAPIData,
  UpdateAPIData,
  APITestRequest,
  APITestResponse,
} from '../../../../services/apiManagement'
import { CODE_FONT_FAMILY } from '../../../../constants/fonts'

const { TextArea } = Input
const { Text, Paragraph } = Typography

/** 将对象转为键值对数组，用于表单 */
const objectToKeyValueList = (
  obj: Record<string, any> | undefined
): Array<{ key: string; value: string }> => {
  if (!obj || typeof obj !== 'object') return []
  return Object.entries(obj).map(([key, value]) => ({
    key,
    value: typeof value === 'string' ? value : JSON.stringify(value),
  }))
}

/** 将键值对数组转为对象，用于提交 */
const keyValueListToObject = (
  list: Array<{ key?: string; value?: string }> | undefined
): Record<string, any> => {
  if (!Array.isArray(list)) return {}
  return list.reduce<Record<string, any>>((acc, { key, value }) => {
    if (!key) return acc
    if (value === undefined || value === '') {
      acc[key] = ''
      return acc
    }
    const trimmed = value.trim()
    if (
      trimmed.startsWith('{') ||
      trimmed.startsWith('[') ||
      trimmed === 'true' ||
      trimmed === 'false'
    ) {
      try {
        acc[key] = JSON.parse(trimmed)
      } catch {
        acc[key] = value
      }
    } else if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      acc[key] = Number(trimmed)
    } else {
      acc[key] = value
    }
    return acc
  }, {})
}

/**
 * 接口管理列表页面组件
 */
const APIListPage: React.FC = () => {
  const { t } = useTranslation()
  const { message: messageApi } = App.useApp()
  const actionRef = useRef<ActionType>(null)
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])

  // Modal 相关状态（创建/编辑接口）
  const [modalVisible, setModalVisible] = useState(false)
  const [isEdit, setIsEdit] = useState(false)
  const [currentApiUuid, setCurrentApiUuid] = useState<string | null>(null)
  const [formLoading, setFormLoading] = useState(false)
  const [formInitialValues, setFormInitialValues] = useState<Record<string, any> | undefined>(
    undefined
  )

  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [detailData, setDetailData] = useState<API | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // 测试接口状态
  const [testDrawerVisible, setTestDrawerVisible] = useState(false)
  const [testingApiUuid, setTestingApiUuid] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<APITestResponse | null>(null)
  const [testLoading, setTestLoading] = useState(false)
  const [testRequestJson, setTestRequestJson] = useState<string>('{}')

  /**
   * 处理新建接口
   */
  const handleCreate = () => {
    setIsEdit(false)
    setCurrentApiUuid(null)
    setFormInitialValues({
      method: 'GET',
      is_active: true,
      is_system: false,
      request_headers: [],
      request_params: [],
      request_body: [],
      response_format: [],
      response_example: [],
    })
    setModalVisible(true)
  }

  /**
   * 处理编辑接口
   */
  const handleEdit = async (record: API) => {
    try {
      setIsEdit(true)
      setCurrentApiUuid(record.uuid)

      // 获取接口详情
      const detail = await getAPIByUuid(record.uuid)
      setFormInitialValues({
        name: detail.name,
        code: detail.code,
        description: detail.description,
        path: detail.path,
        method: detail.method,
        is_active: detail.is_active,
        is_system: detail.is_system,
        request_headers: objectToKeyValueList(detail.request_headers),
        request_params: objectToKeyValueList(detail.request_params),
        request_body: objectToKeyValueList(detail.request_body),
        response_format: objectToKeyValueList(detail.response_format),
        response_example: objectToKeyValueList(detail.response_example),
      })
      setModalVisible(true)
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.apis.getDetailFailed'))
    }
  }

  /**
   * 处理查看详情
   */
  const handleView = async (record: API) => {
    try {
      setDetailLoading(true)
      setDrawerVisible(true)
      const detail = await getAPIByUuid(record.uuid)
      setDetailData(detail)
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.apis.getDetailFailed'))
    } finally {
      setDetailLoading(false)
    }
  }

  /**
   * 处理删除接口
   */
  const handleDelete = async (record: API) => {
    try {
      await deleteAPI(record.uuid)
      messageApi.success(t('pages.system.apis.deleteSuccess'))
      actionRef.current?.reload()
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.apis.deleteFailed'))
    }
  }

  /**
   * 批量删除接口（系统接口会由后端拒绝）
   */
  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning(t('pages.system.apis.selectToDelete'))
      return
    }
    Modal.confirm({
      title: t('pages.system.apis.batchDeleteConfirm', { count: selectedRowKeys.length }),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      okType: 'danger',
      onOk: async () => {
        try {
          let done = 0
          let fail = 0
          for (const uuid of selectedRowKeys) {
            try {
              await deleteAPI(String(uuid))
              done++
            } catch {
              fail++
            }
          }
          if (fail > 0) {
            messageApi.warning(t('pages.system.apis.batchDeleteDone', { done, fail }))
          } else {
            messageApi.success(t('pages.system.apis.batchDeleteSuccessCount', { count: done }))
          }
          setSelectedRowKeys([])
          actionRef.current?.reload()
        } catch (error: any) {
          messageApi.error(error.message || t('pages.system.apis.batchDeleteFailed'))
        }
      },
    })
  }

  /**
   * 处理测试接口
   */
  const handleTest = async (record: API) => {
    try {
      setTestingApiUuid(record.uuid)
      setTestDrawerVisible(true)
      setTestRequestJson('{}')
      setTestResult(null)
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.apis.openTestFailed'))
    }
  }

  /**
   * 执行接口测试
   */
  const handleExecuteTest = async () => {
    if (!testingApiUuid) return

    try {
      setTestLoading(true)

      // 解析测试请求 JSON
      let testRequest: APITestRequest = {}
      try {
        testRequest = JSON.parse(testRequestJson)
      } catch (e) {
        messageApi.error(t('pages.system.apis.testRequestJsonInvalid'))
        return
      }

      const result = await testAPI(testingApiUuid, testRequest)
      setTestResult(result)

      if (result.status_code >= 200 && result.status_code < 300) {
        messageApi.success(t('pages.system.apis.testSuccess'))
      } else {
        messageApi.warning(t('pages.system.apis.testCompleteStatus', { code: result.status_code }))
      }
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.apis.testFailed'))
    } finally {
      setTestLoading(false)
    }
  }

  /**
   * 处理提交表单（创建/更新接口）
   */
  const handleSubmit = async (values: any): Promise<void> => {
    try {
      setFormLoading(true)

      // 解析键值对表单为对象
      const requestHeaders = keyValueListToObject(values.request_headers)
      const requestParams = keyValueListToObject(values.request_params)
      const requestBody = keyValueListToObject(values.request_body)
      const responseFormat = keyValueListToObject(values.response_format)
      const responseExample = keyValueListToObject(values.response_example)

      if (isEdit && currentApiUuid) {
        await updateAPI(currentApiUuid, {
          name: values.name,
          code: values.code,
          description: values.description,
          path: values.path,
          method: values.method,
          request_headers: requestHeaders,
          request_params: requestParams,
          request_body: requestBody,
          response_format: responseFormat,
          response_example: responseExample,
          is_active: values.is_active,
        } as UpdateAPIData)
        messageApi.success(t('pages.system.apis.updateSuccess'))
      } else {
        await createAPI({
          name: values.name,
          code: values.code,
          description: values.description,
          path: values.path,
          method: values.method,
          request_headers: requestHeaders,
          request_params: requestParams,
          request_body: requestBody,
          response_format: responseFormat,
          response_example: responseExample,
          is_active: values.is_active,
          is_system: values.is_system || false,
        } as CreateAPIData)
        messageApi.success(t('pages.system.apis.createSuccess'))
      }

      setModalVisible(false)
      setFormInitialValues(undefined)
      actionRef.current?.reload()
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.apis.operationFailed'))
      throw error
    } finally {
      setFormLoading(false)
    }
  }

  /**
   * 表格列定义
   */
  const columns: ProColumns<API>[] = [
    {
      title: t('pages.system.apis.columnName'),
      dataIndex: 'name',
      width: 200,
      fixed: 'left',
    },
    {
      title: t('pages.system.apis.columnCode'),
      dataIndex: 'code',
      width: 150,
    },
    {
      title: t('pages.system.apis.columnMethod'),
      dataIndex: 'method',
      width: 100,
      valueType: 'select',
      valueEnum: {
        GET: { text: 'GET', status: 'Success' },
        POST: { text: 'POST', status: 'Processing' },
        PUT: { text: 'PUT', status: 'Warning' },
        DELETE: { text: 'DELETE', status: 'Error' },
        PATCH: { text: 'PATCH', status: 'Default' },
      },
      render: (_, record) => {
        const methodColors: Record<string, string> = {
          GET: 'green',
          POST: 'blue',
          PUT: 'orange',
          DELETE: 'red',
          PATCH: 'purple',
        }
        return <Tag color={methodColors[record.method] || 'default'}>{record.method}</Tag>
      },
    },
    {
      title: t('pages.system.apis.columnPath'),
      dataIndex: 'path',
      ellipsis: true,
      width: 300,
    },
    {
      title: t('pages.system.apis.columnDescription'),
      dataIndex: 'description',
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: t('pages.system.apis.columnActive'),
      dataIndex: 'is_active',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: t('pages.system.apis.enabled'), status: 'Success' },
        false: { text: t('pages.system.apis.disabled'), status: 'Default' },
      },
      render: (_, record) => (
        <Tag color={record.is_active ? 'success' : 'default'}>
          {record.is_active ? t('pages.system.apis.enabled') : t('pages.system.apis.disabled')}
        </Tag>
      ),
    },
    {
      title: t('pages.system.apis.columnSystem'),
      dataIndex: 'is_system',
      width: 100,
      hideInSearch: true,
      render: (_, record) =>
        record.is_system ? (
          <Tag color="purple">{t('pages.system.apis.systemTag')}</Tag>
        ) : (
          <Tag>{t('pages.system.apis.customTag')}</Tag>
        ),
    },
    {
      title: t('pages.system.apis.columnCreatedAt'),
      dataIndex: 'created_at',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t('pages.system.apis.columnActions'),
      valueType: 'option',
      width: 250,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleView(record)}
          >
            {t('pages.system.apis.view')}
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            {t('pages.system.apis.edit')}
          </Button>
          <Button
            type="link"
            size="small"
            icon={<ThunderboltOutlined />}
            onClick={() => handleTest(record)}
          >
            {t('pages.system.apis.test')}
          </Button>
          {!record.is_system && (
            <Popconfirm
              title={t('pages.system.apis.deleteConfirmTitle')}
              onConfirm={() => handleDelete(record)}
            >
              <Button type="link" danger size="small" icon={<DeleteOutlined />}>
                {t('pages.system.apis.delete')}
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <>
      <ListPageTemplate>
        <UniTable<API>
          actionRef={actionRef}
          columns={columns}
          request={async (params, sort, _filter, searchFormValues) => {
            // 处理搜索参数
            const apiParams: any = {
              page: params.current || 1,
              page_size: params.pageSize || 20,
            }

            // 搜索关键词
            if (searchFormValues?.search) {
              apiParams.search = searchFormValues.search
            }

            // 方法筛选
            if (searchFormValues?.method) {
              apiParams.method = searchFormValues.method
            }

            // 启用状态筛选
            if (
              searchFormValues?.is_active !== undefined &&
              searchFormValues.is_active !== '' &&
              searchFormValues.is_active !== null
            ) {
              apiParams.is_active = searchFormValues.is_active
            }

            try {
              const result = await getAPIList(apiParams)
              return {
                data: result.items,
                success: true,
                total: result.total,
              }
            } catch (error: any) {
              console.error('获取接口列表失败:', error)
              messageApi.error(error?.message || t('pages.system.apis.loadListFailed'))
              return {
                data: [],
                success: false,
                total: 0,
              }
            }
          }}
          rowKey="uuid"
          showAdvancedSearch={true}
          enableRowSelection
          onRowSelectionChange={setSelectedRowKeys}
          rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
          showDeleteButton
          onDelete={handleBatchDelete}
          deleteButtonText={t('pages.system.apis.batchDelete')}
          showCreateButton
          onCreate={handleCreate}
          createButtonText={t('pages.system.apis.createButton')}
          showImportButton
          onImport={async data => {
            if (!data || data.length < 2) {
              messageApi.warning(t('pages.system.apis.fillImportData'))
              return
            }
            const headers = (data[0] || []).map((h: any) =>
              String(h || '')
                .replace(/^\*/, '')
                .trim()
            )
            const rows = data
              .slice(1)
              .filter((row: any[]) => row.some((c: any) => c != null && String(c).trim()))
            const fieldMap: Record<string, string> = {
              接口名称: 'name',
              name: 'name',
              接口代码: 'code',
              code: 'code',
              接口路径: 'path',
              path: 'path',
              请求方法: 'method',
              method: 'method',
              描述: 'description',
              description: 'description',
              启用状态: 'is_active',
              is_active: 'is_active',
            }
            let done = 0
            for (const row of rows) {
              const obj: Record<string, any> = {}
              headers.forEach((h, i) => {
                const field = fieldMap[h] || fieldMap[h?.trim()]
                if (field && row[i] != null) obj[field] = row[i]
              })
              if (obj.name && obj.code && obj.path && obj.method) {
                await createAPI({
                  name: String(obj.name),
                  code: String(obj.code)
                    .replace(/[^a-z0-9_]/g, '_')
                    .toLowerCase(),
                  path: String(obj.path),
                  method: String(obj.method).toUpperCase() || 'GET',
                  description: obj.description ? String(obj.description) : undefined,
                  is_active:
                    obj.is_active !== 'false' && obj.is_active !== '0' && obj.is_active !== '',
                  is_system: false,
                } as CreateAPIData)
                done++
              }
            }
            messageApi.success(t('pages.system.apis.importSuccessCount', { count: done }))
            actionRef.current?.reload()
          }}
          showExportButton
          onExport={async (type, keys, pageData) => {
            let items: API[] = []
            if (type === 'selected' && keys?.length) {
              items = await Promise.all(keys.map(k => getAPIByUuid(String(k))))
            } else if (type === 'currentPage' && pageData?.length) {
              items = pageData
            } else {
              const res = await getAPIList({ page: 1, page_size: 10000 })
              items = res.items
            }
            if (items.length === 0) {
              messageApi.warning(t('pages.system.apis.noDataToExport'))
              return
            }
            const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `apis-${new Date().toISOString().slice(0, 10)}.json`
            a.click()
            URL.revokeObjectURL(url)
            messageApi.success(t('pages.system.apis.exportSuccess'))
          }}
          pagination={{
            defaultPageSize: 20,
            showSizeChanger: true,
          }}
        />
      </ListPageTemplate>

      {/* 创建/编辑接口 Modal */}
      <FormModalTemplate
        title={isEdit ? t('pages.system.apis.modalEdit') : t('pages.system.apis.modalCreate')}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false)
          setFormInitialValues(undefined)
        }}
        onFinish={handleSubmit}
        isEdit={isEdit}
        initialValues={formInitialValues}
        loading={formLoading}
        width={MODAL_CONFIG.LARGE_WIDTH}
      >
        <ProFormText
          name="name"
          label={t('pages.system.apis.labelName')}
          rules={[{ required: true, message: t('pages.system.apis.nameRequired') }]}
          placeholder={t('pages.system.apis.namePlaceholder')}
          colProps={{ span: 12 }}
        />
        <ProFormText
          name="code"
          label={t('pages.system.apis.labelCode')}
          rules={[
            { required: true, message: t('pages.system.apis.codeRequired') },
            { pattern: /^[a-z0-9_]+$/, message: t('pages.system.apis.codePattern') },
          ]}
          placeholder={t('pages.system.apis.codePlaceholder')}
          disabled={isEdit}
          colProps={{ span: 12 }}
        />
        <ProFormText
          name="path"
          label={t('pages.system.apis.labelPath')}
          rules={[{ required: true, message: t('pages.system.apis.pathRequired') }]}
          placeholder={t('pages.system.apis.pathPlaceholder')}
          colProps={{ span: 12 }}
        />
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
          colProps={{ span: 12 }}
        />
        <ProFormGroup colProps={{ span: 12 }} style={{ paddingLeft: 4, paddingRight: 4 }}>
          <ProFormList
            name="request_headers"
            label={t('pages.system.apis.labelRequestHeaders')}
            creatorButtonProps={{ creatorButtonText: t('pages.system.apis.addRequestHeader') }}
            min={0}
          >
            <ProFormGroup>
              <ProFormText name="key" placeholder={t('pages.system.apis.headerKeyPlaceholder')} colProps={{ span: 8 }} />
              <ProFormText name="value" placeholder={t('pages.system.apis.headerValuePlaceholder')} colProps={{ span: 14 }} />
            </ProFormGroup>
          </ProFormList>
        </ProFormGroup>
        <ProFormGroup colProps={{ span: 12 }} style={{ paddingLeft: 4, paddingRight: 4 }}>
          <ProFormList
            name="request_params"
            label={t('pages.system.apis.labelRequestParams')}
            creatorButtonProps={{ creatorButtonText: t('pages.system.apis.addParam') }}
            min={0}
          >
            <ProFormGroup>
              <ProFormText name="key" placeholder={t('pages.system.apis.paramKeyPlaceholder')} colProps={{ span: 8 }} />
              <ProFormText
                name="value"
                placeholder={t('pages.system.apis.paramValuePlaceholder')}
                colProps={{ span: 14 }}
              />
            </ProFormGroup>
          </ProFormList>
        </ProFormGroup>
        <ProFormGroup colProps={{ span: 12 }} style={{ paddingLeft: 4, paddingRight: 4 }}>
          <ProFormList
            name="request_body"
            label={t('pages.system.apis.labelRequestBody')}
            creatorButtonProps={{ creatorButtonText: t('pages.system.apis.addBodyField') }}
            min={0}
          >
            <ProFormGroup>
              <ProFormText name="key" placeholder={t('pages.system.apis.bodyKeyPlaceholder')} colProps={{ span: 8 }} />
              <ProFormText
                name="value"
                placeholder={t('pages.system.apis.bodyValuePlaceholder')}
                colProps={{ span: 14 }}
              />
            </ProFormGroup>
          </ProFormList>
        </ProFormGroup>
        <ProFormGroup colProps={{ span: 12 }} style={{ paddingLeft: 4, paddingRight: 4 }}>
          <ProFormList
            name="response_format"
            label={t('pages.system.apis.labelResponseFormat')}
            creatorButtonProps={{ creatorButtonText: t('pages.system.apis.addFormatField') }}
            min={0}
          >
            <ProFormGroup>
              <ProFormText name="key" placeholder={t('pages.system.apis.formatKeyPlaceholder')} colProps={{ span: 8 }} />
              <ProFormText name="value" placeholder={t('pages.system.apis.formatValuePlaceholder')} colProps={{ span: 14 }} />
            </ProFormGroup>
          </ProFormList>
        </ProFormGroup>
        <ProFormGroup colProps={{ span: 24 }} style={{ paddingLeft: 4, paddingRight: 4 }}>
          <ProFormList
            name="response_example"
            label={t('pages.system.apis.labelResponseExample')}
            creatorButtonProps={{ creatorButtonText: t('pages.system.apis.addExampleField') }}
            min={0}
          >
            <ProFormGroup>
              <ProFormText name="key" placeholder={t('pages.system.apis.exampleKeyPlaceholder')} colProps={{ span: 8 }} />
              <ProFormText
                name="value"
                placeholder={t('pages.system.apis.exampleValuePlaceholder')}
                colProps={{ span: 14 }}
              />
            </ProFormGroup>
          </ProFormList>
        </ProFormGroup>
        <ProFormTextArea
          name="description"
          label={t('pages.system.apis.labelDescription')}
          placeholder={t('pages.system.apis.descriptionPlaceholder')}
          fieldProps={{ rows: 3 }}
          colProps={{ span: 24 }}
        />
        <ProFormSwitch name="is_active" label={t('pages.system.apis.labelActive')} colProps={{ span: 12 }} />
        {!isEdit && <ProFormSwitch name="is_system" label={t('pages.system.apis.labelSystem')} colProps={{ span: 12 }} />}
      </FormModalTemplate>

      {/* 查看详情 Drawer */}
      <DetailDrawerTemplate
        title={t('pages.system.apis.detailTitle')}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        loading={detailLoading}
        width={DRAWER_CONFIG.LARGE_WIDTH}
        dataSource={detailData}
        columns={[
          { title: t('pages.system.apis.detailColumnName'), dataIndex: 'name' },
          { title: t('pages.system.apis.detailColumnCode'), dataIndex: 'code' },
          { title: t('pages.system.apis.detailColumnDescription'), dataIndex: 'description' },
          {
            title: t('pages.system.apis.detailColumnMethod'),
            dataIndex: 'method',
            render: (value: string) => <Tag color="blue">{value}</Tag>,
          },
          { title: t('pages.system.apis.detailColumnPath'), dataIndex: 'path' },
          {
            title: t('pages.system.apis.detailColumnRequestHeaders'),
            dataIndex: 'request_headers',
            render: (value: any) => (
              <pre
                style={{
                  margin: 0,
                  padding: '8px',
                  backgroundColor: '#f5f5f5',
                  borderRadius: '4px',
                  overflow: 'auto',
                  maxHeight: '200px',
                  fontSize: 12,
                }}
              >
                {JSON.stringify(value || {}, null, 2)}
              </pre>
            ),
          },
          {
            title: t('pages.system.apis.detailColumnRequestParams'),
            dataIndex: 'request_params',
            render: (value: any) => (
              <pre
                style={{
                  margin: 0,
                  padding: '8px',
                  backgroundColor: '#f5f5f5',
                  borderRadius: '4px',
                  overflow: 'auto',
                  maxHeight: '200px',
                  fontSize: 12,
                }}
              >
                {JSON.stringify(value || {}, null, 2)}
              </pre>
            ),
          },
          {
            title: t('pages.system.apis.detailColumnRequestBody'),
            dataIndex: 'request_body',
            render: (value: any) => (
              <pre
                style={{
                  margin: 0,
                  padding: '8px',
                  backgroundColor: '#f5f5f5',
                  borderRadius: '4px',
                  overflow: 'auto',
                  maxHeight: '200px',
                  fontSize: 12,
                }}
              >
                {JSON.stringify(value || {}, null, 2)}
              </pre>
            ),
          },
          {
            title: t('pages.system.apis.detailColumnResponseFormat'),
            dataIndex: 'response_format',
            render: (value: any) => (
              <pre
                style={{
                  margin: 0,
                  padding: '8px',
                  backgroundColor: '#f5f5f5',
                  borderRadius: '4px',
                  overflow: 'auto',
                  maxHeight: '200px',
                  fontSize: 12,
                }}
              >
                {JSON.stringify(value || {}, null, 2)}
              </pre>
            ),
          },
          {
            title: t('pages.system.apis.detailColumnResponseExample'),
            dataIndex: 'response_example',
            render: (value: any) => (
              <pre
                style={{
                  margin: 0,
                  padding: '8px',
                  backgroundColor: '#f5f5f5',
                  borderRadius: '4px',
                  overflow: 'auto',
                  maxHeight: '200px',
                  fontSize: 12,
                }}
              >
                {JSON.stringify(value || {}, null, 2)}
              </pre>
            ),
          },
          {
            title: t('pages.system.apis.detailColumnActive'),
            dataIndex: 'is_active',
            render: (value: boolean) => (
              <Tag color={value ? 'success' : 'default'}>
                {value ? t('pages.system.apis.enabled') : t('pages.system.apis.disabled')}
              </Tag>
            ),
          },
          {
            title: t('pages.system.apis.detailColumnSystem'),
            dataIndex: 'is_system',
            render: (value: boolean) =>
              value ? (
                <Tag color="purple">{t('pages.system.apis.systemTag')}</Tag>
              ) : (
                <Tag>{t('pages.system.apis.customTag')}</Tag>
              ),
          },
          { title: t('pages.system.apis.detailColumnCreatedAt'), dataIndex: 'created_at', valueType: 'dateTime' },
          { title: t('pages.system.apis.detailColumnUpdatedAt'), dataIndex: 'updated_at', valueType: 'dateTime' },
        ]}
      />

      {/* 接口测试 Drawer */}
      <Drawer
        title={t('pages.system.apis.testDrawerTitle')}
        open={testDrawerVisible}
        onClose={() => {
          setTestDrawerVisible(false)
          setTestingApiUuid(null)
          setTestResult(null)
          setTestRequestJson('{}')
        }}
        size={800}
        extra={
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            loading={testLoading}
            onClick={handleExecuteTest}
          >
            {t('pages.system.apis.executeTest')}
          </Button>
        }
      >
        {testingApiUuid && (
          <>
            <div style={{ marginBottom: 16 }}>
              <Paragraph>
                <Text strong>{t('pages.system.apis.testRequestLabel')}</Text>
              </Paragraph>
              <TextArea
                value={testRequestJson}
                onChange={e => setTestRequestJson(e.target.value)}
                rows={8}
                placeholder={t('pages.system.apis.testRequestPlaceholder')}
                style={{ fontFamily: CODE_FONT_FAMILY, fontSize: 12 }}
              />
            </div>

            {testResult && (
              <div>
                <Paragraph>
                  <Text strong>{t('pages.system.apis.testResultLabel')}</Text>
                </Paragraph>
                <div style={{ marginBottom: 16 }}>
                  <Space>
                    <Text>{t('pages.system.apis.statusCodeLabel')}</Text>
                    <Tag
                      color={
                        testResult.status_code >= 200 && testResult.status_code < 300
                          ? 'success'
                          : 'error'
                      }
                    >
                      {testResult.status_code}
                    </Tag>
                    <Text>{t('pages.system.apis.elapsedLabel')}</Text>
                    <Tag>{testResult.elapsed_time}s</Tag>
                  </Space>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <Text strong>{t('pages.system.apis.responseHeadersLabel')}</Text>
                  <pre
                    style={{
                      margin: '8px 0',
                      padding: '8px',
                      backgroundColor: '#f5f5f5',
                      borderRadius: '4px',
                      overflow: 'auto',
                      maxHeight: '200px',
                      fontSize: 12,
                    }}
                  >
                    {JSON.stringify(testResult.headers, null, 2)}
                  </pre>
                </div>
                <div>
                  <Text strong>{t('pages.system.apis.responseBodyLabel')}</Text>
                  <pre
                    style={{
                      margin: '8px 0',
                      padding: '8px',
                      backgroundColor: '#f5f5f5',
                      borderRadius: '4px',
                      overflow: 'auto',
                      maxHeight: '400px',
                      fontSize: 12,
                    }}
                  >
                    {typeof testResult.body === 'string'
                      ? testResult.body
                      : JSON.stringify(testResult.body, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </>
        )}
      </Drawer>
    </>
  )
}

export default APIListPage
