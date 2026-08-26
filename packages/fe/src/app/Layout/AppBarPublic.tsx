import { Button, HStack, Image } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router';
import logoUrl from '../../assets/ed-fi-logo-light.svg';

export const AppBarPublic = () => {
  return (
    <HStack
      zIndex={2}
      as="header"
      justify="space-between"
      w="100%"
      position="sticky"
      top="0px"
      bg="white"
      borderBottom="1px solid"
      borderColor="gray.200"
      boxShadow="md"
      py={1}
      px={3}
    >
      <RouterLink to="/">
        <Image alt="logo" h="40px" maxW="300px" objectFit="contain" src={logoUrl} />
      </RouterLink>
      <Button variant="solid" colorScheme="blue" as={RouterLink} to="/login">
        Log in
      </Button>
    </HStack>
  );
};
