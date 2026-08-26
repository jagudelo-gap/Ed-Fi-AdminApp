import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { Heading, ScaleFade, Stack, Text } from '@chakra-ui/react';
import { Attribute, PageContentCard } from './pageLayout';
import { ApiClientResponseV2, ApplicationResponseV1, ApplicationResponseV2, SecretSharingMethod } from '@edanalytics/models';

function OneTimeShareCredentials({ canReset }: { canReset?: boolean }) {
  const credentialsData: ApplicationResponseV1 | ApplicationResponseV2 | ApiClientResponseV2 | undefined = useLocation().state;
  const [url, setUrl] = useState<string | undefined>(undefined);
  const [key, setKey] = useState<string | undefined>(undefined);
  const [secret, setSecret] = useState<string | undefined>(undefined);
  const [showYopass, setShowYopass] = useState<boolean>(false);
  const [showDirect, setShowDirect] = useState<boolean>(false);

  useEffect(() => {
    if (credentialsData) {
      if (credentialsData.secretSharingMethod === SecretSharingMethod.Direct) {
        // Type guard to check for key and secret properties
        if (
          'key' in credentialsData &&
          'secret' in credentialsData &&
          credentialsData.key &&
          credentialsData.secret
        ) {
          setKey(credentialsData.key);
          setSecret(credentialsData.secret);
        }
        setTimeout(() => {
          setShowDirect(true);
        }, 500);
      } else if (credentialsData.secretSharingMethod === SecretSharingMethod.Yopass) {
        if ('link' in credentialsData && credentialsData.link) {
          const parsedUrl = new URL(credentialsData.link);
          setUrl(parsedUrl.toString());
          setTimeout(() => {
            setShowYopass(true);
          }, 500);
        }
      }
    }
  }, [credentialsData]);

  return (
    <Stack>
      {url ? (
        <ScaleFade in={showYopass} unmountOnExit>
          <PageContentCard borderColor="primary.200" bg="primary.50" mt={4}>
            <Heading mb={4} whiteSpace="nowrap" color="gray.700" size="md">
              Credentials Created
            </Heading>
            <Text fontStyle="italic">
              The link below will take you to a page where you can view the credentials. When you go
              there you will be asked to confirm whether you actually want to retrieve them, because
              that can only be done once. If you need to give the link to someone else, make sure you
              don't retrieve the credentials yourself first, or else the link will no longer work for
              them.
            </Text>
            {canReset && (
              <Text mt={4} fontStyle="italic">
                We limit the retrieval to one time only for security reasons, but note that you can
                always reset the credentials again if there's a mistake.
              </Text>
            )}
            <Attribute
              mt={8}
              p={0}
              label="Link to credentials"
              value={url.toString()}
              isCopyable
              isUrl
              isUrlExternal
            />
          </PageContentCard>
        </ScaleFade>
      ) : (key && secret) ? (
        <ScaleFade in={showDirect}>
          <PageContentCard borderColor="primary.200" bg="primary.50" mt={4}>
            <Heading mb={4} whiteSpace="nowrap" color="gray.700" size="md">
              Key and secret created
            </Heading>
            <Text fontStyle="italic">
              The key and secret below will be available here until you leave the page.
            </Text>
            <Text mt={4} fontStyle="italic">
              We limit the retrieval to one time only for security reasons, but note that you can
              always reset the credentials again if there's a mistake.
            </Text>
            <Attribute
              mt={8}
              p={0}
              label="Key"
              value={key.toString()}
              isCopyable
            />
            <Attribute
              mt={8}
              p={0}
              label="Secret"
              value={secret.toString()}
              isCopyable
              isMasked
            />
          </PageContentCard>
        </ScaleFade>
      ) : null
      }
    </Stack>
  );
}

export { OneTimeShareCredentials };
