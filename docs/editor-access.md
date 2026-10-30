# Editor access

The player, staff, and World Rules editors start locked. Open the in-game Settings popup,
enter the editor password once, and select **Unlock editor**. After that, **Turn editor on**
and **Turn editor off** toggle all three editors without requesting the password again
or undoing saved edits. This unlock belongs to the browser, independently of career saves.
Turning the editor off and reopening the browser preserves both the unlock and off state.

Each career records `editorUsed` and `editorFirstUsedAt` in its persisted state.
Successful player, staff, finance, injury, transfer and World Rules editor actions
mark that career. Merely unlocking or toggling the editor does not. Resetting edited
values never clears the history; starting a new career starts clean. The same state
envelope is used for local saves, archived local slots and cloud saves, so the history
travels with the career. Older saves with retained editor overrides, frozen attributes,
custom World Rules or editor staff-transfer records are marked as previously edited;
their first-use date remains unknown.

The password is verified by `/api/editor-access` on the Next.js server using scrypt
(N=131072, r=8, p=1). Only a salted hash is stored. The server issues a signed,
HttpOnly, SameSite=Strict persistent cookie; HTTPS production deployments also use Secure.
The signed credential remembers the unlock, with a separate HttpOnly cookie for
the on/off preference so an in-flight status check cannot undo a toggle. It has no
one-hour timeout. The browser cookie has a 400-day lifetime, renewed whenever access
is checked. Clearing cookies, using another browser, or leaving the browser unused
past the cookie lifetime requires unlocking again. A valid old one-hour unlock is
automatically upgraded to the remembered unlock on its next access check.
The password, hash, and signing secret are never sent in API responses or included
in the browser bundle, game saves, or localStorage. Editor changes recheck access
before applying, and the editor-specific store actions refuse locked changes.

## Private configuration

Set `EDITOR_PASSWORD_HASH` and `EDITOR_SESSION_SECRET` in the server environment.
For local development these are in the ignored `.env.local`. Do not share this file.
For hosting, copy those two values into the hosting provider's private environment
configuration and restart/redeploy. Neither variable may use a `NEXT_PUBLIC_` prefix.
Missing or invalid configuration keeps the editor locked.

Hash format: `scrypt:<16-byte salt as hex>:<64-byte derived key as hex>`.
The session secret is a separately generated random 32-byte value represented as hex.
There is no API or in-game option to change the password. Changing either private
configuration value invalidates existing unlock cookies.

Keep hosting credentials, environment configuration, and deployment permissions
restricted to the owner. Source code access does not reveal the password, but code
access combined with deployment access allows someone to replace the verifier.

## Scope

This locks the editors in the unmodified application. The game simulates and saves
careers in the browser; a person controlling their browser or a modified local copy
can change their own local save. This is not a guarantee of tamper-proof save data.

Unlock attempts are limited to five per minute per server process, with one password
verification at a time. A multi-instance production host should also enforce a
shared rate limit for `POST /api/editor-access`. Unlock/disable requests require
the same origin. Other tabs recheck access when notified, focused, or every 30 seconds.

Security references: [OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
and [OWASP session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).
