import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@ghoomo/db';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
