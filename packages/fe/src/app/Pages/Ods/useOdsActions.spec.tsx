import 'reflect-metadata';
import { useOdsActions } from './useOdsActions';
import { ActionProps, ActionsType } from '@edanalytics/common-ui';
import { useNavigate, useParams } from 'react-router';
import { useAuthorize, useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { instancesV2, odsQueries } from '../../api';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';
import { useQueryClient } from '@tanstack/react-query';
import { GetOdsDto } from '@edanalytics/models';

jest.mock('react-router', () => ({
  useNavigate: jest.fn(),
  useParams: jest.fn(),
}));

jest.mock('@tanstack/react-query', () => ({
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

jest.mock('../../Layout/FeedbackBanner', () => ({
  usePopBanner: jest.fn(),
}));

jest.mock('../../helpers/mutationErrCallback', () => ({
  mutationErrCallback: jest.fn(() => ({})),
}));

jest.mock('../../api', () => ({
  odsQueries: {
    delete: jest.fn(),
    getAll: jest.fn(() => ({ queryKey: ['odss-list-key'] })),
    getOne: jest.fn(() => ({ queryKey: ['odss-detail-key'] })),
  },
  instancesV2: { delete: jest.fn() },
}));

const mockUseNavigate = useNavigate as jest.Mock;
const mockUseParams = useParams as jest.Mock;
const mockUseAuthorize = useAuthorize as jest.Mock;
const mockUsePopBanner = usePopBanner as jest.Mock;
const mockUseNavContext = useTeamEdfiTenantNavContextLoaded as jest.Mock;
const mockOdsDelete = odsQueries.delete as jest.Mock;
const mockInstancesDelete = instancesV2.delete as jest.Mock;
const mockMutationErrCallback = mutationErrCallback as jest.Mock;
const mockUseQueryClient = useQueryClient as jest.Mock;

describe('useOdsActions', () => {
  const navigateSpy = jest.fn();
  const popBannerSpy = jest.fn();
  const odsMutateAsync = jest.fn();
  const instancesMutateAsync = jest.fn();
  const setQueryDataSpy = jest.fn();

  const setup = (startingBlocks: boolean) => {
    mockUseNavigate.mockReturnValue(navigateSpy);
    mockUseParams.mockReturnValue({ odsId: '5' });
    mockUsePopBanner.mockReturnValue(popBannerSpy);
    mockUseAuthorize.mockReturnValue(true);
    mockUseNavContext.mockReturnValue({
      teamId: 1,
      sbEnvironmentId: 2,
      edfiTenantId: 3,
      edfiTenant: { id: 3 },
      sbEnvironment: { startingBlocks },
    });
    mockMutationErrCallback.mockReturnValue({});
    mockOdsDelete.mockReturnValue({ isPending: false, mutateAsync: odsMutateAsync });
    mockInstancesDelete.mockReturnValue({ isPending: false, mutateAsync: instancesMutateAsync });
    mockUseQueryClient.mockReturnValue({ setQueryData: setQueryDataSpy });
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('uses instancesV2 delete mutation for non-startingBlocks ODSs with instanceManageId > 0', () => {
    setup(false);

    const result = useOdsActions({ id: 5, instanceManageId: 77, status: 'Created' });
    (result as ActionsType & { Delete: ActionProps }).Delete.onClick();

    expect(mockInstancesDelete).toHaveBeenCalledWith({ edfiTenant: { id: 3 }, teamId: 1 });
    expect(instancesMutateAsync).toHaveBeenCalledWith(
      { id: 77 },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
    expect(odsMutateAsync).not.toHaveBeenCalled();
  });

  it('does not expose Delete action for non-startingBlocks ODSs without instanceManageId', () => {
    setup(false);

    const result = useOdsActions({ id: 5, instanceManageId: null, status: 'Created' });

    expect(result).not.toHaveProperty('Delete');
  });

  it('does not expose Delete action for non-startingBlocks ODSs unless status is Created', () => {
    setup(false);

    const result = useOdsActions({ id: 5, instanceManageId: 77, status: 'PendingDelete' });

    expect(result).not.toHaveProperty('Delete');
  });

  it('uses odsQueries.delete for startingBlocks with id=ods.id', () => {
    setup(true);

    const result = useOdsActions({ id: 5, instanceManageId: null, status: null });
    (result as ActionsType & { Delete: ActionProps }).Delete.onClick();

    expect(mockOdsDelete).toHaveBeenCalledWith({ edfiTenant: { id: 3 }, teamId: 1 });
    expect(odsMutateAsync).toHaveBeenCalledWith(
      { id: 5 },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
    expect(instancesMutateAsync).not.toHaveBeenCalled();
  });

  it('immediately sets status to PendingDelete in query cache on non-startingBlocks delete', () => {
    setup(false);

    const result = useOdsActions({ id: 5, instanceManageId: 77, status: 'Created' });
    (result as ActionsType & { Delete: ActionProps }).Delete.onClick();

    expect(setQueryDataSpy).toHaveBeenCalledWith(['odss-list-key'], expect.any(Function));
    expect(setQueryDataSpy).toHaveBeenCalledWith(['odss-detail-key'], expect.any(Function));

    const updateList = setQueryDataSpy.mock.calls[0][1] as (arg: Record<number, GetOdsDto>) => Record<number, GetOdsDto>;
    const updateDetail = setQueryDataSpy.mock.calls[1][1] as (arg: GetOdsDto) => GetOdsDto;
    const cachedList = {
      5: Object.assign(new GetOdsDto(), {
        id: 5,
        dbName: 'ods-5',
        odsInstanceName: 'ODS 5',
        status: 'Created',
      }),
    } as Record<number, GetOdsDto>;
    const cachedDetail = Object.assign(new GetOdsDto(), {
      id: 5,
      dbName: 'ods-5',
      odsInstanceName: 'ODS 5',
      status: 'Created',
    });

    const updatedList = updateList(cachedList);
    const updatedDetail = updateDetail(cachedDetail);

    expect(updatedList[5]).toBeInstanceOf(GetOdsDto);
    expect(updatedList[5].displayName).toBe('ODS 5');
    expect(updatedList[5].status).toBe('PendingDelete');
    expect(updatedDetail).toBeInstanceOf(GetOdsDto);
    expect(updatedDetail.displayName).toBe('ODS 5');
    expect(updatedDetail.status).toBe('PendingDelete');
  });

  it('does not touch query cache for startingBlocks delete', () => {
    setup(true);

    const result = useOdsActions({ id: 5, instanceManageId: null, status: null });
    (result as ActionsType & { Delete: ActionProps }).Delete.onClick();

    expect(setQueryDataSpy).not.toHaveBeenCalled();
  });
});
