"use strict"
window.POLONIEX_NONCE = 0
window.POLONIEX_NONCE_OFFSET = -1
/**
 *
 * @returns {*}
 * @constructor
 */
function Poloniex() {
	let state = {
		aliases: [
			"POLONIEX",
		],
		endpoint: "https://poloniex.com/",
		fields: {
			public: {
				label: "API Key",
				message: "",
			},
			private: {
				label: "Secret",
				message: "",
			},
		},
		name: "Poloniex",
		patterns: [

		],
		permissions: {
			origins: [
				//"https://*.poloniex.com/*"
				"https://poloniex.com/*" // Backwards compatible (< 3.0.0)
			],
		},
		subscriptions: {
			active: [
				"jdbctnilemusxowhazvfrkqgyp", // Poloniex
				"ibyhtgdsuoxrfqjcpakvwmnzel", // Poloniex - Yearly
			],
			inactive: [
				"qyvwjsemxdrtgkoifhuacnplzb", // Poloniex - Early Bird
			],
		},
		website: "https://poloniex.com/",
	}

	function* account(isMarginTrading) {
		let params = {}
		params.command = "returnCompleteBalances" // excludes "margin", "lending"
		const balances = yield* post.call(this, "/tradingApi", params)

		let available = {
			exchange: {},
			margin: {},
		}
		for (let symbol in balances) {
			if (balances.hasOwnProperty(symbol)) {
				let balance = balances[symbol]
				balances[symbol].balance = (Number(balance.available) + Number(balance.onOrders)).toFixed(8)

				available.exchange[symbol] = balances[symbol]
			}
		}

		if (isMarginTrading) {
			params.command = "returnTradableBalances"
			const tradable = yield* post.call(this, "/tradingApi", params)
			for (let symbol in tradable) {
				if (tradable.hasOwnProperty(symbol)) {
					// e.g. BTC_LTC => [BTC, LTC]; BTC is the same amount in each symbol
					const currency = symbol.split("_")[1]
					const balance = tradable[symbol][currency]
					if (available.exchange.hasOwnProperty(currency)) {
						available.exchange[currency].balance = (Number(available.exchange[currency].balance) + Number(balance)).toFixed(8)
					} else {
						available.exchange[currency] = {
							available: balance,
							balance: balance,
						}
					}
					available.margin[currency] = {
						available: balance,
						balance: balance,
					}
				}
			}
		}

		return available
	}

	function* get(resource, query) {
		resource = state.endpoint + resource.replace(/^\/+/, "")

		return yield* this.getRequest(resource, query, null, "json")
	}

	function* getNonce() {
		let nonce = Math.round(Date.now() / 1000) * 1000 // second precision

		if (window.POLONIEX_NONCE != nonce) {
			window.POLONIEX_NONCE_OFFSET = -1
		}

		window.POLONIEX_NONCE = nonce
		window.POLONIEX_NONCE_OFFSET++

		nonce += window.POLONIEX_NONCE_OFFSET

		return nonce
	}

	function* ordersCancel(order) {
		let params = {}
		params.command = "cancelOrder"
		params.orderNumber = order.orderNumber

		const response = yield* post.call(this, "/tradingApi", params)

		return response.success === 1
	}

	function* ordersCancelAll(Command) {
		const pair = symbolPair(Command.s)
		let orders = yield* ordersOpen.call(this, pair.symbol)

		orders = orders.filter((order) => {
			if (Command.b && Command.b !== order.type) {
				return false // buy, sell
			}
			if (Command.fp && Command.fp.compare(order.rate)) {
				return false // Price mismatch
			}
			if (Command.d) {
				return false // Disabled
			}

			return true
		})

		// Limit the number of cancelled orders by the requested "Cancel Maximum"
		const end = Command.cm.reference(orders.length).resolve(0)
		if (Command.cm.getMax() < orders.length) {
			switch (Command.cmo) {
				case "newest":
					sortByIndex(orders, "orderNumber", true)
					break
				case "oldest":
					sortByIndex(orders, "orderNumber")
					break
				case "lowest":
					sortByIndex(orders, "rate")
					break
				case "highest":
					sortByIndex(orders, "rate", true)
					break
				case "smallest":
					sortByIndex(orders, "amount")
					break
				case "biggest":
					sortByIndex(orders, "amount", true)
					break
				case "random":
					shuffle(orders)
			}
			orders = orders.slice(0, end)
		}

		for (let i = 0; i < orders.length; i++) {
			yield* ordersCancel.call(this, orders[i])
		}
	}

	function* ordersOpen(symbol) {
		let params = {}
		params.command = "returnOpenOrders"
		params.currencyPair = symbol

		return yield* post.call(this, "/tradingApi", params)
	}

	function* positionsClose(position) {
		let params = {}
		params.command = "closeMarginPosition"
		params.currencyPair = position.symbol

		return yield* post.call(this, "/tradingApi", params)
	}

	function* positionsCloseAll(Command) {
		const pair = symbolPair(Command.s)
		let positions = yield* positionsOpen.call(this, pair.symbol)

		positions = positions.filter((position) => {
			if (position.type === "none") {
				return false // Remove placeholder
			}
			if (Command.b && Command.b !== position.type) {
				return false // long, short; Book mismatch
			}
			if (pair.symbol !== position.symbol) {
				return false // Market mismatch
			}
			if (Command.d) {
				return false // Disabled
			}

			return true
		})

		// Limit the number of closed positions by the requested "Close Maximum"
		const end = Command.cm.reference(positions.length).resolve(0)
		if (Command.cm.getMax() < positions.length) {
			switch (Command.cmo) {
				case "newest":
				case "oldest":
					console.warn("Close Maximum Order [" + Command.cmo + "] is currently not supported.")
					break
				case "lowest":
					sortByIndex(positions, "basePrice")
					break
				case "highest":
					sortByIndex(positions, "basePrice", true)
					break
				case "smallest":
					sortByIndex(positions, "amount")
					break
				case "biggest":
					sortByIndex(positions, "amount", true)
					break
				case "random":
					shuffle(positions)
			}
			positions = positions.slice(0, end)
		}

		for (let i = 0; i < positions.length; i++) {
			yield* positionsClose.call(this, positions[i])
		}
	}

	function* positionsOpen(symbol) {
		let params = {}
		params.command = "getMarginPosition"
		params.currencyPair = "all"

		const response = yield* post.call(this, "/tradingApi", params)
		let positions = []

		// { MARKET: position, ... } => [ position, ... ]
		for (let currency in response) {
			if (response.hasOwnProperty(currency)) {
				let position = response[currency]
				position.symbol = currency

				positions.push(position)
			}
		}

		return positions
	}

	function* post(resource, parameters) {
		resource = state.endpoint + resource.replace(/^\/+/, "")

		parameters = parameters || {}
		parameters.nonce = yield* getNonce()

		const credentials = yield* this.getExchangeCredentials("private")
		const signature = () => {
			let sha = new jsSHA("SHA-512", "TEXT")
			sha.setHMACKey(credentials.private, "TEXT")
			sha.update(serialize(parameters))

			return sha.getHMAC("HEX")
		}

		let headers = {}
		headers["Content-Type"] = "application/x-www-form-urlencoded"
		headers.Key = credentials.public
		headers.Sign = signature()

		try {
			const response = yield* this.postRequest(resource, parameters, headers, "json")

			return response
		} catch (ex) {
			if (ex.hasOwnProperty("error")) {
				throw new Error(ex.error)
			}
			if (ex.hasOwnProperty("message")) {
				throw new Error(ex.message)
			}
			throw new Error("An unknown error has occurred.")
		}
	}

	function symbolPair(symbol) {
		symbol = symbol.toUpperCase()
		const reg = /^(.+)(BTC|ETH|XMR|USDT)$/i
		const result = reg.exec(symbol)
		let so = {}

		if (!result) {
			throw new Error("Unknown market symbol: " + symbol)
		}

		so.main = result ? result[2] : ""
		so.pair = result ? result[1] : ""
		so.precision = 8
		so.symbol = so.main + "_" + so.pair

		return so
	}

	function* symbolTicker(symbol) {
		/**
		 *
		 * @param {{last, lowestAsk, highestBid, percentChange, baseVolume, quoteVolume, isFrozen, high24hr, low24hr}} ticker
		 * @returns {{active: boolean, ask: *, bid: *, high: *, last: *, low: *}}
		 */
		function normalizeTicker(ticker) {
			return {
				active: !ticker.isFrozen,
				ask: ticker.lowestAsk,
				bid: ticker.highestBid,
				high: ticker.high24hr,
				last: ticker.last,
				low: ticker.low24hr
			}
		}

		let query = {}
		query.command = "returnTicker"

		let tickers = yield* get.call(this, "/public", query)
		for (let currency in tickers) {
			if (tickers.hasOwnProperty(currency)) {
		 		tickers[currency] = normalizeTicker(tickers[currency])
			}
		}

		if (symbol) {
			if (!tickers.hasOwnProperty(symbol)) {
				return null
			}

			return tickers[symbol]
		}

		return tickers
	}

	function testCommand() {
		const alert = Alert({
			desc: "d=1 b=buy q=1%",
			sym: "POLONIEX:PINKBTC"
		})
		const commands = alert.commands
		const command = commands.shift()

		return command
	}

	function* trade(Command) {
		if (!Command.b) {
			throw new SyntaxError("Command [b]ook parameter is invalid.")
		}

		const pair = symbolPair(Command.s)
		const balances = yield* account.call(this, Command.isMarginTrading)
		let currency = Command.isBid ? pair.main : pair.pair
		const wallet = Command.isMarginTrading ? "margin" : "exchange"

		if (Command.isMarginTrading) {
			currency = pair.pair
		}

		if (!balances.hasOwnProperty(wallet) || !balances[wallet].hasOwnProperty(currency)) {
			throw new ReferenceError("Account Balance (" + wallet + ", " + currency + ") not available.")
		}

		const ticker = yield* symbolTicker.call(this, pair.symbol)
		if (!ticker) {
			throw new ReferenceError("Ticker (" + pair.symbol + ") is not available.")
		}

		const balance = balances[wallet][currency]
		const first = ((Command.isBid && Command.t !== "market") || (Command.isAsk && Command.t === "market")) ? ticker.bid : ticker.ask
		let price = Command.p.relative(first).resolve(8)
		if (Command.fp) {
			price = Command.fp.resolve(8)
		}
		let available = Command.y === "equity" ? balance.balance : balance.available

		if (Command.isMarginTrading) {
			if (Command.u === "currency" && !Command.q.getIsPercent()) {
				Command.q.div(price)
			}
			Command.q.reference(available)
		} else {
			if (Command.isBid && Command.u !== "currency") {
				available /= price
				Command.q.reference(available)
			} else if (Command.u === "currency") {
				if (Command.isAsk) {
					available *= price
				}
				Command.q.reference(available)
				Command.q.div(price)
			} else {
				Command.q.reference(available)
			}
		}

		let params = {}
		params.amount = Command.q.resolve(8)
		params.currencyPair = pair.symbol
		switch (Command.t) {
			case "fok":
				params.fillOrKill = 1
				break
			case "ioc":
				params.immediateOrCancel = 1
				break
			case "post":
				params.postOnly = 1
		}
		params.rate = price
		if (Command.isMarginTrading) {
			params.command = Command.isBid ? "marginBuy" : "marginSell" // long, short
		} else {
			params.command = Command.isBid ? "buy" : "sell"
		}

		if (Command.d) {
			console.info("Poloniex", params)
			return false // Disabled
		}

		return yield* post.call(this, "/tradingApi", params)
	}


	return Object.assign(
		{},
		Exchange(state),
		{
			exchangeOrdersCancelAll: ordersCancelAll,
			exchangePositionsCloseAll: positionsCloseAll,
			exchangeTrade: trade,
			getExchangeTestCommand: testCommand,
		}
	)
}
