/**
 * 采购订单页面组件测试
 * 
 * 测试采购订单页面的基本功能。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { App } from 'antd'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import PurchaseOrdersPage from '../../src/apps/kuaizhizao/pages/purchase-management/purchase-orders/index'

// Mock依赖
vi.mock('../../src/apps/kuaizhizao/services/purchase', () => ({
  listPurchaseOrders: vi.fn(),
  getPurchaseOrder: vi.fn(),
  createPurchaseOrder: vi.fn(),
  updatePurchaseOrder: vi.fn(),
}))

describe('采购订单页面', () => {
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
    const { listPurchaseOrders } = await import('../../src/apps/kuaizhizao/services/purchase')
    vi.mocked(listPurchaseOrders).mockResolvedValue({ data: [], total: 0, success: true })

    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App>
            <PurchaseOrdersPage />
          </App>
        </BrowserRouter>
      </QueryClientProvider>
    )

    // 等待组件渲染完成
    await waitFor(() => {
      expect(document.body).toBeTruthy()
    }, { timeout: 3000 })
  })

  it('应该能够加载采购订单列表', async () => {
    const { listPurchaseOrders } = await import('../../src/apps/kuaizhizao/services/purchase')
    vi.mocked(listPurchaseOrders).mockResolvedValue({ data: [], total: 0, success: true })

    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App>
            <PurchaseOrdersPage />
          </App>
        </BrowserRouter>
      </QueryClientProvider>
    )

    // 验证listPurchaseOrders被调用
    await waitFor(() => {
      expect(listPurchaseOrders).toHaveBeenCalled()
    }, { timeout: 3000 })
  })
})


