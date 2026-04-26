import { spawn } from "node:child_process";

const checks = [
  ["node", ["--check", "public/extension/content-script.js"]],
  ["node", ["--check", "public/extension/background.js"]],
  ["npm", ["run", "build"]],
  ["npm", ["run", "test:extension"]],
  ["npm", ["run", "test:extension:background"]],
  ["npm", ["run", "test:extension:files"]],
  ["npm", ["run", "test:extension:sidepanel"]],
  ["npm", ["run", "test:demo"]],
];

for (const [command, args] of checks) {
  await run(command, args);
}

console.log("extension and demo verification loop passed");

function run(command, args) {
  return new Promise((resolve, reject) => {
    const label = [command, ...args].join(" ");
    console.log(`\n> ${label}`);
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${label} exited with ${code}`));
    });
  });
}
