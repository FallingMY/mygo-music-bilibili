# 哔哩哔哩 for MyGo Music

在 [MyGo Music](https://github.com/egoist/mygo-music) 里听 B站视频的音轨：搜索、粘贴链接、B站音乐榜、分区排行、多P和合集、收藏夹、历史、评论、字幕歌词。仅供个人收听，与哔哩哔哩官方无关；用的是网页端接口，B站改接口时可能失效。

[English](#english)

## 安装

1. 先装 [ffmpeg](https://ffmpeg.org)。B站音轨是 MP4 封装的 AAC（少数 Hi-Res 稿件是 FLAC），MyGo Music 解不了，插件会调用 ffmpeg 边下边转成 MP3：

   ```bash
   brew install ffmpeg
   ```

2. 安装插件：点这个链接 [mygo-music://install-plugin?repo=GentleM4dman/mygo-music-bilibili](mygo-music://install-plugin?repo=GentleM4dman/mygo-music-bilibili)，或在「设置 → 插件 → +」里粘贴 `https://github.com/GentleM4dman/mygo-music-bilibili`。
3. 在「设置 → 插件」里允许哔哩哔哩启动程序。它只会启动 ffmpeg，位置限定为 PATH、`/opt/homebrew/bin` 或 `/usr/local/bin`。

需要 MyGo Music 0.1.8 及以上。

## 能做什么

- **不登录**：搜视频和 UP 主；在搜索框粘贴视频链接、b23.tv 短链、BV 号或 av 号（带 `?p=3` 时那一P排最前）；B站音乐榜（周榜）；音乐各分区近一周排行；多P视频当专辑，每P一首；单P视频属于合集时，专辑页列出整个合集；UP 主的投稿；评论第一页；「相关推荐」电台。
- **扫码登录后**：默认收藏夹作为「喜欢」；其他收藏夹和收藏的合集作为歌单；往自己的收藏夹里加歌、删歌，新建和重命名收藏夹；历史记录；首页推荐和「首页推荐」电台；关注 UP 主；全部评论、点赞和发评论；有字幕的视频把字幕当歌词。
- **音质**：标准是 128 kbps MP3，高是 320 kbps MP3，都由 B站最高码率的 AAC（一般 192 kbps）转码而来。无损会播放 Hi-Res 稿件的 FLAC，需要大会员；拿不到时退回 320 kbps。

## 登录与隐私

登录后的 Cookie 以明文保存在本机这个插件的数据目录里，只发给 B站。在 App 里退出登录只会删掉本机保存的这份；要让这次登录在 B站那边失效，请在哔哩哔哩 App 的登录设备管理里下线。

## 开发

```bash
npm test            # 离线测试扫码登录
npm run test:live   # 不登录，用真实的 B站接口把各功能跑一遍
```

测试在 Node 22+ 里加载 `index.js`，用一个模拟的 `host` 代替 MyGo Music 提供的宿主对象。

---

## English

Plays the audio of Bilibili videos in [MyGo Music](https://github.com/egoist/mygo-music). For personal listening; not affiliated with Bilibili. It uses the website's own API and may stop working when that changes.

**Install** [ffmpeg](https://ffmpeg.org) first (`brew install ffmpeg`). Bilibili serves AAC (or FLAC for a few Hi-Res uploads) inside MP4, which MyGo Music doesn't decode, so ffmpeg converts it to MP3 as it plays. Then install with [mygo-music://install-plugin?repo=GentleM4dman/mygo-music-bilibili](mygo-music://install-plugin?repo=GentleM4dman/mygo-music-bilibili), and in Settings > Plugins allow Bilibili to start programs. It only starts ffmpeg, from the PATH, `/opt/homebrew/bin` or `/usr/local/bin`.

**Signed out**: search videos and uploaders, paste links (`bilibili.com/video/…`, `b23.tv/…`, BV or av IDs), the weekly Bilibili Music Chart, weekly charts of the music categories, a video's parts (or its collection) as an album, uploaders' videos, the first page of comments, and a station of related videos.

**Signed in** (scan the QR code with the Bilibili app): your default favorites folder as Liked, other folders and saved collections as playlists, editing your own folders, history, recommendations, following uploaders, all comments, liking and posting comments, and subtitles as lyrics where a video has them.

**Quality**: Standard is 128 kbps MP3 and High is 320 kbps MP3, both converted from Bilibili's best AAC. Lossless plays the FLAC of Hi-Res uploads (needs a premium account) and falls back to High.

**Privacy**: the session's cookies are kept unencrypted in the plugin's data on this machine and are only sent to Bilibili. Signing out forgets them here. To end the session on Bilibili's side, log out the device in the Bilibili app.

## License

MIT
