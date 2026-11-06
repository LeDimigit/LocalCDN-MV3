/**
 * Internal Helper Module
 * Belongs to LocalCDN (since 2020-02-26)
 * (Origin: Decentraleyes)
 *
 * @author      Thomas Rientjes
 * @since       2017-10-26
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
 * Helpers
 */

const helpers = {};


/**
 * Public Methods
 */

helpers.insertI18nContentIntoDocument = function (document) {
    const scriptDirection = helpers.determineScriptDirection(navigator.language);
    const i18nElements = document.querySelectorAll('[data-i18n-content]');

    let translationComplete = true;

    i18nElements.forEach(function (i18nElement) {
        const i18nMessageName = i18nElement.getAttribute('data-i18n-content');

        if (browser.i18n.getMessage(i18nMessageName) !== '') {
            if (i18nElement.type === 'button') {
                i18nElement.value = browser.i18n.getMessage(i18nMessageName);
            } else {
                i18nElement.textContent = browser.i18n.getMessage(i18nMessageName);
            }
            i18nElement.setAttribute('dir', scriptDirection);
        } else {
            translationComplete = false;
        }
    });

    return translationComplete;
};

helpers.insertI18nTitlesIntoDocument = function (document) {
    const scriptDirection = helpers.determineScriptDirection(navigator.language);
    const i18nElements = document.querySelectorAll('[data-i18n-title]');

    i18nElements.forEach(function (i18nElement) {
        let i18nMessageName = i18nElement.getAttribute('data-i18n-title');

        i18nElement.setAttribute('title', browser.i18n.getMessage(i18nMessageName));
        i18nElement.setAttribute('dir', scriptDirection);
    });
};

helpers.languageIsFullySupported = function (language) {

    let languageSupported = false;

    const supportedLanguages = [
        'ar',
        'bg',
        'ca',
        'cs',
        'da',
        'de',
        'el',
        'en',
        'en_CA',
        'en_US',
        'eo',
        'es',
        'et',
        'fa',
        'fi',
        'fr',
        'he',
        'hr',
        'hu',
        'id',
        'is',
        'it',
        'ja',
        'kn',
        'ko',
        'lb',
        'lt',
        'ml',
        'nb_NO',
        'nl',
        'pl',
        'pt',
        'pt_BR',
        'pt_PT',
        'ro',
        'ru',
        'sco',
        'si',
        'sk',
        'sl',
        'sr',
        'sv',
        'te',
        'tl',
        'tr',
        'uk',
        'vi',
        'zh_Hans',
        'zh_Hant'
    ];

    for (const supportedLanguage of supportedLanguages) {
        if (language.search(supportedLanguage) !== -1) {
            languageSupported = true;
        }
    }

    return languageSupported;
};

helpers.normalizeDomain = function (domain) {
    return domain.toLowerCase().trim();
};

helpers.extractDomainFromUrl = function (url, normalize) {
    if ((/^(?!(http[s]?|file):\/\/).*/).test(url)) {
        return null;
    }

    let extractedDomain;

    try {
        extractedDomain = new URL(url).host;
    } catch (exception) {
        extractedDomain = null;
    }

    if (url.startsWith(Address.CHROME)) {
        extractedDomain = null;
    }

    if (extractedDomain === '') {
        extractedDomain = null;
    }

    if (extractedDomain !== null && normalize === true) {
        extractedDomain = helpers.normalizeDomain(extractedDomain);
    }

    return extractedDomain;
};

helpers.getWildcard = function (initiatorDomain) {
    let domain = initiatorDomain.split('.');

    if (domain.length > 2) {
        domain[0] = '*';
        domain = domain.join().replace(/,/g, '.');
        return domain;
    }
};

helpers.getTopLevelDomain = function (initiatorDomain) {
    const domain = initiatorDomain.split('.');

    domain[domain.length - 2] = '*';
    return `${domain[domain.length - 2]}.${domain[domain.length - 1]}`;
};

helpers.checkAllowlisted = function (domain, list) {
    if (!domain) return false;

    const subdomains = helpers.getAllSubdomains(domain);

    for (const subdomain of subdomains) {
        if (list[subdomain]) return true;
    }
    return false;
};


helpers.getAllSubdomains = function (domain) {
    const parts = domain.split('.').reverse();
    const subdomains = [];
    let currentSubdomain = '';

    for (const part of parts) {
        currentSubdomain = part + (currentSubdomain ? `.${currentSubdomain}` : '');
        subdomains.push(`*.${currentSubdomain}`);
        subdomains.push(currentSubdomain);
    }

    return subdomains;
};

helpers.extractFilenameFromPath = function (path) {

    const pathSegments = path.split('/');
    const filename = pathSegments[pathSegments.length - 1];

    return filename === '' ? pathSegments[1] : filename;
};

helpers.determineCdnName = function (domainName) {
    return CDNs[domainName] || 'Unknown';
};

helpers.determineScriptDirection = function (language) {
    let scriptDirection;

    const rightToLeftLanguages = ['ar', 'fa', 'he'];
    const primaryLanguage = language.split(/[-_]/)[0].toLowerCase();

    if (rightToLeftLanguages.indexOf(primaryLanguage) === -1) {
        scriptDirection = 'ltr';
    } else {
        scriptDirection = 'rtl';
    }

    return scriptDirection;
};

helpers.determineActiveTab = function () {
    return new Promise((resolve) => {
        let opt = {
            'active': true,
            'currentWindow': true
        };

        browser.tabs.query(opt, function (tabs) {
            if (tabs[0]) {
                resolve(tabs[0]);
            } else {
                opt = {'active': true};

                browser.tabs.query(opt, function (fallbackTabs) {
                    resolve(fallbackTabs[0]);
                });
            }
        });
    });
};


helpers.formatNumber = function (number) {
    if (typeof number === 'number') {
        return number.toLocaleString();
    }
};

helpers.formatFilename = function (targetPath) {
    if (targetPath.startsWith('resources/element-ui/')) {
        if (!targetPath.endsWith('.min.jsm')) {
            targetPath = targetPath.replace('.jsm', '.min.jsm');
        }
    }
    return targetPath;
};

helpers.compareVersion = function (v1, v2) {
    /**
     *  compareVersion( '1.5.7' , '1.5.8' ) is FALSE
     *  compareVersion( '1.5.8' , '1.5.7' ) is TRUE
     *  compareVersion( '1.5.7' , '1.5.7' ) is TRUE
     */
    v1 = v1.split('.');
    v2 = v2.split('.');
    const k = Math.min(v1.length, v2.length);
    for (let i = 0; i < k; ++i) {
        v1[i] = parseInt(v1[i], 10);
        v2[i] = parseInt(v2[i], 10);
        if (v1[i] > v2[i]) {
            return true;
        }
        if (v1[i] < v2[i]) {
            return false;
        }
    }
    return v1.length === v2.length ? true : v1.length < v2.length ? false : true;
};

helpers.throttle = function (callback, interval) {
    // Runs the first call immediately, further calls at most once per interval (the last one is never lost)
    let timeout = null;
    let pending = false;

    const wait = function () {
        timeout = setTimeout(function () {
            timeout = null;
            if (pending) {
                pending = false;
                callback();
                wait();
            }
        }, interval);
    };

    return function () {
        if (timeout === null) {
            callback();
            wait();
        } else {
            pending = true;
        }
    };
};

helpers.isGoogleDomain = function (initiatorDomain) {
    const parts = initiatorDomain.split('.');

    // remove subdomains if exist
    if (parts.length > 2) {
        parts.shift();
    }

    return GoogleDomains[parts.join('.')] || false;
};
