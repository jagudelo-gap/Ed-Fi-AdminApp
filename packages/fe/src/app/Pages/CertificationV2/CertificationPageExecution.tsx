import {
  Box,
  Button,
  ButtonGroup,
  FormControl,
  FormLabel,
  HStack,
  Input,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Text,
  Tr,
  chakra,
} from '@chakra-ui/react';
import { PageTemplate } from '@edanalytics/common-ui';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import certificationScenarios from './certification-scenarios.json';
import { useNavToParent } from '../../helpers';
import { config } from '../../../config/config';

type CertificationParameter = {
  name?: string;
  description?: string;
};

type CertificationScenario = {
  id: number;
  scenariosVersion?: string;
  scenariosGroup?: string;
  scenariosName?: string;
  scenarioStep?: string;
  parameters?: CertificationParameter[];
};

type CertificationExecutionLocationState = {
  scenario?: CertificationScenario;
};

type ValidationErrorResult = {
  property: string;
  validation: string;
  error: string;
};

type ExecutionResult = {
  scenarioStep: string;
  lastModifiedDate: string;
  isValid: boolean;
  successful: number;
  errors: number;
  'validation-errors': ValidationErrorResult[];
};

type RowExecutionStatus = 'Not executed' | 'Successful' | 'Failed';

export const CertificationPageExecution = () => {
  const navigate = useNavigate();
  const navToParentOptions = useNavToParent();
  const location = useLocation();
  const selectedScenario = (location.state as CertificationExecutionLocationState | null)?.scenario;
  const scenarios = certificationScenarios as CertificationScenario[];

  useEffect(() => {
    if (!selectedScenario) {
      navigate(navToParentOptions, { replace: true });
    }
  }, [selectedScenario, navigate, navToParentOptions]);

  const scenarioRows = useMemo(
    () =>
      scenarios.filter(
        (item) =>
          item.scenariosVersion === selectedScenario?.scenariosVersion &&
          item.scenariosGroup === selectedScenario?.scenariosGroup &&
          item.scenariosName === selectedScenario?.scenariosName
      ),
    [scenarios, selectedScenario]
  );

  const [validatedScenario, setValidatedScenario] = useState<CertificationScenario | null>(null);

  const parameterDefinitions = useMemo(
    () =>
      (validatedScenario?.parameters ?? []).filter(
        (parameter): parameter is CertificationParameter & { name: string } =>
          Boolean(parameter.name?.trim())
      ),
    [validatedScenario]
  );

  const [parameterValues, setParameterValues] = useState<Record<string, string>>({});
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [nextExecutionIsSuccess, setNextExecutionIsSuccess] = useState(true);
  const [rowExecutionStatusById, setRowExecutionStatusById] = useState<
    Record<number, RowExecutionStatus>
  >({});

  useEffect(() => {
    setRowExecutionStatusById((prev) => {
      let hasChanges = false;
      const next = { ...prev };

      scenarioRows.forEach((row) => {
        if (next[row.id] === undefined) {
          next[row.id] = 'Not executed';
          hasChanges = true;
        }
      });

      return hasChanges ? next : prev;
    });
  }, [scenarioRows]);

  useEffect(() => {
    if (!validatedScenario) {
      setParameterValues({});
      return;
    }

    const initialValues = parameterDefinitions.reduce<Record<string, string>>((acc, parameter) => {
      acc[parameter.name] = '';
      return acc;
    }, {});

    setParameterValues(initialValues);
  }, [validatedScenario, parameterDefinitions]);

  if (!config.showRequestCertification) {
    return null;
  }

  if (!selectedScenario) {
    return null;
  }

  const canExecuteScenario = parameterDefinitions.every((parameter) =>
    Boolean(parameterValues[parameter.name]?.trim())
  );

  const formattedLastExecution = (() => {
    if (!executionResult) {
      return '';
    }

    const executionDate = new Date(executionResult.lastModifiedDate);
    if (Number.isNaN(executionDate.getTime())) {
      return executionResult.lastModifiedDate;
    }

    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(executionDate);
  })();

  return (
    <PageTemplate title="Certification">
      <chakra.form w="full">
        <Box w="full">
          <Box
            mb={4}
            p={4}
            border="1px solid"
            borderColor="blue.200"
            bg="blue.50"
            borderRadius="md"
            borderLeftWidth="6px"
            borderLeftColor="blue.500"
          >
            <HStack spacing={8} alignItems="flex-start" flexWrap="wrap">
              <Box>
                <Text fontSize="xs" color="gray.600" textTransform="uppercase" letterSpacing="wide">
                  Group or Area
                </Text>
                <Text fontSize="lg" fontWeight="bold" color="blue.800">
                  {selectedScenario.scenariosGroup ?? 'N/A'}
                </Text>
              </Box>
              <Box>
                <Text fontSize="xs" color="gray.600" textTransform="uppercase" letterSpacing="wide">
                  Scenario
                </Text>
                <Text fontSize="lg" fontWeight="bold" color="blue.800">
                  {selectedScenario.scenariosName ?? 'N/A'}
                </Text>
              </Box>
            </HStack>
          </Box>

          <Table size="sm" mb={6}>
            <Thead>
              <Tr>
                <Th>Step</Th>
                <Th>Status</Th>
                <Th>Action</Th>
              </Tr>
            </Thead>
            <Tbody>
              {scenarioRows.map((row) => (
                <Tr key={row.id}>
                  <Td>{row.scenarioStep ?? 'N/A'}</Td>
                  <Td>
                    {(() => {
                      const status = rowExecutionStatusById[row.id] ?? 'Not executed';
                      const statusColor =
                        status === 'Successful'
                          ? 'green.600'
                          : status === 'Failed'
                            ? 'red.600'
                            : 'gray.600';
                      const dotColor =
                        status === 'Successful'
                          ? 'green.500'
                          : status === 'Failed'
                            ? 'red.500'
                            : 'gray.400';

                      return (
                        <HStack spacing={2}>
                          <Box w="8px" h="8px" borderRadius="full" bg={dotColor} />
                          <Text color={statusColor} fontWeight={status === 'Not executed' ? 'normal' : 'medium'}>
                            {status}
                          </Text>
                        </HStack>
                      );
                    })()}
                  </Td>
                  <Td>
                    <Button
                      size="sm"
                      colorScheme="primary"
                      type="button"
                      onClick={() => {
                        setValidatedScenario(row);
                        setExecutionResult(null);
                      }}
                    >
                      Validate
                    </Button>
                  </Td>
                </Tr>
              ))}
              {scenarioRows.length === 0 && (
                <Tr>
                  <Td colSpan={3}>
                    <Text color="gray.600">No scenarios found for the selected filters.</Text>
                  </Td>
                </Tr>
              )}
            </Tbody>
          </Table>

          {validatedScenario && (
            <Box
              w="full"
              maxW="42em"
              mt={6}
              p={5}
              border="1px solid"
              borderColor="gray.200"
              borderRadius="md"
              bg="gray.50"
            >
              <Box
                mb={4}
                p={3}
                border="1px solid"
                borderColor="orange.200"
                bg="orange.50"
                borderRadius="md"
              >
                <Text fontSize="md" fontWeight="semibold" color="orange.800" mb={1}>
                  Enter Validation Parameters
                </Text>
                <Text fontSize="sm" color="orange.900">
                  Complete the fields below, then click Execute Scenario to run validation for the selected step.
                </Text>
              </Box>

              {parameterDefinitions.map((parameter) => (
                <FormControl key={parameter.name} mb={4}>
                  <FormLabel>{parameter.description?.trim() || parameter.name}</FormLabel>
                  <Input
                    placeholder={`Enter ${parameter.name}`}
                    value={parameterValues[parameter.name] ?? ''}
                    onChange={(event) => {
                      setParameterValues((prev) => ({
                        ...prev,
                        [parameter.name]: event.target.value,
                      }));
                    }}
                  />
                </FormControl>
              ))}

              <Button
                colorScheme="primary"
                type="button"
                isDisabled={!canExecuteScenario}
                onClick={() => {
                  const hasErrors = !nextExecutionIsSuccess;

                  setExecutionResult({
                    scenarioStep: validatedScenario.scenarioStep ?? '',
                    lastModifiedDate: new Date().toISOString(),
                    isValid: !hasErrors,
                    successful: 15,
                    errors: hasErrors ? 2 : 0,
                    'validation-errors': hasErrors
                      ? [
                          {
                            property: 'alternateDayName',
                            validation: 'isString',
                            error: 'expected undefined to be a string',
                          },
                          {
                            property: 'alternateDayName',
                            validation: 'isNotEmpty',
                            error: '.empty was passed non-string primitive undefined',
                          },
                        ]
                      : [],
                  });

                  setRowExecutionStatusById((prev) => ({
                    ...prev,
                    [validatedScenario.id]: hasErrors ? 'Failed' : 'Successful',
                  }));

                  setNextExecutionIsSuccess((prev) => !prev);
                }}
              >
                Execute Scenario
              </Button>
            </Box>
          )}

          {!validatedScenario && (
            <Text color="gray.600" mb={2}>
              Select Validate on a row to load its dynamic parameters.
            </Text>
          )}

          <ButtonGroup mt={4} colorScheme="primary">
            <Button
              variant="ghost"
              type="button"
              onClick={() => {
                navigate(navToParentOptions);
              }}
            >
              Back
            </Button>
          </ButtonGroup>
        </Box>
      </chakra.form>

      <Box mt={8} w="30em" borderTop="1px solid" borderColor="gray.200" pt={6}>
        <HStack mb={3} justify="space-between" alignItems="center">
          <Text fontWeight="semibold">Execution result</Text>
          {executionResult ? (
            <HStack spacing={2}>
              <Box
                w="10px"
                h="10px"
                borderRadius="full"
                bg={executionResult.isValid ? 'green.500' : 'red.500'}
              />
              <Text
                fontSize="sm"
                fontWeight="medium"
                color={executionResult.isValid ? 'green.600' : 'red.600'}
              >
                {executionResult.isValid ? 'Successful' : 'Errors found'}
              </Text>
            </HStack>
          ) : (
            <Text fontSize="sm" color="gray.500">
              Not executed
            </Text>
          )}
        </HStack>

        {executionResult && (
          <>
            <Text mb={1}>Last execution: {formattedLastExecution}</Text>
            
            {executionResult.errors > 0 && executionResult['validation-errors'].length > 0 && (
              <>
                <Text mb={3}>Errors: {executionResult.errors}</Text>
                <Text mb={2} fontWeight="medium">
                  Validation errors:
                </Text>
                {executionResult['validation-errors'].map((item, index) => (
                  <Box
                    key={`${item.property}-${item.validation}-${index}`}
                    mb={3}
                    p={3}
                    border="1px solid"
                    borderColor="red.200"
                    bg="red.50"
                    borderLeftWidth="4px"
                    borderLeftColor="red.500"
                    borderRadius="md"
                  >
                    <HStack mb={2} spacing={2}>
                      <Box w="8px" h="8px" borderRadius="full" bg="red.500" />
                      <Text fontSize="sm" fontWeight="semibold" color="red.700">
                        Error
                      </Text>
                    </HStack>
                    <Text mb={1}>Property: {item.property}</Text>
                    <Text mb={1}>Validation: {item.validation}</Text>
                    <Text>Error: {item.error}</Text>
                  </Box>
                ))}
              </>
            )}
          </>
        )}
        {executionResult === null && (
          <Text color="gray.600">Run the scenario to see the simulated response.</Text>
        )}
      </Box>
    </PageTemplate>
  );
};
