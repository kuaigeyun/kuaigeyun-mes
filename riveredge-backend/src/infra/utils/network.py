"""本机网络地址探测（CORS / 扫码下载等共用）。"""

from __future__ import annotations

import socket


def detect_lan_ipv4() -> str | None:
    """
    本机对外通信网卡的 IPv4。

    用于开发态 CORS、扫码下载等场景，避免把 127.0.0.1 发给手机/局域网客户端。
    探测失败或结果为环回时返回 None。
    """
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.connect(("8.8.8.8", 80))
            ip = sock.getsockname()[0]
            if ip and not ip.startswith("127."):
                return ip
    except OSError:
        pass
    return None
