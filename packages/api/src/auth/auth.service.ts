import { ITeamCache, PrivilegeCode, upwardInheritancePrivileges } from '@edanalytics/models';
import {
  Edorg,
  EdOrgClosure,
  Ods,
  Ownership,
  EdfiTenant,
  User,
  UserTeamMembership,
  SbEnvironment,
} from '@edanalytics/models-server';
import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, IsNull, Not, Repository, TreeRepository } from 'typeorm';
import * as jose from 'jose';
import { type ProtectedHeaderParameters, type JWTPayload } from 'jose';
import { Issuer } from 'openid-client';
import { CacheService } from '../app/cache.module';
import {
  cacheAccordingToPrivileges,
  cacheEdorgPrivilegesDownward,
  cacheEdorgPrivilegesUpward,
  initializeOdsPrivilegeCache,
  initializeEdfiTenantPrivilegeCache,
  initializeSbEnvironmentPrivilegeCache,
} from './authorization/helpers';
import config from 'config';

@Injectable()
export class AuthService {
  edorgsTreeRepository: TreeRepository<Edorg>;
  constructor(
    @InjectRepository(Ods)
    private odssRepository: Repository<Ods>,
    @InjectRepository(EdfiTenant)
    private edfiTenantsRepository: Repository<EdfiTenant>,
    @InjectRepository(Edorg)
    private edorgsRepository: Repository<Edorg>,
    @InjectRepository(EdOrgClosure)
    private edorgClosureRepository: Repository<EdOrgClosure>,
    @InjectRepository(Ownership)
    private ownershipsRepository: Repository<Ownership>,
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    @InjectRepository(UserTeamMembership)
    private utmRepo: Repository<UserTeamMembership>,
    @InjectEntityManager()
    private entityManager: EntityManager,
    @Inject(CacheService) private cacheManager: CacheService
  ) {
    this.edorgsTreeRepository = this.entityManager.getTreeRepository(Edorg);
  }

  /** Get union of user's global role privileges and team role privileges.
   *
   * _Note that a global role may contain team-type privileges which apply
   * to any team context the user chooses to assume, as if they were assigned
   * a role within that team that granted those privileges locally._
   */
  async getUserPrivileges(
    userId: number,
    /** Optionally look up a team membership, if one exists, whose privileges will be added to the Set */
    teamId?: number
  ) {
    const privileges = new Set<PrivilegeCode>();

    if (teamId !== undefined) {
      // We don't want to error out if there's no membership, because a user can still be granted team-level privileges globally.
      const membership = await this.utmRepo.findOne({
        where: {
          userId,
          teamId,
        },
        relations: ['role'],
      });

      membership?.role?.privilegeIds?.forEach((code) => {
        // team roles *shouldn't* have any non-team privileges, but just in case, we don't want to add any global privileges based on a team role.
        if (code.startsWith('team.')) {
          privileges.add(code);
        }
      });
    }
    const user = await this.usersRepo.findOneOrFail({
      where: {
        id: userId,
        isActive: true,
      },
      relations: ['role'],
    });

    user.role?.privilegeIds?.forEach((code) => {
      privileges.add(code);
    });
    return privileges;
  }

  private async getUser({ username, clientId }: { username?: string; clientId?: string }) {
    if (!clientId && !username) return null;

    try {
      const where = username ? { username } : { clientId, userType: 'machine' as const };
      const user = await this.usersRepo.findOne({
        where,
        relations: ['role'],
      });
      if (user === null) return null;

      const teamMemberships = await this.utmRepo.find({
        where: {
          userId: user.id,
          roleId: Not(IsNull()),
        },
        relations: ['role', 'team'],
      });

      if (teamMemberships.length) {
        user.userTeamMemberships = teamMemberships;
      }

      return user;
    } catch (error) {
      Logger.error(`Database error during user lookup for ${username || clientId}:`, error);
      // Throw the error to be caught by validateUser which will handle it gracefully
      throw error;
    }
  }

