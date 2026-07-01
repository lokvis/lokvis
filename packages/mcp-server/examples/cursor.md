# Cursor 配置示例

编辑 `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "lokvis": {
      "command": "npx",
      "args": ["-y", "@lokvis/mcp-server@latest"],
      "env": {
        "LOKVIS_WORKDIR": "/Users/your-username/Projects"
      }
    }
  }
}
```

## 在 Cursor 中使用

配置后重启 Cursor,在 Chat 面板输入:

- "Compress all screenshots in this project to under 200KB"
- "Resize the favicon to 32x32 and 16x16"
- "Convert all PNG assets to WebP"

Cursor 会自动调用对应的 Lokvis tool,文件本地处理不上传。
