import { request } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";

const email = process.env.NIVO_E2E_EMAIL ?? "oscar.vasquez@megaalimentos.com";
const password = process.env.NIVO_E2E_PASSWORD ?? "prueba10";
const seed = process.env.NIVO_E2E_SEED !== "false";

function run(...args: string[]) {
  execFileSync("npm", ["--prefix", "server", "run", ...args], { cwd: process.cwd(), stdio: "inherit" });
}

export default async function globalSetup() {
  if (seed) {
    run("create-admin", "--", email, password, "E2E Admin");
    run("seed:demo", "--", "--force");
  }
  const context = await request.newContext({ baseURL: "http://127.0.0.1:3000" });
  const response = await context.post("/api/auth/login", { data: { email, password } });
  if (!response.ok()) throw new Error(`E2E login failed (${response.status()}). Run migrations and create the admin user first.`);
  mkdirSync("test-results", { recursive: true });
  await context.storageState({ path: "test-results/e2e-auth.json" });
  await context.dispose();
}
