# 预设对话

把导出的项目 JSON 放在这个文件夹里，就能用 URL 参数直接载入 / 分享。

## 用法

| 链接 | 效果 |
| --- | --- |
| `?preset=demo` | 载入 `presets/demo.json`（编辑器里打开） |
| `?play=1&preset=demo` | 纯游玩模式直接播放 `presets/demo.json` |
| `?play=1&preset=demo&node=p_talk` | 从 `p_talk` 这个节点开始播放 |

也可以写完整路径或外链：

```text
?preset=presets/demo.json
?preset=./presets/demo.json
?preset=https://example.com/my-story.json
```

外链需要服务器允许跨域（GitHub raw 可以）。

## 怎么做一个预设

1. 打开编辑器，设计好对话。
2. 点右上角「导出 JSON」。
3. 把下载的 JSON 改个英文名（比如 `my-story.json`），放进本文件夹。
4. 提交到 GitHub。
5. 分享链接：`https://你的用户名.github.io/helltaker-dialogue-editor/?play=1&preset=my-story`

> 预设项目是只读的：载入后不会写入访客的 localStorage / IndexedDB，也不会覆盖访客自己的项目。
> 上传的图片会以内嵌 base64 的形式一起打包在导出的 JSON 里，所以预设链接可以独立使用。
