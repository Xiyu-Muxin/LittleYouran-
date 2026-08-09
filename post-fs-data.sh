#!/system/bin/sh

# Magisk 注入的是 MODPATH,不是 MODDIR;两个都兜底
MODDIR="${MODPATH:-/data/adb/modules/LittleYouran}"
BIN="$MODDIR/bin/LittleYouran"

# 给守护进程二进制加上可执行权限(Windows zip 打包时大概率丢了 x 位)
if [ -f "$BIN" ]; then
    chmod 0755 "$BIN"
    # SELinux context 兜底(部分设备/内核会把模块目录标成 magisk_file)
    chcon u:object_r:magisk_file:s0 "$BIN" 2>/dev/null
    restorecon "$BIN" 2>/dev/null
fi