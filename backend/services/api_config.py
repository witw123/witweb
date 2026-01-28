"""
API配置管理
存储和管理GRSAI API Token等配置
"""
import json
from pathlib import Path
from typing import Optional

CONFIG_FILE = Path(__file__).parent.parent / "data" / "api_config.json"
CORE_CONFIG_FILE = Path(__file__).parent.parent / "data" / "config.json"

def get_api_token() -> Optional[str]:
    """获取API Token"""
    if not CONFIG_FILE.exists():
        return None
    
    try:
        with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
            config = json.load(f)
            return config.get('grsai_token')
    except Exception:
        return None

def save_api_token(token: str) -> bool:
    """保存API Token"""
    try:
        # 确保目录存在
        CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
        
        # 读取现有配置
        config = {}
        if CONFIG_FILE.exists():
            try:
                with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                    config = json.load(f)
            except Exception:
                pass
        
        # 更新token
        config['grsai_token'] = token
        
        # 保存配置
        with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
        
        return True
    except Exception as e:
        print(f"Failed to save API token: {e}")
        return False

def get_api_config() -> dict:
    """获取完整API配置"""
    if not CONFIG_FILE.exists():
        return {}
    
    try:
        with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {}

def get_api_base_url() -> Optional[str]:
    """获取API Base URL"""
    config = get_api_config()
    return config.get('api_base_url')

def save_api_base_url(base_url: str) -> bool:
    """保存API Base URL"""
    try:
        # 确保目录存在
        CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
        
        # 读取现有配置
        config = get_api_config()
        
        # 更新base_url
        config['api_base_url'] = base_url
        
        # 保存配置
        with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
        
        return True
    except Exception as e:
        print(f"Failed to save API base URL: {e}")
        return False

def get_sora2_api_key() -> Optional[str]:
    """???Sora2 API Key"""
    config = get_api_config()
    if config.get('sora2_api_key'):
        return config.get('sora2_api_key')
    if CORE_CONFIG_FILE.exists():
        try:
            with open(CORE_CONFIG_FILE, 'r', encoding='utf-8') as f:
                core_cfg = json.load(f)
                return core_cfg.get('api_key')
        except Exception:
            return None
    return None

def save_sora2_api_key(api_key: str) -> bool:
    """保存Sora2 API Key"""
    try:
        # 确保目录存在
        CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
        
        # 读取现有配置
        config = get_api_config()
        
        # 更新api_key
        config['sora2_api_key'] = api_key
        
        # 保存配置
        with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
        
        return True
    except Exception as e:
        print(f"Failed to save Sora2 API key: {e}")
        return False

