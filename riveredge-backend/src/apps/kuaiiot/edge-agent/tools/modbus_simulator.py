#!/usr/bin/env python3
"""Modbus TCP 模拟从站，供本地联调 Edge Agent。"""

from __future__ import annotations

import argparse
import struct

from pymodbus.datastore import ModbusSequentialDataBlock, ModbusServerContext, ModbusSlaveContext
from pymodbus.server import StartTcpServer


def build_context() -> ModbusServerContext:
    # 地址 0-1: float32 temp=26.5
    temp_bytes = struct.pack(">f", 26.5)
    registers = [0, 0]
    registers[0] = int.from_bytes(temp_bytes[:2], "big")
    registers[1] = int.from_bytes(temp_bytes[2:], "big")
    # 地址 2: status code 1 = running
    registers.extend([1, 0])
    block = ModbusSequentialDataBlock(0, registers)
    store = ModbusSlaveContext(hr=block, ir=block)
    return ModbusServerContext(slaves=store, single=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Modbus TCP simulator for kuaiiot Edge Agent")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=5020)
    args = parser.parse_args()
    print(f"Modbus simulator listening on {args.host}:{args.port}")
    StartTcpServer(context=build_context(), address=(args.host, args.port))


if __name__ == "__main__":
    main()
