import { execSync } from "node:child_process";

// 本项目占用的固定/默认端口：服务端 5160、前端 vite 默认 5173
// 在 dev 启动前清理这些端口上残留的孤儿进程，避免 EADDRINUSE
const PORTS = [5160, 5173];
const isWindows = process.platform === "win32";

for (const port of PORTS) {
  let pids = [];
  try {
    if (isWindows) {
      const out = execSync(
        `powershell -NoProfile -Command "(Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue).OwningProcess | Sort-Object -Unique"`,
        { encoding: "utf8" },
      );
      pids = out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    } else {
      const out = execSync(`lsof -ti tcp:${port}`, { encoding: "utf8" });
      pids = out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    }
  } catch {
    // 端口未被占用
  }
  for (const pid of pids) {
    try {
      if (isWindows) execSync(`taskkill /PID ${pid} /F /T`, { stdio: "ignore" });
      else execSync(`kill -9 ${pid}`, { stdio: "ignore" });
      console.log(`[clean-ports] 已释放端口 ${port} (PID ${pid})`);
    } catch {
      // 忽略清理失败（进程已退出或无权限）
    }
  }
}
console.log("[clean-ports] 完成");
