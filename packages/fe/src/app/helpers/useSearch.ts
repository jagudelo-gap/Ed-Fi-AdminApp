import { useMemo } from 'react';
import { useSearchParams } from 'react-router';

export const useSearchParamsObject = <OutputType extends object>(
  transformer?: (obj: object) => OutputType
) => {
  const [urlSearchParams] = useSearchParams();
  return useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dict = [...urlSearchParams.entries()].reduce<Record<string, any>>((obj, entry) => {
      const [key, value] = entry;
      if (key in obj) {
        if (!Array.isArray(obj[key])) {
          obj[key] = [obj[key]];
        }
        obj[key].push(value);
      } else {
        obj[key] = value;
      }
      return obj;
    }, {});
    return transformer ? transformer(dict) : dict;
  }, [urlSearchParams, transformer]);
};
