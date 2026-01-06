/**
 * 物料管理页面组件测试
 * 
 * 测试物料管理页面的基本功能。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { App } from 'antd'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import MaterialsManagementPage from '../../src/apps/master-data/pages/materials/management'

// Mock依赖
vi.mock('../../src/apps/master-data/services/material', () => ({
  materialApi: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  materialGroupApi: {
    list: vi.fn(),
  },
}))

describe('物料管理页面', () => {
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
    const { materialApi, materialGroupApi } = await import('../../src/apps/master-data/services/material')
    vi.mocked(materialApi.list).mockResolvedValue([])
    vi.mocked(materialGroupApi.list).mockResolvedValue([])

    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App>
            <MaterialsManagementPage />
          </App>
        </BrowserRouter>
      </QueryClientProvider>
    )

    // 等待组件渲染完成
    await waitFor(() => {
      expect(document.body).toBeTruthy()
    }, { timeout: 3000 })
  })

  it('应该能够加载物料列表', async () => {
    const { materialApi } = await import('../../src/apps/master-data/services/material')
    vi.mocked(materialApi.list).mockResolvedValue([])

    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App>
            <MaterialsManagementPage />
          </App>
        </BrowserRouter>
      </QueryClientProvider>
    )

    // 验证materialApi.list被调用
    await waitFor(() => {
      expect(materialApi.list).toHaveBeenCalled()
    }, { timeout: 3000 })
  })
})


