import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import type { Request } from 'express';
import { ProjectsService, type Project } from './projects.service';

export type RequestWithProject = Request & { project?: Project };

/** Autentikasi API publik: header `Authorization: Bearer <api_key>`. */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly projects: ProjectsService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<RequestWithProject>();
    const match = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization ?? '');
    if (!match) {
      throw new UnauthorizedException(
        'Sertakan header Authorization: Bearer <api_key>.',
      );
    }
    const project = await this.projects.findByApiKey(match[1]);
    if (!project)
      throw new UnauthorizedException(
        'API key tidak valid atau sudah dicabut.',
      );
    req.project = project;
    return true;
  }
}

/** Proyek pemilik API key pada request ini. */
export const CurrentProject = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => {
    const project = ctx.switchToHttp().getRequest<RequestWithProject>().project;
    if (!project) throw new UnauthorizedException();
    return project;
  },
);
