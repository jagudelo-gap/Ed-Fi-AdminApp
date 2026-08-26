import {
  Box,
  Button,
  ButtonGroup,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
  Stack,
  Text,
  Tooltip,
  chakra,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionIcon,
  AccordionPanel,
  Table,
  Thead,
  Th,
  Tr,
  Tbody,
  Td,
} from '@chakra-ui/react';
import { Icons } from '@edanalytics/common-ui';
import { PostSbEnvironmentDto, PostSbEnvironmentTenantDTO } from '@edanalytics/models';
import { FieldErrors, UseFormGetValues, UseFormRegister, UseFormSetValue, UseFormClearErrors, UseFormSetError } from 'react-hook-form';

const ED_ORG_PATTERN = /^\s*\d+(\s*,\s*\d+)*\s*$/;

interface TenantManagementSectionProps {
  isMultitenant: boolean;
  tenants: PostSbEnvironmentTenantDTO[];
  register: UseFormRegister<PostSbEnvironmentDto>;
  setValue: UseFormSetValue<PostSbEnvironmentDto>;
  getValues: UseFormGetValues<PostSbEnvironmentDto>;
  errors: FieldErrors<PostSbEnvironmentDto>;
  clearErrors: UseFormClearErrors<PostSbEnvironmentDto>;
  setError: UseFormSetError<PostSbEnvironmentDto>;
}

