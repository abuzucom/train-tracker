/**
 * The northwest corridor crossings, ordered northwest to southeast.
 *
 * Crossings are identified by `dotCode`, the federal National Grade Crossing
 * Inventory identifier. Never match a crossing on its street name. Two
 * distinct crossings in this feed are named "Post Oak", and only 743673P
 * belongs to this corridor. The other, 440652H, sits about 16 km south.
 *
 * `arcgisObjectId` is recorded for tracing a row back to the upstream service.
 * It is not a join key. The upstream service assigns it and could renumber it.
 */

/** @typedef {object} Crossing
 * @property {string} dotCode Federal grade crossing identifier.
 * @property {string} name Common name for display.
 * @property {number} corridorSeq Position northwest to southeast, from 1.
 * @property {number} lat Latitude in degrees.
 * @property {number} lon Longitude in degrees.
 * @property {number} arcgisObjectId Upstream OBJECTID, for tracing only.
 */

/** @type {readonly Crossing[]} */
export const CORRIDOR_CROSSINGS = Object.freeze([
  { dotCode: "743650H", name: "Gessner", corridorSeq: 1, lat: 29.86154, lon: -95.54447, arcgisObjectId: 12 },
  { dotCode: "743653D", name: "Campbell", corridorSeq: 2, lat: 29.85276, lon: -95.53210, arcgisObjectId: 45 },
  { dotCode: "743658M", name: "Blalock", corridorSeq: 3, lat: 29.84723, lon: -95.52431, arcgisObjectId: 13 },
  { dotCode: "758656T", name: "South Pinemont", corridorSeq: 4, lat: 29.84082, lon: -95.51530, arcgisObjectId: 29 },
  { dotCode: "743659U", name: "Clay", corridorSeq: 5, lat: 29.83357, lon: -95.50510, arcgisObjectId: 46 },
  { dotCode: "743662C", name: "Bingle", corridorSeq: 6, lat: 29.82560, lon: -95.49399, arcgisObjectId: 9 },
  { dotCode: "743668T", name: "Kempwood", corridorSeq: 7, lat: 29.81820, lon: -95.48355, arcgisObjectId: 18 },
  { dotCode: "743267T", name: "Antoine", corridorSeq: 8, lat: 29.81175, lon: -95.47469, arcgisObjectId: 43 },
  { dotCode: "743270B", name: "Long Point", corridorSeq: 9, lat: 29.80304, lon: -95.46272, arcgisObjectId: 44 },
  { dotCode: "743673P", name: "Post Oak", corridorSeq: 10, lat: 29.79814, lon: -95.45603, arcgisObjectId: 19 },
  { dotCode: "743677S", name: "Hempstead", corridorSeq: 11, lat: 29.79039, lon: -95.44491, arcgisObjectId: 20 },
]);

/** Number of crossings a complete snapshot must contain. */
export const CORRIDOR_CROSSING_COUNT = CORRIDOR_CROSSINGS.length;

/** Codes the poller accepts, for rejecting anything the query did not ask for. */
export const CORRIDOR_CODES = Object.freeze(
  new Set(CORRIDOR_CROSSINGS.map((crossing) => crossing.dotCode)),
);
