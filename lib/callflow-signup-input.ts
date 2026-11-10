export function validateSignup(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("INVALID_SIGNUP");
  const body = value as Record<string, unknown>;
  const text = (key: string) => typeof body[key] === "string" ? body[key] as string : "";
  const name = text("name").trim();
  const workspaceName = text("workspaceName").trim();
  const email = text("email").trim().toLowerCase();
  const password = text("password");
  if (name.length < 2 || name.length > 160 || workspaceName.length < 2 || workspaceName.length > 160 ||
      email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      password.length < 8 || password.length > 128 || !password.trim()) throw new Error("INVALID_SIGNUP");
  return { name, workspaceName, email, password };
}
