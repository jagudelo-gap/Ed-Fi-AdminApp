import { GetSessionDataDto, GetTeamDto, GetUserDto, PutUserDto } from '@edanalytics/models';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { plainToInstance } from 'class-transformer';
import { methods } from '../methods';

const baseUrl = '';

export const useMe = () => {
  const me = useQuery({
    staleTime: 90 * 1000,
    queryKey: [`me`, 'basics'],

    queryFn: () => {
      return axios
        .get<{ data: unknown }>(`${baseUrl}/auth/me`, { withCredentials: true })
        .then((res) => {
          return plainToInstance(GetSessionDataDto, res.data);
        })
        .catch((err) => {
          if (err.response.status === 401) {
            return null;
          } else {
            throw err;
          }
        });
    },
  });
  return me;
};
export const useMyTeams = () =>
  useQuery({
    staleTime: 90 * 1000,
    queryKey: [`me`, 'teams'],
    queryFn: () => {
      return methods.getManyMap(`${baseUrl}/auth/my-teams`, GetTeamDto);
    },
  });
export const usePutMe = (callback?: () => void) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (user: PutUserDto) =>
      methods.put(`${baseUrl}/users/${user.id}`, PutUserDto, GetUserDto, user),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['me'] });
      callback?.();
    },
  });
};
