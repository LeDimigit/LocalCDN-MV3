/**
 * Entry Point
 * Belongs to LocalCDN (since 2020-02-26)
 * (Origin: Decentraleyes)
 *
 * @author      Thomas Rientjes
 * @since       2016-04-04
 *
 * @author      nobody
 * @since       2020-02-26
 *
 * @license     MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/.
 */

'use strict';


/**
 * Main
 */

const main = {};


/**
 * Private Methods
 */

main._initializeSettings = function () {
    main.settingsReady = storageManager.getManagedSettings().then((managed) => {
        main.hideWelcomePage = managed[Setting.HIDE_WELCOME_PAGE] === true;
        main.managedSettings = storageManager.validateManagedSettings(managed);
        return storageManager.ready;
    }).then(() => new Promise((resolve) => storageManager.getSettings(function (items) {
        // Delete old keys
        if (items.whitelistedDomains !== undefined) {
            if (items.allowlistedDomains === undefined || Object.keys(items.allowlistedDomains).length === 0) {
                items['allowlistedDomains'] = items.whitelistedDomains;
            }
            delete items['whitelistedDomains'];
            storageManager.type.remove('whitelistedDomains');
        }

        // Convert value of notifications
        if (items.hideReleaseNotes !== undefined) {
            if (items.hideReleaseNotes === true) {
                items.updateNotification = 0;
            } else {
                items.updateNotification = 2;
            }
            delete items['hideReleaseNotes'];
            storageManager.type.remove('hideReleaseNotes');
        }

        // Use default if key is missing
        for (const key of Object.keys(SettingDefaults)) {
            if (items[key] === undefined) {
                items[key] = SettingDefaults[key];
            }
        }

        // Settings of an enterprise policy override the stored settings on every start
        Object.assign(items, main.managedSettings);

        if (items.disablePrefetch !== false) {
            browser.privacy.network.networkPredictionEnabled.set({
                'value': false
            });
        }

        stateManager.selectedIcon = items.selectedIcon;
        stateManager.showIconBadge = items.showIconBadge !== false;
        stateManager.getInvertOption = items.negateHtmlFilterList === undefined ? true : items.negateHtmlFilterList;
        stateManager.internalStatistics = items.internalStatistics;
        stateManager.hideDonationButton = items.hideDonationButton;
        stateManager.hideCounters = items.hideCounters;
        stateManager.changeBadgeColorMissingResources = items.changeBadgeColorMissingResources;
        stateManager.logging = items.enableLogging;

        wrappers.setIcon({
            'path': stateManager.selectedIcon
        }, 'Enabled');

        storageManager.amountInjected = items.amountInjected;
        interceptor.xhrTestDomain = items.xhrTestDomain;
        interceptor.allowedDomainsGoogleFonts = items.allowedDomainsGoogleFonts;
        interceptor.blockMissing = items.blockMissing;
        interceptor.blockGoogleFonts = items.blockGoogleFonts;
        requestAnalyzer.allowlistedDomains = items.allowlistedDomains;
        requestAnalyzer.domainsManipulateDOM = items.domainsManipulateDOM || {};

        wrappers.badgeDefaultTextColor = items.badgeDefaultTextColor;
        wrappers.badgeDefaultBackgroundColor = items.badgeDefaultBackgroundColor;
        wrappers.badgeHTMLfilterTextColor = items.badgeHTMLfilterTextColor;
        wrappers.badgeHTMLFilterBackgroundColor = items.badgeHTMLFilterBackgroundColor;
        wrappers.badgeMissingResourceTextColor = items.badgeMissingResourceTextColor;
        wrappers.badgeMissingResourceBackgroundColor = items.badgeMissingResourceBackgroundColor;

        wrappers.setBadgeTextColor({'color': items.badgeDefaultTextColor, 'type': 'default'});
        wrappers.setBadgeBackgroundColor({'color': items.badgeDefaultBackgroundColor, 'type': 'default'});

        // Copy for the DNR rulesets, setSettings() removes the local-only keys
        const dnrItems = Object.assign({}, items);

        // Static rulesets follow the settings; the dynamic allowlist rule mirrors the allowlist.
        resolve(storageManager.setSettings(items).then(async () => {
            await dnrManager.applyRulesets(dnrItems);
            await dnrManager.applyAllowlist(dnrItems.allowlistedDomains);
            await dnrManager.removeLegacyXhrRules();
        }));
    })));

    return main.settingsReady;
};

