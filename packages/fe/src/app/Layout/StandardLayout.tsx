import { Box, Flex, HStack, Text, VStack, Link } from '@chakra-ui/react';
import { Outlet, useParams } from 'react-router';
import { useMe } from '../api';
import { NavContextProvider, useNavContext } from '../helpers';
import { AppBar } from './AppBar';
import { AppBarPublic } from './AppBarPublic';
import { Breadcrumbs } from './Breadcrumbs';
import { FeedbackBanners } from './FeedbackBanner';
import { LandingLayout, LandingLayoutRouteElement } from './LandingLayout';
import { Nav, useAsId } from './Nav';
import { externalUrls } from '../routes/pathConstants';

const LoadEdfiTenantContext = () => {
  const { edfiTenant, edfiTenantId, sbEnvironment, sbEnvironmentId } = useNavContext();
  if (edfiTenant?.id !== edfiTenantId || sbEnvironment?.id !== sbEnvironmentId) {
    return null;
  }
  return <Outlet />;
};

export const StandardLayout = () => {
  const me = useMe();
  const isLoggedIn = me.data !== undefined && me.data !== null;
  const hasRole = !!me.data?.role;
  const asId = useAsId();
  const params = useParams();

  return (
    <NavContextProvider
      asId={asId}
      edfiTenantId={'edfiTenantId' in params ? Number(params.edfiTenantId) : undefined}
      sbEnvironmentId={'sbEnvironmentId' in params ? Number(params.sbEnvironmentId) : undefined}
    >
      <VStack spacing={0} h="100vh" overflow="hidden" id="borderGlobal">
        {isLoggedIn ? <AppBar /> : <AppBarPublic />}
        <HStack
          as="main"
          w="100%"
          flex="auto 1 1"
          align="start"
          overflow="hidden"
          spacing={0}
          position="static"
        >
          {hasRole ? (
            <>
              <Nav />
              <Box
                boxShadow="inner-md"
                border="1px solid"
                borderColor="gray.200"
                borderTopLeftRadius="md"
                bg="background-bg"
                maxH="100%"
                h="100%"
                overflow="auto"
                flexGrow="1"
              >
                <Flex flexDir="column" minW="35em" h="100%">
                  <FeedbackBanners />
                  <Box p={3} display="flex" flexDir="column" flexGrow={1} px="calc(4vw + 0.5em)">
                    <Breadcrumbs mb={5} />
                    <Box flexGrow={1} pb="2em" w="fit-content" minW="100%">
                      {/* asId might be one render behind */}
                      {params.asId && Number(params.asId) !== asId ? null : (
                        <LoadEdfiTenantContext />
                      )}
                    </Box>
                    <Box fontSize="sm" color="gray.600" textAlign="center">
                      ©2023-{new Date().getFullYear()}, Education Analytics, Inc., Ed-Fi Alliance, LLC. All rights reserved.
                      <br />
                      Distributed under the Apache License, version 2.
                      <br />
                      <Link href={externalUrls.supportCommunity()} target="_blank" rel="noopener noreferrer">
                      Report an issue
                      </Link>
                    </Box>
                  </Box>
                </Flex>
              </Box>
            </>
          ) : isLoggedIn ? (
            <LandingLayout>
              <Text
                p="1em"
                fontSize="2xl"
                fontWeight={500}
                color="gray.700"
                textAlign="center"
                maxW="30em"
              >
                We found you in our database, but you don't have a role assigned yet.
              </Text>
            </LandingLayout>
          ) : me.isPending ? null : (
            <LandingLayoutRouteElement />
          )}
        </HStack>
      </VStack>
    </NavContextProvider>
  );
};
