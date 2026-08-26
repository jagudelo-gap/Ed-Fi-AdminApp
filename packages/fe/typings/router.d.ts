import React from 'react';

declare module 'react-router' {
  function useMatches(): {
    id: string;
    pathname: string;
    params: Params<string>;
    data: unknown;
    handle: {
      crumb?: undefined | (() => React.ReactNode);
      fallbackCrumb?: undefined | (() => React.ReactNode);
      path?: string;
    };
  }[];
  interface IndexRouteObject {
    handle?:
      | undefined
      | {
          crumb?: undefined | (() => React.ReactNode);
          fallbackCrumb?: undefined | (() => React.ReactNode);
        };
  }
  interface NonIndexRouteObject {
    handle?:
      | undefined
      | {
          crumb?: undefined | (() => React.ReactNode);
          fallbackCrumb?: undefined | (() => React.ReactNode);
        };
  }
}
