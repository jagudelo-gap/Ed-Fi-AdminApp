import {
  Badge,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Heading,
  Link,
  SimpleGrid,
  Text,
} from '@chakra-ui/react';
import { PageTemplate } from '@edanalytics/common-ui';
import { GetSessionDataDtoUtm } from '@edanalytics/models';
import { Link as RouterLink } from 'react-router';
import { LandingContent } from '../../Layout/Landing';
import { useAsId } from '../../Layout/Nav';
import { useMe } from '../../api';
import { TeamHome } from './TeamHome';
import { externalUrls } from '../../routes/pathConstants';

export const GlobalHome = () => {
  const asId = useAsId();
  const me = useMe();
  if (me.data === null) {
    return <LandingContent />;
  } else {
    if (asId === undefined) {
      return <GlobalHomeComponent />;
    } else {
      return <TeamHome />;
    }
  }
};
const GlobalHomeComponent = () => {
  const me = useMe();
  const utms = me.data?.userTeamMemberships ?? [];
  return utms.length ? (
    <PageTemplate customPageContentCard title="Your teams">
      <SimpleGrid w="fit-content" columns={3} spacing={4}>
        {utms.map((utm) => (
          <UtmCard key={utm.id} utm={utm} />
        ))}
      </SimpleGrid>
    </PageTemplate>
  ) : (
    <NoUtmCards />
  );
};

const UtmCard = ({ utm }: { utm: GetSessionDataDtoUtm }) => {
  return (
    <Card maxW="xs" variant="elevated">
      <CardHeader pb={0}>
        <Heading color="gray.600" size="md">
          {utm.team.displayName}
        </Heading>
      </CardHeader>
      <CardBody>
        <Text>
          Your role: <Badge>{utm.role?.displayName ?? '(inactive)'}</Badge>.
        </Text>
        <Text>Member since {utm.createdShort}.</Text>
      </CardBody>
      <CardFooter>
        <Link as={RouterLink} to={`/as/${utm.team.id}`} color="blue.500">
          Enter team &rarr;
        </Link>
      </CardFooter>
    </Card>
  );
};

const NoUtmCards = () => {
  const me = useMe();

  if (!me.data) {
    return null;
  }

  const cantDoAnything = me.data.role?.privilegeIds.length === 1; // just `me:read`
  const preferredName = me.data.givenName && me.data.givenName !== '' ? me.data.givenName : null;
  return (
    <>
      <Heading whiteSpace="nowrap" color="gray.700" size="page-heading" fontSize="2xl" mb="1.5rem">
        Welcome{preferredName ? ' ' + preferredName + ',' : ''}
      </Heading>
      {cantDoAnything ? (
        <Text fontSize="larger">
          It looks like we haven't set you up to be able to do much yet. If you're confused
          <br /> by that please see our{' '}
          <Link
            fontWeight="semibold"
            color="blue.500"
            target="_blank"
            href={externalUrls.startingGuide()}
          >
            help page
          </Link>{' '}
          or get in{' '}
          <Link
            fontWeight="semibold"
            color="blue.500"
            target="_blank"
            href={externalUrls.supportCommunity()}
          >
            contact
          </Link>
          .
        </Text>
      ) : (
        <Text fontSize="larger">Choose an item on the left to get started.</Text>
      )}
    </>
  );
};
