# Claude Desktop 配置示例

编辑 `~/Library/Application Support/Claude/claude_desktop_config.json`(macOS)或对应平台的配置文件:

## 基础配置(仅本地处理,无需 API Key)

```json
{
  "mcpServers": {
    "lokvis": {
      "command": "npx",
      "args": ["-y", "@lokvis/mcp-server"],
      "env": {
        "LOKVIS_WORKDIR": "/Users/your-username/Documents",
        "LOKVIS_DOMAINS": "image,pdf"
      }
    }
  }
}
```

## 带 API Key 配置(启用 cloud AI tool)

```json
{
  "mcpServers": {
    "lokvis": {
      "command": "npx",
      "args": ["-y", "@lokvis/mcp-server"],
      "env": {
        "LOKVIS_WORKDIR": "/Users/your-username/Documents",
        "LOKVIS_DOMAINS": "image,pdf",
        "LOKVIS_API_KEY": "lk_your_api_key_here"
      }
    }
  }
}
```

API Key 可在 https://app.lokvis.com/settings/api-keys 创建。

## 测试 Prompt

配置完成后重启 Claude Desktop,尝试以下 prompt:

### Image 处理

1. **"Compress image.jpg to 80% quality"**
   → 调用 `lokvis_image_compress`

2. **"Resize image.png to 800px width"**
   → 调用 `lokvis_image_resize`

3. **"Convert image.png to WebP format"**
   → 调用 `lokvis_image_convert`

### PDF 处理

4. **"Merge report.pdf and appendix.pdf into one file"**
   → 调用 `lokvis_pdf_merge`

5. **"Compress large.pdf to reduce file size"**
   → 调用 `lokvis_pdf_compress`

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `LOKVIS_WORKDIR` | 工作目录(资产读写根路径) | 当前目录 |
| `LOKVIS_DOMAINS` | 启用的能力域,逗号分隔 | `image` |
| `LOKVIS_MODE` | 运行模式 `stdio` \| `sse` | `stdio` |
| `LOKVIS_API_KEY` | API Key(可选,启用 cloud AI tool) | — |
| `LOKVIS_API_BASE_URL` | cloud API 地址 | `https://api.lokvis.com` |

## 故障排查

- **"Browser not connected"**:Claude 调用 video/audio 能力时,Node 降级不支持,需打开 lokvis.app 浏览器标签页连接 BrowserBridge
- **"File too large"**:>10MB 文件需在浏览器用 File System Access API 授权
- **"Tool not available"**:检查 `LOKVIS_DOMAINS` 是否包含对应能力域(如 `pdf` 域需包含在列表中)
- **"API key validation failed"**:检查 `LOKVIS_API_KEY` 是否正确,或是否已撤销
