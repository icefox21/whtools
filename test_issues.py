#!/usr/bin/env python3
"""
Test to reproduce the current issues
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

def test_current_issues():
    """Test the current issues described by user"""
    print("=== Testing Current Issues ===")
    
    from __init__ import WuhuoTextGate
    
    # Issue 1: Node starts muted again
    print("\n1️⃣ 测试初始状态是否静音:")
    node = WuhuoTextGate()
    print("   节点创建后，检查初始状态...")
    print("   注意：在ComfyUI中，节点的初始状态由前端决定")
    print("   enable_edit默认值应该是True（红色状态）")
    
    # Simulate the workflow you described
    print("\n2️⃣ 模拟完整工作流场景:")
    
    # Step 1: Node in red state with upstream text
    print("   步骤1: 红色状态接收上游文本")
    result1 = node.run(
        enable_edit=True,    # Red state
        free_pass=False,
        in_text="Upstream text that should be captured",
        edit_text="Manual text",
        node_id="issue_test_1"
    )
    captured = getattr(node, '_captured_text', None)
    print(f"   结果: {result1}")
    print(f"   捕获文本: {captured}")
    print(f"   工作流是否停止: {result1 == ('',)}")
    
    # Step 2: Switch to yellow state (disable edit)
    print("\n   步骤2: 手动关闭编辑，切换到黄色状态")
    result2 = node.run(
        enable_edit=False,   # Yellow state
        free_pass=False,
        in_text="",          # No new upstream text
        edit_text="Modified manual text",
        node_id="issue_test_2"
    )
    captured2 = getattr(node, '_captured_text', None)
    print(f"   结果: {result2}")
    print(f"   应该传递捕获文本: {'Upstream text that should be captured' in result2[0] if result2 else False}")
    print(f"   捕获文本状态: {captured2}")
    
    # Step 3: Check if workflow can continue
    print("\n   步骤3: 检查工作流是否能继续")
    if result2 and result2[0]:
        print(f"   ✅ 黄色状态成功传递文本: '{result2[0]}'")
        print("   ✅ 工作流应该可以继续执行")
    else:
        print("   ❌ 黄色状态没有传递文本")
        print("   ❌ 工作流可能无法继续")
    
    # Check the specific issues mentioned
    print(f"\n=== 问题分析 ===")
    issues = []
    
    if result1 != ("",):
        issues.append("红色状态没有正确停止工作流")
    
    if not result2 or 'Upstream text that should be captured' not in result2[0]:
        issues.append("黄色状态没有传递捕获的文本")
    
    if not issues:
        print("✅ 后端逻辑测试通过 - 问题可能在前端JavaScript")
    else:
        print("❌ 发现后端逻辑问题:")
        for issue in issues:
            print(f"   - {issue}")
    
    return len(issues) == 0

if __name__ == "__main__":
    test_current_issues()