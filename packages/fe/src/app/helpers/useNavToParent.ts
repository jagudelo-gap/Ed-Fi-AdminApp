import { generatePath, useMatches, useParams } from 'react-router';
import { flatRoutes } from '../routes';
import uniq from 'lodash/uniq';

/**
 * Navigate up one level in the route tree. Useful for redirecting after deletion of a resource whose page you were on.
 * @returns Router nav options or undefined
 */
export const useNavToParent = () => {
  const matches = useMatches();
  const params = useParams();
  const lastMatch = matches[matches.length - 1];
  const breadcrumbs = uniq(
    flatRoutes
      .filter((m) => m.path && lastMatch?.handle?.path?.startsWith(m.path))
      .map((r) => r.path?.replace(/\/$/, ''))
      .sort((a, b) => {
        const aPath = a;
        const bPath = b;
        return aPath && bPath
          ? aPath.startsWith(bPath)
            ? 1
            : bPath.startsWith(aPath)
            ? -1
            : 0
          : 0;
      })
  );
  if (breadcrumbs.length > 1) {
    return generatePath(breadcrumbs.slice(-2)[0] ?? '/', params);
  } else {
    return '/';
  }
};