export const TenantManagementSection = ({
  isMultitenant,
  tenants,
  register,
  setValue,
  getValues,
  errors,
  clearErrors,
  setError,
}: TenantManagementSectionProps) => {
  if (isMultitenant) {
    // Multi-tenant mode
    return (
      <Box>
        <FormControl>
          <FormLabel>
            Tenants{' '}
            <Tooltip label="Add tenants for this multi-tenant deployment" hasArrow>
              <chakra.span>
                <Icons.InfoCircle />
              </chakra.span>
            </Tooltip>
          </FormLabel>
          <Text fontSize="sm" color="orange.600" mb={2}>
            ⚠️ Ensure all tenant names entered below are properly configured in your Admin API before proceeding
          </Text>
          {/* Hidden field for tenant-level errors */}
          <FormControl isInvalid={!!errors.tenants} display="none">
            <Input {...register('tenants')} type="hidden" />
          </FormControl>
          {errors.tenants?.message && (
            <Text color="red.500" fontSize="sm" mb={2}>
              {errors.tenants.message}
            </Text>
          )}
          <Stack spacing={2}>
            <ButtonGroup size="sm">
              <Button
                onClick={() => {
                  const currentTenants = getValues('tenants') || [];
                  const newTenant: PostSbEnvironmentTenantDTO = {
                    name: `tenant${currentTenants.length + 1}`,
                    odss: [],
                  };
                  setValue('tenants', [...currentTenants, newTenant]);
                }}
              >
                Add Tenant
              </Button>
            </ButtonGroup>
            {tenants.length > 0 && (
              <Accordion defaultIndex={[0]} allowMultiple>
                {tenants.map((tenant, index) => (
                  <AccordionItem key={index}>
                    <AccordionButton>
                      <Box flex="1" textAlign="left">
                        <Text fontWeight="bold">{tenant.name}</Text>
                      </Box>
                      <Box
                        as="span"
                        fontSize="sm"
                        color="red.500"
                        cursor="pointer"
                        px={2}
                        py={1}
                        borderRadius="md"
                        _hover={{ bg: "red.50" }}
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation();
                          const currentTenants = getValues('tenants') || [];
                          const updatedTenants = [...currentTenants];
                          if (updatedTenants[index]) {
                            updatedTenants.splice(index, 1);
                          }
                          setValue('tenants', updatedTenants);
                          // Clear tenant-related validation errors when removing a tenant
                          clearErrors('tenants');
                        }}
                      >
                        Remove
                      </Box>
                      <AccordionIcon />
                    </AccordionButton>
                    <AccordionPanel pb={4}>
                      <Box flex="1" textAlign="left">
                        <Stack spacing={2} w="full">
                          <FormControl isInvalid={!!errors.tenants?.[index]?.name}>
                            <FormLabel>
                              Tenant Name{' '}
                              <Tooltip label="The tenant key you set in appsettings file" hasArrow>
                                <chakra.span>
                                  <Icons.InfoCircle />
                                </chakra.span>
                              </Tooltip>
                            </FormLabel>
                            <Input
                              value={tenant.name}
                              {...register(`tenants.${index}.name`)}
                              onChange={(e) => {
                                const currentTenants = getValues('tenants') || [];
                                const updatedTenants = [...currentTenants];
                                updatedTenants[index].name = e.target.value;
                                setValue('tenants', updatedTenants);
                              }}
                              placeholder="Tenant name"
                            />
                            <FormErrorMessage>{errors.tenants?.[index]?.name?.message}</FormErrorMessage>
                          </FormControl>
                          <FormControl isInvalid={!!errors.tenants?.[index]?.odss}>
                            <FormLabel>
                              ODS Instances{' '}
                              <Tooltip label="Add the ODS Instances for the tenant" hasArrow>
                                <chakra.span>
                                  <Icons.InfoCircle />
                                </chakra.span>
                              </Tooltip>
                            </FormLabel>
                            <Text fontSize="sm" color="orange.600" mb={2}>
                              ⚠️ Ensure all Ods Instance names entered below are properly configured in your Admin API before proceeding
                            </Text>
                            <ButtonGroup size="sm" mb={2}>
                              <Button
                                onClick={() => {
                                  const currentTenants = getValues('tenants') || [];
                                  const updatedTenants = [...currentTenants];
                                  if (!updatedTenants[index].odss) {
                                    updatedTenants[index].odss = [];
                                  }
                                  // Find the max id currently in use and increment by 1 for the new ODS instance
                                  const currentOdss = updatedTenants[index].odss;
                                  const idArray = currentOdss.map(o => typeof o.id === 'number' ? o.id : 0);
                                  const maxId = idArray.length > 0 ? Math.max(...idArray) : 0;
                                  updatedTenants[index].odss.push({
                                    id: maxId + 1,
                                    name: `ODS ${maxId + 1}`,
                                    dbName: `ODS_${maxId + 1}`,
                                    allowedEdOrgs: '',
                                  });
                                  setValue('tenants', updatedTenants);
                                  // Clear validation errors for this tenant's ODS instances
                                  clearErrors(`tenants.${index}.odss`);
                                }}
                              >
                                Add ODS
                              </Button>
                            </ButtonGroup>
                            <FormErrorMessage>{errors.tenants?.[index]?.odss?.message}</FormErrorMessage>
                            <Box>
                              <Table variant="simple" size="sm">
                                <Thead>
                                  <Tr>
                                    <Th>ODS Name{' '}
                                      <Tooltip label="ODS name in Admin API" hasArrow>
                                        <chakra.span>
                                          <Icons.InfoCircle />
                                        </chakra.span>
                                      </Tooltip></Th>
                                    <Th>DB Name{' '}
                                      <Tooltip label="Database name for the ODS instance" hasArrow>
                                        <chakra.span>
                                          <Icons.InfoCircle />
                                        </chakra.span>
                                      </Tooltip></Th>
                                    <Th>Education Organization Identifier(s){' '}
                                      <Tooltip label="Comma separated list of Education Organization IDs managed in this instance" hasArrow>
                                        <chakra.span>
                                          <Icons.InfoCircle />
                                        </chakra.span>
                                      </Tooltip></Th>
                                    <Th>Actions</Th>
                                  </Tr>
                                </Thead>
                                {tenant.odss && tenant.odss.length > 0 && (
                                  <Tbody>
                                    {tenant.odss.map((ods, odsIndex) => (
                                      <Tr key={odsIndex}>
                                        <Td>
                                          <FormControl isInvalid={!!errors.tenants?.[index]?.odss?.[odsIndex]?.name}>
                                            <Input
                                              value={ods.name}
                                              {...register(`tenants.${index}.odss.${odsIndex}.name`)}
                                              onChange={(e) => {
                                                const currentTenants = getValues('tenants') || [];
                                                setValue('tenants', currentTenants.map((t, i) =>
                                                  i === index
                                                    ? { ...t, odss: (t.odss ?? []).map((o, j) => j === odsIndex ? { ...o, name: e.target.value } : o) }
                                                    : t
                                                ));
                                                if (e.target.value.trim()) {
                                                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                  clearErrors(`tenants.${index}.odss.${odsIndex}.name` as any);
                                                }
                                              }}
                                              placeholder="ODS name"
                                              size="sm"
                                            />
                                            <FormErrorMessage>{errors.tenants?.[index]?.odss?.[odsIndex]?.name?.message}</FormErrorMessage>
                                          </FormControl>
                                        </Td>
                                        <Td>
                                          <FormControl isInvalid={!!errors.tenants?.[index]?.odss?.[odsIndex]?.dbName}>
                                            <Input
                                              value={ods.dbName}
                                              {...register(`tenants.${index}.odss.${odsIndex}.dbName`)}
                                              onChange={(e) => {
                                                const currentTenants = getValues('tenants') || [];
                                                setValue('tenants', currentTenants.map((t, i) =>
                                                  i === index
                                                    ? { ...t, odss: (t.odss ?? []).map((o, j) => j === odsIndex ? { ...o, dbName: e.target.value } : o) }
                                                    : t
                                                ));
                                                if (e.target.value.trim()) {
                                                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                  clearErrors(`tenants.${index}.odss.${odsIndex}.dbName` as any);
                                                }
                                              }}
                                              placeholder="DB name"
                                              size="sm"
                                            />
                                            <FormErrorMessage>{errors.tenants?.[index]?.odss?.[odsIndex]?.dbName?.message}</FormErrorMessage>
                                          </FormControl>
                                        </Td>
                                        <Td>
                                          <FormControl isInvalid={!!errors.tenants?.[index]?.odss?.[odsIndex]?.allowedEdOrgs}>
                                            <Input
                                              value={ods.allowedEdOrgs}
                                              {...register(`tenants.${index}.odss.${odsIndex}.allowedEdOrgs`)}
                                              onChange={(e) => {
                                                const currentTenants = getValues('tenants') || [];
                                                setValue('tenants', currentTenants.map((t, i) =>
                                                  i === index
                                                    ? { ...t, odss: (t.odss ?? []).map((o, j) => j === odsIndex ? { ...o, allowedEdOrgs: e.target.value } : o) }
                                                    : t
                                                ));
                                                const val = e.target.value;
                                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                const fieldPath = `tenants.${index}.odss.${odsIndex}.allowedEdOrgs` as any;
                                                if (!val || val.trim() === '') {
                                                  setError(fieldPath, { type: 'required', message: 'Education Organization Identifier(s) is required' });
                                                } else if (!ED_ORG_PATTERN.test(val)) {
                                                  setError(fieldPath, { type: 'pattern', message: 'Education Organization Identifier(s) must be numbers separated by commas (e.g., "1, 255901, 25590100")' });
                                                } else {
                                                  clearErrors(fieldPath);
                                                }
                                              }}
                                              placeholder="1, 255901, 25590100"
                                              size="sm"
                                            />
                                            <FormErrorMessage>{errors.tenants?.[index]?.odss?.[odsIndex]?.allowedEdOrgs?.message}</FormErrorMessage>
                                          </FormControl>
                                        </Td>
                                        <Td>
                                          <Button
                                            size="sm"
                                            colorScheme="red"
                                            variant="ghost"
                                            onClick={() => {
                                              const currentTenants = getValues('tenants') || [];
                                              const updatedTenants = [...currentTenants];
                                              if (updatedTenants[index]?.odss) {
                                                updatedTenants[index].odss.splice(odsIndex, 1);
                                              }
                                              setValue('tenants', updatedTenants);
                                              // Clear validation errors specific to this tenant's ODS instances
                                              clearErrors(`tenants.${index}.odss`);
                                            }}
                                          >
                                            Remove
                                          </Button>
                                        </Td>
                                      </Tr>
                                    ))}
                                  </Tbody>
                                )}
                              </Table>
                            </Box>
                          </FormControl>
                        </Stack>
                      </Box>
                    </AccordionPanel>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </Stack>
        </FormControl>
      </Box>
    );
  } else {
    // Single-tenant mode
    return (
      <Box>
        <FormControl isInvalid={!!errors.tenants?.[0]?.odss}>
          <FormLabel>
            ODS Instances{' '}
            <Tooltip label="Configure ODS instances for the single-tenant deployment" hasArrow>
              <chakra.span>
                <Icons.InfoCircle />
              </chakra.span>
            </Tooltip>
          </FormLabel>
          <ButtonGroup size="sm" mb={2}>
            <Button
              onClick={() => {
                const currentTenants = getValues('tenants') || [];
                // Ensure we have a default tenant
                if (currentTenants.length === 0) {
                  setValue('tenants', [{
                    name: 'default',
                    odss: []
                  }]);
                }
                const updatedTenants = [...currentTenants];
                const existingTenant = updatedTenants[0] || { name: 'default', odss: [] };
                const currentOdss = existingTenant.odss ?? [];
                const idArray = currentOdss.map(o => typeof o.id === 'number' ? o.id : 0);
                const maxId = idArray.length > 0 ? Math.max(...idArray) : 0;
                // Find the max id currently in use and increment by 1 for the new ODS instance
                updatedTenants[0] = {
                  ...existingTenant,
                  odss: [
                    ...currentOdss,
                    {
                      id: maxId + 1,
                      name: `ODS ${maxId + 1}`,
                      dbName: `ODS_${maxId + 1}`,
                      allowedEdOrgs: '',
                    },
                  ],
                };
                setValue('tenants', updatedTenants);
                // Clear validation errors for the default tenant's ODS instances
                clearErrors('tenants.0.odss');
              }}
            >
              Add ODS Instance
            </Button>
          </ButtonGroup>
          <FormErrorMessage>{errors.tenants?.[0]?.odss?.message}</FormErrorMessage>
          <Box>
            <Table variant="simple" size="sm">
              <Thead>
                <Tr>
                  <Th>ODS Name{' '}
                    <Tooltip label="ODS name in Admin API" hasArrow>
                      <chakra.span>
                        <Icons.InfoCircle />
                      </chakra.span>
                    </Tooltip></Th>
                  <Th>DB Name{' '}
                    <Tooltip label="Database name for the ODS instance" hasArrow>
                      <chakra.span>
                        <Icons.InfoCircle />
                      </chakra.span>
                    </Tooltip></Th>
                  <Th>Education Organization Identifier(s){' '}
                    <Tooltip label="Comma separated list of Education Organization IDs managed in this instance" hasArrow>
                      <chakra.span>
                        <Icons.InfoCircle />
                      </chakra.span>
                    </Tooltip></Th>
                  <Th>Actions</Th>
                </Tr>
              </Thead>
              {tenants.length > 0 && tenants[0]?.odss && tenants[0].odss.length > 0 && (
                <Tbody>
                  {tenants[0].odss.map((ods, odsIndex) => (
                    <Tr key={odsIndex}>
                      <Td>
                        <FormControl isInvalid={!!errors.tenants?.[0]?.odss?.[odsIndex]?.name}>
                          <Input
                            value={ods.name}
                            onChange={(e) => {
                              const currentTenants = getValues('tenants') || [];
                              const updatedTenants = [...currentTenants];
                              updatedTenants[0] = {
                                ...updatedTenants[0],
                                odss: (updatedTenants[0].odss ?? []).map((o, i) =>
                                  i === odsIndex ? { ...o, name: e.target.value } : o
                                ),
                              };
                              setValue('tenants', updatedTenants);
                              if (e.target.value.trim()) {
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                clearErrors(`tenants.0.odss.${odsIndex}.name` as any);
                              }
                            }}
                            placeholder="ODS name"
                            size="sm"
                          />
                          <FormErrorMessage>{errors.tenants?.[0]?.odss?.[odsIndex]?.name?.message}</FormErrorMessage>
                        </FormControl>
                      </Td>
                      <Td>
                        <FormControl isInvalid={!!errors.tenants?.[0]?.odss?.[odsIndex]?.dbName}>
                          <Input
                            value={ods.dbName}
                            onChange={(e) => {
                              const currentTenants = getValues('tenants') || [];
                              const updatedTenants = [...currentTenants];
                              updatedTenants[0] = {
                                ...updatedTenants[0],
                                odss: (updatedTenants[0].odss ?? []).map((o, i) =>
                                  i === odsIndex ? { ...o, dbName: e.target.value } : o
                                ),
                              };
                              setValue('tenants', updatedTenants);
                              if (e.target.value.trim()) {
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                clearErrors(`tenants.0.odss.${odsIndex}.dbName` as any);
                              }
                            }}
                            placeholder="DB name"
                            size="sm"
                          />
                          <FormErrorMessage>{errors.tenants?.[0]?.odss?.[odsIndex]?.dbName?.message}</FormErrorMessage>
                        </FormControl>
                      </Td>
                      <Td>
                        <FormControl isInvalid={!!errors.tenants?.[0]?.odss?.[odsIndex]?.allowedEdOrgs}>
                          <Input
                            value={ods.allowedEdOrgs}
                            onChange={(e) => {
                              const currentTenants = getValues('tenants') || [];
                              const updatedTenants = [...currentTenants];
                              updatedTenants[0] = {
                                ...updatedTenants[0],
                                odss: (updatedTenants[0].odss ?? []).map((o, i) =>
                                  i === odsIndex ? { ...o, allowedEdOrgs: e.target.value } : o
                                ),
                              };
                              setValue('tenants', updatedTenants);
                              const val = e.target.value;
                              // eslint-disable-next-line @typescript-eslint/no-explicit-any
                              const fieldPath = `tenants.0.odss.${odsIndex}.allowedEdOrgs` as any;
                              if (!val || val.trim() === '') {
                                setError(fieldPath, { type: 'required', message: 'Education Organization Identifier(s) is required' });
                              } else if (!ED_ORG_PATTERN.test(val)) {
                                setError(fieldPath, { type: 'pattern', message: 'Education Organization Identifier(s) must be numbers separated by commas (e.g., "1, 255901, 25590100")' });
                              } else {
                                clearErrors(fieldPath);
                              }
                            }}
                            placeholder="1, 255901, 25590100"
                            size="sm"
                          />
                          <FormErrorMessage>{errors.tenants?.[0]?.odss?.[odsIndex]?.allowedEdOrgs?.message}</FormErrorMessage>
                        </FormControl>
                      </Td>
                      <Td>
                        <Button
                          size="sm"
                          colorScheme="red"
                          variant="ghost"
                          onClick={() => {
                            const currentTenants = getValues('tenants') || [];
                            const updatedTenants = [...currentTenants];
                            updatedTenants[0] = {
                              ...updatedTenants[0],
                              odss: (updatedTenants[0]?.odss ?? []).filter(
                                (_, i) => i !== odsIndex
                              ),
                            };
                            setValue('tenants', updatedTenants);
                            // Clear validation errors specific to the default tenant's ODS instances
                            clearErrors('tenants.0.odss');
                          }}
                        >
                          Remove
                        </Button>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              )}
            </Table>
          </Box>
        </FormControl>
      </Box>
    );
  }
};
