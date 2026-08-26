/**
 * Safely applies whitelisted DTO fields to an entity.
 * This provides defense-in-depth security by explicitly controlling
 * which fields can be updated, preventing accidental exposure of
 * server-controlled fields like id, createdAt, createdById, etc.
 *
 * @param entity - The existing entity to update
 * @param dto - The DTO containing the update data
 * @param allowedFields - Array of field names that are allowed to be updated
 * @returns The updated entity
 *
 * @example
 * ```typescript
 * const updated = applyDtoUpdates(
 *   existingUser,
 *   updateUserDto,
 *   ['username', 'roleId', 'isActive', 'givenName', 'familyName', 'description', 'modifiedById']
 * );
 * ```
 */
export function applyDtoUpdates<TEntity, TDto extends object>(
  entity: TEntity,
  dto: TDto,
  allowedFields: (keyof TDto)[]
): TEntity {
  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(dto, field)) {
      (entity as Record<PropertyKey, unknown>)[field as PropertyKey] = dto[field];
    }
  }
  return entity;
}
