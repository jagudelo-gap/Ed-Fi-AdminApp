import { SbV1MetaEdorg } from '@edanalytics/models';
import { EdfiTenant, Edorg, Ods } from '@edanalytics/models-server';
import { Logger } from '@nestjs/common';
import _ from 'lodash';
import { DeepPartial, EntityManager } from 'typeorm';

export type DeltaCounts = {
  inserted: number;
  updated: number;
  deleted: number;
};

export type SyncableOds = {
  id: number | null;
  name: string | null;
  dbName: string;
  instanceManageId?: number | null;
  instanceType?: string | null;
  status?: string | null;
  databaseTemplate?: string | null;
  databaseName?: string | null;
  edorgs?: SbV1MetaEdorg[];
};

export type SyncableEdorgFlat = SbV1MetaEdorg & {
  parent?: SbV1MetaEdorg['educationorganizationid'];
};

export const computeOdsListDeltas = (
  shouldHaveOdss: SyncableOds[],
  doHaveOdss: Ods[],
  edfiTenant: EdfiTenant,
  em: EntityManager
) => {
  Logger.log(
    `computeOdsListDeltas: Processing ${shouldHaveOdss.length} incoming ODS, ${doHaveOdss.length} existing ODS`
  );

  const odsDeltas = {
    insert: [] as Ods[],
    update: [] as Ods[],
    delete: [] as number[],
  };

  // Partition incoming ODS: those with an odsInstanceId (V2 / non-SB V1 from form)
  // vs those without (SB V1 Lambda responses that don't carry an odsInstanceId).
  const metaOdssById = new Map(
    shouldHaveOdss
      .filter(o => o.id !== null)
      .map((o) => [o.id, o])
  );
  const metaOdssByDbName = new Map(
    shouldHaveOdss
      .filter(o => o.id === null)
      .map((o) => [o.dbName, o])
  );

  /** Initially all existing ODS — matched ones are removed; remaining are deleted */
  const odsIdsToDelete = new Set(doHaveOdss.map((o) => o.id));

  // Existing ODS with a known odsInstanceId → match by odsInstanceId
  const odsMapById = new Map<number, Ods>(
    doHaveOdss
      .filter(o => o.odsInstanceId !== null)
      .map((o) => [o.odsInstanceId, o])
  );
  // Existing ODS without odsInstanceId (SB V1 legacy) → match by dbName
  const odsMapByDbName = new Map<string, Ods>(
    doHaveOdss
      .filter(o => o.odsInstanceId === null)
      .map((o) => [o.dbName, o])
  );

  Logger.log(
    `Existing ODS: ${odsMapById.size} by odsInstanceId, ${odsMapByDbName.size} by dbName`
  );
  Logger.log(
    `Incoming ODS: ${metaOdssById.size} by id, ${metaOdssByDbName.size} by dbName`
  );

  // Process id-based ODS (V2 and non-SB V1 from the admin form)
  [...metaOdssById.values()].forEach((sbOds) => {
    const newOds: DeepPartial<Ods> = {
      sbEnvironmentId: edfiTenant.sbEnvironmentId,
      edfiTenantId: edfiTenant.id,
      dbName: sbOds.dbName,
      instanceManageId: sbOds.instanceManageId ?? null,
      odsInstanceId: sbOds.id,
      odsInstanceName: sbOds.name,
      instanceType: sbOds.instanceType ?? null,
      status: sbOds.status ?? null,
      databaseTemplate: sbOds.databaseTemplate ?? null,
      databaseName: sbOds.databaseName ?? null,
    };

    if (odsMapById.has(sbOds.id)) {
      const existingOds = odsMapById.get(sbOds.id);
      odsIdsToDelete.delete(existingOds.id);

      const hasChanges =
        existingOds.dbName !== sbOds.dbName ||
        existingOds.odsInstanceName !== sbOds.name ||
        (existingOds.instanceType ?? null) !== (sbOds.instanceType ?? null) ||
        (existingOds.status ?? null) !== (sbOds.status ?? null) ||
        (existingOds.databaseTemplate ?? null) !== (sbOds.databaseTemplate ?? null) ||
        (existingOds.databaseName ?? null) !== (sbOds.databaseName ?? null) ||
        (existingOds.instanceManageId ?? null) !== (sbOds.instanceManageId ?? null);

      Logger.log(
        `ODS ${sbOds.id}: dbName "${existingOds.dbName}" vs "${sbOds.dbName}", ` +
        `name "${existingOds.odsInstanceName}" vs "${sbOds.name}", hasChanges=${hasChanges}`
      );

      if (hasChanges) {
        Logger.log(`Updating ODS instance ${sbOds.id}: dbName="${existingOds.dbName}" -> "${sbOds.dbName}"`);
        odsDeltas.update.push(Object.assign(existingOds, newOds));
      }
    } else {
      Logger.log(`Inserting new ODS instance ${sbOds.id}: dbName="${sbOds.dbName}", name="${sbOds.name}"`);
      odsDeltas.insert.push(em.getRepository(Ods).create(newOds));
    }
  });

  // Process dbName-based ODS (SB V1 Lambda — no odsInstanceId available)
  [...metaOdssByDbName.values()].forEach((sbOds) => {
    const newOds: DeepPartial<Ods> = {
      sbEnvironmentId: edfiTenant.sbEnvironmentId,
      edfiTenantId: edfiTenant.id,
      dbName: sbOds.dbName,
      instanceManageId: sbOds.instanceManageId ?? null,
      odsInstanceId: null,
      odsInstanceName: sbOds.name,
      instanceType: sbOds.instanceType ?? null,
      status: sbOds.status ?? null,
      databaseTemplate: sbOds.databaseTemplate ?? null,
      databaseName: sbOds.databaseName ?? null,
    };

    if (odsMapByDbName.has(sbOds.dbName)) {
      const existingOds = odsMapByDbName.get(sbOds.dbName);
      odsIdsToDelete.delete(existingOds.id);

      const hasChanges =
        existingOds.odsInstanceName !== sbOds.name ||
        (existingOds.instanceType ?? null) !== (sbOds.instanceType ?? null) ||
        (existingOds.status ?? null) !== (sbOds.status ?? null) ||
        (existingOds.databaseTemplate ?? null) !== (sbOds.databaseTemplate ?? null) ||
        (existingOds.databaseName ?? null) !== (sbOds.databaseName ?? null) ||
        (existingOds.instanceManageId ?? null) !== (sbOds.instanceManageId ?? null);
      if (hasChanges) {
        Logger.log(`Updating SB V1 ODS by dbName "${sbOds.dbName}"`);
        odsDeltas.update.push(Object.assign(existingOds, newOds));
      }
    } else {
      Logger.log(`Inserting new SB V1 ODS by dbName "${sbOds.dbName}"`);
      odsDeltas.insert.push(em.getRepository(Ods).create(newOds));
    }
  });

  odsDeltas.delete = [...odsIdsToDelete.values()];

  Logger.log(
    `computeOdsListDeltas result: ${odsDeltas.insert.length} inserts, ${odsDeltas.update.length} updates, ${odsDeltas.delete.length} deletes`
  );

  return odsDeltas;
};

