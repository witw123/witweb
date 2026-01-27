import sys
import os
import uvicorn

# Add root dir to sys.path so 'backend' module is found
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from backend.main import app
except ImportError:
    # If import fails, try to help debug
    print("Error importing backend.main")
    traceback.print_exc()
    sys.exit(1)

if __name__ == "__main__":
    print("Starting server on port 8000...")
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
