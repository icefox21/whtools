# Copyright (c) 2024-2026 icefox21
# This project is licensed under the GNU General Public License v3.0 (GPL-3.0).
# Project Link: https://github.com/icefox21/whtools

import ast
import math
import operator as op
from .switch_any import any_type

class WuhuoSimpleMath:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "optional": {
                "a": (any_type, { "default": 0.0 }),
                "b": (any_type, { "default": 0.0 }),
                "c": (any_type, { "default": 0.0 }),
                "d": (any_type, { "default": 0.0 }),
            },
            "required": {
                "value": ("STRING", { "multiline": False, "default": "" }),
            },
        }

    RETURN_TYPES = ("INT", "FLOAT", )
    FUNCTION = "execute"
    CATEGORY = "wuhuo"

    def execute(self, value, a = 0.0, b = 0.0, c = 0.0, d = 0.0):
        # Defensive conversion of shapes to list to allow indexing in math expression
        if hasattr(a, 'shape'):
            a = list(a.shape)
        if hasattr(b, 'shape'):
            b = list(b.shape)
        if hasattr(c, 'shape'):
            c = list(c.shape)
        if hasattr(d, 'shape'):
            d = list(d.shape)

        # Defensive float conversions if string inputs are given
        if isinstance(a, str):
            try:
                a = float(a)
            except ValueError:
                pass
        if isinstance(b, str):
            try:
                b = float(b)
            except ValueError:
                pass
        if isinstance(c, str):
            try:
                c = float(c)
            except ValueError:
                pass
        if isinstance(d, str):
            try:
                d = float(d)
            except ValueError:
                pass

        def safe_pow(left, right):
            if isinstance(right, (int, float)) and abs(right) > 32:
                raise ValueError("Exponent is too large")
            return op.pow(left, right)
        
        operators = {
            ast.Add: op.add,
            ast.Sub: op.sub,
            ast.Mult: op.mul,
            ast.Div: op.truediv,
            ast.FloorDiv: op.floordiv,
            ast.Pow: safe_pow,
            ast.USub: op.neg,
            ast.Mod: op.mod,
            ast.Eq: op.eq,
            ast.NotEq: op.ne,
            ast.Lt: op.lt,
            ast.LtE: op.le,
            ast.Gt: op.gt,
            ast.GtE: op.ge,
            ast.And: lambda x, y: x and y,
            ast.Or: lambda x, y: x or y,
            ast.Not: op.not_
        }

        op_functions = {
            'min': min,
            'max': max,
            'round': round,
            'sum': sum,
            'len': len,
        }

        def eval_(node):
            # Safe and cross-version Python AST evaluation
            if isinstance(node, ast.Constant):  # Python 3.8+ (covers numbers, strings, bools, None)
                return node.value
            elif hasattr(ast, 'Num') and isinstance(node, ast.Num):  # legacy fallback for numbers
                return node.n
            elif hasattr(ast, 'Str') and isinstance(node, ast.Str):  # legacy fallback for strings
                return node.s
            elif isinstance(node, ast.Name):  # variable name mapping
                if node.id == "a":
                    return a
                if node.id == "b":
                    return b
                if node.id == "c":
                    return c
                if node.id == "d":
                    return d
            elif isinstance(node, ast.BinOp):  # binary operations (e.g. +, -, *, /)
                left = eval_(node.left)
                right = eval_(node.right)
                op_type = type(node.op)
                if op_type in operators:
                    return operators[op_type](left, right)
            elif isinstance(node, ast.UnaryOp):  # unary operations (e.g. -x)
                operand = eval_(node.operand)
                op_type = type(node.op)
                if op_type in operators:
                    return operators[op_type](operand)
            elif isinstance(node, ast.Compare):  # comparison operations (e.g. a == b, a < b)
                left = eval_(node.left)
                for op_node, comparator in zip(node.ops, node.comparators):
                    op_type = type(op_node)
                    if op_type in operators:
                        if not operators[op_type](left, eval_(comparator)):
                            return 0
                    else:
                        return 0
                return 1
            elif isinstance(node, ast.BoolOp):  # boolean logic operations (e.g. a and b)
                if isinstance(node.op, ast.And):
                    for value in node.values:
                        if not eval_(value):
                            return 0
                    return 1
                if isinstance(node.op, ast.Or):
                    for value in node.values:
                        if eval_(value):
                            return 1
                    return 0
            elif isinstance(node, ast.Call):  # custom allowed functions (e.g. min, max, round, sum, len)
                if isinstance(node.func, ast.Name) and node.func.id in op_functions:
                    args = [eval_(arg) for arg in node.args]
                    return op_functions[node.func.id](*args)
            elif isinstance(node, ast.Subscript):  # indexing and slicing (e.g. a[0])
                value = eval_(node.value)
                if isinstance(node.slice, ast.Constant):
                    return value[node.slice.value]
                elif hasattr(ast, 'Index') and isinstance(node.slice, ast.Index):  # legacy Index wrapper
                    return value[eval_(node.slice.value)]
                else:
                    return value[eval_(node.slice)]
            return 0

        try:
            parsed = ast.parse(value, mode='eval').body
            result = eval_(parsed)
        except Exception as e:
            print(f"[whtools] SimpleMath evaluation failed for expression '{value}': {e}")
            result = 0.0

        # Defensive handling of float return formats
        if isinstance(result, (int, float)):
            try:
                result_float = float(result)
            except Exception:
                result = 0.0
            else:
                if not math.isfinite(result_float) or abs(result_float) > 1_000_000_000_000:
                    result = 0.0
                else:
                    result = result_float
            if isinstance(result, (int, float)) and (math.isnan(result) or math.isinf(result)):
                result = 0.0
        else:
            try:
                result = float(result)
            except Exception:
                result = 0.0

        return (int(round(result)), float(result), )