  async validateUser({ username, clientId }: { username?: string; clientId?: string }) {
    if (!clientId && !username) return null;

    try {
      const user = await this.getUser({ username, clientId });
      if (user === null || !user.isActive) {
        return null;
      } else {
        return user;
      }
    } catch (error) {
      Logger.error(`Database error during user validation for ${username || clientId}:`, error);
      // During database failures, we cannot authenticate users safely
      // Return null to trigger authentication failure gracefully
      return null;
    }
  }

  async findActiveUserById(userId: number): Promise<User | null> {
    return await this.usersRepo.findOne({
      where: { id: userId, isActive: true },
      relations: ['role'],
    });
  }

  async constructTeamOwnerships(teamId: number) {
    const start = new Date();
    if (typeof teamId !== 'number') throw new UnauthorizedException();
    const ownerships = await this.ownershipsRepository.find({
      where: {
        teamId,
      },
      relations: [
        'sbEnvironment',
        'sbEnvironment.edfiTenants',
        'edfiTenant',
        'edfiTenant.sbEnvironment',
        'ods',
        'edorg',
        'role',
        'integrationProvider',
      ],
    });

    /**
     * Map of all Edorgs needed during execution.
     * Just a data bucket used for dynamic programming; carries no access control meaning itself.
     */
    const allEdorgs = new Map<number, Edorg>();
    /**
     * Map of all Odss needed during execution.
     * Just a data bucket used for dynamic programming; carries no access control meaning itself.
     */
    const allOdss = new Map<number, Ods>();
    /**
     * Map of all EdfiTenants needed during execution.
     * Just a data bucket used for dynamic programming; carries no access control meaning itself.
     */
    const allEdfiTenants = new Map<number, EdfiTenant>();
    /**
     * Map of all SbEnvironments needed during execution.
     * Just a data bucket used for dynamic programming; carries no access control meaning itself.
     */
    const allSbEnvironments = new Map<number, SbEnvironment>();

    const ownedOdss: Ownership[] = [];
    const ownedEdorgs: Ownership[] = [];

    /**
     * Repository of the privileges this team has on each relevant SbEnvironment
     *
     * These variables are used dynamically. As the authorization builder
     * works its way up and down the resource hierarchy, it adds new items
     * or new privileges to existing items as prescribed by the app's
     * inheritance rules.
     */
    const sbEnvironmentPrivileges = new Map<number, Set<PrivilegeCode>>();
    /**
     * Repository of the privileges this team has on each relevant EdfiTenant
     *
     * These variables are used dynamically. As the authorization builder
     * works its way up and down the resource hierarchy, it adds new items
     * or new privileges to existing items as prescribed by the app's
     * inheritance rules.
     */
    const edfiTenantPrivileges = new Map<number, Set<PrivilegeCode>>();
    /**
     * Repository of the privileges this team has on each relevant ODS
     *
     * These variables are used dynamically. As the authorization builder
     * works its way up and down the resource hierarchy, it adds new items
     * or new privileges to existing items as prescribed by the app's
     * inheritance rules.
     */
    const odsPrivileges = new Map<number, Set<PrivilegeCode>>();
    /**
     * Repository of the privileges this team has on each relevant Ed-Org
     *
     * These variables are used dynamically. As the authorization builder
     * works its way up and down the resource hierarchy, it adds new items
     * or new privileges to existing items as prescribed by the app's
     * inheritance rules.
     */
    const edorgPrivileges = new Map<number, Set<PrivilegeCode>>();
    /**
     * Repository of the privileges this team has on each relevant IntegrationProvider
     *
     * These variables are used dynamically. As the authorization builder
     * works its way up and down the resource hierarchy, it adds new items
     * or new privileges to existing items as prescribed by the app's
     * inheritance rules.
     */
    const integrationProviderPrivileges = new Map<number, Set<PrivilegeCode>>();

    ownerships
      .filter((o) => o.role?.privilegeIds.length)
      .forEach((o) => {
        if (o.sbEnvironment) {
          sbEnvironmentPrivileges.set(o.sbEnvironment.id, new Set(o.role.privilegeIds ?? []));
          allSbEnvironments.set(o.sbEnvironment.id, o.sbEnvironment);
          o.sbEnvironment.edfiTenants.forEach((edfiTenant) => {
            /*
            the way SbEnvironment ownerships get applied to EdfiTenant privileges
            is by just adding to the list of owned EdfiTenants, rather than by
            having their own redundant auth derivation and caching logic. The only
            privileges they cache directly are the
            `team.sb-environment.edfi-tenant:<action>` ones (read and refresh-resources).
            */
            edfiTenantPrivileges.set(edfiTenant.id, new Set(o.role.privilegeIds ?? []));
            allEdfiTenants.set(edfiTenant.id, edfiTenant);
          });
        } else if (o.edfiTenant) {
          if (!edfiTenantPrivileges.has(o.edfiTenant.id)) {
            edfiTenantPrivileges.set(o.edfiTenant.id, new Set());
          }
          edfiTenantPrivileges.set(
            o.edfiTenant.id,
            new Set([...edfiTenantPrivileges.get(o.edfiTenant.id), ...o.role.privilegeIds])
          );
          allEdfiTenants.set(o.edfiTenant.id, o.edfiTenant);
        } else if (o.ods) {
          odsPrivileges.set(o.ods.id, new Set(o.role?.privilegeIds ?? []));
          ownedOdss.push(o);
          allOdss.set(o.ods.id, o.ods);
        } else if (o.edorg) {
          edorgPrivileges.set(o.edorg.id, new Set(o.role?.privilegeIds ?? []));
          ownedEdorgs.push(o);
          allEdorgs.set(o.edorg.id, o.edorg);
        } else if (o.integrationProvider) {
          integrationProviderPrivileges.set(
            o.integrationProvider.id,
            new Set(o.role?.privilegeIds ?? [])
          );
        }
      });

    const cache: ITeamCache = {
      'team.ownership:read': true,
      'team.role:read': true,
      'team.role:create': true,
      'team.role:update': true,
      'team.role:delete': true,
      'team.user:read': true,
      'team.user-team-membership:read': true,
      'team.user-team-membership:update': true,
      'team.user-team-membership:delete': true,
      'team.user-team-membership:create': true,

      // See various notes about "empty privileges"
      'team.sb-environment:read': new Set(),
      'team.integration-provider.application:read': new Set(),
    };

    /*

    First trace the resource tree _downward_ from the owned resources,
    accumulating more privileges as we go and applying them to the
    resources we encounter.

    */
    const allEdfiTenantIds = [...allEdfiTenants.keys()];

    const dbSpecificEdOrgQuery = {
      mssql: () => {
        return this.edorgsRepository
          .createQueryBuilder('edorg')
          .leftJoin(
            'edorg_closure',
            'descendants',
            'descendants.id_ancestor IN (:edorgs) AND descendants.id_descendant = edorg.id',
            {
              edorgs: [...edorgPrivileges.keys()].join(','),
            }
          )
          .leftJoin(
            'edorg_closure',
            'ancestors',
            'ancestors.id_descendant IN (:edorgs) AND ancestors.id_ancestor = edorg.id',
            {
              edorgs: [...edorgPrivileges.keys()].join(','),
            }
          )
          .where(
            `descendants.id_ancestor IS NOT NULL OR
              ancestors.id_descendant IS NOT NULL OR
              edorg.odsId IN (:odss)`,
            {
              odss: ownedOdss.map((o) => o.ods.id).join(','),
            }
          )
          .getMany();
      },
      pgsql: () => {
        return this.edorgsRepository
          .createQueryBuilder('edorg')
          .leftJoin(
            'edorg_closure',
            'descendants',
            'descendants.id_ancestor = ANY (:edorgs) AND descendants.id_descendant = edorg.id',
            {
              edorgs: [...edorgPrivileges.keys()],
            }
          )
          .leftJoin(
            'edorg_closure',
            'ancestors',
            'ancestors.id_descendant = ANY (:edorgs) AND ancestors.id_ancestor = edorg.id',
            {
              edorgs: [...edorgPrivileges.keys()],
            }
          )
          .where(
            `descendants.id_ancestor IS NOT NULL OR
           ancestors.id_descendant IS NOT NULL OR
           --edorg.edfiTenantId = ANY (:edfiTenants) OR
           edorg.odsId = ANY (:odss)`,
            {
              odss: ownedOdss.map((o) => o.ods.id),
            }
          )
          .getMany();
      },
    };

    const [allEdorgsRaw, allOdssRaw, allEdfiTenantsRaw] = await Promise.all([
      dbSpecificEdOrgQuery[config.DB_ENGINE](),
      this.odssRepository.findBy([
        {
          id: In(ownedEdorgs.map((o) => o.edorg.odsId)),
        },
      ]),
      this.edfiTenantsRepository.findBy([
        {
          id: In([
            ...ownedEdorgs.map((o) => o.edorg.edfiTenantId),
            ...ownedOdss.map((o) => o.ods.edfiTenantId),
          ]),
        },
      ]),
    ]);

    const rootEdorgsPerOds: Record<number, Edorg[]> = {};
    allEdorgsRaw.forEach((edorg) => {
      if (typeof edorg.parentId !== 'number') {
        if (!(edorg.odsId in rootEdorgsPerOds)) {
          rootEdorgsPerOds[edorg.odsId] = [];
        }
        rootEdorgsPerOds[edorg.odsId].push(edorg);
      }
      allEdorgs.set(edorg.id, edorg);
    });

    const odssPerEdfiTenant = Object.fromEntries(
      allEdfiTenantIds.map((edfiTenantId) => [edfiTenantId, [] as Ods[]])
    );
    allOdssRaw.forEach((ods) => {
      if (!(ods.edfiTenantId in odssPerEdfiTenant)) {
        odssPerEdfiTenant[ods.edfiTenantId] = [];
      }
      odssPerEdfiTenant[ods.edfiTenantId].push(ods);
      allOdss.set(ods.id, ods);
    });

    allEdfiTenantsRaw.forEach((edfiTenant) => {
      allEdfiTenants.set(edfiTenant.id, edfiTenant);
    });

    const sbEnvironmentPrivilegesEntries = [...sbEnvironmentPrivileges.entries()];
    sbEnvironmentPrivilegesEntries.forEach(([sbEnvironmentId, myPrivileges]) => {
      const sbEnvironment = allSbEnvironments.get(sbEnvironmentId);
      cacheAccordingToPrivileges({
        cache,
        privileges: myPrivileges,
        resource: 'team.sb-environment',
        id: sbEnvironmentId,
      });
      initializeSbEnvironmentPrivilegeCache(cache, myPrivileges, sbEnvironment);
    });

    const integrationProviderPrivilegesEntries = [...integrationProviderPrivileges.entries()];
    integrationProviderPrivilegesEntries.forEach(([integrationProviderId, myPrivileges]) => {
      cacheAccordingToPrivileges({
        cache,
        privileges: myPrivileges,
        resource: 'team.integration-provider.application',
        id: integrationProviderId,
      });
    });

    const edfiTenantPrivilegesEntries = [...edfiTenantPrivileges.entries()];
    edfiTenantPrivilegesEntries.forEach(([edfiTenantId, myPrivileges]) => {
      cacheAccordingToPrivileges({
        cache,
        privileges: myPrivileges,
        resource: 'team.sb-environment.edfi-tenant',
        id: edfiTenantId,
        sbEnvironmentId: allEdfiTenants.get(edfiTenantId).sbEnvironmentId,
      });
      initializeEdfiTenantPrivilegeCache(cache, myPrivileges, edfiTenantId);

      const upwardPrivileges = new Set(
        [...myPrivileges].filter((p) => upwardInheritancePrivileges.has(p))
      );
      cacheAccordingToPrivileges({
        cache,
        privileges: upwardPrivileges,
        resource: 'team.sb-environment',
        id: allEdfiTenants.get(edfiTenantId).sbEnvironmentId,
      });
    });

    const odsPrivilegesEntries = [...odsPrivileges.entries()];
    odsPrivilegesEntries.forEach(([odsId, myPrivileges]) => {
      const ods = allOdss.get(odsId);

      cacheAccordingToPrivileges({
        cache,
        privileges: myPrivileges,
        resource: 'team.sb-environment.edfi-tenant.ods',
        id: ods.id,
        edfiTenantId: ods.edfiTenantId,
      });
      initializeOdsPrivilegeCache(cache, myPrivileges, ods.edfiTenantId);

      /*
        Apply downward-inheriting privileges to root Ed-Orgs within this ODS. EdfiTenant-level privileges
        don't need to be applied downward like these ODS ones because they're already reflected in
        the blanket `true` privilege cache. But ODS-level ones must be applied downward so they can
        be reflected in individual Ed-org or ODS IDs showing up in the cache.
      */
      rootEdorgsPerOds[odsId]?.forEach((edorg) => {
        if (!edorgPrivileges.has(edorg.id)) {
          edorgPrivileges.set(edorg.id, new Set());
        }
        myPrivileges.forEach((p) => edorgPrivileges.get(edorg.id).add(p));
      });
    });

    const edorgPrivilegesEntries = [...edorgPrivileges.entries()];

    const edorgIds = new Set(edorgPrivilegesEntries.map(([edorgId]) => edorgId));

    const dbSpecificEdOrgClosureQuery = {
      mssql: () => {
        const edOrgIdList = [[...edorgIds.values()]].join(',');
        return this.edorgClosureRepository
          .createQueryBuilder('edorg_closure')
          .where('"id_ancestor" <> "id_descendant"')
          .andWhere('("id_ancestor" IN (:ancestors) OR "id_descendant" IN (:descendants))', {
            ancestors: edOrgIdList,
            descendants: edOrgIdList,
          })
          .getMany();
      },
      pgsql: () => {
        return this.entityManager.query(
          'SELECT "id_ancestor", "id_descendant" from "edorg_closure" WHERE "id_ancestor" <> "id_descendant" and ("id_ancestor" = ANY ($1) OR "id_descendant" = ANY ($1))',
          [[...edorgIds.values()]]
        );
      },
    };

    const edorgClosureRaw = await dbSpecificEdOrgClosureQuery[config.DB_ENGINE]();

    const parentEdorgIds = new Set<number>();
    const ancestorMap = new Map<number, Set<Edorg>>();
    edorgClosureRaw.forEach((row) => {
      parentEdorgIds.add(row.id_ancestor);
      if (!ancestorMap.has(row.id_descendant)) {
        ancestorMap.set(row.id_descendant, new Set());
      }
      ancestorMap.get(row.id_descendant).add(allEdorgs.get(row.id_ancestor));
    });

    const descendantMap = new Map<number, Edorg[]>();
    [...allEdorgs.values()].forEach((edorg) => {
      if (typeof edorg.parentId === 'number') {
        if (!descendantMap.has(edorg.parentId)) {
          descendantMap.set(edorg.parentId, [edorg]);
        } else {
          descendantMap.set(edorg.parentId, [...descendantMap.get(edorg.parentId), edorg]);
        }
      }
    });

    edorgPrivilegesEntries.forEach((entry) => {
      const [edorgId, myPrivileges] = entry;
      const edorg = allEdorgs.get(edorgId);

      let tree: Edorg;
      if (parentEdorgIds.has(edorgId)) {
        const buildDescendants = (edorg: Edorg) => {
          const descendants = descendantMap.get(edorg.id);
          edorg.children = descendants;
          if (descendants) {
            edorg.children.forEach((child) => buildDescendants(child));
          }
        };
        tree = edorg;
        buildDescendants(tree);
      } else {
        tree = edorg;
      }
      cacheEdorgPrivilegesDownward(cache, myPrivileges, tree, edorgPrivileges);
    });

    /*

    Then trace the tree _upward_ from the owned resources, applying
    only the upwardly-inheritable privileges.

    */
    for (const edorgId in ownedEdorgs) {
      const ownership = ownedEdorgs[edorgId];
      const edorg = ownership.edorg!;
      const edfiTenant = allEdfiTenants.get(edorg.edfiTenantId);
      const ancestors = [...(ancestorMap.get(edorg.id) ?? [])];

      const ownedPrivileges = new Set(ownership.role.privileges.map((p) => p?.code) ?? []);

      cacheEdorgPrivilegesUpward({ cache, edorg, edfiTenant, ownedPrivileges, ancestors });
    }

    for (const odsId in ownedOdss) {
      const ownership = ownedOdss[odsId];
      const ods = ownership.ods!;

      const ownedPrivileges = new Set(ownership.role?.privileges.map((p) => p?.code) ?? []);
      const appliedPrivileges = new Set(
        [...ownedPrivileges].filter((p) => upwardInheritancePrivileges.has(p))
      );

      cacheAccordingToPrivileges({
        cache,
        privileges: appliedPrivileges,
        resource: 'team.sb-environment',
        id: allEdfiTenants.get(ods.edfiTenantId).sbEnvironmentId,
      });
      cacheAccordingToPrivileges({
        cache,
        privileges: appliedPrivileges,
        resource: 'team.sb-environment.edfi-tenant',
        sbEnvironmentId: ods.sbEnvironmentId,
        id: ods.edfiTenantId,
      });
      cacheAccordingToPrivileges({
        cache,
        privileges: appliedPrivileges,
        resource: 'team.sb-environment.edfi-tenant.claimset',
        id: true,
        edfiTenantId: ods.edfiTenantId,
      });
      cacheAccordingToPrivileges({
        cache,
        privileges: appliedPrivileges,
        resource: 'team.sb-environment.edfi-tenant.vendor',
        id: true,
        edfiTenantId: ods.edfiTenantId,
      });
      cacheAccordingToPrivileges({
        cache,
        privileges: appliedPrivileges,
        resource: 'team.sb-environment.edfi-tenant.profile',
        id: true,
        edfiTenantId: ods.edfiTenantId,
      });
    }

    const end = new Date();
    Logger.verbose(
      `Team ${teamId} ownership object cached in ${(
        Number(end) - Number(start)
      ).toLocaleString()}ms`
    );
    return cache;
  }

