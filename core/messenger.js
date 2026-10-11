/**
 * Messenger
 * Belongs to LocalCDN (since 2020-02-26)
 * (Origin: Decentraleyes)
 *
 * @author      Thomas Rientjes
 * @since       2018-05-28
 *
 * @author      nobody
 * @since       2020-02-26
 *
 * @license     MPL 2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/.
 */

'use strict';


/**
 * Messenger
 */

const messenger = {};


/**
 * Private Methods
 */

messenger._handleMessageReceived = function (message, sender, sendResponse) {
    // The service worker may just have been started: wait for the state to be restored.
    Promise.all([main.ready, stateManager.ready, log.ready]).then(function () {
        messenger._dispatch(message, sender, sendResponse);
    });
    return MessageResponse.ASYNCHRONOUS;
};

messenger._dispatch = function (message, sender, sendResponse) {

    const topic = message.topic;
    const value = message.value;
    const popup = {};

    switch (topic) {

        case 'tab:fetch-injections': {
            const tab = stateManager.tabs[value] || {'injections': {}, 'blocked': 0, 'missing': 0};
            sendResponse({'value': {
                'injections': tab.injections,
                'blockedCounter': tab.blocked,
                'missingCounter': tab.missing
            }});
            return MessageResponse.SYNCHRONOUS;
        }

        case 'tab:inject':
            chrome.scripting.executeScript({
                'target': {'tabId': value},
                'func': (domain) => {
                    const fill = () => {
                        const field = document.getElementById('domain');
                        if (field) {
                            field.value = domain;
                        }
                    };
                    if (document.readyState === 'complete') {
                        fill();
                    } else {
                        window.addEventListener('load', fill);
                    }
                },
                'args': [String(message.url)]
            });
            return MessageResponse.SYNCHRONOUS;

        case 'domain:fetch-is-allowlisted':
            sendResponse({'value': Boolean(helpers.checkAllowlisted(value, requestAnalyzer.allowlistedDomains))});
            return MessageResponse.SYNCHRONOUS;

        case 'domain:fetch-is-manipulateDOM':
            sendResponse({'value': Boolean(helpers.checkAllowlisted(value, requestAnalyzer.domainsManipulateDOM))});
            return MessageResponse.SYNCHRONOUS;

        case 'domain:fetch-is-google-fonts':
            sendResponse({'value': Boolean(helpers.checkAllowlisted(value, interceptor.allowedDomainsGoogleFonts))});
            return MessageResponse.SYNCHRONOUS;

        case 'allowlist:add-domain':
            stateManager.addDomainToAllowlist(value).then(function () {
                sendResponse({'value': true});
            });
            return MessageResponse.ASYNCHRONOUS;

        case 'allowlist:remove-domain':
            stateManager.removeDomainFromAllowlist(value).then(function () {
                sendResponse({'value': true});
            });
            return MessageResponse.ASYNCHRONOUS;

        case 'manipulateDOM:add-domain':
            stateManager.addDomainToManipulateDOMlist(value).then(function () {
                sendResponse({'value': true});
            });
            return MessageResponse.ASYNCHRONOUS;

        case 'manipulateDOM:remove-domain':
            stateManager.removeDomainFromManipulateDOMlist(value).then(function () {
                sendResponse({'value': true});
            });
            return MessageResponse.ASYNCHRONOUS;

        case 'google-fonts:add-domain':
            stateManager.addDomainToGoogleFontsList(value).then(function () {
                sendResponse({'value': true});
            });
            return MessageResponse.ASYNCHRONOUS;

        case 'google-fonts:remove-domain':
            stateManager.removeDomainFromGoogleFontsList(value).then(function () {
                sendResponse({'value': true});
            });
            return MessageResponse.ASYNCHRONOUS;

        case 'statistic:delete':
            storageManager.statistics = {};
            break;

        case 'logs:get':
            sendResponse({'logs': log.data});
            return MessageResponse.SYNCHRONOUS;

        case 'logs:delete':
            log.data = [];
            log.persist();
            break;

        case 'popup:get-data':
            popup.amountInjected = storageManager.amountInjected;
            popup.internalStatistics = stateManager.internalStatistics;
            popup.negateHtmlFilterList = stateManager.getInvertOption;
            popup.loggingStatus = stateManager.logging;
            popup.hideDonationButton = stateManager.hideDonationButton;
            popup.blockGoogleFonts = interceptor.blockGoogleFonts;
            sendResponse({'data': popup});
            return MessageResponse.ASYNCHRONOUS;
    }
};


/**
 * Event Handlers
 */

chrome.runtime.onMessage.addListener(messenger._handleMessageReceived);
