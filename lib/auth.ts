import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { prisma } from "@/lib/prisma"
import { nextCookies } from "better-auth/next-js"

export const auth = betterAuth({
  baseURL: {
    allowedHosts: ["*.ranqia.ai", "*.ranqia.com", "localhost:3000"],
    protocol: process.env.NODE_ENV === "development" ? "http" : "https",
  },
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      accessType: "offline",
      prompt: "select_account consent",
      scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    },
  },
  plugins: [nextCookies()],
})
