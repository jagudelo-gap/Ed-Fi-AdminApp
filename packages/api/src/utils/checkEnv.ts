import * as config from 'config';
import { asBool } from './config-bool';

const errs = [];

if (
  config.DB_ENCRYPTION_SECRET_VALUE === undefined &&
  config.AWS_DB_ENCRYPTION_SECRET === undefined
) {
  errs.push('DB_ENCRYPTION_SECRET not defined either locally or as AWS secret.');
}
if (config.DB_SECRET_VALUE === undefined && config.AWS_DB_SECRET === undefined) {
  errs.push('DB_SECRET not defined either locally or as AWS secret.');
}
if (
  (config.AWS_DB_SECRET !== undefined || config.AWS_DB_ENCRYPTION_SECRET !== undefined) &&
  config.AWS_REGION === undefined
) {
  errs.push('Configured to use AWS secrets, but AWS_REGION not defined.');
}
if (config.FE_URL === undefined) {
  errs.push('FE_URL not defined.');
}
if (config.MY_URL === undefined) {
  errs.push('MY_URL not defined.');
}

if (config.USE_YOPASS === undefined) {
  errs.push('USE_YOPASS not defined.');
}
else if (asBool(config.USE_YOPASS)) {
  if (config.YOPASS_URL === undefined) {
    errs.push('YOPASS_URL not defined.');
  }
}

if (config.RATE_LIMIT_TTL === undefined) {
  errs.push('RATE_LIMIT_TTL not defined.');
}
if (config.RATE_LIMIT_LIMIT === undefined) {
  errs.push('RATE_LIMIT_LIMIT not defined.');
}

if (config.USE_PKCE === undefined) {
  errs.push('USE_PKCE not defined.');
}
if (errs.length > 0) {
  throw new Error('Config error:\n- ' + errs.join('\n- '));
}
