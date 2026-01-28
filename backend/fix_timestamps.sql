-- SQL脚本：修复消息时间戳格式
-- 将UTC时间转换为本地时间（东八区 +8小时）

-- 1. 创建临时表存储转换后的数据
CREATE TABLE messages_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    username TEXT NOT NULL,
    user_avatar TEXT,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (channel_id) REFERENCES channels(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 2. 复制数据并转换时间戳（UTC转本地时间，加8小时）
INSERT INTO messages_new (id, channel_id, user_id, username, user_avatar, content, created_at)
SELECT 
    id, 
    channel_id, 
    user_id, 
    username, 
    user_avatar, 
    content,
    datetime(created_at, '+8 hours')  -- 将UTC时间转换为东八区本地时间
FROM messages;

-- 3. 删除旧表
DROP TABLE messages;

-- 4. 重命名新表
ALTER TABLE messages_new RENAME TO messages;

-- 完成！现在所有消息的时间戳都已转换为本地时间
