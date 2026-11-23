const isNode = typeof window === 'undefined';
const windowObj = isNode ? { localStorage: new Map() } : window;
const storage = windowObj.localStorage;

const toSnakeCase = (str) => {
	return str.replace(/([A-Z])/g, '_$1').toLowerCase();
}

// Validasi parameter dari URL: tanpa ini, tautan seperti
// ?app_base_url=https://situs-palsu membelokkan halaman login ke situs phishing.
const isTrustedBaseUrl = (v) => {
	try {
		const u = new URL(v);
		if (u.protocol !== 'https:' && !(u.protocol === 'http:' && u.hostname === 'localhost')) return false;
		const h = u.hostname.toLowerCase();
		return h === window.location.hostname || h === 'base44.app' || h.endsWith('.base44.app') || h === 'base44.com' || h.endsWith('.base44.com');
	} catch {
		return false;
	}
};
const VALIDATORS = {
	app_base_url: isTrustedBaseUrl,
	app_id: (v) => /^[a-f0-9]{24}$/i.test(v),
	functions_version: (v) => /^[A-Za-z0-9._-]{1,64}$/.test(v),
};

const getAppParamValue = (paramName, { defaultValue = undefined, removeFromUrl = false } = {}) => {
	if (isNode) {
		return defaultValue;
	}
	const storageKey = `base44_${toSnakeCase(paramName)}`;
	const urlParams = new URLSearchParams(window.location.search);
	const rawParam = urlParams.get(paramName);
	const isValid = VALIDATORS[paramName] || (() => true);
	const searchParam = rawParam && isValid(rawParam) ? rawParam : null;
	if (removeFromUrl) {
		urlParams.delete(paramName);
		const newUrl = `${window.location.pathname}${urlParams.toString() ? `?${urlParams.toString()}` : ""
			}${window.location.hash}`;
		window.history.replaceState({}, document.title, newUrl);
	}
	if (searchParam) {
		storage.setItem(storageKey, searchParam);
		return searchParam;
	}
	if (defaultValue) {
		storage.setItem(storageKey, defaultValue);
		return defaultValue;
	}
	const storedValue = storage.getItem(storageKey);
	if (storedValue && isValid(storedValue)) {
		return storedValue;
	}
	return null;
}

const getAppParams = () => {
	if (getAppParamValue("clear_access_token") === 'true') {
		storage.removeItem('base44_access_token');
		storage.removeItem('token');
	}
	return {
		appId: getAppParamValue("app_id", { defaultValue: import.meta.env.VITE_BASE44_APP_ID }),
		token: getAppParamValue("access_token", { removeFromUrl: true }),
		fromUrl: getAppParamValue("from_url", { defaultValue: window.location.href }),
		functionsVersion: getAppParamValue("functions_version", { defaultValue: import.meta.env.VITE_BASE44_FUNCTIONS_VERSION }),
		appBaseUrl: getAppParamValue("app_base_url", { defaultValue: import.meta.env.VITE_BASE44_APP_BASE_URL }),
	}
}


export const appParams = {
	...getAppParams()
}