  clearTeamOwnershipCache(teamId: number) {
    this.cacheManager.del(String(teamId));
  }

  async reloadTeamOwnershipCache(
    teamId: number,
    /** Load the cache even if it's currently expired, meaning it hasn't been used in 1hr */
    evenIfInactive = true
  ) {
    const existingValue: ITeamCache | undefined = this.cacheManager.get(String(teamId));

    if (existingValue || evenIfInactive) {
      this.clearTeamOwnershipCache(teamId);
      const newCache = this.constructTeamOwnerships(teamId);
      this.cacheManager.set(String(teamId), newCache, 30 /* seconds */);
      return await newCache;
    } else {
      return null;
    }
  }

  async getTeamOwnershipCache(teamId: number) {
    const cachedValue = this.cacheManager.get(String(teamId));
    if (cachedValue !== undefined) {
      return await cachedValue;
    } else {
      try {
        const newCache = this.constructTeamOwnerships(teamId);
        this.cacheManager.set(String(teamId), newCache, 30 /* seconds */);
        return await newCache;
      } catch (error) {
        Logger.error(
          `Database error during team ownership cache construction for team ${teamId}:`,
          error
        );
        // Return null during database failures to indicate the operation failed
        // This will cause authentication to fail gracefully
        return null;
      }
    }
  }

