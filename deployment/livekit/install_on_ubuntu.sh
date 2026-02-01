#!/bin/bash

# 1. 安装 Docker (如果已安装会自动跳过或更新)
echo "正在检查/安装 Docker..."
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 2. 创建目录
echo "创建 LiveKit 目录..."
mkdir -p ~/livekit-server
cd ~/livekit-server

# 3. 生成配置文件 (livekit.yaml)
echo "生成 livekit.yaml..."
cat > livekit.yaml <<EOF
port: 7880
rtc:
  tcp_port: 7881
  udp_port: 7882
  port_range_start: 50000
  port_range_end: 60000
  use_external_ip: true

keys:
  # 这里的 Key:Secret 必须与 docker-compose.yml 和您本地项目的 .env 一致
  "witweb_key": "witweb_secret_88888888"

logging:
  level: info
EOF

# 4. 生成 Docker Compose 文件
echo "生成 docker-compose.yml..."
cat > docker-compose.yml <<EOF
version: "3.9"
services:
  livekit:
    image: livekit/livekit-server:latest
    command: --config /etc/livekit.yaml
    restart: unless-stopped
    network_mode: host
    volumes:
      - ./livekit.yaml:/etc/livekit.yaml
    environment:
      # 格式: LIVEKIT_KEYS=key:secret
      - LIVEKIT_KEYS=witweb_key:witweb_secret_88888888
EOF

# 5. 启动服务
echo "启动 LiveKit 服务器..."
sudo docker compose up -d

# 6. 显示结果
PUBLIC_IP=$(curl -s ifconfig.me)
echo "========================================"
echo "✅ 部署成功!"
echo ""
echo "服务器地址: http://${PUBLIC_IP}:7880"
echo "API Key:    witweb_key"
echo "API Secret: witweb_secret_88888888"
echo ""
echo "请将以上信息填入您本地项目的 .env 文件中。"
echo "========================================"
