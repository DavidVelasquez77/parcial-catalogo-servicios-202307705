export type UserRole = 'ADMIN' | 'CONSULTA' | 'SOLICITANTE' | 'AGENTE' | 'APROBADOR';

export interface AuthenticatedUser {
  id: number;
  name: string;
  username: string;
  email: string | null;
  role: UserRole;
  roles: UserRole[];
  active: boolean;
  positionId: number;
  sectionId: number;
}
