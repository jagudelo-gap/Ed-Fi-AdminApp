import 'reflect-metadata';
import { OdssTable } from './OdssPage';
import { instancesV2, odsQueries } from '../../api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthorize, useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';
import { GetOdsDto } from '@edanalytics/models';

jest.mock('@edanalytics/common-ui', () => ({
  Icons: { View: 'ViewIcon', Delete: 'DeleteIcon' },
  PageTemplate: ({ children }: { children: React.ReactNode }) => children,
  PageActions: () => null,
  SbaaTableAllInOne: jest.fn(() => null),
  TableRowActions: () => null,
}));

jest.mock('@chakra-ui/react', () => ({
  Badge: () => null,
  HStack: ({ children }: { children: React.ReactNode }) => children,
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('react-router', () => ({
  Link: () => null,
  useNavigate: jest.fn(),
}));

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
  useQueryClient: jest.fn(),
}));

jest.mock('../../helpers', () => ({
  useTeamEdfiTenantNavContextLoaded: jest.fn(),
  useAuthorize: jest.fn(),
  teamEdfiTenantAuthConfig: jest.fn((id, edfiTenantId, teamId, privilege) => ({
    privilege,
    subject: { id, edfiTenantId, teamId },
  })),
}));

jest.mock('../../api', () => ({
  odsQueries: {
    getAll: jest.fn(),
    delete: jest.fn(),
    getOne: jest.fn(() => ({ queryKey: ['ods-detail-key'] })),
  },
  instancesV2: { delete: jest.fn() },
}));

jest.mock('../../Layout/FeedbackBanner', () => ({
  usePopBanner: jest.fn(),
}));

jest.mock('../../helpers/mutationErrCallback', () => ({
  mutationErrCallback: jest.fn(() => ({})),
}));

const mockUseQuery = useQuery as jest.Mock;
const mockUseQueryClient = useQueryClient as jest.Mock;
const mockOdsGetAll = odsQueries.getAll as jest.Mock;
const mockOdsDelete = odsQueries.delete as jest.Mock;
const mockUseAuthorize = useAuthorize as jest.Mock;
const mockUseTeamEdfiTenantNavContextLoaded = useTeamEdfiTenantNavContextLoaded as jest.Mock;
const mockInstancesDelete = instancesV2.delete as jest.Mock;
const mockUsePopBanner = usePopBanner as jest.Mock;
const mockMutationErrCallback = mutationErrCallback as jest.Mock;

