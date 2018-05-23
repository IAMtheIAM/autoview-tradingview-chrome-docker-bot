"use strict"
window.KRAKEN_NONCE = 0
window.KRAKEN_NONCE_OFFSET = -1

/**
 *
 * @returns {*}
 * @constructor
 */
function Kraken() {
	let state = {
		aliases: [
			"KRAKEN",
		],
		endpoint: "https://api.kraken.com",
		fields: {
			public: {
				label: "API Key",
				message: "",
			},
			private: {
				label: "Private Key",
				message: "",
			}
		},
		name: "Kraken (beta)",
		patterns: [

		],
		permissions: {
			origins: [
				"https://*.kraken.com/*"
			],
			permissions: [],
		},
		subscriptions: {
			active: [
				"qxtoysapiwkjuegnrbmfchzdlv", // Kraken
				"krknpwcfbjuqxihlomgsatyevdz", // Kraken - Yearly
			],
			inactive: [

			],
		},
		version: "0",
		website: "https://www.kraken.com",
	}

	function* account(symbol) {
		let params = {}
		params.asset = symbol

		const data = yield* post.call(this, "/TradeBalance", params)

		// e = equity = trade balance + unrealized net profit/loss
		// tb = trade balance (combined balance of all equity currencies)
		return {
			available: data.tb,
			balance: data.e,
		}
	}

	function* get(resource, query, headers) {
		query = query || {}

		if (query) {
			resource = resource + "?" + serialize(query).replace("%20", "+")
		}

		return yield* make.call(this, "GET", resource, null, headers)
	}

	function* getNonce() {
		let nonce = Math.round(Date.now() / 1000) * 1000 // second precision

		if (window.KRAKEN_NONCE != nonce) {
			window.KRAKEN_NONCE_OFFSET = -1
		}

		window.KRAKEN_NONCE = nonce
		window.KRAKEN_NONCE_OFFSET++

		nonce += window.KRAKEN_NONCE_OFFSET

		return nonce
	}

	function* make(method, resource, parameters, headers) {
		const credentials = yield* this.getExchangeCredentials("private")
		const nonce = yield* getNonce.call(this)
		const scope = (method === "GET") ? "public" : "private"
		const sha256 = (data, format) => {
			let sha = new jsSHA("SHA-256", "TEXT")
			sha.update(data)
			return sha.getHash(format)
		}

		resource = "/" + state.version + "/" + scope + resource

		parameters = parameters || {}
		if (method === "POST") {
			parameters.nonce = nonce
		}
		parameters = serialize(parameters)

		headers = headers || {}
		if (method === "POST") {
			const hash = sha256(nonce + parameters, "BYTES")
			const data = resource + hash

			headers["api-key"] = credentials.public
			headers["api-sign"] = signature(credentials, data, "B64") // Base64 encode
		}

		resource = state.endpoint + resource

		try {
			const func = method.toLowerCase() + "Request" // e.g. deleteRequest, postRequest
			const response = yield* this[func](resource, parameters, headers, "json")

			if (response.error && response.error.length) {
				const error = /^([EW])(.*)$/.exec(response.error)
				if (error[1] === "E") {
					throw new Error(this.getExchangeName() + ": " + error[2])
				} else {
					console.warn(this.getExchangeName(), error[2])
				}
			}

			return response.result
		} catch (ex) {
			if (ex.hasOwnProperty("message")) {
				throw new Error(ex.message)
			}
			if (ex.hasOwnProperty("error")) {
				throw new Error(ex.error)
			}

			throw new Error("An unknown error has occurred.")
		}
	}

	function* ordersCancel(order) {
		if (!order.hasOwnProperty("txid") || !order.txid) {
			throw new Error("Order is not uniquely identified")
		}

		let params = {}
		params.txid = order.txid

		const response = yield* post.call(this, "/CancelOrder", params)

		return response.count
	}

	function* ordersCancelAll(Command) {
		const market = yield* symbolInfo.call(this, Command.s)
		let orders = yield* ordersOpen.call(this, market)
		orders = orders.filter((order) => {
			if (Command.b && order.descr.type !== (Command.isBid ? "buy" : "sell")) {
				return false // Book mismatch
			}
			if (Command.isMarginTrading) {
				if (order.descr.leverage === "none") {
					return false // Margin Trading mismatch
				}
				if (Command.l && Command.l + ":1" !== order.descr.leverage) {
					return false // Leverage mismatch
				}
			} else if (order.descr.leverage !== "none") {
				return false // Spot Trading mismatch
			}

			return true
		})

		// Limit the number of cancelled orders by the requested "Cancel Maximum"
		const end = Command.cm.reference(orders.length).resolve(0)
		if (Command.cm.getMax() < orders.length) {
			switch (Command.cmo) {
				case "newest":
					sortByIndex(orders, "opentm", true)
					break
				case "oldest":
					sortByIndex(orders, "opentm")
					break
				case "lowest":
					sortByIndex(orders, ["descr","price"])
					break
				case "highest":
					sortByIndex(orders, ["descr","price"], true)
					break
				case "smallest":
					sortByIndex(orders, "vol")
					break
				case "biggest":
					sortByIndex(orders, "vol", true)
					break
				case "random":
					shuffle(orders)
			}
			orders = orders.slice(0, end)
		}

		for (let i = 0; i < orders.length; i++) {
			const order = orders[i]
			if (Command.d) {
				console.info("Order", order.vol, "@", order.descr.price, "would be cancelled")
			} else {
				yield* ordersCancel.call(this, order)
			}
		}
	}

	function* ordersOpen(market) {
		let params = {}
		// params.trades = true

		let orders = yield* post.call(this, "/OpenOrders", params)
		orders = orders.open || {}
		for (let txid in orders) {
			if (orders.hasOwnProperty(txid)) {
				const order = orders[txid]
				order.leverage = order.descr.leverage !== "none"
					? parseInt(order.descr.leverage.substr(0, 1), 10)
					: 0
				order.txid = txid

				if (order.status === "closed" || order.status === "canceled" || order.status === "expired") {
					delete orders[txid] // Order is not Open
				}
				if (order.descr.pair !== market.altname) {
					delete orders[txid] // Symbol mismatch
				}
			}
		}
		orders = Object.values(orders)

		return orders
	}

	function* positionsClose(Command, position, market) {
		let price = Command.p.reset()
		price.relative(position.price)

		let volume = Command.q.reset()
		volume.reference(position.volume)

		let params = {}
		params.pair = position.pair
		params.type = position.type === "buy" ? "sell" : "buy"
		if (Command.t === "market") {
			params.ordertype = "market"
		} else {
			params.ordertype = "limit"
			params.price = price.resolve(market.pair_decimals)
		}
		params.volume = volume.resolve(market.lot_decimals)
		params.leverage = Command.l || position.leverage || 2 // "none" = Spot Trading
		if (Command.t === "post") {
			params.oflags = "post"
		}

		if (Command.t === "settle") {
			params.ordertype = "settle-position"
			params.type = position.type
			params.volume = 0
		}

		params.trading_agreement = "agree"

		if (Command.d) {
			console.info(this.getExchangeName(), params)
			return false // Disabled
		}

		const order = yield* post.call(this, "/AddOrder", params)

		return order
	}

	/**
	 * Note: One position per symbol
	 * @param Command
	 */
	function* positionsCloseAll(Command) {
		const market = yield* symbolInfo.call(this, Command.s)
		let positions = yield* positionsOpen.call(this, market.symbol)
		positions = positions.filter((position) => {
			if (Command.b && position.type !== (Command.isBid ? "buy" : "sell")) {
				return false // Book mismatch
			}
			if (Command.l && position.leverage !== Command.l) {
				return false // Leverage mismatch
			}

			return true
		})

		// Limit the number of closed positions by the requested "Close Maximum"
		const end = Command.cm.reference(positions.length).resolve(0)
		if (Command.cm.getMax() < positions.length) {
			switch (Command.cmo) {
				case "newest":
					sortByIndex(positions, "time", true)
					break
				case "oldest":
					sortByIndex(positions, "time")
					break
				case "lowest":
					sortByIndex(positions, "price")
					break
				case "highest":
					sortByIndex(positions, "price", true)
					break
				case "smallest":
					sortByIndex(positions, "volume")
					break
				case "biggest":
					sortByIndex(positions, "volume", true)
					break
				case "random":
					shuffle(positions)
			}
			positions = positions.slice(0, end)
		}

		for (let i = 0; i < positions.length; i++) {
			yield* positionsClose.call(this, Command, positions[i], market)
		}
	}

	function* positionsOpen(symbol) {
		let params = {}
		// params.docalcs = true

		let positions = yield* post.call(this, "/OpenPositions", params)
		for (let txid in positions) {
			if (positions.hasOwnProperty(txid)) {
				const position = positions[txid]
				position.leverage = Math.round(position.cost / position.margin)
				position.price = Number(position.cost / position.vol)
				position.txid = txid
				position.volume = position.vol - position.vol_closed

				if (position.pair !== symbol) {
					delete positions[txid] // Symbol mismatch
				}
			}
		}
		positions = Object.values(positions)

		return positions
	}

	function* post(resource, parameters, headers) {
		return yield* make.call(this, "POST", resource, parameters, headers)
	}

	function signature(credentials, data, format) {
		let sha = new jsSHA("SHA-512", "BYTES")
		sha.setHMACKey(credentials.private, "B64") // Base64 decode
		sha.update(data)

		return sha.getHMAC(format)
	}

	function* symbolInfo(symbol) {
		let query = {}
		query.pair = symbol

		let instruments = yield* get.call(this, "/AssetPairs", query)
		if (!instruments.hasOwnProperty(symbol)) {
			let found = false
			for (let assetId in instruments) {
				if (instruments.hasOwnProperty(assetId)) {
					const asset = instruments[assetId]
					if (asset.altname === symbol) {
						symbol = assetId
						found = true
						break
					}
				}
			}

			if (!found) {
				throw new Error("Instrument '" + symbol + "' was not found.")
			}
		}

		 let instrument = instruments[symbol]
		instrument.symbol = symbol

		return instrument
	}

	function* symbolTicker(symbol) {
		let query = {}
		query.pair = symbol

		const tickers = yield* get.call(this, "/Ticker", query)
		if (!tickers.hasOwnProperty(symbol)) {
			let found = false
			for (let assetId in tickers) {
				if (tickers.hasOwnProperty(assetId)) {
					const asset = tickers[assetId]
					if (asset.altname === symbol) {
						symbol = assetId
						found = true
						break
					}
				}
			}

			if (!found) {
				throw new Error("Instrument '" + symbol + "' was not found.")
			}
		}

		let ticker = tickers[symbol]
		ticker.ask = Number(ticker.a[0]) // [price, volume (whole numbers), volume]
		ticker.bid = Number(ticker.b[0]) // [price, volume (whole numbers), volume]

		return ticker
	}

	function testCommand() {
		const alert = Alert({
			desc: "d=1 b=buy q=1%",
			sym: "KRAKEN:XBTUSD"
		})
		const commands = alert.commands
		const command = commands.shift()

		return command
	}

	function* time() {
		const response = yield* get.call(this, "/Time")
		const serverTime = response.unix * 1000
		const epoch = Date.now()
		const offset = (epoch - serverTime) / 1000

		console.info(this.getExchangeName(), "time", serverTime, "Autoview time", epoch, "Offset", offset, "seconds")
	}

	function* trade(Command) {
		if (!Command.b) {
			throw new SyntaxError("Book (b) parameter is required.")
		}
		if (Command.isMarginTrading && !Command.l) {
			throw new SyntaxError("Leverage (l) parameter is required when Margin Trading.")
		}

		const market = yield* symbolInfo.call(this, Command.s)
		const currency = Command.isBid ? market.quote : market.base
		const balance = yield* account.call(this, currency)
		let available = Command.y === "equity" ? balance.balance : balance.available
		const ticker = yield* symbolTicker.call(this, market.symbol)
		const first = ((Command.isBid && Command.t !== "market") || (Command.isAsk && Command.t === "market")) ? ticker.bid : ticker.ask
		let price = Command.p.relative(first).resolve(market.pair_decimals)
		if (Command.fp) {
			price = Command.fp.resolve(market.pair_decimals)
		}
		let side = Command.isBid ? "buy" : "sell"

		if (Command.u === "currency" && !Command.q.getIsPercent()) {
			Command.q.div(price) // main => pair
		}
		if (Command.isBid) {
			available /= price // main => pair
		}
		Command.q.reference(available)

		let params = {}
		params.pair = market.symbol
		if (Command.t === "market") {
			params.ordertype = "market"
		} else {
			params.ordertype = "limit"
			params.price = price
		}
		if (Command.hasOwnProperty("sl") && Command.hasOwnProperty("tp")) {
			side = Command.isBid ? "sell" : "buy"
			params.ordertype = Command.t === "market" ? "stop-loss-profit" : "stop-loss-profit-limit"
			params.price = Command.sl.relative(first).resolve(market.pair_decimals) // stop loss price
			params.price2 = Command.tp.relative(first).resolve(market.pair_decimals) // take profit price
		} else if (Command.hasOwnProperty("sl")) {
			side = Command.isBid ? "sell" : "buy"
			if (Command.t === "market") {
				params.ordertype = "stop-loss"
				params.price = Command.sl.relative(first).resolve(market.pair_decimals) // stop loss price
			} else {
				params.ordertype = "stop-loss-limit"
				params.price = Command.sl.relative(first).resolve(market.pair_decimals) // stop loss trigger price
				params.price2 = price // triggered limit price
			}
		} else if (Command.hasOwnProperty("tp")) {
			side = Command.isBid ? "sell" : "buy"
			if (Command.t === "market") {
				params.ordertype = "take-profit"
				params.price = Command.tp.relative(first).resolve(market.pair_decimals) // take profit price
			} else {
				params.ordertype = "take-profit-limit"
				params.price = Command.tp.relative(first).resolve(market.pair_decimals) // take profit price
				params.price2 = price // triggered limit price
			}
		} else if (Command.hasOwnProperty("ts")) {
			side = Command.isBid ? "sell" : "buy"
			if (Command.t === "market") {
				params.ordertype = "trailing-stop"
				params.price = Command.ts.relative(first).resolve(market.pair_decimals) // trailing stop offset
			} else {
				params.ordertype = "trailing-stop-limit"
				params.price = Command.ts.relative(first).resolve(market.pair_decimals) // trailing stop offset
				if (!Command.hasOwnProperty("fp")) {
					throw new Error("Fixed Price (fp) parameter must be used to specific Trailing Stop Offset")
				}
				params.price2 = price // triggered limit offset
			}
		}
		params.type = side
		params.volume = Command.q.resolve(market.lot_decimals)
		if (Command.hasOwnProperty("l")) {
			params.leverage = Command.l
		}
		if (Command.t === "post") {
			params.oflags = "post"
		}

		params.trading_agreement = "agree"

		if (Command.d) {
			console.info(this.getExchangeName(), params)
			return false // Disabled
		}

		const order = yield* post.call(this, "/AddOrder", params)

		return order
	}


	return Object.assign(
		{},
		Exchange(state),
		{
			exchangeOrdersCancelAll: ordersCancelAll,
			exchangePositionsCloseAll: positionsCloseAll,
			exchangeTime: time,
			exchangeTrade: trade,
			getExchangeTestCommand: testCommand,
		}
	)
}
