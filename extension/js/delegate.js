"use strict"

// Background
function background(callback) {
	chrome.runtime.getBackgroundPage(chrome_callback.bind(this, callback))
}

// Callback
function chrome_callback(callback, result) {
	if (arguments.length > 2) {
		console.warn(arguments)
		throw new Error("chrome_callback() does not support multiple arguments.")
	}

	return callback(chrome.runtime.lastError, result)
}

// Identity
function identity_user_info(callback) {
	chrome.identity.getProfileUserInfo(chrome_callback.bind(this, callback))
}

// Permissions
// TODO Permissions() object
function permissions(func, permissions, callback) {
	chrome.permissions[func](permissions, chrome_callback.bind(this, callback))
}
function permissions_all(callback) {
	chrome.permissions.getAll(chrome_callback.bind(this, callback))
}
function permissions_check(data, callback) {
	permissions.call(this, "contains", data, callback)
}
function permissions_request(data, callback) {
	permissions.call(this, "request", data, callback)
}
function permissions_remove(data, callback) {
	permissions.call(this, "remove", data, callback)
}

// Tabs
function tabs_query(queryInfo, callback) {
	chrome.tabs.query(queryInfo, chrome_callback.bind(this, callback))
}
function tabs_reload(tabIds, callback) {
	chrome.tabs.reload(tabIds, chrome_callback.bind(this, callback))
}
