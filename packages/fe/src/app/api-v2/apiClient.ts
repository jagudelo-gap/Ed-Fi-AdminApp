import axios from 'axios';
import { API_URL } from '../api/methods';
import {config} from '../../../typings/config';

axios.defaults.baseURL = API_URL;

export const apiClient = axios.create({
  withCredentials: true,
});

apiClient.interceptors.response.use(
  (res) => res.data,
  (error) => {
    if ([401].includes(error?.response?.status)) {
      console.info('Redirecting to login');
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
      window.location.href = `${axios.defaults.baseURL}/auth/login/${oidcId}?redirect=${encodeURIComponent(
        currentPath + window.location.search
      )}`;
    } else {
      throw error?.response?.data ?? error;
    }
  }
);
