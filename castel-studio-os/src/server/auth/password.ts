import bcrypt from "bcryptjs";

const COST = 12;

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, COST);
}

export async function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

/** Minimum policy: 10+ chars with letters and digits. */
export function passwordPolicyError(pw: string): string | null {
  if (pw.length < 10) return "password.tooShort";
  if (!/[A-Za-z֐-׿]/.test(pw) || !/\d/.test(pw)) return "password.weak";
  return null;
}