describe('OdssTable', () => {
  const odsMutateAsync = jest.fn();
  const instancesMutateAsync = jest.fn();
  const popBannerSpy = jest.fn();
  const mutationOptions = { onError: jest.fn() };

  const getDeleteAction = () => {
    const tableProps = (OdssTable() as React.ReactElement).props;
    const row = tableProps.data[0];
    const nameColumn = tableProps.columns.find((column: { accessorKey: string }) => column.accessorKey === 'displayName');
    const cell = nameColumn.cell({ row: { original: row } });
    const actionElement = (cell.props.children as React.ReactElement[])[1];
    return actionElement.props.actions.Delete;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTeamEdfiTenantNavContextLoaded.mockReturnValue({
      teamId: 1,
      edfiTenant: { id: 3, sbEnvironmentId: 2 },
      sbEnvironment: { startingBlocks: false },
    });
    mockUsePopBanner.mockReturnValue(popBannerSpy);
    mockMutationErrCallback.mockReturnValue(mutationOptions);
    mockUseAuthorize.mockReturnValue(true);
    mockOdsGetAll.mockReturnValue({ queryKey: ['odss'], queryFn: jest.fn() });
    mockOdsDelete.mockReturnValue({ mutateAsync: odsMutateAsync });
    mockUseQuery.mockReturnValue({
      data: {
        5: {
          id: 5,
          displayName: 'ODS 5',
          instanceManageId: 88,
          instanceType: 'Shared',
          status: 'Created',
        },
      },
    });
    mockInstancesDelete.mockReturnValue({ mutateAsync: instancesMutateAsync });
    mockUseQueryClient.mockReturnValue({ setQueryData: jest.fn() });
  });

  it('disables cache reuse on the ODS list query', () => {
    OdssTable();

    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        gcTime: 0,
        staleTime: 0,
      })
    );
  });

  it('sorts ODS rows by name ascending by default', () => {
    mockUseQuery.mockReturnValue({
      data: {
        2: {
          id: 2,
          displayName: 'Alpha',
          instanceManageId: 2,
          instanceType: 'Shared',
          status: 'Created',
        },
        1: {
          id: 1,
          displayName: 'zebra',
          instanceManageId: 1,
          instanceType: 'Shared',
          status: 'Created',
        },
      },
    });

    const tableProps = (OdssTable() as React.ReactElement).props;

    expect(tableProps.data.map((row: { displayName: string }) => row.displayName)).toEqual([
      'Alpha',
      'zebra',
    ]);
  });

  it('shows row Delete action only for non-startingBlocks ODS rows with instanceManageId > 0', () => {
    mockUseQuery.mockReturnValue({
      data: {
        9: {
          id: 9,
          displayName: 'ODS 9',
          instanceManageId: null,
          instanceType: 'Shared',
          status: 'Created',
        },
      },
    });

    const deleteAction = getDeleteAction();

    expect(deleteAction).toBeUndefined();
  });

  it('hides row Delete action for non-startingBlocks ODS rows unless status is Created', () => {
    mockUseQuery.mockReturnValue({
      data: {
        11: {
          id: 11,
          displayName: 'ODS 11',
          instanceManageId: 55,
          instanceType: 'Shared',
          status: 'PendingDelete',
        },
      },
    });

    const deleteAction = getDeleteAction();

    expect(deleteAction).toBeUndefined();
  });

  it('routes non-startingBlocks row Delete action to instances delete using instanceManageId', () => {
    const deleteAction = getDeleteAction();
    deleteAction.onClick();

    expect(instancesMutateAsync).toHaveBeenCalledWith(
      { id: 88 },
      mutationOptions
    );
    expect(odsMutateAsync).not.toHaveBeenCalled();
  });

  it('hides row Delete action when delete authorization is denied', () => {
    mockUseAuthorize.mockReturnValue(false);

    const deleteAction = getDeleteAction();

    expect(deleteAction).toBeUndefined();
  });

  it('keeps startingBlocks row Delete action routed to ods delete by ods.id', () => {
    mockUseTeamEdfiTenantNavContextLoaded.mockReturnValue({
      teamId: 1,
      edfiTenant: { id: 3, sbEnvironmentId: 2 },
      sbEnvironment: { startingBlocks: true },
    });
    mockUseQuery.mockReturnValue({
      data: {
        6: {
          id: 6,
          displayName: 'ODS 6',
          instanceManageId: null,
          instanceType: 'Shared',
          status: null,
        },
      },
    });

    const deleteAction = getDeleteAction();
    deleteAction.onClick();

    expect(odsMutateAsync).toHaveBeenCalledWith({ id: 6 }, mutationOptions);
    expect(instancesMutateAsync).not.toHaveBeenCalled();
  });

  it('immediately sets status to PendingDelete in query cache on non-startingBlocks row delete', () => {
    const setQueryDataSpy = jest.fn();
    mockUseQueryClient.mockReturnValue({ setQueryData: setQueryDataSpy });
    mockOdsGetAll.mockReturnValue({ queryKey: ['odss-list-key'], queryFn: jest.fn() });

    const deleteAction = getDeleteAction();
    deleteAction.onClick();

    expect(setQueryDataSpy).toHaveBeenCalledWith(['odss-list-key'], expect.any(Function));
    const updateList = setQueryDataSpy.mock.calls[0][1] as (arg: Record<number, GetOdsDto>) => Record<number, GetOdsDto>;
    const cachedList = {
      5: Object.assign(new GetOdsDto(), {
        id: 5,
        dbName: 'ods-5',
        odsInstanceName: 'ODS 5',
        status: 'Created',
      }),
    } as Record<number, GetOdsDto>;

    const updatedList = updateList(cachedList);

    expect(updatedList[5]).toBeInstanceOf(GetOdsDto);
    expect(updatedList[5].displayName).toBe('ODS 5');
    expect(updatedList[5].status).toBe('PendingDelete');
  });
});
