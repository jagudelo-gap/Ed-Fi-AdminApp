import 'reflect-metadata';

// The guard reads AUTH0_CONFIG_SECRET.MACHINE_AUDIENCE from the `config` package.
jest.mock('config', () => ({
  AUTH0_CONFIG_SECRET: { MACHINE_AUDIENCE: 'test-audience' },
}));

import { ExecutionContext, HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from '../auth.service';
import { AuthenticatedGuard } from './authenticated.guard';

type JwtPayload = Record<string, unknown>;

describe('AuthenticatedGuard (machine / Bearer path)', () => {
  const activeUser = { id: 1, isActive: true };

  const makeContext = (): ExecutionContext =>
    ({
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({
        getRequest: () => ({
          isAuthenticated: () => false,
          headers: { authorization: 'Bearer token' },
        }),
      }),
    } as unknown as ExecutionContext);

  const makeGuard = (payload: JwtPayload) => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) } as unknown as Reflector;
    const validateUser = jest.fn().mockResolvedValue(activeUser);
    const authService = {
      verifyBearerJwt: jest.fn().mockResolvedValue({ status: 'success', data: payload }),
      validateUser,
    } as unknown as AuthService;
    const guard = new AuthenticatedGuard(reflector, authService);
    return { guard, validateUser };
  };

  it('authorizes a Keycloak-shaped machine token and looks up by client_id (regression)', async () => {
    const { guard, validateUser } = makeGuard({
      client_id: 'keycloak-client',
      scope: 'login:app profile',
      aud: 'test-audience',
    });

    await expect(guard.canActivate(makeContext())).resolves.toBe(true);
    expect(validateUser).toHaveBeenCalledWith({ clientId: 'keycloak-client' });
  });

  it('authorizes an Entra-shaped machine token and looks up by azp', async () => {
    const { guard, validateUser } = makeGuard({
      azp: 'entra-app-guid',
      roles: ['login:app'],
      aud: 'test-audience',
    });

    await expect(guard.canActivate(makeContext())).resolves.toBe(true);
    expect(validateUser).toHaveBeenCalledWith({ clientId: 'entra-app-guid' });
  });

  it('authorizes an Entra v1.0 machine token and looks up by appid', async () => {
    const { guard, validateUser } = makeGuard({
      appid: 'entra-v1-app-id',
      roles: ['login:app'],
      aud: 'test-audience',
    });

    await expect(guard.canActivate(makeContext())).resolves.toBe(true);
    expect(validateUser).toHaveBeenCalledWith({ clientId: 'entra-v1-app-id' });
  });

  it('authorizes an Entra token whose aud is an array', async () => {
    const { guard, validateUser } = makeGuard({
      azp: 'entra-app-guid',
      roles: ['login:app'],
      aud: ['test-audience'],
    });

    await expect(guard.canActivate(makeContext())).resolves.toBe(true);
    expect(validateUser).toHaveBeenCalledWith({ clientId: 'entra-app-guid' });
  });

  it('rejects an Entra machine token missing the login:app role', async () => {
    const { guard, validateUser } = makeGuard({
      azp: 'entra-app-guid',
      roles: ['some.other.role'],
      aud: 'test-audience',
    });

    await expect(guard.canActivate(makeContext())).rejects.toBeInstanceOf(HttpException);
    expect(validateUser).not.toHaveBeenCalled();
  });
});
