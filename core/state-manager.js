/**
 * State Manager (Manifest V3)
 * Belongs to LocalCDN (since 2020-02-26)
 * (Origin: Decentraleyes)
 *
 * @license     MPL 2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 * The service worker can be stopped at any time, so per-tab state is mirrored to
 * chrome.storage.session and restored on start-up.
 */

'use strict';

const stateManager = {};

stateManager.requests = {};
stateManager.tabs = {};
stateManager.getInvertOption = true;
stateManager.selectedIcon = 'Default';
stateManager.showIconBadge = true;
stateManager.internalStatistics = false;
stateManager.hideDonationButton = false;
stateManager.changeBadgeColorMissingResources = false;
stateManager.logging = false;

stateManager._newTab = function () {
    return {'injections': {}, 'missing': 0, 'blocked': 0};
};

stateManager._persistTimer = null;

stateManager.persist = function () {
    if (stateManager._persistTimer !== null) {
        return;
    }
    stateManager._persistTimer = setTimeout(function () {
        stateManager._persistTimer = null;
        chrome.storage.session.set({'tabs': stateManager.tabs});
    }, 200);
};

stateManager.refreshBadge = function (tabIdentifier) {
    const registeredTab = stateManager.tabs[tabIdentifier];
    if (registeredTab === undefined) {
        return;
    }

    const injectionCount = Object.keys(registeredTab.injections).length || 0;
    const missingCount = registeredTab.missing || 0;
    const blockedCount = registeredTab.blocked || 0;

    if (injectionCount > 0) {
        chrome.action.setTitle({'tabId': tabIdentifier, 'title': `LocalCDN (${injectionCount})`}).catch(() => {});
    }

    if (stateManager.showIconBadge === true) {
        if ((missingCount > 0 || blockedCount > 0) && stateManager.changeBadgeColorMissingResources) {
            wrappers.setBadgeColoring(tabIdentifier, BadgeSettingMissingResource.TYPE);
        } else {
            wrappers.setBadgeColoring(tabIdentifier, BadgeSetting.TYPE);
        }
        wrappers.setBadgeText(tabIdentifier, (injectionCount + missingCount + blockedCount));
    }
};

stateManager.registerInjection = function (tabIdentifier, injection) {
    const registeredTab = stateManager.tabs[tabIdentifier];

    if (registeredTab === undefined || injection['result'] === false) {
        return;
    }

    registeredTab.injections[injection.source + injection.path] = injection;
    stateManager.refreshBadge(tabIdentifier);
    stateManager.persist();

    storageManager.amountInjected = (Number(storageManager.amountInjected) || 0) + 1;
    chrome.storage.local.set({[Setting.AMOUNT_INJECTED]: storageManager.amountInjected});

    if (stateManager.internalStatistics) {
        stats.setStats(injection);
    }
};

stateManager.addDomainToAllowlist = function (domain) {
    return new Promise((resolve) => {
        const allowlistedDomains = requestAnalyzer.allowlistedDomains;

        allowlistedDomains[domain] = true;
        storageManager.type.set({allowlistedDomains}, resolve);
    });
};

stateManager.removeDomainFromAllowlist = function (domain) {
    return new Promise((resolve) => {
        const allowlistedDomains = requestAnalyzer.allowlistedDomains;

        if (allowlistedDomains[domain]) {
            delete allowlistedDomains[domain];
        } else {
            for (const key in allowlistedDomains) {
                if (key.startsWith('*.') && domain.endsWith(key.substring(2))) {
                    delete allowlistedDomains[key];
                    break;
                }
            }
        }

        storageManager.type.set({allowlistedDomains}, resolve);
    });
};

// The HTML filter (Firefox only) is not available in the Chromium build; the lists stay for backup compatibility.
stateManager.addDomainToManipulateDOMlist = function (domain) {
    return new Promise((resolve) => {
        const domainsManipulateDOM = requestAnalyzer.domainsManipulateDOM;

        domainsManipulateDOM[domain] = true;
        storageManager.type.set({domainsManipulateDOM}, resolve);
    });
};

stateManager.removeDomainFromManipulateDOMlist = function (domain) {
    return new Promise((resolve) => {
        const domainsManipulateDOM = requestAnalyzer.domainsManipulateDOM;

        delete domainsManipulateDOM[domain];
        storageManager.type.set({domainsManipulateDOM}, resolve);
    });
};

stateManager.addDomainToGoogleFontsList = function (domain) {
    return new Promise((resolve) => {
        const allowedDomainsGoogleFonts = interceptor.allowedDomainsGoogleFonts;

        allowedDomainsGoogleFonts[domain] = true;
        storageManager.type.set({allowedDomainsGoogleFonts}, resolve);
    });
};

stateManager.removeDomainFromGoogleFontsList = function (domain) {
    return new Promise((resolve) => {
        const allowedDomainsGoogleFonts = interceptor.allowedDomainsGoogleFonts;

        delete allowedDomainsGoogleFonts[domain];
        storageManager.type.set({allowedDomainsGoogleFonts}, resolve);
    });
};

stateManager._domainIsListed = function (domain, listname) {
    if (domain === null) {
        return false;
    }
    const list = listname === 'manipulate-dom' ? requestAnalyzer.domainsManipulateDOM : requestAnalyzer.allowlistedDomains;
    return Boolean(helpers.checkAllowlisted(domain, list));
};

