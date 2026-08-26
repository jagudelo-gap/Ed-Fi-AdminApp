import { Link, Text } from '@chakra-ui/react';
import { GetIntegrationAppDto } from '@edanalytics/models';
import { Link as RouterLink } from 'react-router';
import { usePaths } from '../../routes/paths';

export const IntegrationAppLink = ({
  integrationApp,
}: {
  integrationApp: GetIntegrationAppDto;
}) => {
  const paths = usePaths();

  const { id: integrationAppId, applicationName, integrationProviderId } = integrationApp;
  const route = `${paths.integrationApp.view({ integrationAppId, integrationProviderId })}`;

  return integrationApp ? (
    <Link as="span">
      <RouterLink title="Go to application" to={route}>
        {applicationName}
      </RouterLink>
    </Link>
  ) : integrationAppId ? (
    <Text
      title="Integration application may have been deleted, or you lack access."
      as="i"
      color="gray.500"
    >
      can't find &#8220;{integrationAppId}&#8221;
    </Text>
  ) : null;
};
