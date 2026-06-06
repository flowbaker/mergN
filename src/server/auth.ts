import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { MongoClient } from "mongodb";

const url = process.env.MONGO_URL ?? "mongodb://localhost:27017";
const dbName = process.env.MONGO_DB ?? "workflow";
const client = new MongoClient(url);
const db = client.db(dbName);

const socialProviders: Record<
  string,
  { clientId: string; clientSecret: string }
> = {};
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  socialProviders.google = {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  };
}
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  socialProviders.github = {
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
  };
}

const isProd = process.env.NODE_ENV === "production";

if (isProd && !process.env.BETTER_AUTH_SECRET)
  throw new Error("BETTER_AUTH_SECRET is required in production");
if (isProd && !process.env.APP_URL)
  throw new Error("APP_URL is required in production");

const trustedOrigins = [
  process.env.APP_URL,
  ...(isProd ? [] : ["http://localhost:5173", "http://localhost:8787"]),
].filter((v): v is string => Boolean(v));

export const auth = betterAuth({
  database: mongodbAdapter(db),
  baseURL: process.env.APP_URL,
  secret: process.env.BETTER_AUTH_SECRET ?? "dev-insecure-secret-change-me",
  trustedOrigins,
  emailAndPassword: { enabled: true },
  socialProviders,
  session: {
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
});

export type Auth = typeof auth;

export type SessionUser = {
  id: string;
  email: string;
  name: string;
};

export async function getSessionUser(
  headers: Headers,
): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers });
  if (!session?.user) return null;
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
  };
}
