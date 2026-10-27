import { Module } from '@nestjs/common';
import { DeskController } from './desk.controller';
import { DeskService } from './desk.service';

@Module({ controllers: [DeskController], providers: [DeskService] })
export class DeskModule {}
