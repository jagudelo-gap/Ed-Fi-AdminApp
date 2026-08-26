import {
  Box,
  Button,
  ButtonGroup,
  FormLabel,
  HStack,
  Link,
  ListItem,
  Popover,
  PopoverArrow,
  PopoverBody,
  PopoverContent,
  PopoverTrigger,
  Text,
  Tooltip,
  UnorderedList,
  chakra,
} from '@chakra-ui/react';
import { Icons, PageTemplate } from '@edanalytics/common-ui';
import { ImportClaimsetSingleDtoV3 } from '@edanalytics/models';
import { StatusResponse, isExplicitStatusResponse } from '@edanalytics/utils';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router';
import { claimsetQueriesV3 } from '../../api';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';

// Exported for unit testing (see ImportClaimsetsPageV3.spec.tsx).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lowercaseFirstLetterOfKeys(input: any): any {
  if (typeof input !== 'object' || input === null) {
    return input;
  }

  if (Array.isArray(input)) {
    return input.map(lowercaseFirstLetterOfKeys);
  }

  return Object.keys(input).reduce((acc, key) => {
    const newKey = key.charAt(0).toLowerCase() + key.slice(1);
    // Reject __proto__/constructor/prototype keys instead of assigning them:
    // JSON.parse makes `__proto__` an own enumerable key (not the special
    // object-literal form), so `acc[newKey] = ...` would reassign the
    // accumulator's prototype rather than set a property, letting an
    // attacker-supplied import file taint this object before it is
    // serialized to the API.
    if (newKey === '__proto__' || newKey === 'constructor' || newKey === 'prototype') {
      return acc;
    }
    acc[newKey] = lowercaseFirstLetterOfKeys(input[key]);
    return acc;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }, {} as { [key: string]: any });
}

export const ImportClaimsetsPageV3 = () => {
  const [claimsets, setClaimsets] = useState<(ImportClaimsetSingleDtoV3 | unknown)[]>([]);
  const [error, setError] = useState<string | undefined>(undefined);

  return (
    <PageTemplate title={'Import claimsets'}>
      <Box>
        <FormLabel>
          Choose file{' '}
          <Tooltip
            label="Select a file downloaded from the Ed-Fi Admin App claimset export feature."
            hasArrow
          >
            <chakra.span>
              <Icons.InfoCircle />
            </chakra.span>
          </Tooltip>
        </FormLabel>
        <chakra.input
          w="form-width"
          type="file"
          id="claimset-import-file"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) {
              setError('No file selected');
              setClaimsets([]);
              return;
            }
            try {
              const content = JSON.parse(await file.text());
              try {
                const targetClaimsets = content.template.claimSets;
                if (Array.isArray(targetClaimsets)) {
                  setClaimsets(targetClaimsets);
                  setError(undefined);
                  return;
                } else {
                  setError('Did not find array of claimsets in file');
                }
              } catch {
                setError('Did not find expected JSON structure in file');
              }
            } catch {
              setError('Invalid JSON file');
            }
            setClaimsets([]);
          }}
        />
      </Box>
      {error ? <Text color="red.500">{error}</Text> : null}
      {claimsets.length ? (
        <>
          <FormLabel>Claimsets in file</FormLabel>
          <UnorderedList>
            {claimsets.map((claimset, index) => (
              <ListItem my={2} key={index}>
                <ClaimsetItemV3 maybeClaimset={claimset} />
              </ListItem>
            ))}
          </UnorderedList>
        </>
      ) : null}
      <ButtonGroup mt={10} colorScheme="primary" variant="outline">
        <Button
          type="reset"
          onClick={() => {
            (document.getElementById('claimset-import-file') as HTMLInputElement).value = '';
            setClaimsets([]);
            setError(undefined);
          }}
        >
          Reset
        </Button>
      </ButtonGroup>
    </PageTemplate>
  );
};

