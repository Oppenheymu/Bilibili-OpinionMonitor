import { spawn, execSync } from "node:child_process";
import { createInterface } from "node:readline";

const isWindows = process.platform === "win32";

/* ── 启动前清理项目固定端口上的残留进程 ── */
// 服务端 5160、前端 vite 默认 5173，避免上次没退干净导致 EADDRINUSE
function 清理端口() {
  const PORTS = [5160, 5173];
  let 清理数 = 0;
  for (const port of PORTS) {
    let pids = [];
    try {
      const out = isWindows
        ? execSync(
            `powershell -NoProfile -Command "(Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue).OwningProcess | Sort-Object -Unique"`,
            { encoding: "utf8" },
          )
        : execSync(`lsof -ti tcp:${port}`, { encoding: "utf8" });
      pids = out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    } catch {
      // 端口未被占用
    }
    for (const pid of pids) {
      try {
        if (isWindows) execSync(`taskkill /PID ${pid} /F /T`, { stdio: "ignore" });
        else execSync(`kill -9 ${pid}`, { stdio: "ignore" });
        console.log(`[dev] 已释放端口 ${port} (PID ${pid})`);
        清理数++;
      } catch {
        // 忽略清理失败
      }
    }
  }
  if (清理数 === 0) console.log("[dev] 端口检查通过（5160/5173 均空闲）");
}

/* ── 服务进程配置 ── */
// 用运行本脚本的 bun 可执行文件路径，避免 Windows 下 spawn 不走 shell 导致 ENOENT
const bunBin = process.execPath;
const 服务列表 = [
  { 名: "服务端", 色: "\x1b[36m", 命令: bunBin, 参数: ["run", "dev"], cwd: "server" },
  { 名: "前端", 色: "\x1b[32m", 命令: bunBin, 参数: ["run", "dev"], cwd: "client" },
];

const 子进程列表 = [];
let 正在退出 = false;

/* 给子进程输出加 [服务端]/[前端] 前缀和颜色 */
function 挂载输出(子, { 名, 色 }) {
  for (const 流 of [子.stdout, 子.stderr]) {
    if (!流) continue;
    const rl = createInterface({ input: 流 });
    rl.on("line", (line) => {
      process.stdout.write(`${色}[${名}]\x1b[0m ${line}\n`);
    });
  }
}

function 启动服务(cfg) {
  const 子 = spawn(cfg.命令, cfg.参数, {
    cwd: cfg.cwd,
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
    // Unix 用进程组（process.kill(-pid)），Windows 靠 taskkill /T
    detached: !isWindows,
  });
  挂载输出(子, cfg);
  子.on("error", (e) => {
    process.stderr.write(`${cfg.色}[${cfg.名}]\x1b[0m 启动失败: ${e.message}\n`);
    退出全部(1);
  });
  子.on("exit", (code, signal) => {
    if (正在退出) return;
    process.stdout.write(`${cfg.色}[${cfg.名}]\x1b[0m 进程退出 (code=${code}, signal=${signal})\n`);
    退出全部(code ?? 1);
  });
  return 子;
}

/* 杀掉整个进程树：Windows 用 taskkill /T /F，Unix 用进程组信号 */
function 杀进程树(子) {
  if (!子?.pid) return;
  try {
    if (isWindows) {
      spawn("taskkill", ["/pid", String(子.pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      process.kill(-子.pid, "SIGTERM");
    }
  } catch {
    try {
      子.kill("SIGKILL");
    } catch {
      // 已退出
    }
  }
}

function 退出全部(码 = 0) {
  if (正在退出) return;
  正在退出 = true;
  console.log("[dev] Closing all child porocesses...");
  for (const s of 子进程列表) 杀进程树(s);
  // 给 taskkill 一点执行时间
  setTimeout(() => process.exit(码), 800);
}

/* ── 主流程 ── */
清理端口();
for (const cfg of 服务列表) 子进程列表.push(启动服务(cfg));

// Ctrl+C / 终止信号 → 杀掉整个进程树后退出
process.on("SIGINT", () => 退出全部());
process.on("SIGTERM", () => 退出全部());

console.log("[dev] 已启动 — 按 Ctrl+C 退出（会自动清理所有子进程）");
