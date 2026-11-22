import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "user" | "admin";
      plan: "free" | "pro" | "team";
      status: "active" | "suspended" | "deleted";
    } & DefaultSession["user"];
  }

  interface User {
    role?: "user" | "admin";
    plan?: "free" | "pro" | "team";
    status?: "active" | "suspended" | "deleted";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "user" | "admin";
    plan?: "free" | "pro" | "team";
    status?: "active" | "suspended" | "deleted";
    userId?: string;
  }
}

export {};
