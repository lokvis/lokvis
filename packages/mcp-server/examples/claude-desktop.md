# Claude Desktop 配置示例

编辑 `~/Library/Application Support/Claude/claude_desktop_config.json`(macOS)或对应平台的配置文件:

```json
{
  "mcpServers": {
    "lokvis": {
      "command": "npx",
      "args": ["-y", "@lokvis/mcp-server"],
      "env": {
        "LOKVIS_WORKDIR": "/Users/your-username/Documents"
      }
    }
  }
}
```

## 测试 Prompt

配置完成后重启 Claude Desktop,尝试以下 prompt:

1. **"Compress image.jpg to under 100KB"**
   → 调用 `lokvis_compress_image`

2. **"Resize all images in /photos to 1920px width"**
   → 调用 `lokvis_batch_process`(operation: resize)

3. **"Convert image.png to WebP"**
   → 调用 `lokvis_convert_image`

4. **"Add watermark 'Confidential' to bottom-right of report.png"**
   → 调用 `lokvis_watermark_image`

5. **"Run my web-optimize workflow on hero.png"**
   → 调用 `lokvis_run_workflow`

## 故障排查

- **"Browser not connected"**:Claude 调用 video/audio 能力时,Node 降级不支持,需打开 lokvis.app
- **"File too large"**:>10MB 文件需在浏览器用 File System Access API 授权
- **"Tool not available"**:检查 LOKVIS_DOMAINS 是否包含对应能力域
