"use strict"
/**
 *
 * @returns {*}
 * @constructor
 */
function Request() {
	let excludedHeaders = []
	let responseHeaders = {}

	/**
	 *
	 * @param {String} resource
	 * @param {Object} [params]
	 * @param {Object} [headers]
	 * @param {String} responseType
	 * @returns {*}
	 */
	function* _delete(resource, params, headers, responseType) {
		if (typeof params !== "string") {
			params = serialize(params) || null
		}
		headers = headers || {}

		if (!headers.hasOwnProperty("Content-Type")) {
			headers["Content-Type"] = "application/x-www-form-urlencoded;charset=UTF-8"
		}

		return yield make("DELETE", resource, params, headers, responseType)
	}

	/**
	 *
	 * @param {String} key
	 */
	function excludeHeader(key) {
		if (!excludedHeaders.includes(key)) {
			excludedHeaders.push(key)
		}
	}

	/**
	 *
	 * @returns {Object}
	 */
	function getResponseHeaders() {
		return responseHeaders
	}

	/**
	 *
	 * @param {String} resource
	 * @param {Object} [query]
	 * @param {Object} [headers]
	 * @param {String} [responseType]
	 * @returns {*}
	 */
	function* get(resource, query, headers, responseType) {
		if (typeof query !== "string") {
			query = serialize(query) || null
		}
		if (query) {
			resource += (resource.indexOf("?") === -1) ? "?" : "&"
			resource += query
		}

		return yield make("GET", resource, null, headers, responseType)
	}

	/**
	 *
	 * @param {String} method
	 * @param {String} resource
	 * @param {String} [params]
	 * @param {Object} [headers]
	 * @param {String} [responseType]
	 * @returns {Function}
	 */
	function make(method, resource, params, headers, responseType) {
		const manifest = chrome.runtime.getManifest()

		if (typeof method !== "string") {
			throw new TypeError("Invalid method provided: " + typeof method)
		}
		if (typeof resource !== "string") {
			throw new TypeError("Invalid resource provided: " + typeof resource)
		}

		method = method.toUpperCase()
		headers = headers || {}
		responseType = responseType || "text"

		if (!excludedHeaders.includes("X-Ajax-Engine")) {
			headers["X-Ajax-Engine"] = manifest.name + "/" + manifest.version
		}
		if (!excludedHeaders.includes("X-Requested-With")) {
			headers["X-Requested-With"] = "XMLHttpRequest"
		}

		return function(callback) {
			let xhr = new XMLHttpRequest()
			xhr.addEventListener("readystatechange", onsuccess.bind(xhr, callback))
			xhr.responseType = responseType
			xhr.open(method, resource, true)
			for (const field in headers) {
				if (headers.hasOwnProperty(field)) {
					xhr.setRequestHeader(field, headers[field])
				}
			}
			xhr.send(params)
		}
	}

	/**
	 *
	 * @param {String} raw
	 * @returns {Object}
	 */
	function parseHeaders(raw) {
		if (typeof raw !== "string") {
			throw new TypeError("Invalid headers provided: " + typeof raw)
		}

		const tmp = raw.split("\r\n")
		let headers = {}
		for (let i = 0; i < tmp.length; i++) {
			const header = tmp[i].split(": ", 2);
			if (header.length === 2) {
				headers[header[0]] = header[1];
			}
		}

		return headers
	}

	/**
	 *
	 * @param {String} resource
	 * @param {Object} [params]
	 * @param {Object} [headers]
	 * @param {String} responseType
	 * @returns {*}
	 */
	function* post(resource, params, headers, responseType) {
		if (typeof params !== "string") {
			params = serialize(params) || null
		}
		headers = headers || {}

		if (!headers.hasOwnProperty("Content-Type")) {
			headers["Content-Type"] = "application/x-www-form-urlencoded;charset=UTF-8"
		}

		return yield make("POST", resource, params, headers, responseType)
	}

	/**
	 *
	 * @param {String} resource
	 * @param {Object} [params]
	 * @param {Object} [headers]
	 * @param {String} responseType
	 * @returns {*}
	 */
	function* put(resource, params, headers, responseType) {
		if (typeof params !== "string") {
			params = serialize(params) || null
		}
		headers = headers || {}

		if (!headers.hasOwnProperty("Content-Type")) {
			headers["Content-Type"] = "application/x-www-form-urlencoded;charset=UTF-8"
		}

		return yield make("PUT", resource, params, headers, responseType)
	}

	/**
	 *
	 * @param {Function} callback
	 * @param {Object} event
	 * @returns {*}
	 */
	function onsuccess(callback, event) {
		if (this.readyState === XMLHttpRequest.DONE) {
			responseHeaders = parseHeaders(this.getAllResponseHeaders())
			let response

			switch (this.responseType) {
				case "json":
					response = this.response
				break;

				case "text":
				default:
					response = this.responseText
			}

			if (this.status === 200) {
				return callback(null, response) // success
			}

			return callback(response || this.statusText || event, null) // failure
		}
	}

	return {
		getResponseHeaders: getResponseHeaders,
		getRequest: get,
		deleteRequest: _delete,
		postRequest: post,
		putRequest: put,
		util: {
			excludeHeader: excludeHeader,
			parseHeaders: parseHeaders
		}
	}
}
