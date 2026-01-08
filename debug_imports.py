import sys
import os

# Add ComfyUI root to path
current_dir = os.path.dirname(os.path.abspath(__file__))
# current_dir is .../custom_nodes/jdsc
# comfy_root is .../ComfyUI
comfy_root = os.path.dirname(os.path.dirname(current_dir))
sys.path.append(comfy_root)

print(f"Current Dir: {current_dir}")
print(f"ComfyUI Root: {comfy_root}")

print("-" * 20)
print("Checking Imports...")

try:
    import server
    print("PASS: Imported server module")
    try:
        from server import PromptServer
        print("PASS: Imported PromptServer from server")
        if hasattr(PromptServer, 'instance'):
            print(f"INFO: PromptServer.instance is {PromptServer.instance}")
        else:
            print("WARN: PromptServer has no 'instance' attribute")
    except ImportError as e:
        print(f"FAIL: Could not import PromptServer from server: {e}")
except ImportError as e:
    print(f"FAIL: Could not import server module: {e}")
except Exception as e:
    print(f"FAIL: Error importing server: {e}")

try:
    import aiohttp
    print("PASS: Imported aiohttp")
    from aiohttp import web
    print("PASS: Imported web from aiohttp")
except ImportError as e:
    print(f"FAIL: Could not import aiohttp: {e}")
except Exception as e:
    print(f"FAIL: Error importing aiohttp: {e}")

print("-" * 20)
print("Checking Data Directory...")

data_dir = os.path.join(current_dir, "data")
print(f"Data Dir: {data_dir}")

if os.path.exists(data_dir):
    print("PASS: Data directory exists")
    try:
        test_file = os.path.join(data_dir, "test_write.txt")
        with open(test_file, "w") as f:
            f.write("test")
        os.remove(test_file)
        print("PASS: Data directory is writable")
    except Exception as e:
        print(f"FAIL: Data directory is NOT writable: {e}")
else:
    print("FAIL: Data directory does NOT exist")
    try:
        os.makedirs(data_dir, exist_ok=True)
        print("INFO: Created data directory")
    except Exception as e:
        print(f"FAIL: Could not create data directory: {e}")

print("-" * 20)
print("Done.")
