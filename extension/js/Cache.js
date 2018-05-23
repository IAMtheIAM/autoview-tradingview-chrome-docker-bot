"use strict"
/**
 *
 * @param topic
 * @returns {*}
 * @constructor
 */
function Cache(...topic) {
	let state = {
		ttl: 0,
		value: null,
		valueUpdated: 0,
	}

	if (topic.length === 0) {
		throw new ReferenceError("No Cache reference provided.")
	}
	// Normalize
	topic = topic.map((item) => String(item).toUpperCase())

	let self = {
		cacheHasExpired: () => Date.now() > (state.valueUpdated + state.ttl),
		getCacheValue: function* () {
			// Retrieve cached state
			const stored = (yield* Storage("local").getStorageValue.apply(this, topic)) || {}
			state.ttl = stored.ttl || 0
			state.value = stored.value || null
			state.valueUpdated = stored.valueUpdated || 0

			// Value
			return !self.cacheHasExpired() ? state.value : null
		},
		setCacheValue: function* (value, ttl) {
			// Check TTL
			if (typeof ttl !== "number") {
				throw new TypeError("Invalid TTL value provided: " + typeof ttl)
			}
			if (Math.floor(ttl) != ttl) {
				throw new TypeError("Fractional TTL values are not supported.")
			}
			if (ttl < 0) {
				throw new RangeError("TTL value must be greater than or equal to zero.")
			}

			// New state
			state.ttl = ttl * 1000 // Seconds => Milliseconds
			state.value = value
			state.valueUpdated = Date.now()

			// Save state
			let keysEndWithValue = topic
			keysEndWithValue.push(state)
			yield* Storage("local").setStorageValue.apply(this, keysEndWithValue)
		},
	}

	return self
}
