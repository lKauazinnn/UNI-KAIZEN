export type UserRole = 'admin' | 'professor' | 'aluno';

export const ROLE_DISPLAY: Record<UserRole, string> = {
  admin: 'Administrador',
  professor: 'Professor',
  aluno: 'Aluno',
};

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const isOwnerEmail = (email?: string | null): boolean => {
  if (!email || !process.env.OWNER_EMAIL) return false;
  return normalizeEmail(email) === normalizeEmail(process.env.OWNER_EMAIL);
};

export const resolveSystemRole = (user: { email?: string | null; role?: string | null }): UserRole => {
  if (isOwnerEmail(user.email)) return 'admin';
  if (user.role === 'admin' || user.role === 'professor' || user.role === 'aluno') return user.role as UserRole;
  return 'aluno';
};

export const canManageOrganization = (role: UserRole): boolean =>
  role === 'admin' || role === 'professor';