# 本地工作台启动与重启

在终端执行：

```bash
cd /Users/shenzihao/Documents/ChatGPT/AI_Drama
bash scripts/start-local.command
```

打开 http://localhost:5679/film/6?episode=10 。也可在Finder双击scripts/start-local.command。

保持启动终端开启。重启时在该终端按Ctrl+C，等待退出，再执行同一命令。脚本使用本机Node22，先检查SQLite原生模块和前端构建；5679已被占用时不启动第二份或强行杀进程。

检查服务：`curl --max-time 5 http://localhost:5679/health`。
检查监听：`lsof -nP -iTCP:5679 -sTCP:LISTEN`。

若5679被占用但health失败，先检查对应进程和原终端日志，不要直接kill所有Node进程。源码修改后构建前端再重启；日常启动无需重新构建。

2026-09-28排查时5679无监听，旧日志结束于正常GET且未记录退出原因；Node22重新启动后health正常。无法从该日志证明代码崩溃，更可能是临时运行进程生命周期问题。此脚本是前台启动器，不是系统开机自启守护服务；关闭终端或电脑休眠仍影响可用性。
