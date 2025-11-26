import axios from 'axios';
import { ClassConstructor, instanceToPlain, plainToInstance } from 'class-transformer';
import { config } from '../../../typings/config';

export const API_URL: string = config.apiUrl.endsWith("/api") ? config.apiUrl : `${config.apiUrl}/api`;
export const IDP_ACCOUNT_URL: string = config.idpAccountUrl || 'https://localhost/auth/realms/edfi/account/';
axios.defaults.baseURL = API_URL;

export const apiClient = axios.create({
  withCredentials: true,
});

apiClient.interceptors.response.use(
  (res) => res.data,
  (error) => {
    if ([401].includes(error?.response?.status)) {
      console.log('Redirecting to login');
      // Get the OIDC ID from environment or default to 1
      const oidcId = config.oidcId || 1;

      // Get the current path relative to the base path
      const basePath = config.basePath || '/';
      let currentPath = window.location.pathname;

      // If current path includes the base path, strip the base path to prevent duplication
      if (basePath !== '/' && currentPath.startsWith(basePath)) {
        currentPath = currentPath.substring(basePath.length); // Keep the leading slash
      }

      // Redirect to the API auth login endpoint with the OIDC ID
      window.location.href = `${API_URL}/auth/login/${oidcId}?redirect=${encodeURIComponent(
        currentPath + window.location.search
      )}`;
    } else {
      throw error?.response?.data ?? error;
    }
  }
);

async function getManyMap<R extends object>(
  url: string,
  dto: ClassConstructor<R>,
  params: object | undefined,
  key: keyof R
): Promise<Record<string | number, R>>;
async function getManyMap<R extends { id: number }>(
  url: string,
  dto: ClassConstructor<R>,
  params?: object | undefined
): Promise<Record<string | number, R>>;
async function getManyMap<R extends object>(
  url: string,
  dto: ClassConstructor<R>,
  params?: object | undefined,
  key?: keyof R
): Promise<Record<string | number, R>> {
  const res = (await apiClient.get<R>(url, params)) as unknown as R[];
  return (res ?? []).reduce((map, o) => {
    const instance = plainToInstance(dto, o);
    map[instance[key ?? ('id' as keyof R)] as string | number] = instance;
    return map;
  }, {} as Record<string | number, R>);
}

export const methods = {
  getOne: async <R extends object>(url: string, dto: ClassConstructor<R>, params?: object) => {
    const res = await apiClient.get<R>(url, params);
    return plainToInstance(dto, res) as R;
  },
  getMany: async <R extends object>(url: string, dto: ClassConstructor<R>, params?: object) => {
    const res = (await apiClient.get<R>(url, params)) as unknown as R[];
    return (res ?? []).map((o) => plainToInstance(dto, o));
  },
  getManyMap,
  put: async <R extends object, P extends object>(
    url: string,
    dtoReq: ClassConstructor<R>,
    dtoRes: ClassConstructor<P>,
    data: R
  ) => {
    const res = await apiClient.put<R>(url, instanceToPlain(plainToInstance(dtoReq, data)));
    return plainToInstance(dtoRes, res);
  },
  post: async <R extends object, P extends object>(
    url: string,
    dtoReq: ClassConstructor<R>,
    dtoRes: ClassConstructor<P>,
    data: R
  ) => {
    const res = await apiClient.post<R>(url, instanceToPlain(plainToInstance(dtoReq, data)));
    return plainToInstance(dtoRes, res);
  },
  delete: (url: string) => apiClient.delete<unknown>(url),
};
