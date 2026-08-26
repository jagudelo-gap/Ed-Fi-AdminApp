import { FormControl, FormLabel, Switch, useBoolean } from '@chakra-ui/react';
import { GetEdfiTenantDto, regarding } from '@edanalytics/models';
import { useEffect } from 'react';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { edfiTenantQueriesGlobal } from '../../api';
import { useSbEnvironmentNavContextLoaded } from '../../helpers';
import { RegisterSbEnvironmentAdminApiAuto } from './RegisterEdfiTenantAdminApiAuto';
import { RegisterSbEnvironmentAdminApiManual } from './RegisterEdfiTenantAdminApiManual';

export const RegisterEdfiTenantAdminApi = (props: { edfiTenant: GetEdfiTenantDto }) => {
  const { sbEnvironmentId, sbEnvironment } = useSbEnvironmentNavContextLoaded();
  const checkConnection = edfiTenantQueriesGlobal.checkConnection({
    sbEnvironmentId,
  });
  const popBanner = usePopBanner();
  useEffect(() => {
    checkConnection.mutate(
      { entity: props.edfiTenant, pathParams: {} },
      {
        onError: () => undefined,
        onSuccess: (_res) => {
          popBanner({
            title: 'Admin API already connected.',
            type: 'Warning',
            regarding: regarding(sbEnvironment),
          });
        },
      }
    );
    // checkConnection, popBanner, props.edfiTenant, and sbEnvironment are
    // intentionally omitted: this should only check the connection once on
    // mount. checkConnection/popBanner are freshly created on every render
    // (not memoized upstream), so including them would re-trigger the
    // connection check (and possible duplicate banner) on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const { edfiTenant } = props;

  const [selfRegister, setSelfRegister] = useBoolean(true);

  return sbEnvironment ? (
    <>
      <FormControl mb={10}>
        <FormLabel>Use automatic self-registration?</FormLabel>
        <Switch isChecked={selfRegister} onChange={setSelfRegister.toggle} />
      </FormControl>
      {selfRegister ? (
        <RegisterSbEnvironmentAdminApiAuto edfiTenant={edfiTenant} sbEnvironment={sbEnvironment} />
      ) : (
        <RegisterSbEnvironmentAdminApiManual
          edfiTenant={edfiTenant}
          sbEnvironment={sbEnvironment}
        />
      )}
    </>
  ) : (
    <></>
  );
};
