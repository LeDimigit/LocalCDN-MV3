/**
 * Service worker entry point (Manifest V3)
 * Belongs to LocalCDN
 *
 * @license     MPL 2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/.
 */

'use strict';

// Classic scripts share one global scope, exactly as they did in the former background page.
// Event listeners are registered synchronously while these scripts run (MV3 requirement).
importScripts(
    '../core/constants.js',
    '../core/storage-manager.js',
    '../modules/internal/wrappers.js',
    '../modules/internal/targets.js',
    '../modules/internal/helpers.js',
    '../modules/internal/stats.js',
    '../modules/internal/log.js',
    '../core/resources.js',
    '../core/mappings.js',
    '../core/shorthands.js',
    '../core/state-manager.js',
    '../core/request-analyzer.js',
    '../core/dnr-manager.js',
    '../core/messenger.js',
    '../core/interceptor.js',
    '../core/main.js'
);

// A failed badge/title update on a tab that was just closed must never surface as an uncaught error.
self.addEventListener('unhandledrejection', function (event) {
    event.preventDefault();
});
