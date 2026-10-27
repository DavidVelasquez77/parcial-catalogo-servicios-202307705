import { Module } from '@nestjs/common';
import { CmdbController } from './cmdb.controller';
import { CmdbService } from './cmdb.service';

@Module({ controllers: [CmdbController], providers: [CmdbService], exports: [CmdbService] })
export class CmdbModule {}
