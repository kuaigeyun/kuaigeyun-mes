"""
检查端口 9000 的可用性和权限问题
"""
import socket
import sys
import subprocess
import os

def check_port_available(port):
    """检查端口是否可用"""
    try:
        # 尝试绑定端口
        test_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        test_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        test_socket.bind(('0.0.0.0', port))
        test_socket.close()
        return True, "端口可用"
    except OSError as e:
        if e.winerror == 10013:
            return False, f"权限错误 (WinError 10013): {e}"
        elif e.winerror == 10048:
            return False, f"端口已被占用 (WinError 10048): {e}"
        else:
            return False, f"其他错误: {e}"
    except Exception as e:
        return False, f"未知错误: {e}"

def check_port_listening(port):
    """检查端口是否正在监听"""
    try:
        test_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        result = test_socket.connect_ex(('127.0.0.1', port))
        test_socket.close()
        return result == 0
    except Exception:
        return False

def main():
    """主函数"""
    print("=" * 60)
    print("端口 9000 诊断工具")
    print("=" * 60)
    print()
    
    port = 9000
    
    # 检查端口是否正在监听
    print(f"1. 检查端口 {port} 是否正在监听...")
    is_listening = check_port_listening(port)
    if is_listening:
        print(f"   ⚠️  端口 {port} 正在被其他程序监听")
    else:
        print(f"   ✅ 端口 {port} 未被监听")
    print()
    
    # 检查端口是否可用
    print(f"2. 检查端口 {port} 是否可用（尝试绑定）...")
    is_available, message = check_port_available(port)
    if is_available:
        print(f"   ✅ {message}")
    else:
        print(f"   ❌ {message}")
    print()
    
    # 提供解决方案
    print("=" * 60)
    print("解决方案建议：")
    print("=" * 60)
    
    if not is_available:
        if "10013" in message:
            print("1. 以管理员身份运行后端服务")
            print("   - 右键点击 Git Bash 或终端")
            print("   - 选择'以管理员身份运行'")
            print("   - 然后运行启动脚本")
            print()
            print("2. 检查 Windows 防火墙设置")
            print("   - 打开 Windows 防火墙")
            print("   - 允许 Python 或 uvicorn 通过防火墙")
            print()
            print("3. 尝试使用其他端口（如 9001）")
            print("   - 修改 start-backend.sh 中的端口号")
            print("   - 将 --port 9000 改为 --port 9001")
            print()
        elif "10048" in message:
            print("1. 查找占用端口的进程：")
            print("   netstat -ano | findstr :9000")
            print()
            print("2. 结束占用端口的进程（替换 PID 为实际进程ID）：")
            print("   taskkill /PID <进程ID> /F")
            print()
    
    # 检查是否以管理员身份运行
    print("4. 检查当前运行权限...")
    try:
        # 尝试创建一个需要管理员权限的文件
        test_file = "C:\\Windows\\temp\\riveredge_test.txt"
        with open(test_file, 'w') as f:
            f.write("test")
        os.remove(test_file)
        print("   ✅ 当前具有管理员权限")
    except PermissionError:
        print("   ⚠️  当前没有管理员权限")
        print("   💡 建议：以管理员身份运行此脚本和后端服务")
    except Exception:
        print("   ⚠️  无法确定权限状态")
    
    print()
    print("=" * 60)

if __name__ == "__main__":
    main()

