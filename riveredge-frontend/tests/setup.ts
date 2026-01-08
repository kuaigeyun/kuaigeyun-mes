/**
 * 测试环境配置
 * 
 * 配置测试环境的基础设置，包括API URL、认证等
 */

import { vi } from 'vitest'

// 配置测试环境的API基础URL
// 如果设置了环境变量，使用环境变量，否则使用默认值
const TEST_BACKEND_URL = process.env.VITE_BACKEND_URL || process.env.VITE_API_TARGET || 'http://localhost:8100'

// 设置全局测试配置
globalThis.TEST_CONFIG = {
  BACKEND_URL: TEST_BACKEND_URL,
  API_BASE_URL: `${TEST_BACKEND_URL}/api/v1`,
}

// Mock localStorage（如果需要）
if (typeof localStorage === 'undefined') {
  const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  }
  global.localStorage = localStorageMock as any
}

// 设置测试token（如果需要）
if (typeof localStorage !== 'undefined') {
  // 可以从环境变量或测试配置中获取token
  const testToken = process.env.TEST_AUTH_TOKEN
  if (testToken) {
    localStorage.setItem('token', testToken)
  }
  
  // 设置测试租户ID
  const testTenantId = process.env.TEST_TENANT_ID || '1'
  localStorage.setItem('tenant_id', testTenantId)
}

console.log('🧪 测试环境配置:')
console.log(`  后端URL: ${TEST_BACKEND_URL}`)
console.log(`  API基础URL: ${globalThis.TEST_CONFIG.API_BASE_URL}`)
