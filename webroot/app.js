(function() {
    'use strict';

    var MOD = '/data/adb/modules/LittleYouran';
    var CFG = MOD + '/config/LittleYouran.txt';
    var LOG = MOD + '/log.txt';
    var SVC = MOD + '/service.sh';

    function exec(cmd) {
        return new Promise(function(resolve, reject) {
            var id = 'ly_' + Date.now();
            var timer = setTimeout(function() {
                delete window[id];
                reject(new Error('超时'));
            }, 5000);
            window[id] = function(e, o, er) {
                clearTimeout(timer);
                delete window[id];
                e === 0 ? resolve(o) : reject(new Error(er || '执行失败'));
            };
            try {
                ksu.exec(cmd, '{}', id);
            } catch(e) {
                clearTimeout(timer);
                delete window[id];
                reject(new Error(e.message));
            }
        });
    }

    function shellEscape(s) {
        return "'" + s.replace(/'/g, "'\\''") + "'";
    }

    function htmlEncode(s) {
        return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function appendLine(path, line) {
        return exec("printf '%s\\n' " + shellEscape(line) + " >> " + path);
    }

    function writeFile(path, content) {
        var tmp = '/data/local/tmp/.ly_' + Date.now();
        var lines = content.split('\n');
        if (lines.length === 0) return exec('true');
        var cmds = [];
        for (var i = 0; i < lines.length; i++) {
            var op = i === 0 ? '>' : '>>';
            var nl = i < lines.length - 1 ? '\\n' : '';
            cmds.push("printf '%s" + nl + "' " + shellEscape(lines[i]) + " " + op + " " + tmp);
        }
        cmds.push("mv -f " + tmp + " " + path);
        return exec(cmds.join(' && '));
    }

    function status(t, err) {
        var el = document.getElementById('status');
        if (el) { el.textContent = t; el.style.color = err ? '#fca5a5' : '#60a5fa'; }
    }

    window.toggleList = function(type) {
        var el = document.getElementById('expand-' + type);
        var btn = document.getElementById('btn-' + type);
        if (!el) return;
        var open = el.style.display === 'block';
        el.style.display = open ? 'none' : 'block';
        if (btn) btn.textContent = open ? '▼' : '▲';
    };

    function classify(l) {
        if (l.startsWith('mount=')) return 'mount';
        var afterPlus = l.substring(l.indexOf('+') + 1);
        var hasAnd = l.indexOf('&&') !== -1;
        if (afterPlus.indexOf('*') !== -1) {
            if (/\*\.\w+:/.test(afterPlus)) return 'routing';
            if (!hasAnd && /\*\.\w+,/.test(afterPlus)) return 'smartCategory';
        }
        var pc = (l.match(/\+/g) || []).length;
        if (pc >= 2) return hasAnd ? 'multiFilter' : 'filter';
        if (hasAnd) return 'multi';
        return 'simple';
    }

    function loadAll() {
        status('加载中...');
        exec('cat ' + shellEscape(CFG)).then(function(o) {
            var d = { mount:[], simple:[], multi:[], filter:[], multiFilter:[], smartCategory:[], routing:[] };
            o.split('\n').filter(function(l) { return l.trim() && l[0] !== '#'; }).forEach(function(l) {
                d[classify(l)].push(l);
            });
            ['mount','simple','multi','filter','multiFilter','smartCategory','routing'].forEach(function(t) {
                render(t, d[t]);
            });
            status('就绪');
        }).catch(function() { status('读取失败', true); });
    }

    function render(type, items) {
        var fixedEl = document.getElementById('fixed-' + type);
        var expandEl = document.getElementById('expand-' + type);
        var btn = document.getElementById('btn-' + type);
        if (!fixedEl || !expandEl) return;

        var fh = '', eh = '';
        items.forEach(function(r, i) {
            var h = '<div class="rule-item"><span>' + htmlEncode(r) + '</span><span class="del-btn" data-rule="' + htmlEncode(r) + '">✕</span></div>';
            if (i < 2) { fh += h; } else { eh += h; }
        });
        fixedEl.innerHTML = fh;
        expandEl.innerHTML = eh;

        if (items.length <= 2) {
            if (btn) btn.style.display = 'none';
            expandEl.style.display = 'none';
        } else {
            if (btn) btn.style.display = 'block';
        }
    }

    function saveInput(id) {
        var v = document.getElementById(id).value.trim();
        if (!v) return;
        status('检查中...');
        exec('cat ' + shellEscape(CFG)).then(function(o) {
            if (o.split('\n').some(function(l) { return l.trim() === v; })) {
                throw new Error('已存在');
            }
            status('写入中...');
            return appendLine(CFG, v);
        }).then(function() {
            status('重启中...');
            return exec('sh ' + shellEscape(SVC));
        }).then(function() {
            loadAll();
            status('就绪');
            document.getElementById(id).value = '';
        }).catch(function(e) {
            if (e.message !== '已存在') status('操作失败', true);
        });
    }

    window._del = function(r) {
        status('删除中...');
        exec('cat ' + shellEscape(CFG)).then(function(o) {
            var nc = o.split('\n').filter(function(l) { return l.trim() !== r; }).join('\n');
            return writeFile(CFG, nc);
        }).then(function() {
            return exec('sh ' + shellEscape(SVC));
        }).then(function() {
            loadAll();
            status('已删除');
        }).catch(function() { status('删除失败', true); });
    };

    window.copyEx = function(from, to) {
        var el = document.getElementById(to);
        if (el) el.value = document.getElementById(from).textContent;
    };

    window.saveSingle = function(id) { saveInput(id); };

    window.showPage = function(p, el) {
        document.querySelectorAll('.page').forEach(function(pp) { pp.style.display = 'none'; });
        document.getElementById('page-' + p).style.display = 'block';
        document.querySelectorAll('.nav-item').forEach(function(n) { n.classList.remove('active'); });
        el.classList.add('active');
        if (p === 'logs') refreshLogs();
    };

    function refreshLogs() {
        exec('tail -20 ' + shellEscape(LOG)).then(function(o) {
            document.getElementById('logBox').textContent = o || '暂无';
        }).catch(function() {
            document.getElementById('logBox').textContent = '读取失败';
        });
    }

    var RULE_TYPES = [
        { id: 'mount',        icon: '🔘', title: '镜像挂载',       example: 'mount=/sdcard/Download+/sdcard/Mirror' },
        { id: 'simple',       icon: '📦', title: '整体搬运',       example: '/sdcard/Download+/sdcard/a' },
        { id: 'multi',        icon: '📁', title: '多源合一',       example: '/sdcard/A&&/sdcard/B+/sdcard/c' },
        { id: 'filter',       icon: '🎯', title: '格式筛选',       example: '/sdcard/Download+*.zip+/sdcard/zip' },
        { id: 'multiFilter',  icon: '🚀', title: '多源+筛选',      example: '/sdcard/A&&/sdcard/B+*.mp4+/sdcard/Video' },
        { id: 'smartCategory',icon: '🧹', title: '多格式分类',     example: '/sdcard/Download+*.mp4,*.zip,*.jpg+/sdcard/MyMedia' },
        { id: 'routing',      icon: '🗺️', title: '精准分流路由',   example: '/sdcard/Download+*.mp4:/sdcard/1mp4,*.zip:/sdcard/1zzip+/sdcard/Others' }
    ];

    function buildCards() {
        var container = document.getElementById('page-config');
        var html = '';
        RULE_TYPES.forEach(function(rt, i) {
            html += '<div class="card">' +
                '<h2><span class="title-text">' + rt.icon + ' ' + rt.title + '</span>' +
                '<span class="toggle-btn" id="btn-' + rt.id + '" onclick="toggleList(\'' + rt.id + '\')">▼</span></h2>' +
                '<div class="example"><span id="ex' + (i + 1) + '">' + rt.example + '</span>' +
                '<button onclick="copyEx(\'ex' + (i + 1) + '\',\'in' + (i + 1) + '\')">复制</button></div>' +
                '<textarea id="in' + (i + 1) + '" class="input" rows="2" placeholder="输入规则..."></textarea>' +
                '<button class="btn" onclick="saveSingle(\'in' + (i + 1) + '\')">保存并重启</button>' +
                '<div class="rule-container"><div class="fixed-zone" id="fixed-' + rt.id + '"></div>' +
                '<div class="expand-zone" id="expand-' + rt.id + '"></div></div></div>';
        });
        container.innerHTML = html;
        if (!container._delegateAttached) {
            container.addEventListener('click', function(e) {
                var t = e.target;
                while (t && !t.classList.contains('del-btn')) { t = t.parentElement; }
                if (t && confirm('确认删除此规则？')) {
                    var rule = t.getAttribute('data-rule');
                    if (rule) window._del(rule);
                }
            });
            container._delegateAttached = true;
        }
    }

    document.addEventListener('DOMContentLoaded', function() {
        buildCards();
        status('检测桥接...');
        exec('echo ok').then(function(o) {
            if (o.trim() === 'ok') {
                status('就绪');
                loadAll();
                refreshLogs();
                document.getElementById('refresh-log').onclick = refreshLogs;
            } else {
                status('桥接不可用', true);
            }
        }).catch(function() { status('桥接不可用', true); });
    });
})();
