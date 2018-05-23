"use strict"
/**
 *
 * @returns {*}
 * @constructor
 */
function _1Broker() {
	let state = {
		aliases: [
			"1BROKER",
			"FX",
		],
		endpoint: "https://1broker.com/api/v2/",
		fields: {
			public: {
				label: "API Token",
				message: "Only version 2 API tokens are supported. Version 1 was deprecated and disabled on January 9th, 2017.",
			},
		},
		name: "1Broker",
		patterns: [

		],
		permissions: {
			origins: [
				"https://*.1broker.com/*",
			],
		},
		subscriptions: {
			active: [],
			inactive: [],
		},
		website: "https://1broker.com/?r=3228",
	}

	function* account() {
		let overview = yield* get.call(this, "/user/overview.php")
		overview.available = Number(overview.balance).toFixed(8)
		overview.total = Number(overview.net_worth).toFixed(8)

		return overview
	}

	function* get(resource, query) {
		resource = state.endpoint + resource.replace(/^\/+/, "")
		query = query || {}

		const credentials = yield* this.getExchangeCredentials()
		query.token = credentials.public

		const response = yield* this.getRequest(resource, query, null, "json")

		if (response.error) {
			throw new Error(response.error_message)
		}

		if (response.warning) {
			gaEvent(state.name, "warning", response.warning)
			// TODO ErrorLog.warning(response.warning)
			console.warn(response.warning)
		}

		return response.response
	}

	function* ordersCancel(order) {
		let query = {}
		query.order_id = order.order_id

		return yield* get.call(this, "/order/cancel.php", query)
	}

	function* ordersCancelAll(Command) {
		let orders = yield* ordersOpen.call(this, Command.s)

		orders = orders.filter((order) => {
			const isBid = order.direction === "long" // long, short
			const close = (order.stop_loss || order.take_profit)

			if (Command.b && Command.isBid !== isBid) {
				return false // Book mismatch
			}
			if (Command.fp && Command.fp.compare(order.order_type_parameter)) {
				return false // Price mismatch
			}
			if (Command.l && Command.l !== +order.lever_rate) {
				return false // Leverage mismatch
			}
			if (Command.s !== order.symbol) {
				return false // Market mismatch
			}
			if (Command.t && ((Command.t === "open" && close) || (Command.t === "close" && !close))) {
				return false // order Type mismatch
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
					sortByIndex(orders, "order_id", true)
					break
				case "oldest":
					sortByIndex(orders, "order_id")
					break
				case "lowest":
					sortByIndex(orders, "order_type_parameter")
					break
				case "highest":
					sortByIndex(orders, "order_type_parameter", true)
					break
				case "smallest":
					sortByIndex(orders, "margin")
					break
				case "biggest":
					sortByIndex(orders, "margin", true)
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
		let orders = yield* get.call(this, "/order/open.php")

		if (symbol) {
			orders = orders.filter((order) => symbol === order.symbol)
		}

		return orders
	}

	function* positionsClose(Command, position) {
		if (Command.b && Command.b !== position.direction.toLowerCase()) {
			return true // Book mismatch, long, short
		}
		if (Command.l && Command.l !== +position.leverage) {
			return true // Leverage mismatch
		}
		if (Command.s !== position.symbol) {
			return true // Market mismatch
		}

		let query = {}
		query.position_id = position.position_id
		if (Command.t === "market") {
			return yield* get.call(this, "/position/close.php", query)
		}
		if (Command.sl || Command.tp) {
			if (Command.sl) {
				query.stop_loss = Command.sl.relative(position.entry_price).resolve(8)
			}
			if (Command.tp) {
				query.take_profit = Command.tp.relative(position.entry_price).resolve(8)
			}
		} else {
			throw new SyntaxError("Empty position close. Market close or use Stop Loss and/or Take Profit.")
		}

		if (Command.d) {
			return true // Disabled
		}

		return yield* get.call(this, "/position/edit.php", query)
	}

	function* positionsCloseAll(Command) {
		let positions = yield* positionsOpen.call(this, Command.s)

		// Limit the closed positions by the requested "Close Maximum"
		const end = Command.cm.reference(positions.length).resolve(0)
		if (Command.cm.getMax() < positions.length) {
			switch (Command.cmo) {
				case "newest":
					sortByIndex(positions, "position_id", true)
					break
				case "oldest":
					sortByIndex(positions, "position_id")
					break
				case "lowest":
					sortByIndex(positions, "entry_price")
					break
				case "highest":
					sortByIndex(positions, "entry_price", true)
					break
				case "smallest":
					sortByIndex(positions, "value")
					break
				case "biggest":
					sortByIndex(positions, "value", true)
					break
				case "random":
					shuffle(positions)
			}
			positions = positions.slice(0, end)
		}

		for (let i = 0; i < positions.length; i++) {
			yield* positionsClose.call(this, Command, positions[i])
		}
	}

	function* positionsOpen(symbol) {
		let positions = yield* get.call(this, "/position/open.php")

		if (symbol) {
			positions = positions.filter((position) => position.symbol === symbol)
		}

		return positions
	}

	function* symbolMarket(symbol) {
		if (!symbol) {
			throw new SyntaxError("Invalid Symbol provided: " + symbol)
		}

		let query = {}
		query.symbol = symbol

		let response = yield* get.call(this, "/market/details.php", query)
		response.decimals = Number(response.decimals)
		response.maximum_amount = Number(response.maximum_amount)
		response.maximum_leverage = Number(response.maximum_leverage)
		response.overnight_charge_long_percent = Number(response.overnight_charge_long_percent)
		response.overnight_charge_short_percent = Number(response.overnight_charge_short_percent)

		return response
	}

	function* symbolTicker(symbol) {
		let query = {}
		query.symbols = symbol // 20 max.; comma separated

		const response = yield* get.call(this, "/market/quotes.php", query)

		let markets = {}
		response.forEach((market) => markets[market.symbol] = market)

		const market = markets[symbol]

		return market
	}

	function testCommand() {
		const alert = Alert({
			desc: "d=1 b=long q=1%",
			sym: "1BROKER:BTCUSD"
		})
		const commands = alert.commands
		const command = commands.shift()

		return command
	}

	function* trade(Command) {
		if (!Command.b || !Command.isMarginTrading) {
			throw new SyntaxError("Spot trade request made on Margin market.")
		}

		let balance = yield* account.call(this)
		balance = (Command.y === "equity") ? balance.total : balance.available
		const market = yield* symbolMarket.call(this, Command.s)
		const precision = market.hasOwnProperty("decimals") ? +market.decimals : 8
		const ticker = yield* symbolTicker.call(this, Command.s)
		const first = Command.isBid ? +ticker.bid : +ticker.ask
		let price = Command.p.relative(first).resolve(precision)
		if (Command.fp) {
			price = Command.fp.resolve(precision)
		}

		let query = {}
		query.direction = Command.b // long, short
		query.leverage = Command.l || 0
		query.margin = Command.q.reference(balance).resolve(8)
		query.order_type = Command.t
		query.order_type_parameter = price
		query.referral_id = 3228
		if (Command.shared) {
			query.shared = true
		}
		if (Command.sl) {
			query.stop_loss = Command.sl.relative(query.order_type_parameter).resolve(precision)
		}
		query.symbol = Command.s
		if (Command.tp) {
			query.take_profit = Command.tp.relative(query.order_type_parameter).resolve(precision)
		}

		if (query.order_type === "market") {
			delete query.order_type_parameter
		}

		if (query.margin > market.maximum_amount) {
			query.margin = Math.min(query.margin, market.maximum_amount)
			// TODO ErrorLog.warning(...)
			console.warn("Trade Quantity (" + query.margin + ") exceeds market limitation (" + market.maximum_amount + ").")
		}
		if (query.leverage > market.maximum_leverage) {
			query.leverage = Math.min(query.leverage, market.maximum_leverage)
			// TODO ErrorLog.warning(...)
			console.warn("Trade Leverage (" + query.leverage + ") exceeds market limitation (" + market.maximum_leverage + ").")
		}

		if (Command.d) {
			console.info("1Broker", query)
			return false // Disabled
		}

		return yield* get.call(this, "/order/create.php", query)
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