stateManager._setIconDisabled = function (tabIdentifier) {
    wrappers.setIcon({
        'path': stateManager.selectedIcon || 'Default',
        'tabId': tabIdentifier
    }, 'Disabled');
};

stateManager._clearBadgeText = function (tabIdentifier) {
    wrappers.setBadgeText(tabIdentifier, '');
};

stateManager._updateTab = async function (details) {
    if (details.frameId !== 0 || details.tabId === -1) {
        return;
    }

    await stateManager.ready;
    await main.ready;

    const tabIdentifier = details.tabId;
    const tabDomain = helpers.extractDomainFromUrl(details.url, true);

    chrome.action.setTitle({'tabId': tabIdentifier, 'title': 'LocalCDN (0)'}).catch(() => {});

    if (stateManager._domainIsListed(tabDomain)) {
        stateManager._setIconDisabled(tabIdentifier);
        chrome.action.setTitle({'tabId': tabIdentifier, 'title': 'LocalCDN (–)'}).catch(() => {});
    }

    if (stateManager.showIconBadge === true) {
        stateManager._clearBadgeText(tabIdentifier);
    }

    stateManager.tabs[tabIdentifier] = Object.assign(stateManager.tabs[tabIdentifier] || {}, stateManager._newTab());
    stateManager.persist();
};

stateManager._handleStorageChanged = function (changes) {
    if (Setting.SHOW_ICON_BADGE in changes) {
        stateManager.showIconBadge = changes.showIconBadge.newValue;
        if (changes.showIconBadge.newValue !== true) {
            chrome.tabs.query({}, function (tabs) {
                tabs.forEach((tab) => stateManager._clearBadgeText(tab.id));
            });
        }
    } else if (Setting.NEGATE_HTML_FILTER_LIST in changes) {
        stateManager.getInvertOption = changes.negateHtmlFilterList.newValue;
    } else if (Setting.SELECTED_ICON in changes) {
        stateManager.selectedIcon = changes.selectedIcon.newValue;
    } else if (Setting.INTERNAL_STATISTICS in changes) {
        stateManager.internalStatistics = changes.internalStatistics.newValue;
    } else if (Setting.INTERNAL_STATISTICS_DATA in changes) {
        stats.data = changes.internalStatisticsData.newValue;
    } else if (Setting.HIDE_DONATION_BUTTON in changes) {
        stateManager.hideDonationButton = changes.hideDonationButton.newValue;
    } else if (Setting.CHANGE_BADGE_COLOR_MISSING_RESOURCES in changes) {
        stateManager.changeBadgeColorMissingResources = changes.changeBadgeColorMissingResources.newValue;
    } else if (Setting.LOGGING in changes) {
        stateManager.logging = changes.enableLogging.newValue;
    } else if (Setting.BADGE_DEFAULT_TEXT_COLOR in changes) {
        wrappers.badgeDefaultTextColor = changes.badgeDefaultTextColor.newValue;
    } else if (Setting.BADGE_DEFAULT_BACKGROUND_COLOR in changes) {
        wrappers.badgeDefaultBackgroundColor = changes.badgeDefaultBackgroundColor.newValue;
    } else if (Setting.BADGE_HTML_FILTER_TEXT_COLOR in changes) {
        wrappers.badgeHTMLfilterTextColor = changes.badgeHTMLfilterTextColor.newValue;
    } else if (Setting.BADGE_HTML_FILTER_BACKGROUND_COLOR in changes) {
        wrappers.badgeHTMLFilterBackgroundColor = changes.badgeHTMLFilterBackgroundColor.newValue;
    }
};

/**
 * Initialization (restores state after the service worker was stopped)
 */

stateManager.ready = (async function () {
    try {
        const [stored, liveTabs] = await Promise.all([chrome.storage.session.get('tabs'), chrome.tabs.query({})]);
        const restored = stored.tabs || {};
        const tabs = {};

        for (const tab of liveTabs) {
            tabs[tab.id] = restored[tab.id] || stateManager._newTab();
        }
        stateManager.tabs = Object.assign(tabs, stateManager.tabs);
    } catch (err) {
        console.error(`${LogString.PREFIX}`, err);
    }
})();

chrome.tabs.onCreated.addListener(async function (tab) {
    await stateManager.ready;
    stateManager.tabs[tab.id] = stateManager.tabs[tab.id] || stateManager._newTab();
    stateManager.persist();
});

chrome.tabs.onRemoved.addListener(async function (tabIdentifier) {
    await stateManager.ready;
    delete stateManager.tabs[tabIdentifier];
    stateManager.persist();
});

// Remember the URL of the top-level document of each tab (observer only).
chrome.webRequest.onBeforeRequest.addListener(async function (requestDetails) {
    if (requestDetails.tabId === -1) {
        return;
    }
    await stateManager.ready;
    const registeredTab = stateManager.tabs[requestDetails.tabId] || (stateManager.tabs[requestDetails.tabId] = stateManager._newTab());
    registeredTab.details = {'url': requestDetails.url};
    stateManager.persist();
}, {'types': [WebRequestType.MAIN_FRAME], 'urls': [Address.ANY]});

chrome.webNavigation.onCommitted.addListener(stateManager._updateTab, {'url': [{'urlContains': ':'}]});

chrome.storage.onChanged.addListener(stateManager._handleStorageChanged);
