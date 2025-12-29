#!/usr/bin/env python3
"""
演示测试脚本

展示如何测试用户创建功能
"""

import json
import subprocess
import sys


def demo_api_test():
    """演示API测试"""
    print("🚀 用户创建功能测试演示")
    print("=" * 50)

    # 演示测试用例
    test_cases = [
        {
            "name": "正常用户创建",
            "data": {
                "username": "demouser001",
                "password": "password123",
                "full_name": "演示用户001",
                "phone": "13800138001",
                "email": "demo001@example.com"
            },
            "expected": "成功创建用户"
        },
        {
            "name": "超长密码测试",
            "data": {
                "username": "demouser002",
                "password": "a" * 100,  # 100字符密码
                "full_name": "演示用户002",
                "phone": "13800138002",
                "email": "demo002@example.com"
            },
            "expected": "bcrypt正确处理长密码"
        },
        {
            "name": "密码过短验证",
            "data": {
                "username": "demouser003",
                "password": "123",  # 过短密码
                "full_name": "演示用户003",
                "phone": "13800138003",
                "email": "demo003@example.com"
            },
            "expected": "前端验证阻止提交"
        }
    ]

    for i, case in enumerate(test_cases, 1):
        print(f"\n{i}. {case['name']}")
        print(f"   预期结果: {case['expected']}")
        print(f"   测试数据: username={case['data']['username']}, password_length={len(case['data']['password'])}")

    print("\n" + "=" * 50)
    print("📝 使用说明:")
    print("1. 启动后端服务: cd riveredge-backend && uv run uvicorn src.server.main:app --host 0.0.0.0 --port 8000 --reload")
    print("2. 使用浏览器访问前端: http://localhost:8100")
    print("3. 在用户管理页面尝试创建上述用户")
    print("4. 观察验证结果和错误提示")

    print("\n🔧 验证要点:")
    print("✅ 超长密码应该能够成功创建（bcrypt自动处理）")
    print("✅ 短密码应该在前端被阻止")
    print("✅ 其他验证规则正常工作")
    print("✅ API返回合适的错误信息")


if __name__ == "__main__":
    demo_api_test()
