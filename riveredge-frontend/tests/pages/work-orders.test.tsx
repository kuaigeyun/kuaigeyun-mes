/**
 * 工单管理页面组件测试
 * 
 * 测试工单管理页面的基本功能。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { App } from 'antd'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import WorkOrdersPage from '../../src/apps/kuaizhizao/pages/production-execution/work-orders/index'

// Mock依赖
vi.mock('../../src/apps/kuaizhizao/services/production', () => ({
  workOrderApi: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  reworkOrderApi: {
    list: vi.fn(),
  },
  outsourceOrderApi: {
    list: vi.fn(),
  },
}))

vi.mock('../../src/apps/kuaizhizao/services/sales-forecast', () => ({
  getDocumentRelations: vi.fn(),
}))

vi.mock('../../src/apps/master-data/services/process', () => ({
  operationApi: {
    list: vi.fn(),
  },
}))

vi.mock('../../src/apps/master-data/services/factory', () => ({
  workshopApi: {
    list: vi.fn(),
  },
}))

vi.mock('../../src/apps/master-data/services/supply-chain', () => ({
  supplierApi: {
    list: vi.fn(),
  },
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  }
})

describe('工单管理页面', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          cacheTime: 0,
        },
        mutations: {
          retry: false,
        },
      },
    })
  })

  it('应该渲染页面', async () => {
    const { workOrderApi } = await import('../../src/apps/kuaizhizao/services/production')
    vi.mocked(workOrderApi.list).mockResolvedValue([])

    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App>
            <WorkOrdersPage />
          </App>
        </BrowserRouter>
      </QueryClientProvider>
    )

    // 等待组件渲染完成
    await waitFor(() => {
      expect(document.body).toBeTruthy()
    }, { timeout: 3000 })
  })

  it('应该能够加载工单列表', async () => {
    const { workOrderApi } = await import('../../src/apps/kuaizhizao/services/production')
    vi.mocked(workOrderApi.list).mockResolvedValue([])

    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App>
            <WorkOrdersPage />
          </App>
        </BrowserRouter>
      </QueryClientProvider>
    )

    // 验证workOrderApi.list被调用
    await waitFor(() => {
      expect(workOrderApi.list).toHaveBeenCalled()
    }, { timeout: 3000 })
  })
})

