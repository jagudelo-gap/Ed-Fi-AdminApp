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
import { ImportClaimsetSingleDtoV2 } from '@edanalytics/models';
import { StatusResponse, isExplicitStatusResponse } from '@edanalytics/utils';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router';
import { claimsetQueriesV2 } from '../../api';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lowercaseFirstLetterOfKeys(input: any): any {
  if (typeof input !== 'object' || input === null) {
    return input;
  }

  if (Array.isArray(input)) {
    return input.map(lowercaseFirstLetterOfKeys);
  }

  return Object.keys(input).reduce((acc, key) => {
    const newKey = key.charAt(0).toLowerCase() + key.slice(1);
    acc[newKey] = lowercaseFirstLetterOfKeys(input[key]);
    return acc;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }, {} as { [key: string]: any });
}

export const ImportClaimsetsPageV2 = () => {
  const [claimsets, setClaimsets] = useState<(ImportClaimsetSingleDtoV2 | unknown)[]>([]);
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
            try {
              const file = e.target.files?.[0];
              try {
                const content = JSON.parse((await file?.text())!);
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
            } catch {
              setError('No file selected');
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
                <ClaimsetItem maybeClaimset={claimset} />
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

const ClaimsetItem = ({
  maybeClaimset,
}: {
  maybeClaimset: ImportClaimsetSingleDtoV2 | unknown;
}) => {
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const importClaimset = claimsetQueriesV2.import({
    edfiTenant,
    teamId,
  });

  const [error, setError] = useState<StatusResponse | object | undefined>(undefined);
  const [claimset, setClaimset] = useState<ImportClaimsetSingleDtoV2 | undefined>(undefined);
  useEffect(() => {
    try {
      if (Array.isArray(maybeClaimset)) {
        setError({
          title: 'Expected object, got array',
          type: 'Error',
          data: maybeClaimset,
        });
      } else {
        const claimset = plainToInstance(
          ImportClaimsetSingleDtoV2,
          lowercaseFirstLetterOfKeys(maybeClaimset)
        );
        validate(claimset).then((errors) => {
          if (errors.length > 0) {
            setError({
              title: 'Claimset validation failed',
              type: 'Error',
              data: errors,
            });
          }
          setClaimset(claimset);
          setError(undefined);
          return;
        });
        setClaimset(claimset);
      }
    } catch (err) {
      setError({
        title: 'Unable to parse claimset',
        type: 'Error',
        data: err,
      });
    }
  }, [maybeClaimset]);
  return (
    <HStack>
      {claimset ? (
        <>
          <Text>{claimset.name}</Text>{' '}
          <Button
            isDisabled={importClaimset.isSuccess}
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
          <Text as="button" color="red.500">
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
