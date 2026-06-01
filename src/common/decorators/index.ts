import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';

// Extracts the authenticated user from request
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);

// Extracts workspace ID from request header or param
export const WorkspaceId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return (
      request.headers['x-workspace-id'] ||
      request.params?.workspaceId ||
      request.body?.workspaceId
    );
  },
);

// Marks a route as public (skips JWT guard)
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

// Sets required roles for RBAC
export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

// Marks route as workspace-scoped (requires x-workspace-id header)
export const WORKSPACE_SCOPED_KEY = 'workspaceScoped';
export const WorkspaceScoped = () => SetMetadata(WORKSPACE_SCOPED_KEY, true);
