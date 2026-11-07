import { Global, Module } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';
import { ProjectsService } from './projects.service';

@Global()
@Module({
  providers: [ProjectsService, ApiKeyGuard],
  exports: [ProjectsService, ApiKeyGuard],
})
export class ProjectsModule {}
