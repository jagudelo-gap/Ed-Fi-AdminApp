import { ButtonGroup, Button } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import {config} from '../../../typings/config';

export const LandingContent = () => (
  <ButtonGroup size="lg" gap={10}>
    <Button
      autoFocus
      w="8em"
      fontSize="xl"
      variant="solid"
      colorScheme="blue"
      as={RouterLink}
      to="/login"
    >
      Log in
    </Button>
    <Button
      fontSize="xl"
      w="8em"
      variant="outline"
      colorScheme="blue"
      as={RouterLink}
      to={config.helpGuide || "https://docs.ed-fi.org/reference/admin-app-v4/"}
    >
      Learn more
    </Button>
  </ButtonGroup>
);
