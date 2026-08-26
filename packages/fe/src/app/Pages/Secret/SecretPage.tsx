import {
  Box,
  Heading,
  Text,
  VStack,
  chakra,
  useBoolean,
} from '@chakra-ui/react';
import type { SystemStyleObject } from '@chakra-ui/system';
import { ConfirmAction, SecretValue } from '@edanalytics/common-ui';
import { useState } from 'react';
import { useLocation } from 'react-router';
import { getMessage } from './yopass';
import { UnretrievableError } from './UnretrievableError';
import { getFieldsFromSearchParams } from './getFieldsFromSearchParams';
import { getSecretJson } from './getSecretJson';

const placeholder = `
KEY:
123abc123abc

SECRET:
123abc123abc123abc123abc

URL:
https://placeholder-url.edanalytics.org/
`.trim();

const outerBoxCss = {
  css: { cursor: 'pointer' },
  _hover: { background: 'gray.50' },
};
const placeholderCss: SystemStyleObject = {
  userSelect: 'none',
  opacity: '0.7',
  filter: 'blur(0.5rem)',
};

const SecretPage = () => {
  const { search, hash } = useLocation();
  const [_hashMark, uuid, key] = hash.split('/');
  const [secret, setSecret] = useState<string | null>(null);

  const fields = getFieldsFromSearchParams(search);
  const secretJson = getSecretJson(secret, fields);
  const [isUnretrievable, setIsUnretrievable] = useBoolean(false);

  return (
    <VStack p={10} bg="background-bg">
      <Box w="100%" maxW="50em">
        <Heading mb={4} fontSize="xl">
          Retrieve credentials
        </Heading>
        <ConfirmAction
          headerText="Retrieve now?"
          bodyText="The link will only work once. After that, the credentials are deleted and you will have to reset them in order to get another link. This is for extra security."
          yesButtonText="Yes, retrieve them."
          noButtonText="No, not right now."
          isDisabled={!!secret || isUnretrievable}
          action={async () => {
            if (uuid && key && !secret) {
              try {
                const secret = await getMessage(uuid, key);
                setSecret(secret.data.toString());
              } catch (error) {
                if (error === 404) {
                  setIsUnretrievable.on();
                }
              }
            }
          }}
        >
          {(confirmRenderProps) => (
            <Box
              {...confirmRenderProps}
              p={5}
              minH="15em"
              borderRadius="md"
              border="1px"
              borderColor="gray.200"
              boxShadow="lg"
              bg="foreground-bg"
              {...(secret ? {} : outerBoxCss)}
              pos="relative"
            >
              {secret ? null : (
                <Box pos="absolute" left="50%" top="50%">
                  <Text
                    fontWeight="medium"
                    fontSize="lg"
                    w="auto"
                    textAlign="center"
                    transform="translate(-50%, -50%)"
                  >
                    Click to retrieve credentials
                  </Text>
                </Box>
              )}
              {isUnretrievable ? (
                <UnretrievableError />
              ) : secret && secretJson ? (
                <SecretValue value={secretJson} fields={fields} />
              ) : (
                <chakra.pre fontSize="lg" sx={secret ? {} : placeholderCss}>
                  {secret ? secret : placeholder}
                </chakra.pre>
              )}
            </Box>
          )}
        </ConfirmAction>
      </Box>
    </VStack>
  );
};

export default SecretPage;
