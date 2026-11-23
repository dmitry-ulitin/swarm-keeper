# @swarm-keeper/permissions

Better Auth access control for families: `statement`, `ac` and the roles owner, admin, member and viewer. Shared by the API and the web app; the server always checks permissions again.

The role matrix lives in `docs/architecture/authentication.md` ("Roles and permissions"); `src/permissions.spec.ts` pins it row by row. Change both together.
