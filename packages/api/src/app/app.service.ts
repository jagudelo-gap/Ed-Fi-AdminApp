import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

@Injectable()
export class AppService {
  constructor(
    @InjectEntityManager()
    private readonly entityManager: EntityManager
  ) {}

  onApplicationShutdown() {
    try {
      // this.entityManager.connection.isInitialized && this.entityManager.connection.destroy();
    } catch (_error) {
      // do nothing
    }
  }
}
