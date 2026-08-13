import { execSync, spawn } from "node:child_process";
import { createInterface } from "node:readline";

const isWindows = process.platform === "win32";

/* ── 启动前清理项目固定端口上的残留进程 ── */
// 服务端 5160、前端 vite 默认 5173，避免上次没退干净导致 EADDRINUSE

/** 换行切分正则（模块顶层，跨平台 \r\n / \n） */
const LINE_SPLIT_PATTERN = /\r?\n/;

function cleanPorts() {
    const ports = [5160, 5173];
    let cleanedCount = 0;
    for (const port of ports) {
        let pids = [];
        try {
            const out = isWindows
                ? execSync(
                      `powershell -NoProfile -Command "(Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue).OwningProcess | Sort-Object -Unique"`,
                      { encoding: "utf8" },
                  )
                : execSync(`lsof -ti tcp:${port}`, { encoding: "utf8" });
            pids = out
                .split(LINE_SPLIT_PATTERN)
                .map((s) => s.trim())
                .filter(Boolean);
        } catch {
            // 端口未被占用
        }
        for (const pid of pids) {
            try {
                if (isWindows) execSync(`taskkill /PID ${pid} /F /T`, { stdio: "ignore" });
                else execSync(`kill -9 ${pid}`, { stdio: "ignore" });
                console.log(`[dev] 已释放端口 ${port} (PID ${pid})`);
                cleanedCount++;
            } catch {
                // 忽略清理失败
            }
        }
    }
    if (cleanedCount === 0) console.log("[dev] 端口检查通过（5160/5173 均空闲）");
}

/* ── 服务进程配置 ── */
// 用运行本脚本的 bun 可执行文件路径，避免 Windows 下 spawn 不走 shell 导致 ENOENT
const bunBin = process.execPath;
const serviceList = [
    { name: "服务端", color: "\x1b[36m", command: bunBin, args: ["run", "dev"], cwd: "server" },
    { name: "前端", color: "\x1b[32m", command: bunBin, args: ["run", "dev"], cwd: "client" },
];

const childProcesses = [];
let exiting = false;

/* 给子进程输出加 [服务端]/[前端] 前缀和颜色 */
function attachOutput(child, { name, color }) {
    for (const stream of [child.stdout, child.stderr]) {
        if (!stream) continue;
        const rl = createInterface({ input: stream });
        rl.on("line", (line) => {
            process.stdout.write(`${color}[${name}]\x1b[0m ${line}\n`);
        });
    }
}

function startService(cfg) {
    const child = spawn(cfg.command, cfg.args, {
        cwd: cfg.cwd,
        stdio: ["ignore", "pipe", "pipe"],
        shell: false,
        // Unix 用进程组（process.kill(-pid)），Windows 靠 taskkill /T
        detached: !isWindows,
    });
    attachOutput(child, cfg);
    child.on("error", (e) => {
        process.stderr.write(`${cfg.color}[${cfg.name}]\x1b[0m 启动失败: ${e.message}\n`);
        exitAll(1);
    });
    child.on("exit", (code, signal) => {
        if (exiting) return;
        process.stdout.write(
            `${cfg.color}[${cfg.name}]\x1b[0m 进程退出 (code=${code}, signal=${signal})\n`,
        );
        // 前端（vite）偶发退出（如 HMR 依赖优化触发重启）时自动拉起，避免整个环境级联关闭
        if (cfg.name === "前端") {
            setTimeout(() => startService(cfg), 1000);
            return;
        }
        exitAll(code ?? 1);
    });
    return child;
}

/* 杀掉整个进程树：Windows 用 taskkill /T /F，Unix 用进程组信号 */
function killProcessTree(child) {
    if (!child?.pid) return;
    try {
        if (isWindows) {
            spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
        } else {
            process.kill(-child.pid, "SIGTERM");
        }
    } catch {
        try {
            child.kill("SIGKILL");
        } catch {
            // 已退出
        }
    }
}

function exitAll(code = 0) {
    if (exiting) return;
    exiting = true;
    console.log("[dev] Closing all child porocesses...");
    for (const child of childProcesses) killProcessTree(child);
    // 给 taskkill 一点执行时间
    setTimeout(() => process.exit(code), 800);
}

/* ── 主流程 ── */
cleanPorts();
for (const cfg of serviceList) childProcesses.push(startService(cfg));

// Ctrl+C / 终止信号 → 杀掉整个进程树后退出
process.on("SIGINT", () => exitAll());
process.on("SIGTERM", () => exitAll());

console.log("[dev] 已启动 — 按 Ctrl+C 退出（会自动清理所有子进程）");
