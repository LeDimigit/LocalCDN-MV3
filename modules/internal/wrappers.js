/**
 * Internal API Wrapper Module
 * Belongs to LocalCDN.
 *
 * @author      Thomas Rientjes
 * @since       2017-12-03

 * @author      nobody
 * @since       2020-07-09

 * @license     MPL 2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/.
 */

'use strict';


/**
 * Wrappers
 */

const wrappers = {};


/**
 * Public Methods
 */

wrappers.setBadgeBackgroundColor = function (details) {
    if (browser.action.setBadgeBackgroundColor === undefined) {
        return;
    }

    if (details.type === BadgeSetting.TYPE) {
        storageManager.type.set({[Setting.BADGE_DEFAULT_BACKGROUND_COLOR]: details.color});
        wrappers.badgeDefaultBackgroundColor = details.color;
    } else if (details.type === BadgeSettingHTMLFilter.TYPE) {
        storageManager.type.set({[Setting.BADGE_HTML_FILTER_BACKGROUND_COLOR]: details.color});
        wrappers.badgeHTMLFilterBackgroundColor = details.color;
    } else if (details.type === BadgeSettingMissingResource.TYPE) {
        storageManager.type.set({[Setting.BADGE_MISSING_RESOURCE_BACKGROUND_COLOR]: details.color});
        wrappers.badgeMissingResourceBackgroundColor = details.color;
    }
};

wrappers.setBadgeTextColor = function (details) {
    if (browser.action.setBadgeTextColor === undefined) {
        return;
    }

    if (details.type === BadgeSetting.TYPE) {
        storageManager.type.set({[Setting.BADGE_DEFAULT_TEXT_COLOR]: details.color});
        wrappers.badgeDefaultTextColor = details.color;
    } else if (details.type === BadgeSettingHTMLFilter.TYPE) {
        storageManager.type.set({[Setting.BADGE_HTML_FILTER_TEXT_COLOR]: details.color});
        wrappers.badgeHTMLfilterTextColor = details.color;
    } else if (details.type === BadgeSettingMissingResource.TYPE) {
        storageManager.type.set({[Setting.BADGE_MISSING_RESOURCE_TEXT_COLOR]: details.color});
        wrappers.badgeMissingResourceTextColor = details.color;
    }
};

wrappers.setBadgeText = function (tabId, text) {
    if (browser.action.setBadgeText !== undefined && wrappers._isChanged(tabId, 'text', `${text}`)) {
        browser.action.setBadgeText({
            'tabId': tabId,
            'text': `${text}`
        });
    }
};

wrappers.setIcon = function (details, type) {
    if (browser.action.setIcon) {
        details.path = IconType[details.path][type];
        browser.action.setIcon(details);
    }
};

wrappers.setBadgeColoring = function (tabId, value) {
    let textColor, backgroundColor;

    if (value === BadgeSettingHTMLFilter.TYPE) {
        textColor = wrappers.badgeHTMLfilterTextColor;
        backgroundColor = wrappers.badgeHTMLFilterBackgroundColor;
    } else if (value === BadgeSetting.TYPE) {
        textColor = wrappers.badgeDefaultTextColor;
        backgroundColor = wrappers.badgeDefaultBackgroundColor;
    } else if (value === BadgeSettingMissingResource.TYPE) {
        textColor = wrappers.badgeMissingResourceTextColor;
        backgroundColor = wrappers.badgeMissingResourceBackgroundColor;
    } else {
        return;
    }

    if (!wrappers._isChanged(tabId, 'coloring', `${textColor}|${backgroundColor}`)) {
        return;
    }

    if (browser.action.setBadgeTextColor !== undefined) {
        browser.action.setBadgeTextColor({
            'tabId': tabId,
            'color': textColor
        });
    }

    if (browser.action.setBadgeBackgroundColor !== undefined) {
        browser.action.setBadgeBackgroundColor({
            'tabId': tabId,
            'color': backgroundColor
        });
    }
};

wrappers.setTitle = function (tabId, title) {
    if (wrappers._isChanged(tabId, 'title', title)) {
        browser.action.setTitle({
            'tabId': tabId,
            'title': title
        });
    }
};

wrappers.resetTab = function (tabId) {
    // The browser resets tab-specific values on navigation
    delete wrappers._tabValues[tabId];
};


/**
 * Private Methods
 */

wrappers._isChanged = function (tabId, key, value) {
    // Remembers the last value per tab, so the browser is only called if something changed
    if (wrappers._tabValues[tabId] === undefined) {
        wrappers._tabValues[tabId] = {};
    }
    if (wrappers._tabValues[tabId][key] === value) {
        return false;
    }
    wrappers._tabValues[tabId][key] = value;
    return true;
};


/**
 * Initializations
 */

wrappers._tabValues = {};