export const computeOdsTreeDeltas = (
  edfiTenant: EdfiTenant,
  odsMeta: SyncableOds,
  odsEntity: Ods,
  existingEdorgs: Edorg[],
  /** probably from a transaction shared with other operations */
  em: EntityManager
) => {
  const metaEdorgs: SyncableEdorgFlat[] = [];

  const flattenEdorgTree = (
    edorg: SbV1MetaEdorg,
    parent?: SbV1MetaEdorg['educationorganizationid']
  ) => {
    const edorgFlat = {
      ...edorg,
      educationorganizationid: Number(edorg.educationorganizationid),
      parent,
    };
    delete edorgFlat.edorgs;
    metaEdorgs.push(edorgFlat);
    edorg.edorgs?.forEach((childEdorg) =>
      flattenEdorgTree(childEdorg, Number(edorgFlat.educationorganizationid))
    );
  };
  odsMeta.edorgs?.forEach((edorg) => flattenEdorgTree(edorg));

  const edorgRepo = em.getRepository(Edorg);

  const edorgMap = new Map<number, Edorg>();

  existingEdorgs.forEach((edorg) => {
    edorgMap.set(edorg.educationOrganizationId, edorg);
  });
  const edorgsToUpdate = new Map<number, Edorg>();
  const edorgsToInsert = new Map<number, Edorg>();

  // create new entities as necessary
  metaEdorgs.forEach((edfiTenantEdorg) => {
    if (!edorgMap.has(edfiTenantEdorg.educationorganizationid)) {
      const partialEdorgEntity: Partial<Edorg> = {
        edfiTenantId: edfiTenant.id,
        sbEnvironmentId: edfiTenant.sbEnvironmentId,
        ods: odsEntity,
        odsDbName: odsEntity.dbName,
        odsInstanceId: odsEntity.odsInstanceId,
        educationOrganizationId: edfiTenantEdorg.educationorganizationid,
        discriminator: edfiTenantEdorg.discriminator,
        nameOfInstitution: edfiTenantEdorg.nameofinstitution,
        shortNameOfInstitution: edfiTenantEdorg.shortnameofinstitution,
      };
      const newEdorg = edorgRepo.create(partialEdorgEntity);
      edorgsToInsert.set(partialEdorgEntity.educationOrganizationId, newEdorg);
      edorgMap.set(partialEdorgEntity.educationOrganizationId, newEdorg);
    }
  });

  // still-present ones are removed below
  const edorgsToDelete: Set<number> = new Set(existingEdorgs.map((e) => e.id));

  // update existing entities and set parent for new entities created above
  metaEdorgs.forEach((metaEdorg) => {
    const existing = edorgMap.get(metaEdorg.educationorganizationid);
    const parent: Edorg | undefined = edorgMap.get(metaEdorg.parent);
    const correctValues: DeepPartial<Edorg> = {
      discriminator: metaEdorg.discriminator,
      nameOfInstitution: metaEdorg.nameofinstitution,
      shortNameOfInstitution: metaEdorg.shortnameofinstitution,
    };
    let isChanged: boolean;
    if (parent) {
      // can only set parents once all individually created above. thus the check below for insert vs true update
      if (parent.id !== undefined) {
        correctValues.parentId = parent.id;
        isChanged = !_.isMatch(existing, correctValues);
      } else {
        // new parent
        isChanged = true;
      }
    } else {
      isChanged = !_.isMatch(existing, correctValues);
    }
    if (isChanged) {
      const updated = Object.assign(
        existing,
        correctValues,
        // TypeORM has to update the closure table using `parent` entity rather than `parentId` number for some reason
        parent ? { parent } : {}
      );
      if (edorgsToInsert.has(existing.educationOrganizationId)) {
        edorgsToInsert.set(existing.educationOrganizationId, updated);
      } else {
        edorgsToUpdate.set(existing.educationOrganizationId, updated);
      }
    }
    edorgsToDelete.delete(existing.id);
    if (typeof existing.id !== 'number') {
      // don't count as update because it's actually an insertion
    }
  });

  return {
    insert: [...edorgsToInsert.values()],
    update: [...edorgsToUpdate.values()],
    delete: [...edorgsToDelete],
  };
}; /* eslint @typescript-eslint/no-explicit-any: 0 */ // --> OFF

