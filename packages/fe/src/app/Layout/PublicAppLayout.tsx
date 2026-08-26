import { Box, VStack } from '@chakra-ui/react';
import { Outlet } from 'react-router';
import { useMe } from '../api';
import { AppBar } from './AppBar';
import { AppBarPublic } from './AppBarPublic';

export const PublicAppLayout = () => {
  const me = useMe();

  return (
    <VStack spacing={0} h="100vh" overflow="hidden" align="start">
      {me.data ? <AppBar /> : <AppBarPublic />}
      <Box
        boxShadow="inner-md"
        border="1px solid"
        borderColor="gray.200"
        bg="background-bg"
        overflow="auto"
        p={3}
        minW="35em"
        h="100%"
        w="100%"
      >
        <Outlet />
      </Box>
    </VStack>
  );
};
