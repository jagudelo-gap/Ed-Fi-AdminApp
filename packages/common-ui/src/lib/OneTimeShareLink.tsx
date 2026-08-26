import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { Heading, ScaleFade, Text } from '@chakra-ui/react';
import { Attribute, PageContentCard } from './pageLayout';

function OneTimeShareLink({ canReset }: { canReset?: boolean }) {
  const credsLink: unknown = useLocation().state;
  const [url, setUrl] = useState<string | undefined>(undefined);
  const [showUrl, setShowUrl] = useState<boolean>(false);

  useEffect(() => {
    if (typeof credsLink === 'string') {
      try {
        // Check it's a valid URL
        const parsedUrl = new URL(credsLink);
        // Clears state so the link doesn't show again on refresh or back nav
        window.history.replaceState({}, '');
        setUrl(parsedUrl.toString());
        // Delay for extra visibility
        setTimeout(() => setShowUrl(true), 500);
      } catch (error) {
        // TODO: should we display this error instead of returning null for the component?
        // Ignore URL errors
        console.log(error);
      }
    }
  }, [credsLink]);

  // Should errors be displayed here?
  if (!url) return null;

  return (
    <ScaleFade in={showUrl} unmountOnExit>
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
  );
}

export { OneTimeShareLink };
