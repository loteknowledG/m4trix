// Bypass the idb-keyval → sqlite shim alias for one-time migration reads.
export { clear, del, get, keys, set } from 'idb-keyval/dist/index.js';
