#!/usr/bin/env python3
"""
Updated test to verify the fixed text capture mechanism
"""

import sys
import os

# Add the custom_nodes path to sys.path
sys.path.insert(0, os.path.dirname(__file__))

def test_fixed_workflow():
    """Test the fixed workflow with better text persistence"""
    print("=== Testing Fixed Text Capture Workflow ===")
    
    # Import the node class
    from __init__ import WuhuoTextGate
    
    # Create an instance
    node = WuhuoTextGate()
    
    print(f"Initial _captured_text: {getattr(node, '_captured_text', 'None')}")
    
    # Step 1: Red state with input text (should capture and stop workflow)
    print("\n--- Step 1: Red state with input text ---")
    print("模拟：上游节点传来文本，红色状态捕获文本并停止工作流")
    result1 = node.run(
        enable_edit=True,
        free_pass=False,
        in_text="Hello from upstream node",
        edit_text="",
        node_id="test_fixed_1"
    )
    print(f"结果: {result1} (工作流应该停止)")
    print(f"捕获的文本: {getattr(node, '_captured_text', 'None')}")
    
    # Step 2: Switch to yellow mode (disable edit) - should pass captured text
    print("\n--- Step 2: 手动关闭编辑按钮，切换到黄色状态 ---")
    print("模拟：用户手动关闭编辑，应该传递捕获的文本")
    result2 = node.run(
        enable_edit=False,
        free_pass=False,
        in_text="",  # 没有新的上游输入
        edit_text="Manual text that should be ignored",
        node_id="test_fixed_2"
    )
    print(f"结果: {result2}")
    print(f"应该使用捕获的文本: {'Hello from upstream node' in result2[0] if result2 else False}")
    print(f"捕获的文本状态: {getattr(node, '_captured_text', 'None')} (应该保持，因为没有新输入)")
    
    # Step 3: Test workflow continuation - same yellow state
    print("\n--- Step 3: 工作流继续运行，黄色状态保持 ---")
    print("模拟：工作流重新运行，黄色节点应该继续传递捕获的文本")
    result3 = node.run(
        enable_edit=False,
        free_pass=False,
        in_text="",  # 仍然没有新输入
        edit_text="Different manual text",
        node_id="test_fixed_3"
    )
    print(f"结果: {result3}")
    print(f"应该继续使用捕获的文本: {'Hello from upstream node' in result3[0] if result3 else False}")
    
    # Step 4: Test with new upstream input (should clear captured text)
    print("\n--- Step 4: 新的上游文本输入 ---")
    print("模拟：上游节点传来新的文本，应该清除旧的捕获文本")
    result4 = node.run(
        enable_edit=False,
        free_pass=False,
        in_text="New upstream text that should be used",
        edit_text="Manual text",
        node_id="test_fixed_4"
    )
    print(f"结果: {result4}")
    print(f"应该使用新的上游文本: {'New upstream text that should be used' in result4[0] if result4 else False}")
    print(f"捕获的文本状态: {getattr(node, '_captured_text', 'None')} (应该被清除)")
    
    # Summary
    print(f"\n=== 总结 ===")
    success1 = result1 == ("",) and getattr(node, '_captured_text', None) == "Hello from upstream node"
    success2 = result2 and 'Hello from upstream node' in result2[0]
    success3 = result3 and 'Hello from upstream node' in result3[0]
    success4 = result4 and 'New upstream text that should be used' in result4[0]
    
    print(f"✓ 红色状态捕获文本: {'是' if success1 else '否'}")
    print(f"✓ 黄色状态传递捕获文本: {'是' if success2 else '否'}")
    print(f"✓ 捕获文本持续可用: {'是' if success3 else '否'}")
    print(f"✓ 新输入清除旧捕获: {'是' if success4 else '否'}")
    
    print(f"\n详细检查结果:")
    print(f"  红色状态: result1={result1}, captured={getattr(node, '_captured_text', None)}")
    print(f"  黄色状态1: result2={result2}")
    print(f"  黄色状态2: result3={result3}")
    print(f"  新输入: result4={result4}")
    
    if success1 and success2 and success3 and success4:
        print("\n🎉 所有测试通过！文本捕获机制工作正常")
        print("\n✅ 你的问题应该已经解决：")
        print("   1. 红色状态不会'静音'，而是正确捕获文本并中断工作流")
        print("   2. 黄色状态会传递捕获的文本")
        print("   3. 工作流可以继续执行")
        return True
    else:
        print(f"\n❌ 部分测试失败")
        return False

if __name__ == "__main__":
    test_fixed_workflow()