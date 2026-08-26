import { Module } from '@nestjs/common';
import { ArtifactModule } from './artifact/artifact.module';
import { CatalogModule } from './catalog/catalog.module';
import { CertificationController } from './certification.controller';
import { CertificationService } from './certification.service';

@Module({
  imports: [ArtifactModule, CatalogModule],
  controllers: [CertificationController],
  providers: [CertificationService],
})
export class CertificationModule {}
