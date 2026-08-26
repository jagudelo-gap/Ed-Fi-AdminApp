import 'reflect-metadata';
import { SbSyncQueuesPage } from './SbSyncQueuesPage';
import { useIsStartingBlocksDeployment } from '../../helpers';

jest.mock('@chakra-ui/react', () => ({
  Badge: () => null,
  Box: ({ children }: { children: React.ReactNode }) => children,
  HStack: ({ children }: { children: React.ReactNode }) => children,
  Popover: () => null,
  PopoverArrow: () => null,
  PopoverBody: () => null,
  PopoverContent: () => null,
  PopoverTrigger: () => null,
  Text: () => null,
  chakra: { pre: () => null },
}));

jest.mock('@edanalytics/common-ui', () => ({
  DateFormat: { Long: 'Long' },
  PageTemplate: ({ children }: { children: React.ReactNode }) => children,
  SbaaTable: () => null,
  SbaaTableAdvancedButton: () => null,
  SbaaTableFilters: () => null,
  SbaaTablePagination: () => null,
  SbaaTableProviderServerSide: ({ children }: { children: React.ReactNode }) => children,
  TableRowActions: () => null,
  ValueAsDate: jest.fn(() => () => null),
  getColumnFilterParam: jest.fn(() => []),
  getPaginationParams: jest.fn(() => ({})),
  getPrefixedName: jest.fn((name: string) => name),
  getSortParams: jest.fn(() => []),
  stringifyColumnFilters: jest.fn(() => ''),
}));

jest.mock('@tanstack/react-query', () => ({
  keepPreviousData: 'keepPreviousData',
  useQuery: jest.fn(() => ({ data: undefined })),
}));

jest.mock('react-router', () => ({
  useSearchParams: jest.fn(() => [new URLSearchParams()]),
}));

jest.mock('../../api', () => ({
  methods: { getOne: jest.fn() },
  queryKey: jest.fn(() => []),
}));

jest.mock('../../routes', () => ({
  SbSyncQueueLink: () => null,
}));

jest.mock('./useSbSyncQueueActions', () => ({
  useSbSyncQueueActions: jest.fn(() => ({})),
}));

jest.mock('../../helpers', () => ({
  useIsStartingBlocksDeployment: jest.fn(),
}));

const mockUseIsStartingBlocksDeployment = useIsStartingBlocksDeployment as jest.Mock;

describe('SbSyncQueuesPage', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('keeps the Starting Blocks title for a Starting Blocks deployment', () => {
    mockUseIsStartingBlocksDeployment.mockReturnValue(true);

    const page = SbSyncQueuesPage() as React.ReactElement;

    expect(page.props.title).toBe('Starting Blocks sync queue');
  });

  it('uses the Ed-Fi Data Store title for a non-Starting-Blocks deployment', () => {
    mockUseIsStartingBlocksDeployment.mockReturnValue(false);

    const page = SbSyncQueuesPage() as React.ReactElement;

    expect(page.props.title).toBe('Ed-Fi Data Store Sync Queue');
  });
});
