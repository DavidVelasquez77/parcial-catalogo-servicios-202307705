export type UserRole = 'ADMIN' | 'CONSULTA';

export interface AuthenticatedUser {
  id: number;
  name: string;
  username: string;
  email: string | null;
  role: UserRole;
  active: boolean;
  positionId: number;
  sectionId: number;
}
