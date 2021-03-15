/*! Adapted from test.js from GitHub user saulshanabrook (Saul Shanabrook)
    https://gist.github.com/saulshanabrook/b74984677bccd08b028b30d9968623f5
 */

import type { Window } from '../types/window';

export default (function(window: Window) {
    if (typeof window.indexedDB === 'undefined') {
        window.indexedDB = typeof window.mozIndexedDB === 'undefined'
            ? typeof window.webkitIndexedDB === 'undefined'
                ? typeof window.msIndexedDB === 'undefined'
                    ? window.shimIndexedDB
                    : window.msIndexedDB
                : window.webkitIndexedDB
            : window.mozIndexedDB;
    }
})(window);
