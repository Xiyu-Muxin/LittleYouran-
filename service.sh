#!/system/bin/sh

MODDIR=${MODPATH:-${MODDIR:-/data/adb/modules/LittleYouran}}
BIN="$MODDIR/bin/LittleYouran"
LOG="$MODDIR/log.txt"

# Magisk 注入的变量名是 MODPATH 不是 MODDIR,这里两个都兜底
# post-fs-data.sh 阶段可能因 SELinux/只读挂载没能 chmod,这里再兜一次
if [ -f "$BIN" ]; then
    chmod 0755 "$BIN"
    chcon u:object_r:magisk_file:s0 "$BIN" 2>/dev/null
    restorecon "$BIN" 2>/dev/null
fi

# 二进制依赖 libc++_shared.so (std::__ndk1 命名空间, 系统的 libc++.so 不提供);
# 系统 + apex 都不带 libc++_shared.so, 只能用户自己准备一份放进 bin 目录。
# 这里只负责给准备好的 .so 补上权限 + 把模块 bin 加进动态库搜索路径。
for so in "$MODDIR"/bin/*.so; do
    [ -f "$so" ] || continue
    chmod 0755 "$so"
    chcon u:object_r:magisk_file:s0 "$so" 2>/dev/null
    restorecon "$so" 2>/dev/null
done
export LD_LIBRARY_PATH="$MODDIR/bin:$LD_LIBRARY_PATH"

# Kill existing instance by exact path match
PID=$(pgrep -f "$(echo "$BIN" | sed 's/\./\\./g')" 2>/dev/null)
if [ -n "$PID" ]; then
    kill "$PID" 2>/dev/null
    sleep 1
fi

# Wait for /sdcard with 30-second timeout
i=0
while [ ! -d /sdcard ] && [ $i -lt 30 ]; do
    sleep 1
    i=$((i + 1))
done

# Rotate log if larger than 1MB
if [ -f "$LOG" ]; then
    SIZE=$(wc -c < "$LOG")
    if [ "$SIZE" -gt 1048576 ] 2>/dev/null; then
        mv -f "$LOG" "$LOG.old" 2>/dev/null
    fi
fi

nohup "$BIN" > "$LOG" 2>&1 &
