"""
Sora2 API客户端封装
提供与Sora2视频生成API交互的HTTP客户端
"""
import requests
from typing import Optional, Dict, Any
import logging
import json
import os

logger = logging.getLogger(__name__)

try:
    from .api_config import get_sora2_api_key, get_api_base_url
except ImportError:
    from backend.services.api_config import get_sora2_api_key, get_api_base_url

# API配置
API_BASE = os.getenv("SORA2_API_BASE", "https://grsaiapi.com")
API_KEY = os.getenv("SORA2_API_KEY", "")

class Sora2Client:
    """Sora2 API客户端"""
    
    def __init__(self, api_key: str = None, base_url: str = None):
        # 优先使用配置文件中的值
        self.api_key = api_key or get_sora2_api_key() or API_KEY
        self.base_url = base_url or get_api_base_url() or API_BASE
        self.session = requests.Session()
    
    def _get_headers(self) -> Dict[str, str]:
        """获取请求头"""
        return {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}"
        }
    
    def _request(self, method: str, endpoint: str, **kwargs) -> Dict[str, Any]:
        """统一请求处理"""
        url = f"{self.base_url}{endpoint}"
        headers = self._get_headers()
        
        if 'headers' in kwargs:
            headers.update(kwargs.pop('headers'))
        
        try:
            response = self.session.request(method, url, headers=headers, **kwargs)
            response.raise_for_status()
            
            # 处理流式响应
            if response.headers.get('content-type', '').startswith('text/event-stream'):
                return self._parse_stream_response(response)
            
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"Sora2 API request failed: {e}")
            raise Exception(f"API request failed: {str(e)}")
    
    def _parse_stream_response(self, response) -> Dict[str, Any]:
        """解析流式响应"""
        last_data = {}
        for line in response.iter_lines():
            if line:
                line_str = line.decode('utf-8')
                if line_str.startswith('data: '):
                    try:
                        data = json.loads(line_str[6:])
                        last_data = data
                    except json.JSONDecodeError:
                        continue
        return last_data
    
    def generate_video(
        self,
        prompt: str,
        model: str = "sora-2",
        url: Optional[str] = None,
        aspect_ratio: str = "9:16",
        duration: int = 10,
        remix_target_id: str = "",
        size: str = "small"
    ) -> Dict[str, Any]:
        """
        生成视频
        
        Args:
            prompt: 提示词
            model: 模型名称
            url: 参考图URL或Base64
            aspect_ratio: 视频比例
            duration: 视频时长
            remix_target_id: 视频续作ID
            size: 视频清晰度
        
        Returns:
            包含id的字典
        """
        payload = {
            "model": model,
            "prompt": prompt,
            "aspectRatio": aspect_ratio,
            "duration": duration,
            "remixTargetId": remix_target_id,
            "size": size,
            "webHook": "-1",  # 立即返回ID，使用轮询模式
            "shutProgress": False
        }
        
        if url:
            payload["url"] = url
        
        data = self._request("POST", "/v1/video/sora-video", json=payload)
        return data.get("data", {})
    
    def upload_character(
        self,
        url: str,
        timestamps: str = "0,3"
    ) -> Dict[str, Any]:
        """
        上传角色
        
        Args:
            url: 角色视频URL或Base64
            timestamps: 时间范围，格式: "开始秒数,结束秒数"
        
        Returns:
            包含id的字典
        """
        payload = {
            "url": url,
            "timestamps": timestamps,
            "webHook": "-1",
            "shutProgress": False
        }
        
        data = self._request("POST", "/v1/video/sora-upload-character", json=payload)
        return data.get("data", {})
    
    def create_character(
        self,
        pid: str,
        timestamps: str = "0,3"
    ) -> Dict[str, Any]:
        """
        从原视频创建角色
        
        Args:
            pid: 原视频ID
            timestamps: 时间范围
        
        Returns:
            包含id的字典
        """
        payload = {
            "pid": pid,
            "timestamps": timestamps,
            "webHook": "-1",
            "shutProgress": False
        }
        
        data = self._request("POST", "/v1/video/sora-create-character", json=payload)
        return data.get("data", {})
    
    def get_result(self, task_id: str) -> Dict[str, Any]:
        """
        获取任务结果
        
        Args:
            task_id: 任务ID
        
        Returns:
            任务结果数据
        """
        payload = {"id": task_id}
        response = self._request("POST", "/v1/draw/result", json=payload)
        
        if response.get("code") == 0:
            return response.get("data", {})
        elif response.get("code") == -22:
            raise Exception("Task not found")
        else:
            raise Exception(response.get("msg", "Unknown error"))

# 全局客户端实例
sora2_client = Sora2Client()
