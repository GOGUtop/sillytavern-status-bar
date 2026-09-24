# 酒馆状态栏管理器

将整个目录复制到 SillyTavern 的 `public/scripts/extensions/third-party/status-bar-manager/`，重启或在扩展设置中重新加载。

功能：
- 管理多个状态栏，勾选后在 `MESSAGE_RECEIVED`（角色消息生成完成）事件触发。
- 每个状态栏独立提示词，调用独立配置的 OpenAI 兼容 Chat Completions API。
- API 连接测试。
- Chromium Web Bluetooth 选择设备，并可选服务/特征 UUID；生成后的 JSON 会写入特征。

API 地址必须是浏览器可访问的完整 Chat Completions 地址。蓝牙需要 HTTPS/localhost、浏览器支持 Web Bluetooth，并由用户在弹窗中选择设备。