  async verifyBearerJwt(
    token: string | undefined
  ): Promise<{ status: 'success' | 'failure'; data?: JWTPayload; message?: string }> {
    if (token === undefined || token === '') {
      return {
        status: 'failure' as const,
        message: 'Bearer token not found in authorization header',
      };
    }

    let header: ProtectedHeaderParameters;
    try {
      header = jose.decodeProtectedHeader(token);
    } catch (_decodeError) {
      return {
        status: 'failure' as const,
        message: 'Invalid token', // decode error
      };
    }

    const jwkResult = await this.getJsonWebKey(header?.kid);
    if (jwkResult.status !== 'success') {
      return {
        status: 'failure' as const,
        message: 'Invalid token', // kid not found in issuer's jwks
      };
    }

    try {
      const AUTH0_CONFIG_SECRET = await config.AUTH0_CONFIG_SECRET;
      const verifyResult = await jose.jwtVerify(token, jwkResult.jwk, {
        // Core security validations
        issuer: AUTH0_CONFIG_SECRET.ISSUER,
        audience: AUTH0_CONFIG_SECRET.MACHINE_AUDIENCE,
        // Validate required claims exist
        requiredClaims: ['iss', 'aud', 'exp', 'iat', 'sub'],
      });

      return {
        status: 'success' as const,
        data: verifyResult.payload,
      };
    } catch (verifyError) {
      // Provide specific error messages
      let errorMessage: string;

      if (verifyError.code === 'ERR_JWT_EXPIRED') {
        errorMessage = 'Token has expired. Please obtain a new access token.';
      } else if (verifyError.code === 'ERR_JWT_CLAIM_VALIDATION_FAILED') {
        // This handles all claim validation failures (audience, issuer, subject, etc.)
        errorMessage =
          'Token claim validation failed. Please check token audience and issuer configuration.';
      } else if (verifyError.code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED') {
        errorMessage =
          'Token signature verification failed. Please check token source and signing configuration.';
      } else {
        Logger.warn('Unknown verification error:', verifyError.code, verifyError.message);
        errorMessage = `Token verification failed: ${
          verifyError.code || 'UNKNOWN_ERROR'
        }. Please check token format and configuration.`;
      }
      return {
        status: 'failure' as const,
        message: errorMessage,
      };
    }
  }

