import { Link, Text } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router';
import { useGetManyIntegrationProviders } from '../../api-v2';
import { usePaths } from '../../routes/paths';

export const IntegrationProviderLink = (props: { id: number | undefined; prefix?: string }) => {
  const integrationProviders = useGetManyIntegrationProviders({}).data;
  const paths = usePaths();

  const { id, prefix } = props;

  if (!id) {
    return (
      <Text
        title="Integration provider may have been deleted, or you lack access."
        as="i"
        color="gray.500"
      >
        can't find &#8220;{id}&#8221;
      </Text>
    );
  }

  const integrationProvider = integrationProviders?.find((p) => p.id === id);
  return (
    <Link as="span">
      <RouterLink
        title="Go to integration provider"
        to={paths.integrationProvider.view({ integrationProviderId: id })}
      >
        {prefix} {integrationProvider?.name ?? id}
      </RouterLink>
    </Link>
  );
};
