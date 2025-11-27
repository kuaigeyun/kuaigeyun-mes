"""
重启后端服务脚本

停止旧的后端进程并启动新的后端服务
"""

import sys
import os
import subprocess
import time
from pathlib import Path

# 添加 src 目录到 Python 路径
src_path = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_path))

def stop_backend(port=9001):
    """停止运行在指定端口的后端服务"""
    try:
        # Windows 上使用 netstat 和 taskkill
        if sys.platform == 'win32':
            # 查找占用端口的进程
            result = subprocess.run(
                ['netstat', '-ano'],
                capture_output=True,
                text=True,
                shell=True
            )
            
            for line in result.stdout.split('\n'):
                if f':{port}' in line and 'LISTENING' in line:
                    parts = line.split()
                    if len(parts) > 4:
                        pid = parts[-1]
                        print(f"找到占用端口 {port} 的进程: PID {pid}")
                        
                        # 停止进程
                        try:
                            subprocess.run(
                                ['taskkill', '/F', '/PID', pid],
                                check=True,
                                shell=True
                            )
                            print(f"✅ 已停止进程 {pid}")
                            time.sleep(1)  # 等待进程完全停止
                            return True
                        except subprocess.CalledProcessError as e:
                            print(f"⚠️  停止进程失败: {e}")
                            return False
            
            print(f"未找到占用端口 {port} 的进程")
            return True
        else:
            # Linux/Mac 上使用 lsof 和 kill
            result = subprocess.run(
                ['lsof', '-ti', f':{port}'],
                capture_output=True,
                text=True
            )
            
            if result.returncode == 0:
                pid = result.stdout.strip()
                print(f"找到占用端口 {port} 的进程: PID {pid}")
                subprocess.run(['kill', '-9', pid], check=True)
                print(f"✅ 已停止进程 {pid}")
                time.sleep(1)
                return True
            else:
                print(f"未找到占用端口 {port} 的进程")
                return True
                
    except Exception as e:
        print(f"⚠️  停止后端服务时出错: {e}")
        return False

def start_backend():
    """启动后端服务"""
    try:
        # 切换到项目目录
        project_root = Path(__file__).parent.parent
        os.chdir(project_root)
        
        # 激活虚拟环境并启动服务（优先使用根目录的 venv311）
        root_venv = project_root.parent / "venv311"
        local_venv = project_root / "venv311"
        
        if sys.platform == 'win32':
            venv_python = root_venv / "Scripts" / "python.exe"
            if not venv_python.exists():
                venv_python = local_venv / "Scripts" / "python.exe"
        else:
            venv_python = root_venv / "bin" / "python"
            if not venv_python.exists():
                venv_python = local_venv / "bin" / "python"
        
        if not venv_python.exists():
            print(f"❌ 虚拟环境未找到: {venv_python}")
            return False
        
        script_path = project_root / "scripts" / "start_backend.py"
        
        print("正在启动后端服务...")
        # 在后台启动服务
        subprocess.Popen(
            [str(venv_python), str(script_path)],
            cwd=str(project_root),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        
        print("✅ 后端服务已启动")
        print("   服务运行在: http://localhost:9001")
        return True
        
    except Exception as e:
        print(f"❌ 启动后端服务失败: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("重启后端服务")
    print("=" * 60)
    
    # 停止旧服务
    print("\n1. 停止旧的后端服务...")
    stop_backend(9001)
    
    # 等待一下确保端口释放
    time.sleep(2)
    
    # 启动新服务
    print("\n2. 启动新的后端服务...")
    if start_backend():
        print("\n✅ 后端服务重启完成")
        print("   请查看控制台输出以确认服务已成功启动")
    else:
        print("\n❌ 后端服务重启失败")
        sys.exit(1)

