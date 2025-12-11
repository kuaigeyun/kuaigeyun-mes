"""
测试多个端口，找到可用的端口
"""
import socket

def test_port(host, port):
    """测试端口是否可用"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        s.bind((host, port))
        s.close()
        return True, "可用"
    except OSError as e:
        return False, f"错误: {e.winerror if hasattr(e, 'winerror') else e}"
    except Exception as e:
        return False, f"未知错误: {e}"

def main():
    """主函数"""
    print("=" * 60)
    print("测试端口可用性")
    print("=" * 60)
    print()
    
    # 测试的端口列表（避开 Windows 保留范围 8989-9088）
    test_ports = [
        8000,   # 常用开发端口
        8080,   # 常用开发端口
        8888,   # 常用开发端口（但可能被占用）
        7000,   # 避开保留范围
        7001,   # 避开保留范围
        9100,   # 9000 之后，避开保留范围
        9101,   # 9000 之后，避开保留范围
        10000,  # 更高的端口
    ]
    
    print("测试端口（127.0.0.1）:")
    print("-" * 60)
    available_ports = []
    
    for port in test_ports:
        is_available, message = test_port('127.0.0.1', port)
        status = "✅" if is_available else "❌"
        print(f"{status} 端口 {port:5d}: {message}")
        if is_available:
            available_ports.append(port)
    
    print()
    print("=" * 60)
    if available_ports:
        print(f"✅ 找到 {len(available_ports)} 个可用端口:")
        for port in available_ports:
            print(f"   - 端口 {port}")
        print()
        print("💡 建议使用端口:", available_ports[0])
    else:
        print("❌ 没有找到可用端口")
        print("   可能需要检查安全软件或系统策略")
    print("=" * 60)

if __name__ == "__main__":
    main()

