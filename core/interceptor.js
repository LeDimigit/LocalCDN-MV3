/**
 * Interceptor (Manifest V3)
 * Belongs to LocalCDN (since 2020-02-26)
 * (Origin: Decentraleyes)
 *
 * @license     MPL 2.0
 *
 * In Manifest V3 the actual redirection is done by declarativeNetRequest rules. This module
 * only observes requests (non-blocking webRequest) in order to keep statistics, the badge,
 * the popup list and the log up to date, using the same analyzer as before.
 */

'use strict';

const interceptor = {};

interceptor.blockMissing = false;
interceptor.blockGoogleFonts = false;
interceptor.allowedDomainsGoogleFonts = {};
interceptor.xhrTestDomain = 'localcdn.org';


interceptor._isBadResource = function (requestUrl) {
    requestUrl = requestUrl.replace(/(^\w+:|^)\/\//, '');
    return Object.keys(BadResources).some((path) => requestUrl.startsWith(path));
};

interceptor.handleRequest = async function (requestDetails) {
    const tabIdentifier = requestDetails.tabId;
    if (tabIdentifier === -1) {
        return;
    }

    await main.ready;
    await stateManager.ready;

    const registeredTab = stateManager.tabs[tabIdentifier];
    if (registeredTab === undefined) {
        return;
    }

    const tabUrl = (registeredTab.details && registeredTab.details.url) || requestDetails.initiator || '';
    const initiatorDomain = helpers.extractDomainFromUrl(tabUrl, true);
    if (helpers.checkAllowlisted(initiatorDomain, requestAnalyzer.allowlistedDomains)) {
        return;
    }

    let iframe = '';
    if (requestDetails.initiator && tabUrl && !tabUrl.startsWith(requestDetails.initiator)) {
        iframe = requestDetails.initiator;
    }

    if (BlockedRequestMethods[requestDetails.method]) {
        log.append(tabUrl, requestDetails.url, LogString.NON_GET_REQUEST_BLOCKED, true, iframe);
        return;
    }

    if (interceptor._isBadResource(requestDetails.url)) {
        log.append(tabUrl, requestDetails.url, '-', true, iframe);
        return;
    }

    const tabDetails = {'url': tabUrl};
    if (!requestAnalyzer.isValidCandidate(requestDetails, tabDetails)) {
        return;
    }

    const targetDetails = requestAnalyzer.getLocalTarget(requestDetails, tabUrl);

    if (targetDetails['result'] === false || targetDetails['result'] === 'blocked' || !targetDetails.path) {
        const targetDomain = helpers.extractDomainFromUrl(requestDetails.url, true);
        if (!IgnoredHost[targetDomain]) {
            ++registeredTab.missing;
        }
        if (interceptor.blockMissing === true) {
            ++registeredTab.blocked;
            --registeredTab.missing;
        }
        stateManager.refreshBadge(tabIdentifier);
        stateManager.persist();
        return;
    }

    log.append(tabUrl, requestDetails.url, targetDetails.path, false, iframe);
    stateManager.registerInjection(tabIdentifier, targetDetails, tabUrl);

};

interceptor._handleStorageChanged = function (changes) {
    if (Setting.XHR_TEST_DOMAIN in changes) {
        interceptor.xhrTestDomain = changes.xhrTestDomain.newValue;
    }
    if (Setting.BLOCK_MISSING in changes) {
        interceptor.blockMissing = changes.blockMissing.newValue;
    }
    if (Setting.BLOCK_GOOGLE_FONTS in changes) {
        interceptor.blockGoogleFonts = changes.blockGoogleFonts.newValue;
    }
    if (Setting.ALLOWED_DOMAINS_GOOGLE_FONTS in changes) {
        interceptor.allowedDomainsGoogleFonts = changes.allowedDomainsGoogleFonts.newValue;
    }
};

chrome.storage.onChanged.addListener(interceptor._handleStorageChanged);

// Observe only: redirects happen through declarativeNetRequest.
chrome.webRequest.onBeforeRequest.addListener(interceptor.handleRequest, {
    'urls': Object.keys(mappings.cdn).map((host) => Address.ANY_PROTOCOL + host + Address.ANY_PATH)
});

