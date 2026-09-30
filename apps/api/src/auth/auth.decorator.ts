import { SetMetadata } from '@nestjs/common';
import { UserRole } from './auth.types';

export const Roles = (...roles: UserRole[]) => SetMetadata('roles', roles);
