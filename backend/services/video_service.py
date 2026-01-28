"""
视频任务管理服务
"""
import uuid
import json
from typing import Optional, Dict, Any, List
from datetime import datetime

try:
    from ..db import get_conn, adapt_query
    from .sora2_client import sora2_client
except ImportError:
    from backend.db import get_conn, adapt_query
    from backend.services.sora2_client import sora2_client

class VideoService:
    """视频任务管理服务"""
    
    @staticmethod
    def create_task(
        username: str,
        task_type: str,
        **params
    ) -> str:
        """
        创建视频任务
        
        Args:
            username: 用户名
            task_type: 任务类型 (generate, upload_character, create_character)
            **params: 任务参数
        
        Returns:
            任务ID
        """
        task_id = str(uuid.uuid4())
        conn = get_conn()
        cur = conn.cursor()
        
        cur.execute(adapt_query("""
            INSERT INTO video_tasks (
                id, username, task_type, status, progress,
                prompt, model, url, aspect_ratio, duration,
                remix_target_id, size, pid, timestamps
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """), (
            task_id,
            username,
            task_type,
            'pending',
            0,
            params.get('prompt'),
            params.get('model'),
            params.get('url'),
            params.get('aspect_ratio'),
            params.get('duration'),
            params.get('remix_target_id'),
            params.get('size'),
            params.get('pid'),
            params.get('timestamps')
        ))
        
        conn.commit()
        conn.close()
        
        return task_id
    
    @staticmethod
    def update_task_status(
        task_id: str,
        status: str,
        progress: int = None,
        result_json: str = None,
        failure_reason: str = None,
        error: str = None
    ):
        """更新任务状态"""
        conn = get_conn()
        cur = conn.cursor()
        
        update_fields = ["status = ?", "updated_at = datetime('now', 'localtime')"]
        params = [status]
        
        if progress is not None:
            update_fields.append("progress = ?")
            params.append(progress)
        
        if result_json is not None:
            update_fields.append("result_json = ?")
            params.append(result_json)
        
        if failure_reason is not None:
            update_fields.append("failure_reason = ?")
            params.append(failure_reason)
        
        if error is not None:
            update_fields.append("error = ?")
            params.append(error)
        
        params.append(task_id)
        
        cur.execute(adapt_query(f"""
            UPDATE video_tasks
            SET {', '.join(update_fields)}
            WHERE id = ?
        """), tuple(params))
        
        conn.commit()
        conn.close()
    
    @staticmethod
    def save_results(task_id: str, results: List[Dict[str, Any]]):
        """保存任务结果"""
        conn = get_conn()
        cur = conn.cursor()
        
        for result in results:
            cur.execute(adapt_query("""
                INSERT INTO video_results (
                    task_id, url, remove_watermark, pid, character_id
                ) VALUES (?, ?, ?, ?, ?)
            """), (
                task_id,
                result.get('url'),
                result.get('removeWatermark', False),
                result.get('pid'),
                result.get('character_id')
            ))
        
        conn.commit()
        conn.close()
    
    @staticmethod
    def get_task(task_id: str, username: str = None) -> Optional[Dict[str, Any]]:
        """获取任务详情"""
        conn = get_conn()
        cur = conn.cursor()
        
        query = adapt_query("SELECT * FROM video_tasks WHERE id = ?")
        params = [task_id]
        
        if username:
            query = adapt_query("SELECT * FROM video_tasks WHERE id = ? AND username = ?")
            params.append(username)
        
        cur.execute(query, tuple(params))
        row = cur.fetchone()
        
        if not row:
            conn.close()
            return None
        
        task = dict(row)
        
        # 获取结果
        cur.execute(adapt_query("SELECT * FROM video_results WHERE task_id = ?"), (task_id,))
        results = [dict(r) for r in cur.fetchall()]
        task['results'] = results
        
        conn.close()
        return task
    
    @staticmethod
    def get_tasks(
        username: str,
        page: int = 1,
        limit: int = 20,
        task_type: str = None
    ) -> Dict[str, Any]:
        """获取任务列表"""
        conn = get_conn()
        cur = conn.cursor()
        
        offset = (page - 1) * limit
        
        where_clause = "WHERE username = ?"
        params = [username]
        
        if task_type:
            where_clause += " AND task_type = ?"
            params.append(task_type)
        
        # 获取总数
        cur.execute(adapt_query(f"SELECT COUNT(*) FROM video_tasks {where_clause}"), tuple(params))
        total = cur.fetchone()[0]
        
        # 获取任务列表
        cur.execute(adapt_query(f"""
            SELECT * FROM video_tasks
            {where_clause}
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        """), tuple(params + [limit, offset]))
        
        tasks = [dict(row) for row in cur.fetchall()]
        
        conn.close()
        
        return {
            "tasks": tasks,
            "total": total,
            "page": page,
            "limit": limit
        }
    
    @staticmethod
    def poll_and_update(task_id: str):
        """轮询并更新任务状态"""
        try:
            result = sora2_client.get_result(task_id)
            
            status = result.get('status', 'running')
            progress = result.get('progress', 0)
            
            # 更新任务状态
            VideoService.update_task_status(
                task_id,
                status,
                progress,
                json.dumps(result),
                result.get('failure_reason'),
                result.get('error')
            )
            
            # 如果成功，保存结果
            if status == 'succeeded' and result.get('results'):
                VideoService.save_results(task_id, result['results'])
            
            return result
        except Exception as e:
            # 更新为失败状态
            VideoService.update_task_status(
                task_id,
                'failed',
                error=str(e)
            )
            raise
    
    @staticmethod
    def save_character(username: str, character_id: str, name: str = None, source_task_id: str = None):
        """保存角色"""
        conn = get_conn()
        cur = conn.cursor()
        
        cur.execute(adapt_query("""
            INSERT INTO characters (username, character_id, name, source_task_id)
            VALUES (?, ?, ?, ?)
        """), (username, character_id, name, source_task_id))
        
        conn.commit()
        conn.close()
    
    @staticmethod
    def get_characters(username: str) -> List[Dict[str, Any]]:
        """获取用户的角色列表"""
        conn = get_conn()
        cur = conn.cursor()
        
        cur.execute(adapt_query("""
            SELECT * FROM characters
            WHERE username = ?
            ORDER BY created_at DESC
        """), (username,))
        
        characters = [dict(row) for row in cur.fetchall()]
        conn.close()
        
        return characters

video_service = VideoService()
