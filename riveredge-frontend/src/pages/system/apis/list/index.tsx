/**
 * 接口管理列表页面
 *
 * 用于系统管理员查看和管理组织内的接口。
 * 支持接口的 CRUD 操作和接口测试功能。
 */

import React, { useRef, useState } from 'react'
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
  const { message: messageApi } = App.useApp()
  const actionRef = useRef<ActionType>(null)

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
      messageApi.error(error.message || '获取接口详情失败')
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
      messageApi.error(error.message || '获取接口详情失败')
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
      messageApi.success('删除成功')
      actionRef.current?.reload()
    } catch (error: any) {
      messageApi.error(error.message || '删除失败')
    }
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
      messageApi.error(error.message || '打开测试面板失败')
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
        messageApi.error('测试请求 JSON 格式不正确')
        return
      }

      const result = await testAPI(testingApiUuid, testRequest)
      setTestResult(result)

      if (result.status_code >= 200 && result.status_code < 300) {
        messageApi.success('接口测试成功')
      } else {
        messageApi.warning(`接口测试完成，状态码: ${result.status_code}`)
      }
    } catch (error: any) {
      messageApi.error(error.message || '接口测试失败')
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
        messageApi.success('更新成功')
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
        messageApi.success('创建成功')
      }

      setModalVisible(false)
      setFormInitialValues(undefined)
      actionRef.current?.reload()
    } catch (error: any) {
      messageApi.error(error.message || '操作失败')
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
      title: '接口名称',
      dataIndex: 'name',
      width: 200,
      fixed: 'left',
    },
    {
      title: '接口代码',
      dataIndex: 'code',
      width: 150,
    },
    {
      title: '请求方法',
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
      title: '接口路径',
      dataIndex: 'path',
      ellipsis: true,
      width: 300,
    },
    {
      title: '描述',
      dataIndex: 'description',
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: '启用状态',
      dataIndex: 'is_active',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: '启用', status: 'Success' },
        false: { text: '禁用', status: 'Default' },
      },
      render: (_, record) => (
        <Tag color={record.is_active ? 'success' : 'default'}>
          {record.is_active ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '系统接口',
      dataIndex: 'is_system',
      width: 100,
      hideInSearch: true,
      render: (_, record) =>
        record.is_system ? <Tag color="purple">系统</Tag> : <Tag>自定义</Tag>,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
    },
    {
      title: '操作',
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
            查看
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            icon={<ThunderboltOutlined />}
            onClick={() => handleTest(record)}
          >
            测试
          </Button>
          {!record.is_system && (
            <Popconfirm title="确定要删除这个接口吗？" onConfirm={() => handleDelete(record)}>
              <Button type="link" danger size="small" icon={<DeleteOutlined />}>
                删除
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
              messageApi.error(error?.message || '获取接口列表失败')
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
          showCreateButton
          onCreate={handleCreate}
          createButtonText="新建接口"
          showImportButton
          onImport={async data => {
            if (!data || data.length < 2) {
              messageApi.warning('请填写导入数据')
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
            messageApi.success(`成功导入 ${done} 条`)
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
              messageApi.warning('暂无数据可导出')
              return
            }
            const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `apis-${new Date().toISOString().slice(0, 10)}.json`
            a.click()
            URL.revokeObjectURL(url)
            messageApi.success('导出成功')
          }}
          pagination={{
            defaultPageSize: 20,
            showSizeChanger: true,
          }}
        />
      </ListPageTemplate>

      {/* 创建/编辑接口 Modal */}
      <FormModalTemplate
        title={isEdit ? '编辑接口' : '新建接口'}
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
          label="接口名称"
          rules={[{ required: true, message: '请输入接口名称' }]}
          placeholder="请输入接口名称"
          colProps={{ span: 12 }}
        />
        <ProFormText
          name="code"
          label="接口代码"
          rules={[
            { required: true, message: '请输入接口代码' },
            { pattern: /^[a-z0-9_]+$/, message: '接口代码只能包含小写字母、数字和下划线' },
          ]}
          placeholder="请输入接口代码（唯一标识，如：get_user_info）"
          disabled={isEdit}
          colProps={{ span: 12 }}
        />
        <ProFormText
          name="path"
          label="接口路径"
          rules={[{ required: true, message: '请输入接口路径' }]}
          placeholder="请输入接口路径（如：/api/v1/users 或 https://api.example.com/users）"
          colProps={{ span: 12 }}
        />
        <SafeProFormSelect
          name="method"
          label="请求方法"
          rules={[{ required: true, message: '请选择请求方法' }]}
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
            label="请求头"
            creatorButtonProps={{ creatorButtonText: '添加请求头' }}
            min={0}
          >
            <ProFormGroup>
              <ProFormText name="key" placeholder="键（如 Authorization）" colProps={{ span: 8 }} />
              <ProFormText name="value" placeholder="值" colProps={{ span: 14 }} />
            </ProFormGroup>
          </ProFormList>
        </ProFormGroup>
        <ProFormGroup colProps={{ span: 12 }} style={{ paddingLeft: 4, paddingRight: 4 }}>
          <ProFormList
            name="request_params"
            label="请求参数"
            creatorButtonProps={{ creatorButtonText: '添加参数' }}
            min={0}
          >
            <ProFormGroup>
              <ProFormText name="key" placeholder="键（如 page）" colProps={{ span: 8 }} />
              <ProFormText
                name="value"
                placeholder="值（支持数字、JSON）"
                colProps={{ span: 14 }}
              />
            </ProFormGroup>
          </ProFormList>
        </ProFormGroup>
        <ProFormGroup colProps={{ span: 12 }} style={{ paddingLeft: 4, paddingRight: 4 }}>
          <ProFormList
            name="request_body"
            label="请求体"
            creatorButtonProps={{ creatorButtonText: '添加字段' }}
            min={0}
          >
            <ProFormGroup>
              <ProFormText name="key" placeholder="键" colProps={{ span: 8 }} />
              <ProFormText
                name="value"
                placeholder="值（支持字符串、数字、JSON）"
                colProps={{ span: 14 }}
              />
            </ProFormGroup>
          </ProFormList>
        </ProFormGroup>
        <ProFormGroup colProps={{ span: 12 }} style={{ paddingLeft: 4, paddingRight: 4 }}>
          <ProFormList
            name="response_format"
            label="响应格式"
            creatorButtonProps={{ creatorButtonText: '添加字段' }}
            min={0}
          >
            <ProFormGroup>
              <ProFormText name="key" placeholder="键（如 code、message）" colProps={{ span: 8 }} />
              <ProFormText name="value" placeholder="值" colProps={{ span: 14 }} />
            </ProFormGroup>
          </ProFormList>
        </ProFormGroup>
        <ProFormGroup colProps={{ span: 24 }} style={{ paddingLeft: 4, paddingRight: 4 }}>
          <ProFormList
            name="response_example"
            label="响应示例"
            creatorButtonProps={{ creatorButtonText: '添加字段' }}
            min={0}
          >
            <ProFormGroup>
              <ProFormText name="key" placeholder="键" colProps={{ span: 8 }} />
              <ProFormText
                name="value"
                placeholder="值（支持字符串、数字、JSON）"
                colProps={{ span: 14 }}
              />
            </ProFormGroup>
          </ProFormList>
        </ProFormGroup>
        <ProFormTextArea
          name="description"
          label="描述"
          placeholder="选填"
          fieldProps={{ rows: 3 }}
          colProps={{ span: 24 }}
        />
        <ProFormSwitch name="is_active" label="是否启用" colProps={{ span: 12 }} />
        {!isEdit && <ProFormSwitch name="is_system" label="是否系统接口" colProps={{ span: 12 }} />}
      </FormModalTemplate>

      {/* 查看详情 Drawer */}
      <DetailDrawerTemplate
        title="接口详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        loading={detailLoading}
        width={DRAWER_CONFIG.LARGE_WIDTH}
        dataSource={detailData}
        columns={[
          {
            title: '接口名称',
            dataIndex: 'name',
          },
          {
            title: '接口代码',
            dataIndex: 'code',
          },
          {
            title: '接口描述',
            dataIndex: 'description',
          },
          {
            title: '请求方法',
            dataIndex: 'method',
            render: value => <Tag color="blue">{value}</Tag>,
          },
          {
            title: '接口路径',
            dataIndex: 'path',
          },
          {
            title: '请求头',
            dataIndex: 'request_headers',
            render: value => (
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
            title: '请求参数',
            dataIndex: 'request_params',
            render: value => (
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
            title: '请求体',
            dataIndex: 'request_body',
            render: value => (
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
            title: '响应格式',
            dataIndex: 'response_format',
            render: value => (
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
            title: '响应示例',
            dataIndex: 'response_example',
            render: value => (
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
            title: '启用状态',
            dataIndex: 'is_active',
            render: value => (
              <Tag color={value ? 'success' : 'default'}>{value ? '启用' : '禁用'}</Tag>
            ),
          },
          {
            title: '系统接口',
            dataIndex: 'is_system',
            render: value => (value ? <Tag color="purple">系统</Tag> : <Tag>自定义</Tag>),
          },
          {
            title: '创建时间',
            dataIndex: 'created_at',
            valueType: 'dateTime',
          },
          {
            title: '更新时间',
            dataIndex: 'updated_at',
            valueType: 'dateTime',
          },
        ]}
      />

      {/* 接口测试 Drawer */}
      <Drawer
        title="接口测试"
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
            执行测试
          </Button>
        }
      >
        {testingApiUuid && (
          <>
            <div style={{ marginBottom: 16 }}>
              <Paragraph>
                <Text strong>测试请求（JSON）</Text>
              </Paragraph>
              <TextArea
                value={testRequestJson}
                onChange={e => setTestRequestJson(e.target.value)}
                rows={8}
                placeholder='请输入测试请求（JSON 格式），例如：{"headers": {"Authorization": "Bearer token"}, "params": {"page": 1}, "body": {"name": "test"}}'
                style={{ fontFamily: CODE_FONT_FAMILY, fontSize: 12 }}
              />
            </div>

            {testResult && (
              <div>
                <Paragraph>
                  <Text strong>测试结果</Text>
                </Paragraph>
                <div style={{ marginBottom: 16 }}>
                  <Space>
                    <Text>状态码：</Text>
                    <Tag
                      color={
                        testResult.status_code >= 200 && testResult.status_code < 300
                          ? 'success'
                          : 'error'
                      }
                    >
                      {testResult.status_code}
                    </Tag>
                    <Text>耗时：</Text>
                    <Tag>{testResult.elapsed_time}s</Tag>
                  </Space>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <Text strong>响应头：</Text>
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
                  <Text strong>响应体：</Text>
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
