"use strict";
// Singleton
window.Autoview = new Autoview_Class();

/**
 *
 * @constructor
 */
function Autoview_Class() {
	this.init = init;

	function backtesting_export() {
		let i, k, m, s, v;
		const rw = exists("TradingView.bottomWidgetBar._widgets.backtesting._reportWidgetsSet.reportWidget".split("."))
		if (!rw) {
			console.info("Still loading...");
			return;
		}

		const data = rw._data;
		const cd = rw._report._currencyDecimals || 2
		const dd = rw._report._defaultDecimals || 3
		const pd = rw._report._percentDecimals || 2
		const sd = rw._report._seriesDecimals || 2

		let overview = {
			headings: [],
			items: []
		};
		m = [
			["Net Profit", "$netProfit." + sd],
			["Total Closed Trades", "totalTrades"],
			["Percent Profitable", "percentProfitable." + pd + "%"],
			["Profit Factor", "profitFactor." + dd],
			["Max Drawdown", null],
			["Avg Trade", "$avgTrade." + sd],
			["Avg # Bars in Trades", "avgBarsInTrade"]
		];
		for (i = 0; i < m.length; i++) {
			v = m[i];
			overview.headings.push(v[0]);
			if (v[0] === "Max Drawdown") {
				overview.items.push(mv(data.performance, "$maxStrategyDrawDown." + sd));
			} else {
				overview.items.push(mv(data.performance.all, v[1]));
			}
		}

		const p = data.performance;
		let performance = {
			headings: ["", "All", "Long", "Short"],
			items: []
		};
		m = [
			["Net Profit", "$netProfit." + sd],
			["Gross Profit", "$grossProfit." + sd],
			["Gross Loss", "$grossLoss." + sd],
			["Max Drawdown", null],
			["Buy & Hold Return", null],
			["Sharpe Ratio", null],
			["Profit Factor", "profitFactor." + dd],
			["Max Contracts Held", "maxContractsHeld"],
			["Open PL", null],
			["Commission Paid", null],
			["Total Closed Trades", "totalTrades"],
			["Total Open Trades", "totalOpenTrades"],
			["Number Winning Trades", "numberOfWiningTrades"],
			["Number Losing Trades", "numberOfLosingTrades"],
			["Percent Profitable", "percentProfitable." + pd + "%"],
			["Avg Trade", "$avgTrade." + sd],
			["Avg Win Trade", "$avgWinTrade." + sd],
			["Avg Loss Trade", "$avgLosTrade." + sd],
			["Ratio Avg Win / Avg Loss", "ratioAvgWinAvgLoss." + dd],
			["Largest Winning Trade", "$largestWinTrade." + sd],
			["Largest Losing Trade", "$largestLosTrade." + sd],
			["Avg # Bars in Trades", "avgBarsInTrade"],
			["Avg # Bars in Winning Trades", "avgBarsInWinTrade"],
			["Avg # Bars in Losing Trade", "avgBarsInLossTrade"]
		];
		for (i = 0; i < m.length; i++) {
			v = m[i];
			switch (v[0]) {
				case "Buy & Hold Return":
					performance.items.push([v[0], mv(p, "$buyHoldReturn." + cd)]);
					break;
				case "Commission Paid":
					performance.items.push([v[0], mv(p.all, "$commissionPaid." + cd)]);
					break;
				case "Max Drawdown":
					performance.items.push([v[0], mv(p, "$maxStrategyDrawDown." + cd)]);
					break;
				case "Open PL":
					performance.items.push([v[0], mv(p, "$openPL." + cd)]);
					break;
				case "Sharpe Ratio":
					performance.items.push([v[0], mv(p, "sharpeRatio." + cd)]);
					break;
				default:
					performance.items.push([v[0], mv(p.all, v[1]), mv(p.long, v[1]), mv(p.short, v[1])]);
			}
		}

		const t = data.trades;
		let trades = {
			headings: "Trade #,Type,Signal,Date/Time,Price,Contracts,Profit".split(","),
			items: []
		};
		for (i = 0; i < t.length; i++) {
			v = t[i];
			trades.items.push([i + 1, type(v.e.tp), v.e.c, dt(v.e.tm), mv(v.e, "$p." + sd), , ]);
			trades.items.push(v.x.c.length
				? [, type(v.x.tp), v.x.c, dt(v.x.tm), mv(v.x, "$p." + sd), v.q, tz(v.pf.toFixed(sd))]
				: [, type(v.x.tp), "Open", , , , ,]
			);
		}

		m = [
			["Initial Capital", "initial_capital"],
			["Base Currency", "currency"],
			["Allow Up To Orders", "pyramiding"],
			["Order Size", "default_qty_value"],
			["Order Type", "default_qty_type"],
			["Recalculate After Order filled", "calc_on_order_fills"],
			["Recalculate On Every Tick", "calc_on_every_tick"],
			["Verify Price For Limit Orders", "backtest_fill_limits_assumption"],
			["Slippage", "slippage"],
			["Commission", "commission_value"],
			["Commission Type", "commission_type"],
		];
		const mqty = {
			"fixed": "Contracts",
			"cash_per_order": data.currency || "USD",
			"percent_of_equity": "% of equity"
		};
		let inputs = {
			headings: [],
			items: []
		};
		let properties = {
			headings: [],
			items: []
		};
		// inputs/properties: window.initData.content.charts[#].panes[#].sources[#.type=StudyStrategy].metaInfo.inputs
		// isHidden = false
		// .name => .defval
		const chart = 0;
		const pane = 0;
		const sources = window.initData.content.charts[chart].panes[pane].sources;
		let props = {};
		sources.forEach((source) => {
			if (source.type === "StudyStrategy") {
				const values = rw._strategy._properties.inputs || {};
				source.metaInfo.inputs.forEach((input) => {
					if (input.isHidden) {
						return false;
					}
					const value = values.hasOwnProperty(input.id) ? values[input.id]._value : input.defval;
					if (input.hasOwnProperty("groupId")) {
						if (input.groupId === "strategy_props") {
							props[input.internalID] = value;
						}
					} else {
						inputs.headings.push(input.name);
						inputs.items.push(value);
					}
				});
			}
		});
		for (i = 0; i < m.length; i++) {
			v = m[i];
			s = v[0];
			k = v[1];
			v = props[k];
			if (k === "currency" && v === "NONE") {
				v = "Default";
			}
			else if (k === "default_qty_type") {
				v = mqty[v];
			}
			if (k === "pyramiding") {
				properties.headings.push("Pyramiding");
				properties.items.push(v ? "true" : "false");
			}
			properties.headings.push(s);
			properties.items.push(v);
		}

		clipboard("text/plain", output(overview, performance, trades, inputs, properties));

		gaEvent("Autoview", "export")

		function mv(a, k) {
			if (typeof k === "function") {
				return a.push(k());
			}

			if (typeof k === "string") {
				const reg = /^(\$)?(.+?)(?:\.(\d+))?(%)?$/;
				const res = reg.exec(k);

				if (!a.hasOwnProperty(res[2])) {
					return;
				}

				res[1] = /*res[1] ||*/ "";
				res[2] = a[res[2]];
				res[3] = +res[3] || 0;
				res[4] = /*res[4] ||*/ "";

				if (res[2] === null) {
					return "N/A";
				}
				if (res[4] === "%") {
					res[2] *= 100;
				}
				if (k === "profitFactor" && res[2] < 1) {
					res[2] *= -1;
				}

				return res[1] + tz(res[2].toFixed(res[3])) + res[4];
			}

			throw new TypeError("Unsupported type: " + typeof k);
		}

		function output(overview, performance, trades, inputs, properties) {
			let ret = [];

			ret.push(inputs.headings.join("\t"));
			ret.push(inputs.items.join("\t"));

			ret.push("");

			ret.push(properties.headings.join("\t"));
			ret.push(properties.items.join("\t"));

			ret.push("");

			ret.push(overview.headings.join("\t"));
			ret.push(overview.items.join("\t"));

			ret.push("");

			performance.items = performance.items.map(tab);
			ret.push(performance.headings.join("\t"));
			ret = ret.concat(performance.items);

			ret.push("");

			trades.items = trades.items.map(tab);
			ret.push(trades.headings.join("\t"));
			ret = ret.concat(trades.items);

			return ret.join("\n");
		}

		function tab(array) {
			return array.join("\t");
		}

		function type(k) {
			const a = {"le":"Entry Long","lx":"Exit Long","se":"Entry Short","sx":"Exit Short"};

			return a.hasOwnProperty(k) ? a[k] : undefined;
		}

		function tz(n) {
			return n.replace(/([0-9]+(\.[0-9]+[1-9])?)(\.?0+$)/, "$1")
		}
	}

	function backtesting_export_init() {
		let element, li;

		element = document.querySelector("div.backtesting-select-wrapper");
		if (element) {
			element = element.querySelector("ul.report-tabs");
			if (element) {
				li = element.querySelector("li.autoview-backtesting-export");
				if (!li) {
					li = document.createElement("li");
					li.addEventListener("click", backtesting_export);
					li.classList.add("autoview-backtesting-export");
					li.innerHTML = "Export";

					element.appendChild(li);

					console.log("Backtesting Export initialized.");
				}
			}
		}

		setTimeout(backtesting_export_init, 1000);
	}

	function dt(timestamp) {
		const D = new Date(timestamp);
		const d = [D.getFullYear(), p(D.getMonth() + 1), p(D.getDate())].join("-");
		const t = [p(D.getHours()), p(D.getMinutes()), p(D.getSeconds())].join(":");

		return d + " " + t;
	}

	function exists(keys) {
		let key, parent = window;
		for (let i = 0; i < keys.length; i++) {
			key = keys[i];
			if (!parent.hasOwnProperty(key)) {
				return;
			}

			parent = parent[key];
		}

		return parent;
	}

	function init() {
		backtesting_export_init();

		console.log("Autoview initialized.");
	}

	function p(x) {
		return (x.length === 1 || x < 10) ? "0" + x : x;
	}
}
