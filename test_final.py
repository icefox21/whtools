#!/usr/bin/env python3
"""
Final comprehensive test with separate node instances
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

def test_complete_workflow():
    """Test the complete workflow with separate node instances"""
    print("=== Complete Workflow Test ===")
    
    from __init__ import WuhuoTextGate
    
    # Test 1: Red state captures text
    print("\n1️⃣ 红色状态捕获文本测试:")
    node1 = WuhuoTextGate()
    result1 = node1.run(
        enable_edit=True,
        free_pass=False,
        in_text="Upstream text to capture",
        edit_text="",
        node_id="test1"
    )
    captured1 = getattr(node1, '_captured_text', None)
    print(f"   结果: {result1} (应该停止工作流)")
    print(f"   捕获文本: {captured1}")
    test1_ok = result1 == ("",) and captured1 == "Upstream text to capture"
    print(f"   ✅ 测试1通过: {test1_ok}")
    
    # Test 2: Yellow state passes captured text
    print("\n2️⃣ 黄色状态传递捕获文本测试:")
    node2 = WuhuoTextGate()
    # First put it in red state to capture
    node2.run(enable_edit=True, free_pass=False, in_text="Captured text", edit_text="", node_id="test2a")
    # Then switch to yellow state
    result2 = node2.run(
        enable_edit=False,
        free_pass=False,
        in_text="",  # No new input
        edit_text="Manual text",
        node_id="test2b"
    )
    print(f"   结果: {result2}")
    print(f"   应该使用捕获文本: {'Captured text' in result2[0] if result2 else False}")
    test2_ok = result2 and 'Captured text' in result2[0]
    print(f"   ✅ 测试2通过: {test2_ok}")
    
    # Test 3: Yellow state persists captured text
    print("\n3️⃣ 黄色状态持续传递测试:")
    node3 = WuhuoTextGate()
    # Capture in red state
    node3.run(enable_edit=True, free_pass=False, in_text="Persistent text", edit_text="", node_id="test3a")
    # Multiple yellow state calls
    result3a = node3.run(enable_edit=False, free_pass=False, in_text="", edit_text="Manual1", node_id="test3b")
    result3b = node3.run(enable_edit=False, free_pass=False, in_text="", edit_text="Manual2", node_id="test3c")
    print(f"   第一次: {result3a}")
    print(f"   第二次: {result3b}")
    test3_ok = (result3a and 'Persistent text' in result3a[0] and 
                result3b and 'Persistent text' in result3b[0])
    print(f"   ✅ 测试3通过: {test3_ok}")
    
    # Test 4: New input clears captured text
    print("\n4️⃣ 新输入清除旧捕获测试:")
    node4 = WuhuoTextGate()
    # Capture old text
    node4.run(enable_edit=True, free_pass=False, in_text="Old captured", edit_text="", node_id="test4a")
    # New upstream input
    result4 = node4.run(
        enable_edit=False,
        free_pass=False,
        in_text="New upstream text",
        edit_text="Manual",
        node_id="test4b"
    )
    captured4 = getattr(node4, '_captured_text', None)
    print(f"   结果: {result4}")
    print(f"   应该使用新文本: {'New upstream text' in result4[0] if result4 else False}")
    print(f"   捕获文本已清除: {captured4 is None}")
    test4_ok = (result4 and 'New upstream text' in result4[0] and captured4 is None)
    print(f"   ✅ 测试4通过: {test4_ok}")
    
    # Final summary
    print(f"\n=== 最终总结 ===")
    all_passed = test1_ok and test2_ok and test3_ok and test4_ok
    
    if all_passed:
        print("🎉 所有测试通过！文本传递节点工作正常")
        print("\n✅ 你的问题已经解决：")
        print("   📍 红色状态不是'静音'，而是捕获文本并中断工作流")
        print("   📍 黄色状态正确传递捕获的文本")
        print("   📍 捕获的文本可以持续使用直到有新输入")
        print("   📍 新输入会自动清除旧捕获并优先使用")
        print("\n💡 使用建议：")
        print("   1. 上游节点传来文本时，节点变红并停止")
        print("   2. 手动关闭编辑按钮，节点变黄并传递捕获文本")
        print("   3. 工作流可以继续执行，使用捕获的文本")
        return True
    else:
        print("❌ 部分测试失败，需要进一步调试")
        return False

if __name__ == "__main__":
    test_complete_workflow()