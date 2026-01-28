"""
GRSAI API客户端封装
提供与grsaiapi.com交互的HTTP客户端
"""
import os
import requests
from typing import Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)

# 导入配置管理
try:
    from .api_config import get_api_token
except ImportError:
    from backend.services.api_config import get_api_token

# API配置
API_BASE = os.getenv("GRSAI_API_BASE", "https://grsaiapi.com")
# 优先使用配置文件中的token，其次使用环境变量
API_TOKEN = get_api_token() or os.getenv("GRSAI_API_TOKEN", "")

class GRSAIClient:
    """GRSAI API客户端"""
    
    def __init__(self, token: str = None, base_url: str = None):
        self.token = token or API_TOKEN
        self.base_url = base_url or API_BASE
        self.session = requests.Session()
        self.session.headers.update({
            "Content-Type": "application/json"
        })
    
    def _request(self, method: str, endpoint: str, **kwargs) -> Dict[str, Any]:
        """统一请求处理"""
        url = f"{self.base_url}{endpoint}"
        
        try:
            response = self.session.request(method, url, **kwargs)
            response.raise_for_status()
            data = response.json()
            
            # 检查API响应码
            if data.get("code") != 0:
                logger.error(f"API error: {data.get('msg')}")
                raise Exception(data.get("msg", "API request failed"))
            
            return data
        except requests.exceptions.RequestException as e:
            logger.error(f"Request failed: {e}")
            raise Exception(f"API request failed: {str(e)}")
    
    def get_credits(self) -> int:
        """获取账户积分余额"""
        data = self._request("POST", "/client/openapi/getCredits", json={
            "token": self.token
        })
        return data.get("data", {}).get("credits", 0)
    
    def create_api_key(
        self, 
        name: str, 
        key_type: int = 0, 
        credits: int = 0, 
        expire_time: int = 0
    ) -> Dict[str, Any]:
        """创建APIKey"""
        data = self._request("POST", "/client/openapi/createAPIKey", json={
            "token": self.token,
            "type": key_type,
            "name": name,
            "credits": credits,
            "expireTime": expire_time
        })
        return data.get("data", {})
    
    def get_api_key_credits(self, api_key: str) -> int:
        """获取APIKey积分余额"""
        data = self._request("POST", "/client/openapi/getAPIKeyCredits", json={
            "apiKey": api_key
        })
        return data.get("data", {}).get("credits", 0)
    
    def get_model_status(self, model_name: str) -> Dict[str, Any]:
        """获取模型状态"""
        data = self._request("GET", f"/client/common/getModelStatus?model={model_name}")
        return data.get("data", {})

# 全局客户端实例
grsai_client = GRSAIClient()
