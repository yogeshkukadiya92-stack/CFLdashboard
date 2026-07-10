import { spawn } from "node:child_process";

const args = process.argv.slice(2).flatMap((arg) => (arg === "--host" ? "--hostname" : arg));
const child = spawn("next", ["start", ...args], {
  env: process.env,
  stdio: "inherit",
  shell: process.platform === "win32"
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
