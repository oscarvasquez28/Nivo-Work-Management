import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default("127.0.0.1"),
});

const parsed = envSchema.safeParse({
  DATABASE_URL: process.env.DATABASE_URL ?? "postgres://nivo:nivo@127.0.0.1:5432/nivo",
  PORT: process.env.PORT,
  HOST: process.env.HOST,
});

if (!parsed.success) {
  console.error("Invalid server environment:", parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "));
  process.exit(1);
}

export const env = parsed.data;
