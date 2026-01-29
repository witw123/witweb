"use client";

import { useEffect, useState } from "react";

export default function AIAdminPage() {
  const [credits, setCredits] = useState(0);
  const [loading, setLoading] = useState(true);
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [modelStatuses, setModelStatuses] = useState<Record<string, any>>({});
  const [tokenConfig, setTokenConfig] = useState({ has_token: false, token_preview: null as string | null });
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [newToken, setNewToken] = useState("");
  const [savingToken, setSavingToken] = useState(false);

  const [baseUrlConfig, setBaseUrlConfig] = useState({ base_url: "https://grsaiapi.com" });
  const [showBaseUrlInput, setShowBaseUrlInput] = useState(false);
  const [newBaseUrl, setNewBaseUrl] = useState("");
  const [savingBaseUrl, setSavingBaseUrl] = useState(false);

  const [sora2KeyConfig, setSora2KeyConfig] = useState({ has_token: false, token_preview: null as string | null });
  const [showSora2KeyInput, setShowSora2KeyInput] = useState(false);
  const [newSora2Key, setNewSora2Key] = useState("");
  const [savingSora2Key, setSavingSora2Key] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadTokenConfig(),
        loadBaseUrlConfig(),
        loadSora2KeyConfig(),
        loadCredits(),
        loadModelStatuses(),
        loadApiKeys(),
      ]);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadTokenConfig = async () => {
    const token = localStorage.getItem("token");
    const response = await fetch("/api/admin/ai/config/token", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.ok) {
      const data = await response.json();
      setTokenConfig(data);
    }
  };

  const loadBaseUrlConfig = async () => {
    const token = localStorage.getItem("token");
    const response = await fetch("/api/admin/ai/config/base-url", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.ok) {
      const data = await response.json();
      setBaseUrlConfig(data);
      setNewBaseUrl(data.base_url || "https://grsaiapi.com");
    }
  };

  const loadSora2KeyConfig = async () => {
    const token = localStorage.getItem("token");
    const response = await fetch("/api/admin/ai/config/sora2-key", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.ok) {
      const data = await response.json();
      setSora2KeyConfig(data);
    }
  };

  const loadCredits = async () => {
    const token = localStorage.getItem("token");
    const response = await fetch("/api/admin/ai/credits", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error("Failed to fetch credits");
    const data = await response.json();
    setCredits(data.credits || 0);
  };

  const loadApiKeys = async () => {
    const token = localStorage.getItem("token");
    const response = await fetch("/api/admin/ai/apikeys", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.ok) {
      const data = await response.json();
      setApiKeys(data.data || data.items || []);
    }
  };

  const loadModelStatuses = async () => {
    const models = ["gpt-4", "gpt-3.5-turbo", "claude-3-opus", "claude-3-sonnet"];
    const token = localStorage.getItem("token");
    const statuses: Record<string, any> = {};
    for (const model of models) {
      try {
        const response = await fetch(`/api/admin/ai/models/${model}/status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          statuses[model] = data;
        }
      } catch (error) {
        console.error(`Failed to load status for ${model}:`, error);
      }
    }
    setModelStatuses(statuses);
  };

  const handleSaveToken = async () => {
    if (!newToken.trim()) {
      alert("请输入 API Token");
      return;
    }
    try {
      setSavingToken(true);
      const token = localStorage.getItem("token");
      const response = await fetch("/api/admin/ai/config/token", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: newToken.trim() }),
      });
      if (!response.ok) throw new Error("Failed to save token");
      alert("API Token 保存成功");
      setNewToken("");
      setShowTokenInput(false);
      await loadTokenConfig();
      await loadCredits();
    } catch (error: any) {
      alert(`保存失败: ${error.message}`);
    } finally {
      setSavingToken(false);
    }
  };

  const handleSaveBaseUrl = async () => {
    if (!newBaseUrl.trim()) {
      alert("请输入 API Base URL");
      return;
    }
    try {
      setSavingBaseUrl(true);
      const token = localStorage.getItem("token");
      const response = await fetch("/api/admin/ai/config/base-url", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ base_url: newBaseUrl.trim() }),
      });
      if (!response.ok) throw new Error("Failed to save base URL");
      alert("API Base URL 保存成功");
      setShowBaseUrlInput(false);
      await loadBaseUrlConfig();
    } catch (error: any) {
      alert(`保存失败: ${error.message}`);
    } finally {
      setSavingBaseUrl(false);
    }
  };

  const handleSaveSora2Key = async () => {
    if (!newSora2Key.trim()) {
      alert("请输入 Sora2 API Key");
      return;
    }
    try {
      setSavingSora2Key(true);
      const token = localStorage.getItem("token");
      const response = await fetch("/api/admin/ai/config/sora2-key", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: newSora2Key.trim() }),
      });
      if (!response.ok) throw new Error("Failed to save Sora2 API key");
      alert("Sora2 API Key 保存成功");
      setNewSora2Key("");
      setShowSora2KeyInput(false);
      await loadSora2KeyConfig();
    } catch (error: any) {
      alert(`保存失败: ${error.message}`);
    } finally {
      setSavingSora2Key(false);
    }
  };

  const handleCreateKey = async (formData: any) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/admin/ai/apikeys", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });
      if (!response.ok) throw new Error("Failed to create API key");
      const result = await response.json();
      alert(`APIKey 创建成功！\n\nKey: ${result.data?.key || result.key || ""}\n\n请妥善保存，此密钥只显示一次！`);
      setShowCreateModal(false);
      loadCredits();
      loadApiKeys();
    } catch (error: any) {
      alert(`创建失败: ${error.message}`);
    }
  };

  if (loading) {
    return null;
  }

  return (
    <div className="ai-admin-page">
      <div className="admin-header">
        <h1>AI 服务管理</h1>
        <button onClick={loadData} className="btn-secondary">
          刷新数据
        </button>
      </div>

      <div className="token-config-section card">
        <div className="section-header">
          <h2>API Token 配置</h2>
          {!showTokenInput && (
            <button onClick={() => setShowTokenInput(true)} className="btn-secondary">
              {tokenConfig.has_token ? "更新 Token" : "设置 Token"}
            </button>
          )}
        </div>

        {tokenConfig.has_token && !showTokenInput ? (
          <div className="token-status">
            <span className="status-badge online">已配置</span>
            <code className="token-preview">{tokenConfig.token_preview}</code>
          </div>
        ) : !showTokenInput ? (
          <p className="text-muted">未配置 API Token，请点击上方按钮设置</p>
        ) : null}

        {showTokenInput && (
          <div className="token-input-form">
            <div className="form-group">
              <label>GRSAI API Token</label>
              <input
                type="password"
                value={newToken}
                onChange={(e) => setNewToken(e.target.value)}
                placeholder="请输入您的 API Token"
                className="token-input"
              />
              <small className="text-muted">
                Token 将安全保存在服务端，用于调用 GRSAI API 服务
              </small>
            </div>
            <div className="form-actions">
              <button
                onClick={() => {
                  setShowTokenInput(false);
                  setNewToken("");
                }}
                className="btn-secondary"
                disabled={savingToken}
              >
                取消
              </button>
              <button
                onClick={handleSaveToken}
                className="btn-primary"
                disabled={savingToken}
              >
                {savingToken ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="token-config-section card">
        <div className="section-header">
          <h2>API Base URL 配置</h2>
          {!showBaseUrlInput && (
            <button onClick={() => setShowBaseUrlInput(true)} className="btn-secondary">
              更新 Base URL
            </button>
          )}
        </div>

        {!showBaseUrlInput ? (
          <div className="token-status">
            <span className="status-badge online">当前 URL</span>
            <code className="token-preview">{baseUrlConfig.base_url}</code>
          </div>
        ) : null}

        {showBaseUrlInput && (
          <div className="token-input-form">
            <div className="form-group">
              <label>GRSAI API Base URL</label>
              <input
                type="text"
                value={newBaseUrl}
                onChange={(e) => setNewBaseUrl(e.target.value)}
                placeholder="https://grsaiapi.com"
                className="token-input"
              />
              <small className="text-muted">
                API 服务的基础 URL 地址，默认 https://grsaiapi.com
              </small>
            </div>
            <div className="form-actions">
              <button
                onClick={() => {
                  setShowBaseUrlInput(false);
                  setNewBaseUrl(baseUrlConfig.base_url);
                }}
                className="btn-secondary"
                disabled={savingBaseUrl}
              >
                取消
              </button>
              <button
                onClick={handleSaveBaseUrl}
                className="btn-primary"
                disabled={savingBaseUrl}
              >
                {savingBaseUrl ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="token-config-section card">
        <div className="section-header">
          <h2>Sora2 API Key 配置</h2>
          {!showSora2KeyInput && (
            <button onClick={() => setShowSora2KeyInput(true)} className="btn-secondary">
              {sora2KeyConfig.has_token ? "更新 API Key" : "设置 API Key"}
            </button>
          )}
        </div>

        {sora2KeyConfig.has_token && !showSora2KeyInput ? (
          <div className="token-status">
            <span className="status-badge online">已配置</span>
            <code className="token-preview">{sora2KeyConfig.token_preview}</code>
          </div>
        ) : !showSora2KeyInput ? (
          <p className="text-muted">未配置 Sora2 API Key，请点击上方按钮设置</p>
        ) : null}

        {showSora2KeyInput && (
          <div className="token-input-form">
            <div className="form-group">
              <label>Sora2 API Key</label>
              <input
                type="password"
                value={newSora2Key}
                onChange={(e) => setNewSora2Key(e.target.value)}
                placeholder="请输入您的 Sora2 API Key"
                className="token-input"
              />
              <small className="text-muted">用于 Sora2 视频生成服务的 API 密钥</small>
            </div>
            <div className="form-actions">
              <button
                onClick={() => {
                  setShowSora2KeyInput(false);
                  setNewSora2Key("");
                }}
                className="btn-secondary"
                disabled={savingSora2Key}
              >
                取消
              </button>
              <button
                onClick={handleSaveSora2Key}
                className="btn-primary"
                disabled={savingSora2Key}
              >
                {savingSora2Key ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="balance-card">
        <div className="card-header">
          <h2>账户余额</h2>
        </div>
        <div className="balance-amount">
          <span className="currency">积分</span>
          <span className="amount">{credits.toLocaleString()}</span>
        </div>
      </div>

      <div className="apikey-section card">
        <div className="section-header">
          <h2>APIKey 管理</h2>
          <button onClick={() => setShowCreateModal(true)} className="btn-primary">
            创建新 Key
          </button>
        </div>

        {apiKeys.length === 0 ? (
          <p className="text-muted">暂无 APIKey，点击上方按钮创建</p>
        ) : (
          <div className="apikey-list">
            {apiKeys.map((key: any) => (
              <div key={key.id || key.key} className="apikey-item">
                <div className="key-info">
                  <strong>{key.name}</strong>
                  <code>{key.key}</code>
                </div>
                <div className="key-stats">
                  <span>余额: {key.credits}</span>
                  <span>到期: {key.expireTime ? new Date(key.expireTime * 1000).toLocaleDateString() : "永久"}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="model-status-section card">
        <h2>模型状态监控</h2>
        <div className="model-list">
          {Object.entries(modelStatuses).map(([model, status]) => (
            <div key={model} className="model-item">
              <span className="model-name">{model}</span>
              <span className={`status-badge ${status.status ? "online" : "offline"}`}>
                {status.status ? "正常" : "异常"}
              </span>
              {status.error && <span className="error-msg">{status.error}</span>}
            </div>
          ))}
        </div>
      </div>

      {showCreateModal && (
        <CreateKeyModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateKey}
        />
      )}
    </div>
  );
}

function CreateKeyModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (data: any) => void;
}) {
  const [formData, setFormData] = useState({
    name: "",
    type: 0,
    credits: 0,
    expireTime: 0,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate(formData);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>创建 APIKey</h3>
          <button onClick={onClose} className="close-btn">×</button>
        </div>

        <form onSubmit={handleSubmit} className="create-key-form">
          <div className="form-group">
            <label>Key 名称</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="例如: 生产环境 Key"
              required
            />
          </div>

          <div className="form-group">
            <label>类型</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: parseInt(e.target.value, 10) })}
            >
              <option value={0}>无限额度</option>
              <option value={1}>限制额度</option>
            </select>
          </div>

          {formData.type === 1 && (
            <div className="form-group">
              <label>积分额度</label>
              <input
                type="number"
                value={formData.credits}
                onChange={(e) => setFormData({ ...formData, credits: parseInt(e.target.value, 10) || 0 })}
                placeholder="例如: 10000"
                min={0}
              />
            </div>
          )}

          <div className="form-group">
            <label>到期时间（可选）</label>
            <input
              type="datetime-local"
              onChange={(e) => {
                const timestamp = e.target.value ? Math.floor(new Date(e.target.value).getTime() / 1000) : 0;
                setFormData({ ...formData, expireTime: timestamp });
              }}
            />
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn-secondary">
              取消
            </button>
            <button type="submit" className="btn-primary">
              创建
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

