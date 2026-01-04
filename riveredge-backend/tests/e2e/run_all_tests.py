"""
运行所有端到端测试

提供统一的测试运行入口，生成测试报告。

Author: Auto (AI Assistant)
Date: 2026-01-03
"""

import subprocess
import sys
from pathlib import Path
from datetime import datetime


def run_tests():
    """运行所有端到端测试"""
    print("=" * 80)
    print("开始运行全流程自动化测试")
    print("=" * 80)
    print(f"测试时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("")
    
    # 测试文件列表
    test_files = [
        "test_mts_workflow.py",
        "test_mto_workflow.py",
        "test_purchase_workflow.py",
        "test_quality_workflow.py",
        "test_finance_workflow.py",
    ]
    
    # 运行pytest
    test_dir = Path(__file__).parent
    backend_root = test_dir.parent.parent
    
    # 使用uv run来确保使用正确的Python环境和依赖
    cmd = [
        "uv", "run", "pytest",
        str(test_dir),
        "-v",
        "--tb=short",
        "--asyncio-mode=auto",
        "-W", "ignore::DeprecationWarning",
        f"--junit-xml={backend_root / 'test_results.xml'}",
        f"--html={backend_root / 'test_report.html'}",
        "--self-contained-html"
    ]
    
    print(f"执行命令: {' '.join(cmd)}")
    print("")
    
    result = subprocess.run(cmd, cwd=test_dir.parent.parent)
    
    print("")
    print("=" * 80)
    if result.returncode == 0:
        print("✅ 所有测试通过！")
    else:
        print("❌ 部分测试失败，请查看详细报告")
    print("=" * 80)
    
    return result.returncode


if __name__ == "__main__":
    exit_code = run_tests()
    sys.exit(exit_code)

