import { Box, Divider, Image, Link, VStack } from '@chakra-ui/react';
import { ReactNode } from 'react';
import { Outlet } from 'react-router';
import logoUrl from '../../assets/ed-fi-logo-light.svg';
import bgUrl from '../../assets/starting-blocks-no-text.svg';
import { externalUrls } from '../routes/pathConstants';

export const LandingLayoutRouteElement = () => (
  <LandingLayout>
    <Outlet />
  </LandingLayout>
);

export const LandingLayout = (props: { children: ReactNode }) => {
  return (
    <VStack
      css={{
        '&::before': {
          content: '""',
          position: 'absolute',
          filter: 'saturate(0)',
          top: '0',
          left: '0',
          width: '100%',
          height: '100%',
          opacity: '0.1',
          background: `url(${bgUrl})`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: 'cover',
          zIndex: '-1',
        },
      }}
      gap={14}
      p="3em"
      justify="flex-end"
      flex="1 1 100%"
      h="100%"
    >
      <Image
        maxW={{ base: "90%", md: "500px", lg: "600px", xl: "700px" }}
        h="auto"
        filter={'drop-shadow(13px 13px 15px rgba(0,0,0,0.15))'}
        objectFit="contain"
        src={logoUrl}
      />
      <Divider borderColor="gray.500" w="40%" />
      <Box flex="0.6 1 0%">{props.children}</Box>
      <Box fontSize="sm" color="gray.600" textAlign="center">
        ©2023-{new Date().getFullYear()}, Education Analytics, Inc., Ed-Fi Alliance, LLC. All rights reserved.
        <br />
        Distributed under the Apache License, version 2.
        <br />
        <Link href={externalUrls.supportCommunity()} target="_blank" rel="noopener noreferrer">
          Report an issue
        </Link>
      </Box>
    </VStack>
  );
};