export const persistSyncTenant = async ({
  em,
  edfiTenant,
  odss,
}: {
  em: EntityManager;
  edfiTenant: EdfiTenant;
  odss: SyncableOds[];
}) => {
  Logger.log(
    `persistSyncTenant: Starting for tenant ${edfiTenant.name} (id=${edfiTenant.id}) with ${odss.length} ODS`
  );

  const edorgDeltas = {
    insert: [] as Edorg[],
    update: [] as Edorg[],
    delete: [] as number[],
  };
  // Partition incoming ODS by matching strategy
  const metaOdssById = new Map(odss.filter(o => o.id !== null).map((o) => [o.id, o]));
  const metaOdssByDbName = new Map(odss.filter(o => o.id === null).map((o) => [o.dbName, o]));

  const existingOdss = await em.getRepository(Ods).find({
    where: {
      edfiTenantId: edfiTenant.id,
    },
  });

  Logger.log(`  Found ${existingOdss.length} existing ODS in database`);

  const odsDeltas = computeOdsListDeltas(odss, existingOdss, edfiTenant, em);

  // Build lookup maps for ODS entities after the delta computation
  const allCurrentOdss = await em.getRepository(Ods).find({ where: { edfiTenantId: edfiTenant.id } });
  // id-based ODS (V2 / non-SB V1 from form) — looked up by odsInstanceId
  const entityOdssByInstanceId = new Map(
    allCurrentOdss.filter(o => o.odsInstanceId !== null).map((o) => [o.odsInstanceId, o])
  );
  // dbName-based ODS (SB V1 Lambda) — looked up by dbName
  const entityOdssByDbName = new Map(
    allCurrentOdss.filter(o => o.odsInstanceId === null).map((o) => [o.dbName, o])
  );

  // Add newly inserted/updated ODS to the appropriate map so EdOrg processing
  // has access to entities that are not yet persisted but will be saved together.
  [...odsDeltas.insert, ...odsDeltas.update].forEach((o) => {
    if (o.odsInstanceId !== null) {
      entityOdssByInstanceId.set(o.odsInstanceId, o);
    } else {
      entityOdssByDbName.set(o.dbName, o);
    }
  });
  
  const existingEdorgs = await em.getRepository(Edorg).find({
    where: {
      edfiTenantId: edfiTenant.id,
    },
  });

  const odsEdorgsMap = existingEdorgs.reduce((acc, edorg) => {
    if (edorg.odsId in acc) {
      acc[edorg.odsId].push(edorg);
    } else {
      acc[edorg.odsId] = [edorg];
    }
    return acc;
  }, {} as Record<number, Edorg[]>);

  // Process edorgs for id-based ODS (V2 and non-SB V1 from form)
  for (const [odsInstanceId, ods] of metaOdssById) {
    const odsEntity = entityOdssByInstanceId.get(odsInstanceId);
    if (!odsEntity) {
      Logger.warn(`Could not find ODS entity for odsInstanceId ${odsInstanceId}, skipping edorg processing`);
      continue;
    }

    const odsResult = computeOdsTreeDeltas(
      edfiTenant,
      ods,
      odsEntity,
      odsEdorgsMap[odsEntity.id] ?? [],
      em
    );
    edorgDeltas.insert.push(...odsResult.insert);
    edorgDeltas.update.push(...odsResult.update);
    edorgDeltas.delete.push(...odsResult.delete);
  }

  // Process edorgs for dbName-based ODS (SB V1 Lambda — no odsInstanceId)
  for (const [dbName, ods] of metaOdssByDbName) {
    const odsEntity = entityOdssByDbName.get(dbName);
    if (!odsEntity) {
      Logger.warn(`Could not find ODS entity for dbName "${dbName}", skipping edorg processing`);
      continue;
    }

    const odsResult = computeOdsTreeDeltas(
      edfiTenant,
      ods,
      odsEntity,
      odsEdorgsMap[odsEntity.id] ?? [],
      em
    );
    edorgDeltas.insert.push(...odsResult.insert);
    edorgDeltas.update.push(...odsResult.update);
    edorgDeltas.delete.push(...odsResult.delete);
  }

  if (odsDeltas.insert.length || odsDeltas.update.length) {
    Logger.log(
      `Saving ODS changes: ${odsDeltas.insert.length} inserts, ${odsDeltas.update.length} updates`
    );
    const newOdss = await em
      .getRepository(Ods)
      .save([...odsDeltas.insert, ...odsDeltas.update], { chunk: 500 });
    Logger.log(`Successfully saved ${newOdss.length} ODS records`);
    // Build lookup maps: id-based ODS by odsInstanceId, dbName-based ODS by dbName.
    const newOdsMapByInstanceId = new Map(
      newOdss.filter(o => o.odsInstanceId !== null).map((o) => [o.odsInstanceId, o])
    );
    const newOdsMapByDbName = new Map(
      newOdss.filter(o => o.odsInstanceId === null).map((o) => [o.dbName, o])
    );
    for (const edorg of edorgDeltas.insert) {
      edorg.ods = edorg.ods.odsInstanceId !== null
        ? newOdsMapByInstanceId.get(edorg.ods.odsInstanceId)
        : newOdsMapByDbName.get(edorg.ods.dbName);
    }
  } else {
    Logger.log('No ODS changes to save');
  }

  if (odsDeltas.delete.length) {
    await em.getRepository(Ods).delete(odsDeltas.delete);
  }

  const newRootEdorgs: Edorg[] = [];
  for (const edorg of edorgDeltas.insert) {
    if (!edorg.parent || typeof edorg.parent.id === 'number') {
      newRootEdorgs.push(edorg);
    } else {
      if (!edorg.parent.children) {
        edorg.parent.children = [];
      }
      edorg.parent.children.push(edorg);
    }
  }
  // TypeORM doesn't save a tree structure in one go. Need to save parents before children.
  const treeLevels: Edorg[][] = [];
  const putEdorgInLevel = (edorg: Edorg, level: number) => {
    if (!treeLevels[level]) {
      treeLevels[level] = [];
    }
    treeLevels[level].push(edorg);
    (edorg.children ?? []).forEach((child) => putEdorgInLevel(child, level + 1));
  };
  newRootEdorgs.forEach((edorg) => putEdorgInLevel(edorg, 0));

  for (const level of treeLevels) {
    await em.getRepository(Edorg).save(level, { chunk: 500 });
  }
  // const newEdorgs = new Map<string, Edorg>();

  // const flattenEdorgTree = (edorg: Edorg) => {
  //   const children = [...(edorg.children ?? [])];
  //   delete edorg.children;
  //   newEdorgs.set(`${edorg.odsDbName}-${edorg.educationOrganizationId}`, edorg);
  //   children.forEach((child) => flattenEdorgTree(child));
  // };
  // newRootEdorgs.forEach((edorg) => flattenEdorgTree(edorg));

  if (edorgDeltas.update.length) {
    await em.getRepository(Edorg).save(
      edorgDeltas.update /* .map((edorg) =>
        edorg.parent && typeof edorg.parent.id === undefined
          ? // need to reassign parent because save above doesn't mutate existing variables with new ids
            Object.assign(edorg, {
              parent: newEdorgs.get(
                `${edorg.parent.odsDbName}-${edorg.parent.educationOrganizationId}`
              ),
            })
          : edorg
      ) */,
      { chunk: 500 }
    );
  }

  if (edorgDeltas.delete.length) {
    await em.getRepository(Edorg).delete(edorgDeltas.delete);
  }

  const data = {
    edorg: {
      inserted: edorgDeltas.insert.length,
      updated: edorgDeltas.update.length,
      deleted: edorgDeltas.delete.length,
    },
    ods: {
      inserted: odsDeltas.insert.length,
      updated: odsDeltas.update.length,
      deleted: odsDeltas.delete.length,
    },
  };
  let hasChanges = false;
  for (const key of ['ods', 'edorg']) {
    for (const subkey of ['inserted', 'updated', 'deleted']) {
      if (data[key][subkey] > 0) {
        hasChanges = true;
        break;
      }
    }
    if (hasChanges) break;
  }

  return {
    status: 'SUCCESS' as const,
    data: { ...data, hasChanges },
  };
};