main._showReleaseNotes = function (details) {
    // Wait for the settings, they may be changed by an enterprise policy
    main.settingsReady.then(() => main._handleInstalled(details));
};

main._handleStorageChanged = function (changes, areaName) {
    // Settings of an enterprise policy can't be changed, e.g. by the popup or an import
    const reset = {};

    for (const key of Object.keys(changes)) {
        if (!(key in main.managedSettings) || areaName !== main._getStorageArea(key)) {
            continue;
        }
        if (!main._isEqualSetting(changes[key].newValue, main.managedSettings[key])) {
            reset[key] = main.managedSettings[key];
        }
    }

    if (Object.keys(reset).length > 0) {
        storageManager.setSettings(reset);
    }
};

main._getStorageArea = function (key) {
    if (LocalOnlySettings.includes(key) || storageManager.type === browser.storage.local) {
        return 'local';
    }
    return 'sync';
};

main._isEqualSetting = function (value, managedValue) {
    if (typeof managedValue === 'object') {
        // Domain lists, all values are true
        return typeof value === 'object' && value !== null &&
            JSON.stringify(Object.keys(value).sort()) === JSON.stringify(Object.keys(managedValue).sort());
    }
    return value === managedValue;
};

main._handleInstalled = function (details) {
    if (details.reason === browser.runtime.OnInstalledReason.INSTALL) {
        storageManager.type.set({
            [Setting.LAST_MAPPING_UPDATE]: mappings.lastMappingUpdate
        }, function () {
            if (details.temporary !== true && main.hideWelcomePage !== true) {
                browser.tabs.create({
                    'url': browser.runtime.getURL('pages/welcome/welcome.html'),
                    'active': true
                });
            }
        });
    } else if (details.reason === browser.runtime.OnInstalledReason.UPDATE) {
        storageManager.getSettings(function (items) {
            let mappingUpdate = items.lastMappingUpdate !== mappings.lastMappingUpdate;

            // Migrate old keys to new keys https://codeberg.org/nobody/LocalCDN/issues/613
            if (items.badgeDefaultBackgroundColor === undefined) {
                items.badgeDefaultBackgroundColor = items.badgeColor;
                delete items.badgeColor;
            }

            // Migrate old keys to new keys https://codeberg.org/nobody/LocalCDN/issues/613
            if (items.badgeDefaultTextColor === undefined) {
                items.badgeDefaultTextColor = items.badgeTextColor;
                delete items.badgeTextColor;
            }

            // Remove old keys
            const obsoleteKeys = Object.keys(items).filter((key) => !(key in SettingDefaults));
            for (const key of obsoleteKeys) {
                delete items[key];
            }
            storageManager.type.remove(obsoleteKeys);
            // Override old value https://codeberg.org/nobody/LocalCDN/issues/177
            items.xhrTestDomain = 'localcdn.org';

            // Updated mappings.js
            if (mappingUpdate) {
                items.lastMappingUpdate = mappings.lastMappingUpdate;
            }

            if ((mappingUpdate && items.updateNotification === 1) || items.updateNotification === 2) {
                browser.tabs.create({
                    'url': browser.runtime.getURL(`pages/updates/updates.html?mappingupdate=${mappingUpdate}`),
                    'active': false
                });
            } else {
                // No mappings.js update
            }
            storageManager.setSettings(items);
        });
    }
};


/**
 * Initializations
 */
main.managedSettings = {};
main.hideWelcomePage = false;

browser.runtime.onInstalled.addListener(main._showReleaseNotes);
browser.storage.onChanged.addListener(main._handleStorageChanged);
main.ready = main._initializeSettings().catch((err) => console.error(`${LogString.PREFIX}`, err));
