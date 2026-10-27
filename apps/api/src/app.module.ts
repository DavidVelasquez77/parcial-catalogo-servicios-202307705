import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { OrganizationModule } from './organization/organization.module';
import { UsersModule } from './users/users.module';
import { CatalogModule } from './catalog/catalog.module';
import { ServicesModule } from './services/services.module';
import { ImportModule } from './imports/import.module';
import { CmdbModule } from './cmdb/cmdb.module';

@Module({ imports: [DatabaseModule, AuthModule, OrganizationModule, UsersModule, CatalogModule, ServicesModule, ImportModule, CmdbModule] })
export class AppModule {}
