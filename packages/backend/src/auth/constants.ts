export const JWT_EXPIRY = "30d";

export const COOKIE_NAME = "dashboard_token";

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.COOKIE_SECURE === "true",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
};
