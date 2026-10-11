/**
 * Log
 * Belongs to LocalCDN
 *
 * @author      nobody
 * @since       2021-02-19
 *
 * @license     MPL 2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/.
 */

'use strict';


/**
 * Log
 */

const log = {};

log.data = [];
log._timer = null;
log.MAX_ENTRIES = 5000;

log.persist = function () {
    if (log._timer !== null) {
        return;
    }
    log._timer = setTimeout(function () {
        log._timer = null;
        chrome.storage.session.set({'logs': log.data});
    }, 500);
};

log.append = function (initiator, resource, target, highlight, iframe = '') {
    if (stateManager.logging) {
        log.data.push({initiator, resource, target, highlight, iframe});
        if (log.data.length > log.MAX_ENTRIES) {
            log.data.splice(0, log.data.length - log.MAX_ENTRIES);
        }
        log.persist();
    }
};

// Restore (service worker context only)
log.ready = (typeof chrome.storage.session !== 'undefined')
    ? chrome.storage.session.get('logs').then((items) => {
        log.data = (items.logs || []).concat(log.data);
    }).catch(() => {})
    : Promise.resolve();
