/**
 * DNR Manager
 * Belongs to LocalCDN (Manifest V3)
 *
 * Redirects, blocking, header sanitizing and scheme upgrades are static declarativeNetRequest
 * rulesets (rulesets/*.json, generated from core/mappings.js by tools/). This module toggles
 * them according to the user's settings and maintains the dynamic allowlist rule.
 *
 * @license     MPL 2.0
 */

'use strict';

const dnrManager = {};

dnrManager.ALLOWLIST_RULE_ID = 1;

dnrManager._toRuleDomain = function (entry) {
    if (typeof entry !== 'string') {
        return null;
    }
    let domain = entry.trim().toLowerCase().replace(/^\*\./, '').replace(/:\d+$/, '');
    if (domain === '' || domain.includes('*') || !(/^[a-z0-9.-]+$/).test(domain)) {
        return null;
    }
    // declarativeNetRequest domains always include subdomains.
    return domain;
};

dnrManager.applyAllowlist = async function (allowlistedDomains) {
    const domains = Array.from(new Set(Object.keys(allowlistedDomains || {})
        .map(dnrManager._toRuleDomain).filter((d) => d !== null)));
    const rule = {
        'id': dnrManager.ALLOWLIST_RULE_ID,
        'priority': 1000,
        'action': {'type': 'allow'},
        'condition': {
            'initiatorDomains': domains,
            'resourceTypes': ['font', 'image', 'media', 'object', 'other', 'script', 'stylesheet', 'sub_frame', 'xmlhttprequest']
        }
    };
    try {
        await chrome.declarativeNetRequest.updateDynamicRules({
            'removeRuleIds': [dnrManager.ALLOWLIST_RULE_ID],
            'addRules': domains.length > 0 ? [rule] : []
        });
    } catch (err) {
        console.error(`${LogString.PREFIX} Allowlist rule failed`, err);
    }
};

/**
 * Early MV3 builds added dynamic XHR rules for the test domain only. XHR/fetch requests are now
 * covered by the static rules (like in the MV2 version, where every request type was redirected),
 * so just remove any leftovers from a previous install.
 */
dnrManager.removeLegacyXhrRules = async function () {
    try {
        const legacy = (await chrome.declarativeNetRequest.getDynamicRules()).filter((rule) => rule.id >= 10000);
        if (legacy.length > 0) {
            await chrome.declarativeNetRequest.updateDynamicRules({'removeRuleIds': legacy.map((rule) => rule.id)});
        }
        await chrome.storage.local.remove('xhrRulesKey');
    } catch (err) {
        console.error(`${LogString.PREFIX} Cleanup failed`, err);
    }
};

dnrManager.applyRulesets = async function (settings) {
    const enable = [];
    const disable = [];
    (settings.blockMissing === true ? enable : disable).push('block');
    (settings.stripMetadata !== false ? enable : disable).push('sanitize');
    try {
        await chrome.declarativeNetRequest.updateEnabledRulesets({
            'enableRulesetIds': enable,
            'disableRulesetIds': disable
        });
    } catch (err) {
        console.error(`${LogString.PREFIX} Ruleset update failed`, err);
    }
};

dnrManager._handleStorageChanged = async function (changes) {
    if (Setting.ALLOWLISTED_DOMAINS in changes) {
        dnrManager.applyAllowlist(changes.allowlistedDomains.newValue);
    }
    if (Setting.BLOCK_MISSING in changes || Setting.STRIP_METADATA in changes) {
        const items = await storageManager.type.get([Setting.BLOCK_MISSING, Setting.STRIP_METADATA]);
        dnrManager.applyRulesets(items);
    }
};

chrome.storage.onChanged.addListener(dnrManager._handleStorageChanged);

