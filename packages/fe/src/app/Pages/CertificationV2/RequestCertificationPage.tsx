
import {
  Box,
  Button,
  ButtonGroup,
  FormControl,
  FormLabel,
  Input,
  Select,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  chakra,
} from '@chakra-ui/react';
import { PageTemplate } from '@edanalytics/common-ui';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import certificationScenarios from './certification-scenarios.json';
import { useNavToParent } from '../../helpers';
import { config } from '../../../config/config';

type CertificationScenario = {
  id: number;
  scenariosVersion?: string;
  scenariosGroup?: string;
  scenariosName?: string;
  scenarioStep?: string;
  parameters?: Array<{
    name?: string;
    description?: string;
  }>;
};

const getUniqueOptions = (values: Array<string | undefined>) =>
  Array.from(new Set(values.filter((value): value is string => Boolean(value?.trim())))).sort((a, b) =>
    a.localeCompare(b)
  );

const scenarios = certificationScenarios as CertificationScenario[];
const scenarioVersionOptions = getUniqueOptions(scenarios.map((item) => item.scenariosVersion));

export const RequestCertificationPage = () => {
  const navigate = useNavigate();
  const [keyValue, setKeyValue] = useState('');
  const [secretValue, setSecretValue] = useState('');
  const selectedScenarioVersion = scenarioVersionOptions[0] ?? '';
  const [selectedAreaOrGroup, setSelectedAreaOrGroup] = useState('');

  const areaOrGroupOptions = useMemo(
    () =>
      getUniqueOptions(
        scenarios
          .filter((item) => item.scenariosVersion === selectedScenarioVersion)
          .map((item) => item.scenariosGroup)
      ),
    [selectedScenarioVersion]
  );

  const filteredScenarios = useMemo(
    () =>
      scenarios.filter(
        (item) =>
          item.scenariosVersion === selectedScenarioVersion &&
          (selectedAreaOrGroup === '' || item.scenariosGroup === selectedAreaOrGroup)
      ),
    [selectedScenarioVersion, selectedAreaOrGroup]
  );

  const tableScenarios = useMemo(() => {
    const seen = new Set<string>();

    return filteredScenarios.reduce<Array<Omit<CertificationScenario, 'scenarioStep'>>>((acc, item) => {
      const key = `${item.scenariosGroup ?? ''}::${item.scenariosName ?? ''}`;

      if (seen.has(key)) {
        return acc;
      }

      seen.add(key);
      const { scenarioStep: _scenarioStep, ...scenarioWithoutStep } = item;
      acc.push(scenarioWithoutStep);
      return acc;
    }, []);
  }, [filteredScenarios]);

  const navToParentOptions = useNavToParent();
  const canValidateScenario = Boolean(keyValue.trim()) && Boolean(secretValue.trim());

  if (!config.showRequestCertification) {
    return null;
  }

  return (
    <PageTemplate title="Request Certification">
      <chakra.form w="full">
        <Box w="30em" maxW="100%">
          <FormControl>
            <FormLabel>Key</FormLabel>
            <Input
              placeholder="Enter key"
              value={keyValue}
              onChange={(event) => setKeyValue(event.target.value)}
            />
          </FormControl>

          <FormControl>
            <FormLabel>Secret</FormLabel>
            <Input
              placeholder="Enter secret"
              type="password"
              value={secretValue}
              onChange={(event) => setSecretValue(event.target.value)}
            />
          </FormControl>

          <FormControl>
            <FormLabel>Scenarios Version</FormLabel>
            4.0.0
          </FormControl>

          <FormControl>
            <FormLabel>Area or Group Filter</FormLabel>
            <Select
              placeholder={selectedScenarioVersion ? 'All area or group values' : 'Select version first'}
              value={selectedAreaOrGroup}
              isDisabled={!selectedScenarioVersion}
              onChange={(event) => setSelectedAreaOrGroup(event.target.value)}
            >
              {areaOrGroupOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Box
          mt={6}
          p={4}
          border="1px solid"
          borderColor="gray.200"
          borderRadius="md"
          bg="gray.50"
        >
          <Text mb={3} fontWeight="semibold">
            Scenarios
          </Text>

          <Table size="sm" mt={0}>
            <Thead>
              <Tr>
                <Th>Area or Group</Th>
                <Th>Scenario</Th>
                <Th textAlign="right">Action</Th>
              </Tr>
            </Thead>
            <Tbody>
              {tableScenarios.map((scenario) => (
                <Tr key={scenario.id}>
                  <Td>{scenario.scenariosGroup ?? 'N/A'}</Td>
                  <Td>{scenario.scenariosName ?? 'N/A'}</Td>
                  <Td textAlign="right">
                    <Button
                      size="sm"
                      colorScheme="primary"
                      type="button"
                      isDisabled={!canValidateScenario}
                      onClick={() => {
                        navigate('execution', {
                          state: {
                            scenario,
                          },
                        });
                      }}
                    >
                      Validate Scenario
                    </Button>
                  </Td>
                </Tr>
              ))}
              {tableScenarios.length === 0 && (
                <Tr>
                  <Td colSpan={3}>
                    <Text color="gray.600">No scenarios found for the current filters.</Text>
                  </Td>
                </Tr>
              )}
            </Tbody>
          </Table>
        </Box>

        <ButtonGroup mt={4} colorScheme="primary">
          <Button
            variant="ghost"
            isLoading={false}
            type="reset"
            onClick={() => {
              navigate(navToParentOptions);
            }}
          >
            Cancel
          </Button>
        </ButtonGroup>
      </chakra.form>
    </PageTemplate>
  );
};
