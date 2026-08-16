"""行情定价浮动公式：仅行情价、系数与四则运算。"""

from __future__ import annotations

import ast
from decimal import Decimal

from infra.exceptions.exceptions import ValidationError

DEFAULT_MARKET_FLOAT_FORMULA = "quote"

_ALIASES = (
    ("行情价", "quote"),
    ("系数", "factor"),
    ("×", "*"),
    ("÷", "/"),
    ("＋", "+"),
    ("－", "-"),
)

_ALLOWED_BINOPS = (ast.Add, ast.Sub, ast.Mult, ast.Div)
_ALLOWED_UNARY = (ast.UAdd, ast.USub)


def normalize_market_float_formula(raw: object) -> str:
    text = str(raw or "").strip()
    if not text:
        return DEFAULT_MARKET_FLOAT_FORMULA
    for src, dst in _ALIASES:
        text = text.replace(src, dst)
    return text


def _eval_node(node: ast.AST, names: dict[str, Decimal]) -> Decimal:
    if isinstance(node, ast.Expression):
        return _eval_node(node.body, names)
    if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
        return Decimal(str(node.value))
    if isinstance(node, ast.UnaryOp) and isinstance(node.op, _ALLOWED_UNARY):
        value = _eval_node(node.operand, names)
        return value if isinstance(node.op, ast.UAdd) else -value
    if isinstance(node, ast.BinOp) and isinstance(node.op, _ALLOWED_BINOPS):
        left = _eval_node(node.left, names)
        right = _eval_node(node.right, names)
        if isinstance(node.op, ast.Add):
            return left + right
        if isinstance(node.op, ast.Sub):
            return left - right
        if isinstance(node.op, ast.Mult):
            return left * right
        if right == 0:
            raise ValidationError("浮动公式除数不能为0")
        return left / right
    if isinstance(node, ast.Name) and node.id in names:
        return names[node.id]
    raise ValidationError("浮动公式只能使用行情价、系数与加减乘除")


def evaluate_market_float_formula(raw: object, *, quote: Decimal, factor: Decimal) -> Decimal:
    expr = normalize_market_float_formula(raw)
    try:
        tree = ast.parse(expr, mode="eval")
    except SyntaxError as exc:
        raise ValidationError("浮动公式无效") from exc
    return _eval_node(tree, {"quote": quote, "factor": factor})
