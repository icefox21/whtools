import sys
import os
import types

# 模拟冲突：手动创建一个假的 utils 模块，指向 comfy/utils.py
# 注意：我们需要确保这个假的模块看起来像是有问题的那个
fake_utils = types.ModuleType("utils")
fake_utils.__file__ = r"O:\ComfyI2I\ComfyUI\comfy\utils.py"
sys.modules["utils"] = fake_utils

print(f"Simulated conflict: sys.modules['utils'] = {sys.modules['utils']}")

# 添加 custom_nodes 到路径
sys.path.append(r"o:\ComfyI2I\ComfyUI\custom_nodes")

print("Attempting to import jdsc...")
try:
    import jdsc
    print("Import jdsc successful!")
    
    # 检查 utils 模块是否被清理
    if "utils" not in sys.modules:
        print("SUCCESS: 'utils' module was removed from sys.modules")
    elif sys.modules["utils"] != fake_utils:
        print(f"SUCCESS: 'utils' module was replaced: {sys.modules['utils']}")
    else:
        print("WARNING: 'utils' module is still the conflicting one (maybe patch didn't run?)")

except Exception as e:
    print(f"Import failed: {e}")
