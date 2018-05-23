"use strict"
/**
 *
 * @param {String} [storageArea]
 * @returns {*}
 * @constructor
 */
function Storage(storageArea) {
	storageArea = storageArea || "sync"

	function get(object, keys) {
		const key = keys.shift() || null
		if (key) {
			if (!object.hasOwnProperty(key)) {
				return null
			}

			object = object[key]
		}

		if (keys.length === 0) {
			return object
		}

		return get(object, keys) // recursive
	}

	function remove(object, keys) {
		const key = keys.shift() || null

		if (!key || !object.hasOwnProperty(key)) {
			return false
		}

		if (keys.length === 0) {
			delete object[key]
			return true
		}

		return remove(object[key], keys) // recursive
	}

	function storageClear(callback) {
		const chromeCallback = chrome_callback.bind(this, callback)
		chrome.storage[storageArea].clear(chromeCallback)
	}

	function storageGet(keys, callback) {
		const chromeCallback = chrome_callback.bind(this, callback)
		chrome.storage[storageArea].get(keys, chromeCallback)
	}

	function storageSet(data, callback) {
		const chromeCallback = chrome_callback.bind(this, callback)
		chrome.storage[storageArea].set(data, chromeCallback)
	}

	return {
		clearStorage: function* () {
			yield storageClear.bind(this)
		},
		getStorageValue: function* (...keys) {
			// Load existing
			const storage = yield storageGet.bind(this, null)
			// Find desired leaf
			const value = get(storage, keys)

			return value
		},
		removeStorageValue: function* (...keys) {
			// Load existing
			let stored = yield storageGet.bind(this, null)
			// Remove desired leaf
			const result = remove(stored, keys)
			if (result) {
				// Save upon successful leaf removal
				yield storageSet.bind(this, stored)
			}

			return result
		},
		setStorageValue: function* (...keysEndWithValue) {
			// Load existing
			const stored = yield storageGet.bind(this, null)
			// Merge new value
			const append = setObjectStack.apply(this, keysEndWithValue)
			const storage = Object.assignDeep({}, stored, append)
			// Save
			yield storageSet.bind(this, storage)
		}
	}
}
