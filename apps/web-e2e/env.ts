// Everything the end-to-end stack shares. Ports differ from the dev stack (3000/4200).
export const API_PORT = 3100;
export const WEB_PORT = 4300;
export const BASE_URL = `http://localhost:${WEB_PORT}`;
/** The schema owner, for test support queries; the API itself runs as swarm_app (prepare-api.sh). */
export const DATABASE_OWNER_URL = 'postgres://swarm:swarm@127.0.0.1:5432/swarm_keeper_e2e';

export const OWNER = {
  email: 'owner@e2e.test',
  password: 'e2e owner password 2026',
  family: 'Ивановы',
};
/** A second family the seeded owner also owns, for "accept another family". */
export const SECOND_FAMILY = 'Петровы';
