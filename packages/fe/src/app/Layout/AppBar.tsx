import {
  Avatar,
  Button,
  HStack,
  IconButton,
  Image,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Text,
} from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router';
import logoUrl from '../../assets/ed-fi-logo-light.svg';
import { apiClient, useMe, useMyTeams } from '../api';
import { useAsId } from './Nav';
import { externalUrls } from '../routes/pathConstants';
import { Icons } from '@edanalytics/common-ui';

export const AppBar = () => {
  const me = useMe();

  const asId = useAsId();
  const teams = useMyTeams();
  const team = asId === undefined ? undefined : teams.data?.[asId];

  return (
    <HStack
      zIndex={2}
      as="header"
      justify="space-between"
      w="100%"
      position="sticky"
      top="0px"
      bg="foreground-bg"
      py={1}
      px={3}
    >
      <HStack>
        <RouterLink to={asId ? `/as/${asId}` : '/'}>
          <Image alt="logo" h="40px" maxW="300px" objectFit="contain" src={logoUrl} />
        </RouterLink>
        <Text
          lineHeight="1.3"
          borderLeft="1px solid"
          borderColor="gray.300"
          ml="0.9ch"
          pl="1.5ch"
          fontWeight={600}
          fontSize="lg"
          color="gray.600"
        >
          {team?.displayName ?? 'Global scope'}
        </Text>
      </HStack>
      <HStack>
        <IconButton
          href={externalUrls.helpGuide()}
          as="a"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Help"
          icon={<Icons.HelpLink fontSize="lg" />}
          borderRadius="99em"
          variant="ghost"
          size="sm"
          title="Help guide"
        />
        <Menu>
          <MenuButton as={Button} variant="unstyled">
            <HStack spacing={0}>
              <Avatar name={me.data?.fullName} size="sm" />
              <Icons.OpenProfileMenu />
            </HStack>
          </MenuButton>
          <MenuList>
            <MenuItem
              onClick={() => {
                // This ensures proper logout from both AdminApp and the identity provider, then redirects to login page
                window.location.href = `${apiClient.defaults.baseURL}/auth/logout`;
              }}
            >
              Sign out
            </MenuItem>
            {me.data?.role ? (
              <MenuItem to="/account" as={RouterLink}>
                My profile
              </MenuItem>
            ) : null}
            <MenuItem
              href={externalUrls.supportCommunity()}
              as="a"
              target="_blank"
              rel="noopener noreferrer"
            >
              Report an issue
            </MenuItem>
            <MenuItem
              href={externalUrls.helpGuide()}
              as="a"
              target="_blank"
              rel="noopener noreferrer"
            >
              Help guide
            </MenuItem>
          </MenuList>
        </Menu>
      </HStack>
    </HStack>
  );
};
