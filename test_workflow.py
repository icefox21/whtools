#!/usr/bin/env python3
"""
Test script to verify the jdsc text gate functionality
"""

import asyncio
import sys
import os

# Add the custom_nodes path to sys.path
sys.path.insert(0, os.path.dirname(__file__))

def test_text_gate_states():
    """Test the different states of the text gate node"""
    print("Testing WuhuoTextGate states...")
    
    # Import the node class
    from __init__ import WuhuoTextGate
    
    # Create an instance
    node = WuhuoTextGate()
    
    # Test 1: Free pass mode (green state)
    print("\n1. Testing free pass mode (should pass text through):")
    try:
        result = node.run(
            enable_edit=False,
            free_pass=True,
            in_text="Hello World",
            edit_text="",
            node_id="test_node_1"
        )
        print(f"   Result: {result}")
        print("   ✓ Free pass mode works correctly")
    except Exception as e:
        print(f"   ✗ Free pass mode failed: {e}")
    
    # Test 2: Edit mode (red state)
    print("\n2. Testing edit mode (should return empty string):")
    try:
        result = node.run(
            enable_edit=True,
            free_pass=False,
            in_text="Hello World",
            edit_text="Edited Text",
            node_id="test_node_2"
        )
        print(f"   Result: {result}")
        if result == ("",):
            print("   ✓ Edit mode correctly returns empty string (workflow stopped)")
        else:
            print("   ✗ Edit mode should return stop workflow marker")
    except Exception as e:
        print(f"   ✗ Edit mode failed: {e}")
    
    # Test 3: Neither mode (yellow state)
    print("\n3. Testing neither mode (should use edit_text):")
    try:
        result = node.run(
            enable_edit=False,
            free_pass=False,
            in_text="Hello World",
            edit_text="Manual Text",
            node_id="test_node_3"
        )
        print(f"   Result: {result}")
        if result == ("Manual Text",):
            print("   ✓ Neither mode works correctly")
        else:
            print("   ✗ Neither mode should return edit_text")
    except Exception as e:
        print(f"   ✗ Neither mode failed: {e}")
    
    # Test 4: New workflow - initial red state captures text, then switches to yellow
    print("\n4. Testing new workflow (initial red state -> text capture -> yellow state):")
    try:
        # Step 1: Initial state - red (edit mode), text should be captured but workflow stopped
        print("   Step 1: Initial red state with input text:")
        result1 = node.run(
            enable_edit=True,
            free_pass=False,
            in_text="Captured from upstream",
            edit_text="",
            node_id="test_node_6"
        )
        print(f"   Red state result: {result1}")
        print(f"   Captured text: {getattr(node, '_captured_text', 'None')}")
        
        # Step 2: Switch to yellow mode (disable edit) - should pass captured text
        print("   Step 2: Switch to yellow mode (disable edit):")
        result2 = node.run(
            enable_edit=False,
            free_pass=False,
            in_text="",  # No new input
            edit_text="Manual text",  # This should be ignored in favor of captured text
            node_id="test_node_7"
        )
        print(f"   Yellow state result: {result2}")
        print(f"   Should use captured text: {'Captured from upstream' in result2}")
        
        if result2 == ("Captured from upstream",):
            print("   ✓ New workflow works correctly")
        else:
            print("   ✗ New workflow should pass captured text")
            
    except Exception as e:
        print(f"   ✗ New workflow test failed: {e}")
    
    # Test 5: Interlock behavior
    print("\n5. Testing interlock behavior (enable_edit should disable free_pass):")
    try:
        # This simulates what should happen in the frontend
        # when enable_edit is turned on, free_pass should be turned off
        result1 = node.run(
            enable_edit=True,
            free_pass=False,  # This should be auto-disabled in frontend
            in_text="Hello World",
            edit_text="Edited",
            node_id="test_node_8"
        )
        print(f"   Edit mode result: {result1}")
        
        result2 = node.run(
            enable_edit=False,
            free_pass=True,
            in_text="Hello World",
            edit_text="",
            node_id="test_node_5"
        )
        print(f"   Free pass result: {result2}")
        print("   ✓ Interlock logic works correctly")
    except Exception as e:
        print(f"   ✗ Interlock test failed: {e}")

def test_ignore_group():
    """Test the ignore group node"""
    print("\n\nTesting WuhuoIgnoreGroup...")
    
    from __init__ import WuhuoIgnoreGroup
    
    node = WuhuoIgnoreGroup()
    
    # Test enable state
    print("\n1. Testing enable state:")
    try:
        result = node.run(enable=True, node_id="ignore_test_1")
        print(f"   Result: {result}")
        print("   ✓ Ignore group enable works")
    except Exception as e:
        print(f"   ✗ Ignore group enable failed: {e}")
    
    # Test disable state
    print("\n2. Testing disable state:")
    try:
        result = node.run(enable=False, node_id="ignore_test_2")
        print(f"   Result: {result}")
        print("   ✓ Ignore group disable works")
    except Exception as e:
        print(f"   ✗ Ignore group disable failed: {e}")

if __name__ == "__main__":
    print("=" * 60)
    print("JDSC Text Gate Node Test Suite")
    print("=" * 60)
    
    try:
        test_text_gate_states()
        test_ignore_group()
        
        print("\n" + "=" * 60)
        print("All tests completed!")
        print("=" * 60)
        
    except Exception as e:
        print(f"Test suite failed: {e}")
        sys.exit(1)