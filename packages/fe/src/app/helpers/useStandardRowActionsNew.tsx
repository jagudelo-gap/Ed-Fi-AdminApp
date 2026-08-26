import { Icons } from '@edanalytics/common-ui';
import { TeamBasePrivilege, TeamEdfiTenantPrivilege } from '@edanalytics/models';
import { RouteObject, generatePath, useNavigate } from 'react-router';

export type BaseRow = { id: number; displayName: string };

export const useReadTeamEntity = (props: {
  route: RouteObject;
  entity: BaseRow | undefined;
  params: {
    asId: string | number;
    edfiTenantId?: string | number | undefined;
    sbEnvironmentId?: string | number | undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } & Record<any, string | number>;
  privilege?: TeamBasePrivilege | TeamEdfiTenantPrivilege;
}) => {
  const path = props.route.path!;
  const navigate = useNavigate();
  const { params, entity } = props;
  const pathParams = Object.fromEntries(
    Object.entries(params).map(([key, value]) => [
      key,
      value === undefined ? undefined : String(value),
    ]),
  );
  const toOptions = generatePath(path, pathParams);
  return entity === undefined
    ? undefined
    : {
        icon: Icons.View,
        text: 'View',
        title: 'View ' + entity.displayName,
        to: toOptions,
        onClick: () => navigate(toOptions),
      };
};
