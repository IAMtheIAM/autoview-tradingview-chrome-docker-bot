"use strict"
function Broker() {
	let state = {
		aliases: {},
		exchanges: [],
		patterns: [],
	}

	function add(factoryName) {
		if (typeof factoryName !== "string") {
			throw new TypeError("Invalid Exchange provided: " + typeof factoryName)
		}
		if (!window.hasOwnProperty(factoryName)) {
			throw new ReferenceError("Undefined Exchange callable: " + factoryName)
		}
		if (typeof window[factoryName] !== "function") {
			throw new TypeError("Invalid Exchange callable provided: " + typeof window[factoryName])
		}

		const exchange = getObject(factoryName)
		const aliases = exchange.getExchangeAliases()
		const patterns = exchange.getExchangePatterns()

		if (aliases.length === 0 && patterns.length === 0) {
			throw new ReferenceError("Exchange '" + factoryName + "' is inaccessible.")
		}
		if (state.exchanges.indexOf(factoryName) !== -1) {
			throw new ReferenceError("Exchange '" + factoryName + "' has already been defined")
		}

		state.exchanges.push(factoryName)

		aliases.forEach((alias) => {
			if (state.aliases.hasOwnProperty(alias)) {
				throw new ReferenceError("Exchange Alias '" + alias + "' was re-assigned.")
			}

			state.aliases[alias] = factoryName
		})

		patterns.forEach((pattern) => {
			if (pattern instanceof RegExp) {
				state.patterns.push({
					pattern,
					factoryName
				})
			}
		})
	}

	function get(alias, symbol) {
		return getByAlias(alias) || getByPattern(symbol) || null
	}

	function getAll() {
		return state.exchanges.map(getObject)
	}

	function getByAlias(alias) {
		return isAlias(alias) ? getObject(state.aliases[alias]) : null
	}

	function getByPattern(string) {
		for (let i = 0; i < state.patterns.length; i++) {
			const object = state.patterns[i]
			if (object.pattern.test(string)) {
				return getObject(object.factoryName)
			}
		}

		return null
	}

	function getObject(factoryName) {
		const exchange = window[factoryName]()

		return exchange
	}

	function isAlias(alias) {
		if (typeof alias !== "string") {
			throw new TypeError("Invalid Alias provided: " + typeof alias)
		}

		return state.aliases.hasOwnProperty(alias)
	}

	let self = {
		addExchange: add,
		getExchange: get,
		getExchanges: getAll,
		getExchangeByAlias: getByAlias,
		getExchangeByPattern: getByPattern,
		isExchangeAlias: isAlias,
	}

	self.addExchange("_1Broker")
	self.addExchange("Binance")
	self.addExchange("Bitfinex")
	self.addExchange("BitMEX")
	self.addExchange("BitMEXTestnet")
	self.addExchange("Bittrex")
	self.addExchange("GDAX")
	self.addExchange("Kraken")
	self.addExchange("Kucoin")
	self.addExchange("OKCoin")
	self.addExchange("OKEX")
	self.addExchange("Poloniex")

	return self
}
