#!/system/bin/sh

kill $(pgrep -f '/bin/LittleYouran') 2>/dev/null
sleep 1

while [ ! -d /sdcard ]; do sleep 1; done

LD_LIBRARY_PATH=/data/adb/modules/LittleYouran/bin nohup /data/adb/modules/LittleYouran/bin/LittleYouran > /data/adb/modules/LittleYouran/log.txt 2>&1 &

echo "启动成功了喵✌️"
