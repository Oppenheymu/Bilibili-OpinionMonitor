import "dotenv/config"

const 端口 = Number(process.env["端口"] ?? 5160)

console.log(`[舆论监控] 服务准备启动于端口 ${端口}`)
console.log("[舆论监控] 脚手架配置完成，等待后续模块接入")
