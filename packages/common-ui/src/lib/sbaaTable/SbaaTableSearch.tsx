import {
  Button,
  ChakraComponent,
  IconButton,
  InputGroup,
  InputLeftElement,
  InputRightElement,
} from '@chakra-ui/react';
import { DebouncedInput, DivComponent, Icons, useSbaaTableContext } from '..';

export const SbaaTableSearch: DivComponent = (props) => {
  const { children: _children, ...rest } = props;
  const { table } = useSbaaTableContext();

  if (!table) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return null as any;
  }
  const { globalFilter } = table.getState();
  const { setGlobalFilter } = table;

  return (
    <InputGroup
      css={{
        '&:hover .clear-filter': {
          color: 'var(--chakra-colors-gray-800)',
          transition: '0.3s',
        },
      }}
      maxW="30em"
      {...rest}
    >
      <InputLeftElement pointerEvents="none" color="gray.300">
        <Icons.Search fontSize="1.2em" />
      </InputLeftElement>
      <DebouncedInput
        debounce={300}
        borderRadius="100em"
        paddingStart={10}
        paddingEnd={10}
        placeholder="Search"
        value={globalFilter ?? ''}
        onChange={(v) => setGlobalFilter(v)}
      />
      {globalFilter ? (
        <InputRightElement>
          <IconButton
            onClick={() => setGlobalFilter(undefined)}
            className="clear-filter"
            fontSize="xl"
            color="gray.300"
            variant="ghost"
            size="sm"
            borderRadius={'100em'}
            icon={<Icons.X />}
            aria-label="clear search"
          />
        </InputRightElement>
      ) : null}
    </InputGroup>
  );
};

export const SbaaTableAdvancedButton: ChakraComponent<'button'> = (props) => {
  const { children: _children, onClick: _onClick, ...rest } = props;
  const {
    table,
    showSettings: [showSettings, setShowSettings],
  } = useSbaaTableContext();

  if (!table) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return null as any;
  }

  return (
    <Button
      alignSelf="center"
      aria-label="show settings"
      variant="link"
      borderRadius="99em"
      size="sm"
      colorScheme="primary"
      onClick={setShowSettings.toggle}
      {...rest}
    >
      {showSettings ? 'Hide options' : 'More options'}
    </Button>
  );
};