  private _jwks: Promise<Record<string, CryptoKey | Uint8Array>> | undefined;
  private async getJsonWebKey(kid: string) {
    const jwk = (await this._jwks)?.[kid];
    if (jwk === undefined) {
      const AUTH0_CONFIG_SECRET = await config.AUTH0_CONFIG_SECRET;
      if (!AUTH0_CONFIG_SECRET.ISSUER) {
        return {
          status: 'failure' as const,
          message: 'AUTH0_CONFIG_SECRET.ISSUER is not defined',
        };
      }

      this._jwks = new Promise((resolve) => {
        Issuer.discover(AUTH0_CONFIG_SECRET.ISSUER)
          .then((issuer) =>
            fetch(issuer.metadata.jwks_uri).then((response) =>
              response.json().then(async (jwks) => {
                const out: Record<string, CryptoKey | Uint8Array> = {};
                for (let i = 0; i < jwks.keys.length; i++) {
                  const jwk = jwks.keys[i];
                  out[jwk.kid as string] = await jose.importJWK(jwk);
                }
                resolve(out);
              })
            )
          )
          .catch((error) => {
            Logger.error(
              `Error fetching JWKS from ${AUTH0_CONFIG_SECRET.ISSUER}. Check the ISSUER configuration.`,
              error
            );
            resolve({});
          });
      });
      const jwk = (await this._jwks)?.[kid];

      if (jwk === undefined) {
        return {
          status: 'failure' as const,
          message: 'key id (kid) not found in jwks',
        };
      } else {
        return {
          status: 'success' as const,
          jwk,
        };
      }
    } else {
      return {
        status: 'success' as const,
        jwk,
      };
    }
  }
}
