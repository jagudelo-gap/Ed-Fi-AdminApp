import { decrypt, readMessage, DecryptMessageResult } from 'openpgp';
import urlJoin from 'url-join';
import { API_URL } from '../../api/methods';

const decryptMessage = async (data: string, pwd: string): Promise<DecryptMessageResult> => {
  return decrypt({
    message: await readMessage({ armoredMessage: data }),
    passwords: pwd,
    format: 'utf8',
  });
};

export const getMessage = async (uuid: string, pwd: string) => {
  const data = await fetch(urlJoin(API_URL, 'secret', uuid))
    .then((res) => {
      if (res.status === 404) {
        throw 404;
      } else {
        return res.text();
      }
    })
    .then((res) => JSON.parse(res));

  return await decryptMessage(data.message, pwd);
};
