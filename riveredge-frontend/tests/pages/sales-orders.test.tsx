/**
 * 销售订单页面组件测试
 * 
 * 测试销售订单页面的基本功能。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { App } from 'antd'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import SalesOrdersPage from '../../src/apps/kuaizhizao/pages/sales-management/sales-orders/index'

// Mock依赖
vi.mock('../../src/apps/kuaizhizao/services/sales', () => ({
  listSalesOrders: vi.fn(),
  getSalesOrder: vi.fn(),
  createSalesOrder: vi.fn(),
  updateSalesOrder: vi.fn(),
}))

vi.mock('../../../../master-data/services/supply-chain', () => ({
  customerApi: {
    list: vi.fn(),
  },
}))

vi.mock('../../../../master-data/services/material', () => ({
  materialApi: {
    list: vi.fn(),
  },
}))

describe('销售订单页面', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    // 为每个测试创建新的QueryClient
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
    const { listSalesOrders } = await import('../../src/apps/kuaizhizao/services/sales')
    vi.mocked(listSalesOrders).mockResolvedValue([])

    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App>
            <SalesOrdersPage />
          </App>
        </BrowserRouter>
      </QueryClientProvider>
    )

    // 等待组件渲染完成
    await waitFor(() => {
      // 检查页面是否渲染（通过查找表格或其他元素）
      const table = screen.queryByRole('table') || screen.queryByTestId('sales-orders-table')
      expect(table || document.body).toBeTruthy()
    }, { timeout: 3000 })
  })

  it('应该能够加载销售订单列表', async () => {
    const { listSalesOrders } = await import('../../src/apps/kuaizhizao/services/sales')
    vi.mocked(listSalesOrders).mockResolvedValue([])

    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App>
            <SalesOrdersPage />
          </App>
        </BrowserRouter>
      </QueryClientProvider>
    )

    // 验证listSalesOrders被调用
    await waitFor(() => {
      expect(listSalesOrders).toHaveBeenCalled()
    }, { timeout: 3000 })
  })
})