// Exported for unit testing (see ImportClaimsetsPageV3.spec.tsx).
export const ClaimsetItemV3 = ({
  maybeClaimset,
}: {
  maybeClaimset: ImportClaimsetSingleDtoV3 | unknown;
}) => {
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const importClaimset = claimsetQueriesV3.import({
    edfiTenant,
    teamId,
  });

  const [error, setError] = useState<StatusResponse | object | undefined>(undefined);
  const [claimset, setClaimset] = useState<ImportClaimsetSingleDtoV3 | undefined>(undefined);
  // Tracks whether the parsed claimset failed local validation, so the Import
  // button can be disabled instead of letting the user post a known-bad payload.
  const [isInvalid, setIsInvalid] = useState(false);
  useEffect(() => {
    let cancelled = false;
    try {
      if (Array.isArray(maybeClaimset)) {
        setIsInvalid(true);
        // List items are index-keyed, so this component instance can be reused for a
        // different entry when a new file is loaded. Clear any previously parsed
        // claimset, otherwise a stale name renders beside the new error.
        setClaimset(undefined);
        setError({
          title: 'Expected object, got array',
          type: 'Error',
          data: maybeClaimset,
        });
      } else {
        const claimset = plainToInstance(
          ImportClaimsetSingleDtoV3,
          lowercaseFirstLetterOfKeys(maybeClaimset)
        );
        validate(claimset).then((errors) => {
          if (cancelled) return;
          setClaimset(claimset);
          // NOTE: the V2 page calls setError(undefined) unconditionally here,
          // which wipes the error it just set and makes validation invisible.
          // V3 has real validators (the no-whitespace rule), so clear the error
          // only when validation actually passed.
          if (errors.length > 0) {
            setIsInvalid(true);
            setError({
              title: 'Claimset validation failed',
              type: 'Error',
              data: errors.flatMap((e) => Object.values(e.constraints ?? {})),
            });
          } else {
            setIsInvalid(false);
            setError(undefined);
          }
        });
      }
    } catch (err) {
      setIsInvalid(true);
      // Same index-keyed reuse concern as the array branch above.
      setClaimset(undefined);
      setError({
        title: 'Unable to parse claimset',
        type: 'Error',
        data: err,
      });
    }
    return () => {
      cancelled = true;
    };
  }, [maybeClaimset]);
  return (
    <HStack>
      {claimset ? (
        <>
          <Text>{claimset.name}</Text>{' '}
          <Button
            isDisabled={importClaimset.isSuccess || isInvalid}
            isLoading={importClaimset.isPending}
            variant="outline"
            colorScheme="primary"
            size="sm"
            h="1.5rem"
            onClick={() => {
              importClaimset.mutateAsync(
                { entity: claimset, pathParams: {} },
                {
                  onError: (err) => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    setError(err as any);
                  },
                  onSuccess: () => {
                    setError(undefined);
                  },
                }
              );
            }}
          >
            Import
          </Button>
          {importClaimset.isSuccess ? <Icons.CheckCircle color="green.500" /> : undefined}
          {importClaimset.data ? (
            <Link
              ml={3}
              as={RouterLink}
              color="blue.500"
              to={`/as/${teamId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenant.id}/claimsets/${importClaimset.data.id}`}
            >
              View &rarr;
            </Link>
          ) : undefined}
        </>
      ) : null}
      {error ? (
        <>
          <Text color="red.500">
            {isExplicitStatusResponse(error) ? error.title : 'Error '}
          </Text>
          {typeof error === 'object' && 'data' in error && error?.data ? (
            <Popover trigger="click" autoFocus={false}>
              {({ isOpen }) => (
                <>
                  {' '}
                  <PopoverTrigger>
                    <Link as="button" color="red.500">
                      (see more)
                    </Link>
                  </PopoverTrigger>
                  <PopoverContent w="auto" boxShadow="lg" display={!isOpen ? 'none' : undefined}>
                    <PopoverArrow />
                    <PopoverBody borderRadius="md" p="unset" overflow="clip">
                      <Box
                        overflow="auto"
                        minH="7rem"
                        maxH="30rem"
                        minW="20rem"
                        maxW="50rem"
                        w="auto"
                        p={2}
                      >
                        <chakra.pre fontSize="sm" whiteSpace="break-spaces">
                          {JSON.stringify(
                            isExplicitStatusResponse(error) ? error.data : error,
                            null,
                            2
                          )}
                        </chakra.pre>
                      </Box>
                    </PopoverBody>
                  </PopoverContent>
                </>
              )}
            </Popover>
          ) : null}
        </>
      ) : null}
    </HStack>
  );
};
