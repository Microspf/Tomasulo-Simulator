(function() {
	'use strict';

	// 总线通过字典表示
	function CommonDataBus() {
		this._busy = {};
		this._result = {};
	}

	CommonDataBus.prototype.getBusy = function(type, name) {
		var result = this._busy[type + '.' + name];
		if (typeof result === 'undefined') {
			return null;
		} else {
			return result;
		}
	};

	CommonDataBus.prototype.setBusy = function(type, name, instruction) {
		this._busy[type + '.' + name] = instruction; // 记录当前类型的指令占用资源的情况
	};

	CommonDataBus.prototype.getResult = function(station) {
		var result = this._result['' + station.instruction.id];
		if (typeof result === 'undefined') {
			return null;
		} else {
			return result;
		}
	};

	CommonDataBus.prototype.setResult = function(station, value) {
		this._result['' + station.instruction.id] = value;
	};

	CommonDataBus.prototype.clearResult = function() {
		this._result = {};
	};

	if (typeof module === 'object') {
		module.exports = CommonDataBus;
	} else {
		this.CommonDataBus = CommonDataBus;
	}

}).call(this);

