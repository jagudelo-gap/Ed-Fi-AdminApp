import 'reflect-metadata';
import { sbSyncQueuesRoute } from './sb-sync-queue.routes';
import { useIsStartingBlocksDeployment } from '../helpers';

jest.mock('@chakra-ui/react', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  Text: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
}));

jest.mock('react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  useParams: jest.fn(() => ({})),
}));

jest.mock('../Pages/SbSyncQueue/SbSyncQueuePage', () => ({ SbSyncQueuePage: () => null }));
jest.mock('../Pages/SbSyncQueue/SbSyncQueuesPage', () => ({ SbSyncQueuesPage: () => null }));

jest.mock('../api', () => ({
  sbSyncQueueQueries: { getOne: jest.fn(() => ({ queryKey: ['sb-sync-queue'] })) },
}));

jest.mock('../helpers', () => ({
  getRelationDisplayName: jest.fn(),
  useIsStartingBlocksDeployment: jest.fn(),
}));

jest.mock('../helpers/getEntityFromQuery', () => ({
  getEntityFromQuery: jest.fn(),
}));

const mockUseIsStartingBlocksDeployment = useIsStartingBlocksDeployment as jest.Mock;

describe('sbSyncQueuesRoute breadcrumb', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('keeps the SB sync queue crumb for a Starting Blocks deployment', () => {
    mockUseIsStartingBlocksDeployment.mockReturnValue(true);

    const Crumb = sbSyncQueuesRoute.handle.crumb;

    expect(Crumb()).toBe('SB sync queue');
  });

  it('uses the Ed-Fi Data Store crumb for a non-Starting-Blocks deployment', () => {
    mockUseIsStartingBlocksDeployment.mockReturnValue(false);

    const Crumb = sbSyncQueuesRoute.handle.crumb;

    expect(Crumb()).toBe('Ed-Fi Data Store Sync Queue');
  });
});
