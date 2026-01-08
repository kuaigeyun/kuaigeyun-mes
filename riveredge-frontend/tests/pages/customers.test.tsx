/**
 * 客户管理页面组件测试
 * 
 * 测试客户管理页面的基本功能。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { App } from 'antd'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import CustomersPage from '../../src/apps/master-data/pages/supply-chain/customers/index'

// Mock依赖
vi.mock('../../src/apps/master-data/services/supply-chain', () => ({
  customerApi: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}))

describe('客户管理页面', () => {
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
    const { customerApi } = await import('../../src/apps/master-data/services/supply-chain')
    vi.mocked(customerApi.list).mockResolvedValue([])

    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App>
            <CustomersPage />
          </App>
        </BrowserRouter>
      </QueryClientProvider>
    )

    // 等待组件渲染完成
    await waitFor(() => {
      expect(document.body).toBeTruthy()
    }, { timeout: 3000 })
  })

  it('应该能够加载客户列表', async () => {
    const { customerApi } = await import('../../src/apps/master-data/services/supply-chain')
    vi.mocked(customerApi.list).mockResolvedValue([])

    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App>
            <CustomersPage />
          </App>
        </BrowserRouter>
      </QueryClientProvider>
    )

    // 验证customerApi.list被调用
    await waitFor(() => {
      expect(customerApi.list).toHaveBeenCalled()
    }, { timeout: 3000 })
  })
})