export const persistSyncOds = async ({
  em,
  edfiTenant,
  ods,
}: {
  em: EntityManager;
  edfiTenant: EdfiTenant;
  ods: SyncableOds;
}) => {
  const edorgDeltas = {
    insert: [] as Edorg[],
    update: [] as Edorg[],
    delete: [] as number[],
  };
  let odsCreated = false;
  let entityOds = await em.getRepository(Ods).findOneBy({
    edfiTenantId: edfiTenant.id,
    odsInstanceId: ods.id,
  });
  if (entityOds === null) {
    odsCreated = true;
    entityOds = await em.getRepository(Ods).save({
      sbEnvironmentId: edfiTenant.sbEnvironmentId,
      edfiTenantId: edfiTenant.id,
      dbName: ods.dbName,
      odsInstanceId: ods.id,
      odsInstanceName: ods.name,
    });
  }

  const existingEdorgs = await em.getRepository(Edorg).find({
    where: {
      edfiTenantId: edfiTenant.id,
    },
  });

  const odsResult = computeOdsTreeDeltas(edfiTenant, ods, entityOds, existingEdorgs, em);
  edorgDeltas.insert.push(...odsResult.insert);
  edorgDeltas.update.push(...odsResult.update);
  edorgDeltas.delete.push(...odsResult.delete);

  for (const edorg of edorgDeltas.insert) {
    edorg.ods = entityOds;
  }

  const newRootEdorgs: Edorg[] = [];
  for (const edorg of edorgDeltas.insert) {
    if (!edorg.parent || typeof edorg.parent.id === 'number') {
      newRootEdorgs.push(edorg);
    } else {
      if (!edorg.parent.children) {
        edorg.parent.children = [];
      }
      edorg.parent.children.push(edorg);
    }
  }
  // TypeORM doesn't save a tree structure in one go. Need to save parents before children.
  const treeLevels: Edorg[][] = [];
  const putEdorgInLevel = (edorg: Edorg, level: number) => {
    if (!treeLevels[level]) {
      treeLevels[level] = [];
    }
    treeLevels[level].push(edorg);
    (edorg.children ?? []).forEach((child) => putEdorgInLevel(child, level + 1));
  };
  newRootEdorgs.forEach((edorg) => putEdorgInLevel(edorg, 0));

  for (const level of treeLevels) {
    await em.getRepository(Edorg).save(level, { chunk: 500 });
  }

  if (edorgDeltas.update.length) {
    await em.getRepository(Edorg).save(edorgDeltas.update, { chunk: 500 });
  }

  if (edorgDeltas.delete.length) {
    await em.getRepository(Edorg).delete(edorgDeltas.delete);
  }

  const data = {
    edorg: {
      inserted: edorgDeltas.insert.length,
      updated: edorgDeltas.update.length,
      deleted: edorgDeltas.delete.length,
    },
    ods: odsCreated
      ? {
          inserted: 1,
          updated: 0,
          deleted: 0,
        }
      : {
          inserted: 0,
          updated: 0,
          deleted: 0,
        },
  };
  let hasChanges = false;
  for (const key of ['ods', 'edorg']) {
    for (const subkey of ['inserted', 'updated', 'deleted']) {
      if (data[key][subkey] > 0) {
        hasChanges = true;
        break;
      }
    }
    if (hasChanges) break;
  }

  return {
    status: 'SUCCESS' as const,
    data: { ...data, hasChanges },
  };
};

export const persistSyncDeleteOds = async ({
  ods,
  em,
}: {
  ods: Ods;
  edfiTenant: EdfiTenant;
  em: EntityManager;
}) => {
  await em.getRepository(Ods).delete(ods.id);
  const edorgDeletResult = await em.getRepository(Edorg).delete({ odsId: ods.id });
  return {
    status: 'SUCCESS' as const,
    data: {
      edorg: {
        inserted: 0,
        updated: 0,
        deleted: edorgDeletResult.affected ?? 0,
      },
      ods: {
        inserted: 0,
        updated: 0,
        deleted: 1,
      },
      hasChanges: true,
    },
  };
};
