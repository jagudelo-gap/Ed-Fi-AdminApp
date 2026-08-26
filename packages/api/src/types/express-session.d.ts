// Ambient module augmentation: adds the Admin App fields we persist on the
// login session so `request.session.oidcId` / `request.session.idToken` are
// typed everywhere they are used. Kept in a dedicated declaration file rather
// than coupled to a specific runtime module.
import 'express-session';

declare module 'express-session' {
  interface SessionData {
    oidcId?: number;
    idToken?: string;
  }
}
