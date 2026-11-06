/**
 * Storage Manager
 * Belongs to LocalCDN
 *
 * @author      nobody
 * @since       2020-08-28
 *
 * @license     MPL 2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/.
 */

'use strict';


/**
 * Constants
 */

const InvalidFile = 'Invalid file!';

const LocalOnlySettings = [
    Setting.AMOUNT_INJECTED,
    Setting.INTERNAL_STATISTICS,
    Setting.INTERNAL_STATISTICS_DATA,
    Setting.DEFAULT_RANGE_STATISTIC,
    Setting.STORAGE_TYPE
];

// Settings which can't be set by an enterprise policy
const UnmanagedSettings = [
    Setting.AMOUNT_INJECTED,
    Setting.INTERNAL_STATISTICS_DATA,
    Setting.LAST_MAPPING_UPDATE,
    Setting.STORAGE_TYPE
];


/**
 * Storage Manager
 */

const storageManager = {};


/**
 * Public Methods
 */

storageManager.checkStorageType = function () {
    return new Promise((resolve) => {
        browser.storage.local.get([Setting.STORAGE_TYPE], function (items) {
            if (items.storageType === 'sync') {
                storageManager.type = browser.storage.sync;
            } else {
                storageManager.type = browser.storage.local;
            }
            resolve();
        });
    });
};

storageManager.migrateData = function (target) {
    let storageSource, storageDestination, syncFetch;

    syncFetch = false;

    if (target === 'local') {
        storageSource = browser.storage.sync;
        storageDestination = browser.storage.local;
    } else if (target === 'sync') {
        storageSource = browser.storage.local;
        storageDestination = browser.storage.sync;
    } else if (target === 'sync-fetch') {
        storageSource = browser.storage.sync;
        storageDestination = browser.storage.sync;
        target = 'sync';
        syncFetch = true;
    } else {
        return;
    }

    storageSource.get(null, function (data) {
        const settings = {};
        for (const key of Object.keys(SettingDefaults)) {
            if (!LocalOnlySettings.includes(key) && data[key] !== undefined) {
                settings[key] = data[key];
            }
        }

        // Local-only settings (statistics, counter) always stay in the local storage
        Promise.all([
            new Promise((resolve) => browser.storage.local.set({[Setting.STORAGE_TYPE]: target}, resolve)),
            new Promise((resolve) => storageDestination.set(settings, resolve))
        ]).then(() => {
            if (syncFetch === true) {
                browser.runtime.reload();
            }
        });
    });
};

storageManager.getSettings = function (callback) {
    storageManager.type.get(null, function (items) {
        browser.storage.local.get(LocalOnlySettings, function (localItems) {
            callback(Object.assign(items, localItems));
        });
    });
};

storageManager.setSettings = function (items) {
    const localItems = {};

    for (const key of LocalOnlySettings) {
        if (key in items) {
            localItems[key] = items[key];
            delete items[key];
        }
    }

    if (storageManager.type === browser.storage.sync) {
        // Remove local-only settings which were written to the sync storage by mistake
        browser.storage.sync.remove(LocalOnlySettings);
    }

    return Promise.all([
        new Promise((resolve) => browser.storage.local.set(localItems, resolve)),
        new Promise((resolve) => storageManager.type.set(items, resolve))
    ]);
};

storageManager.getManagedSettings = function () {
    // Enterprise policy, e.g. 'policies.json' -> '3rdparty' -> 'Extensions' in Firefox
    if (browser.storage.managed === undefined) {
        return Promise.resolve({});
    }
    // The promise is rejected if there is no policy for this extension
    return browser.storage.managed.get().then((items) => items || {}, () => ({}));
};

storageManager.validateManagedSettings = function (managed) {
    const valid = {};

    for (const [key, value] of Object.entries(managed)) {
        if (!(key in SettingDefaults) || UnmanagedSettings.includes(key)) {
            continue;
        }
        if (storageManager._isValidManagedValue(key, value)) {
            valid[key] = value;
        } else {
            console.warn(`[ LocalCDN ] Invalid value of managed setting: ${key}`);
        }
    }
    return valid;
};

storageManager.export = function () {
    let filename = new Date().toISOString();
    filename = `${filename.substring(0, 10)}_localcdn_backup.txt`;

    storageManager.type.get(null, function (items) {
        delete items['whitelistedDomains'];
        let element = document.createElement('a');
        element.setAttribute('href', `data:text/plain;charset=utf-8,${encodeURIComponent(JSON.stringify(items, null, '  '))}`);
        element.setAttribute('download', filename);
        element.style.display = 'none';
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    });
};

storageManager.startImportFilePicker = function () {
    const input = document.getElementById('import-file-picker');
    input.value = '';
    input.click();
};

storageManager.handleImportFilePicker = function () {
    const file = document.getElementById('import-file-picker').files[0];
    const reader = new FileReader();

    reader.readAsText(file, 'UTF-8');

    reader.onload = (ev) => {
        let content = ev.target.result;
        try {
            storageManager._validation(JSON.parse(content));
        } catch (err) {
            console.error(`[ LocalCDN ] ${err}`);
            if (err !== InvalidFile) {
                alert(err);
            }
        }
    };
};


/**
 * Private Methods
 */

storageManager._handleStorageChanged = function (type, areaName) {
    if (areaName === 'local' && Setting.STORAGE_TYPE in type) {
        if (type.storageType.newValue === 'sync') {
            storageManager.type = browser.storage.sync;
        } else {
            storageManager.type = browser.storage.local;
        }
    }
};

