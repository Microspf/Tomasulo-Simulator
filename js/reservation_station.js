(function() {
	'use strict';

	function ReservationStation(name) {
		this.name = name;
		this.state = ReservationStation.STATE_IDLE;
		this.parameters = null;
		this.tags = null;
		this.instruction = null;
	}

	ReservationStation.STATE_IDLE = 1;		// 空闲
	ReservationStation.STATE_ISSUE = 2;		// 流出
	ReservationStation.STATE_EXECUTE = 3;	// 执行
	ReservationStation.STATE_WRITE_BACK = 4;// 写回

	if (typeof module === 'object') {
		module.exports = ReservationStation;
	} else {
		this.ReservationStation = ReservationStation;
	}

}).call(this);

