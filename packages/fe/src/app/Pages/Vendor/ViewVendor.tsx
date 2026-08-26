import { useQuery } from '@tanstack/react-query';
import {
  Attribute,
  AttributeContainer,
  AttributesGrid,
  ContentSection,
  CopyButton,
} from '@edanalytics/common-ui';
import { useParams } from 'react-router';
import { vendorQueriesV1 } from '../../api';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';

export const ViewVendor = () => {
  const params = useParams() as {
    vendorId: string;
  };
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const vendor = useQuery(
    vendorQueriesV1.getOne({
      id: params.vendorId,
      edfiTenant,
      teamId,
    })
  ).data;

  return vendor ? (
    <ContentSection>
      <AttributesGrid>
        <Attribute label="Id" value={vendor.vendorId} isCopyable />
        <Attribute label="Company" value={vendor.company} />
        <Attribute label="Contact" value={vendor.contactName} />
        {vendor.contactEmailAddress ? (
          <Attribute
            label="Contact email"
            value={`mailto:${vendor.contactEmailAddress}`}
            isUrl
            isUrlExternal
            isCopyable
          />
        ) : null}
        <AttributeContainer label="Namespace">
          {vendor.namespacePrefixes === ''
            ? '-'
            : vendor.namespacePrefixes.split(/,\s*/g).map((ns) => (
                <p key={ns}>
                  <CopyButton value={ns} />
                  {ns}
                </p>
              ))}
        </AttributeContainer>
      </AttributesGrid>
    </ContentSection>
  ) : null;
};
