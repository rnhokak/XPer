import { promises as fs } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const distDir = path.join(repoRoot, "apps", "cashflow-spa", "dist");
const publicDir = path.join(repoRoot, "public", "app", "cashflow");

const ensureDist = async () => {
  try {
    const stat = await fs.stat(distDir);
    if (!stat.isDirectory()) {
      throw new Error("dist is not a directory");
    }
  } catch (error) {
    throw new Error(`Missing cashflow SPA build at ${distDir}. Run cashflow:build first.`);
  }

  const indexPath = path.join(distDir, "index.html");
  try {
    await fs.access(indexPath);
  } catch {
    throw new Error(`Missing index.html at ${indexPath}.`);
  }
};

const copyDir = async () => {
  await fs.rm(publicDir, { recursive: true, force: true });
  await fs.mkdir(publicDir, { recursive: true });
  await fs.cp(distDir, publicDir, { recursive: true });
};

const run = async () => {
  await ensureDist();
  await copyDir();
  console.log(`Copied cashflow SPA to ${publicDir}`);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
