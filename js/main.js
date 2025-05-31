(function() {
	'use strict';

	var InstructionType, ReservationStation, Instruction;
	if (typeof module === 'object') { // nodejs
		InstructionType = require('./instruction_type.js');
		ReservationStation = require('./reservation_station.js');
		Instruction = require('./instruction.js');
	} else {
		InstructionType = this.InstructionType;
		ReservationStation = this.ReservationStation;
		Instruction = this.Instruction;
	}

	// 初始化指令队列
	function Main(program, system) {
		Instruction.resetID();
		this.system = system;
		this.system.clock = 0;

		/* parse program */
		program = program.toUpperCase()
		                 .replace(/[\s,]+/g, ',')
		                 .replace(/^,|,$/g, '');

		var tokens = program.split(','); // 分割出指令的类型
		var instructions = [];

		for (var i = 0; i < tokens.length;) {
			var instructionType = this.system.instructionTypes[tokens[i++]];
			var params = [];
			for (var j = 0; j < instructionType.parameters.length; ++j, ++i) {
				switch (instructionType.parameters[j]) { // 指令的参数类型
				case InstructionType.PARAMETER_TYPE_REGISTER:
					params.push(tokens[i]);
					break;
				case InstructionType.PARAMETER_TYPE_ADDRESS:
					params.push(parseInt(tokens[i], 10)); // 地址参数转换成10进制数字
					break;
				}
			}
			instructions.push(new Instruction(instructionType, params)); // 在指令队列中载入指令
		}

		this.instructions = instructions;
		this.issuedInstructions = 0; // 初始时，取指令的数量为0
	}

	// tomasulo算法，执行结束后返回true
	Main.prototype.step = function() { // 通过prototype可以访问Main创造的对象
		++this.system.clock;

		// 取指令开始
		if (this.instructions.length > this.issuedInstructions) { // 如果指令队列还有指令，就继续取指令
			var instruction = this.instructions[this.issuedInstructions];
			var stations = instruction.type.stations; // 获取指令类型对应的保留站
			for (var i = 0; i < stations.length; ++i) {
				if (stations[i].state == ReservationStation.STATE_IDLE) { // 如果保留站是空闲的
					// 将指令放入保留站
					var station = stations[i];

					station.state = ReservationStation.STATE_ISSUE; // 设置保留站状态为ISSUE
					station.instruction = instruction;				// 将指令放入保留站
					instruction.issueTime = this.system.clock;		// 设置指令的取指时的时间

					var dest = instruction.type.destParameter;		// 获取指令的目的地址
					var paramCount = instruction.type.parameters.length; // 获取指令的参数个数

					station.parameters = [];
					station.tags = [];
					for (var i = 0; i < paramCount; ++i) {
						var value = null;
						var tag = null;

						if (i !== dest) {
							switch (instruction.type.parameters[i]) {
							case InstructionType.PARAMETER_TYPE_REGISTER:// 如果是寄存器
								// 检查总线是否被占用
								tag = this.system.commonDataBus.getBusy(InstructionType.PARAMETER_TYPE_REGISTER, instruction.parameters[i]);
								if (tag === null) {
									value = this.system.registerFile.get(instruction.parameters[i]); 
								}
								break;
							case InstructionType.PARAMETER_TYPE_ADDRESS: // 如果是地址
								// 检查总线是否被占用
								tag = this.system.commonDataBus.getBusy(InstructionType.PARAMETER_TYPE_ADDRESS, instruction.parameters[i]);
								value = instruction.parameters[i];
								break;
							}
						} else { // dest
							value = instruction.parameters[i];
						}

						station.parameters.push(value);
						station.tags.push(tag);
					}

					var type = instruction.type.parameters[dest];
					var name = instruction.parameters[dest];
					this.system.commonDataBus.setBusy(type, name, station);

					++this.issuedInstructions;// 增加取指令的数量
				}
			}
		}
		// 取指令结束
		// 执行和写结果
		for (var i in this.system.reservationStations) {
			var station = this.system.reservationStations[i];
			if (station.state === ReservationStation.STATE_EXECUTE) {// 如果保留站的状态是执行
				// 开始执行
				if ((--station.instruction.time) === 0) {
					// 执行结束
					station.instruction.executeTime = this.system.clock;
					station.state = ReservationStation.STATE_WRITE_BACK;
				}
				// 结束执行
			} else if (station.state === ReservationStation.STATE_WRITE_BACK) {
				// 开始写回
				var dest = station.instruction.type.destParameter;
				var type = station.instruction.type.parameters[dest];
				var name = station.instruction.parameters[dest];
				var value = station.instruction.type.calculate.call(station, station.parameters);
				if (typeof value === 'undefined') {
					value = true;
				}
				// 检查总线是否被占用
				if (this.system.commonDataBus.getBusy(type, name) === station) {
					switch (type) {
					case InstructionType.PARAMETER_TYPE_REGISTER:
						this.system.registerFile.set(name, value); // 写回寄存器
						break;
					case InstructionType.PARAMETER_TYPE_ADDRESS:
						value = name;
						break;
					}

					this.system.commonDataBus.setBusy(type, name, null); // 释放总线
					this.system.commonDataBus.setResult(station, value); // 记录计算结果
				}

				station.instruction.writeBackTime = this.system.clock;
				station.state = ReservationStation.STATE_IDLE;
				// 结束写回
			}
		}

		var allDone = true;
		for (var i in this.system.reservationStations) {
			var station = this.system.reservationStations[i];
			if (station.state === ReservationStation.STATE_ISSUE) {
				// 检查是否所有执行所需的值都可用
				var needMoreValues = false;
				for (var j = 0; j < station.tags.length; ++j) {
					if (station.tags[j] !== null) {
						var value = this.system.commonDataBus.getResult(station.tags[j]); // 从总线获取数据
						if (value !== null) {
							station.parameters[j] = value; // 载入参数j的值
							station.tags[j] = null; // 参数j不再需要标签
						} else {
							needMoreValues = true; // 如果从总线获取数据失败，则依旧需要数据
						}
					}
				}
				if (!needMoreValues) { // 当数据相关解决后，进入执行阶段
					station.state = ReservationStation.STATE_EXECUTE;
				}
			}

			if (station.state !== ReservationStation.STATE_IDLE) {
				allDone = false;// 如果有保留站处于非空闲状态，则表示算法没有结束
			}
		}

		this.system.commonDataBus.clearResult();
		return allDone;
	}

	Main.prototype.run = function() {
		while (!this.step()) {
			// 点击一次step就run一下，run调用step，执行一步算法，时钟++
			// 如果step函数没有结束，不忙等
			// 如果step函数结束了，意味着所有指令执行结束，开始忙等
		}
	}

	if (typeof module === 'object') {
		module.exports = Main; // 使require()可以使用Main
	} else {
		this.Main = Main;
	}

}).call(this);

