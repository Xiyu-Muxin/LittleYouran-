var cfg = "/data/adb/modules/LittleYouran/config/LittleYouran.txt";
var log = "/data/adb/modules/LittleYouran/log.txt";
var svc = "/data/adb/modules/LittleYouran/service.sh";

function exec(cmd, cb) {
    var id = "ly_" + Date.now();
    var timer = setTimeout(function() { delete window[id]; cb(1, '', '超时'); }, 5000);
    window[id] = function(e, o, er) { clearTimeout(timer); delete window[id]; cb(e, o, er); };
    try { ksu.exec(cmd, '{}', id); } catch(e) { clearTimeout(timer); cb(1, '', e.message); }
}

function status(t, e) {
    var el = document.getElementById('status');
    if(el) { el.textContent = t; el.style.color = e ? '#fca5a5' : '#60a5fa'; }
}

function toggleList(type) {
    var el = document.getElementById('expand-' + type);
    var btn = document.getElementById('btn-' + type);
    if(!el) return;

    if(el.style.display === 'block') {
        el.style.display = 'none';
        if(btn) btn.textContent = '▼';
    } else {
        el.style.display = 'block';
        if(btn) btn.textContent = '▲';
    }
}

function loadAll() {
    status('加载中...');
    exec('cat "' + cfg + '"', function(e, o) {
        if(e === 0 && o) {
            var lines = o.split('\n').filter(function(l) { return l.trim() && l[0] !== '#'; });
            // 新增两个分类: smartCategory (多格式分类), routing (精准分流路由)
            var d = { mount:[], simple:[], multi:[], filter:[], multiFilter:[], smartCategory:[], routing:[] };

            lines.forEach(function(l) {
                if(l.startsWith('mount=')) {
                    d.mount.push(l);
                }
                else if (l.indexOf(':') !== -1) {
                    // 7. 精准分流路由 - 包含 `格式:目的地` 映射
                    d.routing.push(l);
                }
                else if ((l.match(/,/g)||[]).length >= 1) {
                    // 6. 多格式分类 - 包含逗号分隔的多个格式
                    d.smartCategory.push(l);
                }
                else {
                    var plusCount = (l.match(/\+/g)||[]).length;
                    var hasAnd = l.indexOf('&&') !== -1;

                    if (plusCount >= 2) {
                        if (hasAnd) { d.multiFilter.push(l); } else { d.filter.push(l); }
                    }
                    else if (hasAnd) {
                        d.multi.push(l);
                    }
                    else {
                        d.simple.push(l);
                    }
                }
            });

            render('mount', d.mount);
            render('simple', d.simple);
            render('multi', d.multi);
            render('filter', d.filter);
            render('multiFilter', d.multiFilter);
            render('smartCategory', d.smartCategory);
            render('routing', d.routing);
            status('就绪');
        } else { status('读取失败', true); }
    });
}

function render(type, items) {
    var fixedEl = document.getElementById('fixed-' + type);
    var expandEl = document.getElementById('expand-' + type);
    var btn = document.getElementById('btn-' + type);
    if(!fixedEl || !expandEl) return;

    fixedEl.innerHTML = '';
    expandEl.innerHTML = '';

    items.forEach(function(r, index) {
        // 对单引号进行转义，防止 onclick 中的字符串断裂
        var escaped = r.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        var html = '<div class="rule-item"><span>' + r + '</span><span class="del-btn" onclick="delRule(\'' + escaped + '\')">✕</span></div>';
        if(index < 2) {
            fixedEl.innerHTML += html;
        } else {
            expandEl.innerHTML += html;
        }
    });

    if (items.length <= 2) {
        if(btn) btn.style.display = 'none';
        expandEl.style.display = 'none';
    } else {
        if(btn) btn.style.display = 'block';
    }
}

function saveInput(id) {
    var v = document.getElementById(id).value.trim();
    if(!v) return;
    status('检查中...');
    exec('cat "' + cfg + '"', function(e, o) {
        if(o && o.indexOf(v) !== -1) { status('已存在', true); return; }
        status('写入中...');
        var esc = v.replace(/'/g, "'\\''");
        exec("echo '" + esc + "' >> " + cfg, function(e) {
            if(e === 0) {
                status('重启中...');
                exec('sh ' + svc, function(e) {});
                loadAll();
                status('🚀 成功');
                document.getElementById(id).value = '';
            } else { status('写入失败', true); }
        });
    });
}

function delRule(r) {
    status('删除中...');
    exec('cat "' + cfg + '"', function(e, o) {
        if(e !== 0) { status('读取失败', true); return; }
        var newContent = o.split('\n').filter(function(l) { return l.trim() !== r; }).join('\n');
        var tmp = '/data/local/tmp/ly_del_tmp';
        var esc = newContent.replace(/'/g, "'\\''");
        exec("echo '" + esc + "' > " + tmp + " && mv " + tmp + " " + cfg, function(e2) {
            exec('sh ' + svc, function(e3) {});
            loadAll();
            status('已删除');
        });
    });
}

function logs() {
    exec("tail -20 '" + log + "'", function(e, o) {
        document.getElementById('logBox').textContent = o || '暂无';
    });
}

//新增日志清理
function clearLogs(){
    status('清理中...');
    //使用 echo 覆盖空字符到日志文件
    exec('sh ' + svc, function(e, o){
        if(e===0){
            status('日志已清空并重启服务');
            //等待1秒，等新进程启动并生成初始日志后，再刷新日志框
            setTimeout(logs, 1000);
        }else{
            status('清理失败', true);
        }
    });
}

document.addEventListener('DOMContentLoaded', function() {
    status('检测桥接...');
    exec('echo ok', function(e, o) {
        if(e === 0 && o.trim() === 'ok') {
            status('就绪');
            loadAll();
            logs();
            document.getElementById('refresh-log').onclick = logs;
            document.getElementById('clear-log').onclick = clearLogs;  //新增日志清理功能，绑定点击事件
        } else {
            status('桥接不可用', true);
        }
    });
});

function copyEx(idFrom, idTo) {
    var el = document.getElementById(idTo);
    if(el) el.value = document.getElementById(idFrom).textContent;
}
function saveSingle(id) { saveInput(id); }
function showPage(p, el) {
    document.querySelectorAll('.page').forEach(function(pp) { pp.style.display = 'none'; });
    document.getElementById('page-' + p).style.display = 'block';
    document.querySelectorAll('.nav-item').forEach(function(n) { n.classList.remove('active'); });
    el.classList.add('active');
}