storageManager._validation = function (content) {
    let imported = {};

    // Delete old keys
    if (content.whitelistedDomains !== undefined) {
        content.allowlistedDomains = content.whitelistedDomains;
        delete content['whitelistedDomains'];
    }

    // Convert value of notifications
    if (content.hideReleaseNotes !== undefined) {
        content.updateNotification = content.hideReleaseNotes ? 0 : 2;
        delete content['hideReleaseNotes'];
    }

    // Convert type of updateNotification
    if (typeof content.updateNotification === 'string') {
        content.updateNotification = parseInt(content.updateNotification);
    }

    // Migrate badge colors
    if (content.badgeDefaultBackgroundColor === undefined) {
        content.badgeDefaultBackgroundColor = content.badgeColor;
    }
    if (content.badgeDefaultTextColor === undefined) {
        content.badgeDefaultTextColor = content.badgeTextColor;
    }

    for (const [key, value] of Object.entries(SettingDefaults)) {
        // If type the same as default settings
        if (content[key] !== null && typeof value === typeof content[key]) {
            if (typeof value === 'object') {
                imported[key] = storageManager._validateDomainsAndStatistics(key, content[key]);
            } else if (typeof value === 'string') {
                imported[key] = storageManager._validateStrings(content[key]);
            } else if (typeof value === 'number') {
                imported[key] = storageManager._validateNumbers(content[key]);
            } else if (typeof value === 'boolean') {
                imported[key] = content[key];
            }
        } else if (content[key] === undefined) {
            // Set default if not existing in file
            imported[key] = value;
        } else {
            alert(`${browser.i18n.getMessage('dialogImportFailed')}\n\n${key}: ${content[key]}`);
            throw InvalidFile;
        }
    }

    storageManager.type.set(imported);

    alert(browser.i18n.getMessage('dialogImportSuccessful'));
    browser.runtime.reload();
};

storageManager._validateDomainsAndStatistics = function (type, obj) {
    let valid = {};

    if (type === 'allowedDomainsGoogleFonts' || type === 'domainsManipulateDOM' || type === 'allowlistedDomains') {
        for (const [key, value] of Object.entries(obj)) {
            // eslint-disable-next-line no-useless-escape
            if (((Regex.LISTED_HOST).test(key) || key === '') && value === true) {
                valid[key] = value;
            } else {
                alert(`${browser.i18n.getMessage('dialogImportFailed')}: ${key}`);
                throw InvalidFile;
            }
        }
    } else if (type === 'internalStatisticsData') {
        for (const [date, values] of Object.entries(obj)) {
            if ((Regex.INTERNAL_STATISTICS_DATA).test(date)) {
                for (const [types, category] of Object.entries(values)) {
                    if (types === 'frameworks') {
                        for (const [name, counter] of Object.entries(category)) {
                            // eslint-disable-next-line max-len
                            if (!(Regex.INTERNAL_RESOURCES).test(name) || !Number.isFinite(counter)) {
                                alert(`${browser.i18n.getMessage('dialogImportFailed')}: ${name}`);
                                throw InvalidFile;
                            }
                        }
                    } else if (types === 'cdns') {
                        for (const [name, counter] of Object.entries(category)) {
                            // eslint-disable-next-line no-useless-escape, max-len
                            if (!(Regex.DOMAIN).test(name) || !Number.isFinite(counter)) {
                                alert(`${browser.i18n.getMessage('dialogImportFailed')}: ${name}`);
                                throw InvalidFile;
                            }
                        }
                    } else {
                        alert(`${browser.i18n.getMessage('dialogImportFailed')}: ${type}`);
                        throw InvalidFile;
                    }
                }
            } else {
                alert(`${browser.i18n.getMessage('dialogImportFailed')}: ${date}`);
                throw InvalidFile;
            }
        }
        valid = obj;
    } else {
        alert(`${browser.i18n.getMessage('dialogImportFailed')}: ${type}`);
        throw InvalidFile;
    }
    return valid;
};

storageManager._validateStrings = function (value) {
    if ((Regex.ISO_DATE).test(value)) {
        return value;
    } else if ((Regex.HEX_COLOR).test(value)) {
        return value;
    } else if (value === 'Default' || value === 'Light' || value === 'Grey') {
        return value;
    } else if (value === 'local' || value === 'sync') {
        return value;
    } else if (value === 'decentraleyes.org' || value === 'localcdn.org') {
        return 'localcdn.org';
    } else {
        return '';
    }
};

storageManager._validateNumbers = function (value) {
    return isNaN(value) ? 0 : value;
};

storageManager._isValidManagedValue = function (key, value) {
    const defaultValue = SettingDefaults[key];

    if (value === null || typeof value !== typeof defaultValue) {
        return false;
    }
    if (typeof value === 'object') {
        // Domain lists
        return !Array.isArray(value) &&
            Object.entries(value).every(([host, enabled]) => (Regex.LISTED_HOST).test(host) && enabled === true);
    }
    if (key === Setting.UPDATE_NOTIFICATION) {
        return [0, 1, 2].includes(value);
    }
    if (key === Setting.DEFAULT_RANGE_STATISTIC) {
        return ['day', 'week', 'month', 'year', 'all'].includes(value);
    }
    if (typeof value === 'string') {
        return storageManager._validateStrings(value) === value;
    }
    return true;
};


/**
 * Initializations
 */

storageManager.data = {};
storageManager.type = browser.storage.local;
storageManager.amountInjected = 0;
storageManager.statistics = {};
storageManager.ready = storageManager.checkStorageType();

browser.storage.onChanged.addListener(storageManager._handleStorageChanged);
