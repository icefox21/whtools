import json
import os

file_path = r"o:\ComfyI2I\ComfyUI\custom_nodes\jdsc\data\enhance_presets.json"

try:
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
        print(f"File content length: {len(content)}")
        # print first 100 chars
        print(f"First 100 chars: {content[:100]}")
        
        # Try to parse
        data = json.loads(content)
        print("JSON is valid.")
        print(f"Keys: {list(data.keys())}")
except Exception as e:
    print(f"JSON is INVALID: {e}")
