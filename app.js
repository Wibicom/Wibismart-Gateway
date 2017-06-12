
/**
* !!! Important device information !!!
* -------------------------------------
* Organization ID : 4rxa4d
* Device Type : Enviro
* Device ID : b0b448e49c80
* Authentication Method : token
* Authentication Token : u!lTBzeWYJ1Bd!fC)Q
*/


var noble = require('noble');
var Client = require('ibmiotf');

var weatherServiceUuid = 'aa40';
var accelServiceUuid = 'aa80';
var lightServiceUuid = 'aa20';
var batteryServiceUuid = '180f';
var serviceUuids = [weatherServiceUuid, accelServiceUuid, lightServiceUuid, batteryServiceUuid];

var weatherDataCharUuid = 'aa41';
var weatherOnCharUuid = 'aa42';
var weatherPeriodCharUuid = 'aa44';


var accelDataCharUuid = 'aa81';
var accelOnCharUuid = 'aa82';
var accelPeriodCharUuid = 'aa83';


var lightDataCharUuid = 'aa21';
var lightOnCharUuid = 'aa22';
var lightPeriodCharUuid = 'aa23';


var batteryDataCharUuid = '2a19';


//varibles used for commands
var currentDiscoveredDevices = [];
var connectedDevices = {};



// Write 0x01 value to turn sensors on
var onValue = new Buffer(1);
onValue.writeUInt8(0x01, 0);
var offValue = new Buffer(1);
offValue.writeUInt8(0x00, 0);

var mqttConfig = {
    "org" : "4rxa4d",
    "id" : "506583dd5c62",
    "domain": "internetofthings.ibmcloud.com",
    "type" : "BeagleBone",
    "auth-method" : "token",
    "auth-token" : "rGpBk2iF?tMG*PSznn"
};

var deviceClient = new Client.IotfGateway(mqttConfig);

// Called when noble is ready
noble.on('stateChange', function(state) {
  if (state === 'poweredOn') {
  	console.log('[MQTT] Connecting...');
  	deviceClient.connect();
  }
  else {
    console.log("Stop scanning");
    noble.stopScanning();
  }
})

deviceClient.on('connect', function () {
  //publishing event using the default quality of service
	console.log('[MQTT] Connected');
  deviceClient.subscribeToGatewayCommand("scan");
  deviceClient.subscribeToGatewayCommand("connectTo");
  deviceClient.subscribeToGatewayCommand("sensorToggle");
  deviceClient.subscribeToGatewayCommand("sensorPeriod");
  deviceClient.on('command', function(type, id, commandName, commandFormat, payload, topic) {
    console.log("Recieved command " +commandName);
    payload = payload.toString('utf8');
    payload = JSON.parse(payload);
    switch(commandName) {
      case 'scan':
      currentDiscoveredDevices = [];
        noble.startScanning([], false);
        setTimeout(function() {//after 5 seconds we send back the information about the devices we discovered.
          var out = [];
          for(i in currentDiscoveredDevices) {
            var set = {};
            set.localName = currentDiscoveredDevices[i].advertisement.localName;
            set.deviceId = currentDiscoveredDevices[i].address.replace(/:/g, '');
            out.push(set);
          }
          console.log("[MQTT] sending back scan response. (" + currentDiscoveredDevices.length + " devices)");
          deviceClient.publishGatewayEvent("scanResponse", 'json', JSON.stringify({d:out}));
        }, 10000);
        break;
      case 'connectTo':
      var found = false;
        for(i in currentDiscoveredDevices) {
          console.log(currentDiscoveredDevices[i].address.replace(/:/g, '')+ "///"+ currentDiscoveredDevices[i].advertisement.localName);
          if(currentDiscoveredDevices[i].address.replace(/:/g, '') == payload.data.deviceId && currentDiscoveredDevices[i].advertisement.localName == payload.data.localName) {
            console.log("[BLE] Connecting to device " + payload.data.localName + " with id " + payload.data.deviceId + "...");
            connectToEnviro(currentDiscoveredDevices[i]);
            found = true;
          }
        }
        if (found == false) {
          console.log("Did not find " + payload.data.localName);
          deviceClient.publishGatewayEvent("connectionResponse", 'json', JSON.stringify({message: "The device " + payload.data.localName + " you are trying to connect to is not found. Try scanning again..."}));
        }
        break;
      case 'sensorToggle':
        var targetDevice = connectedDevices[payload.data.deviceId];
        if(targetDevice == undefined || targetDevice == null) {
           deviceClient.publishGatewayEvent("sensorToggleResponse", 'json', JSON.stringify({message: "The device " + payload.data.localName + " is not connected, you cannot toggle its sensors."}));
           break;
        }
        var peripheral = targetDevice.peripheral;
        if(payload.data.value == "off") {
          switch(payload.data.sensor) {
            case 'weatherCharOn':
              turnSensorOff(peripheral, payload.data.sensor);
              break;
            case 'accelCharOn':
              turnSensorOff(peripheral, payload.data.sensor);
              break;
            case 'lightCharOn':
              turnSensorOff(peripheral, payload.data.sensor);
              break;
            default:
              break;
          }
        }
        else if (payload.data.value == "on") {
          switch(payload.data.sensor) {
            case 'weatherOnChar':
              turnWeatherSensorOn(peripheral);
              break;
            case 'accelOnChar':
              turnAccelSensorOn(peripheral);
              break;
            case 'lightOnChar':
              turnLightSensorOn(peripheral);
              break;
            default:
              break;
          }
        }
        break;
      case 'sensorPeriod':
        var targetDevice = connectedDevices[payload.data.deviceId];
        if(targetDevice == undefined || targetDevice == null) {
           deviceClient.publishGatewayEvent("sensorToggleResponse", 'json', JSON.stringify({message: "The device " + payload.data.localName + " is not connected, you cannot change the period of its sensors."}));
           break;
        }
        peripheral = targetDevice.peripheral;
        var period = payload.data.value*10;//this multiplication by 10 is due to the fact that enviros have a connection period of 100ms
        var targetSensor = targetDevice[payload.data.sensor];
        setPeriod(targetSensor, period, peripheral);
    }
  });

});



noble.on('discover', function(peripheral) {
  // Check if peripheral contains 'Enviro' in its name
  if(peripheral.advertisement['localName'] != null && peripheral.advertisement['localName'].indexOf('Enviro') > -1) {
  	console.log('[BLE] Discovered Enviro ', peripheral.advertisement['localName'], " with address : ", peripheral.address, '.');

    
    currentDiscoveredDevices.push(peripheral);
	  
  }
})


function connectToEnviro(peripheral) {
  peripheral.connect(function(err) {
      if(err) {
        deviceClient.publishGatewayEvent("connectionResponse", 'json', JSON.stringify({message: "Connection to device " + peripheral.advertisement.localName + " was attempted and failed..."}));
        throw err;
      }
      connectedDevices[peripheral.address.replace(/:/g, '')] = {peripheral: peripheral};
      var thisPeripheral = connectedDevices[peripheral.address.replace(/:/g, '')];

      console.log("[BLE] Connected to device " + peripheral.advertisement.localName);
      deviceClient.publishGatewayEvent("connectionResponse", 'json', JSON.stringify({message: "Device " + peripheral.advertisement.localName + " connected successfully!"}));

      peripheral.once('disconnect', function() {
        // handle the disconnection event of the peripheral
        connectedDevices[peripheral.address.replace(/:/g, '')] = null;
        console.log('[BLE] Peripheral:', peripheral.advertisement['localName'], " disconnected");
        console.log('      Attempting to reconnect ...');
        deviceClient.publishGatewayEvent("connectionResponse", 'json', JSON.stringify({message: "Device " + peripheral.advertisement.localName + " disconnected, atempting to reconect."}));
        connectToEnviro(peripheral);
      });
      console.log("[BLE] Looking for characteristics ...");
      // Once the peripheral has been connected, then discover the
      // services and characteristics of interest.
      // peripheral.discoverAllServicesAndCharacteristics(function(error, services, characteristics){
      //   console.log("[BLE] Found some !");
      //   services.forEach(function(service) {
      //     service.forEach(function(characteristic) {
      //       console.log("[BLE] Found ", characteristic.uuid )
      //     });
      //   });
      // });

        peripheral.discoverSomeServicesAndCharacteristics(serviceUuids, [], function(error, services, characteristics){

          characteristics.forEach(function(characteristic) {
              console.log("[BLE]  ", peripheral.advertisement.localName, " found characteristic:", characteristic.uuid);
              if (weatherOnCharUuid == characteristic.uuid) {
                thisPeripheral.weatherOnChar = characteristic;
              }
              else if (accelOnCharUuid == characteristic.uuid) {
                thisPeripheral.accelOnChar = characteristic;
              }
              else if (lightOnCharUuid == characteristic.uuid) {
                thisPeripheral.lightOnChar = characteristic;
              }
              else if (weatherDataCharUuid == characteristic.uuid) {
                thisPeripheral.weatherDataChar = characteristic;
              }
              else if (accelDataCharUuid == characteristic.uuid) {
                thisPeripheral.accelDataChar = characteristic;
              }
              else if (lightDataCharUuid == characteristic.uuid) {
                thisPeripheral.lightDataChar = characteristic;
              } 
              else if (weatherPeriodCharUuid == characteristic.uuid) {
                thisPeripheral.weatherPeriodChar = characteristic;
              }
              else if (accelPeriodCharUuid == characteristic.uuid) {
                thisPeripheral.accelPeriodChar = characteristic;
              }
              else if (lightPeriodCharUuid == characteristic.uuid) {
                thisPeripheral.lightPeriodChar = characteristic;
              }
              else if (batteryDataCharUuid == characteristic.uuid) {
                thisPeripheral.batteryDataChar = characteristic;
              }
            })
     
           // Check to see if we found all of our characteristics.
            //
            if (thisPeripheral.weatherOnChar &&
                thisPeripheral.accelOnChar &&
                thisPeripheral.lightOnChar && 
                thisPeripheral.weatherDataChar &&
                thisPeripheral.accelDataChar &&
                thisPeripheral.lightDataChar &&
                thisPeripheral.weatherPeriodChar &&
                thisPeripheral.accelPeriodChar &&
                thisPeripheral.lightPeriodChar &&
                thisPeripheral.batteryDataChar) {
              turnWeatherSensorOn(peripheral);
              turnAccelSensorOn(peripheral);
              turnLightSensorOn(peripheral);
              turnBatteryReadOn(peripheral);
              setPeriod(thisPeripheral.accelPeriodChar, 30, peripheral);
              setPeriod(thisPeripheral.weatherPeriodChar, 30, peripheral);
              setPeriod(thisPeripheral.lightPeriodChar, 30, peripheral);
            }
            else {
              console.log('[BLE] missing characteristics');
            }

            //sending Rssi information periodically every 3 seconds;
            setInterval(function() {
              peripheral.updateRssi(function(err, rssi) {
              console.log('[BLE] ' + peripheral.advertisement['localName'] + ' -> Location Data : ' + rssi + ' dbm');
              deviceClient.publishDeviceEvent("Enviro", peripheral.address.replace(/:/g, ''),"location","json",'{"d" : { "rssi" : ' + rssi + ' }}');

              //keep looking for more enviros
              noble.startScanning();
            });
            }, 3000);
        });
    })
}

function setPeriod(char, period, peripheral){
	  var periodBuf = new Buffer(1);
    periodBuf.writeUInt8(period, 0);
    console.log("writing period: " + period);///////////////////////////////////////////////////::
    char.write(periodBuf, false, function(err) {
      console.log("period callback. err: "+err);
      if(err) {//I dont think these print because callback is printed but no messages.
        deviceClient.publishGatewayEvent("sensorPeriodResponse", 'json', JSON.stringify({message: "Peiod of sensor on " + peripheral.advertisement.localName + " failed to be set to " + period/10}));
        throw err;
      }
      else {
        deviceClient.publishGatewayEvent("sensorPeriodResponse", 'json', JSON.stringify({message: "Peiod of sensor on " + peripheral.advertisement.localName + " was successfully set to " + period/10}));
      }
    });
}


function turnWeatherSensorOn(peripheral){
    var thisPeripheral = connectedDevices[peripheral.address.replace(/:/g, '')];
    // Turn on weather sensor and subsribe to it
    thisPeripheral.weatherOnChar.write(onValue, false, function(err) {
    	if (!err) {
        deviceClient.publishGatewayEvent("sensorToggleResponse", 'json', JSON.stringify({message: "Weather sensor of " + peripheral.advertisement.localName + " has connected successfully!"}));
    		thisPeripheral.weatherDataChar.on('data', function(data, isNotification) {
            	
            var temperature = ((data.readUInt8(2) * 0x10000 + data.readUInt8(1) * 0x100 + data.readUInt8(0)) / 100.0).toFixed(1);
        		var pressure = ((data.readUInt8(5) * 0x10000 + data.readUInt8(4) * 0x100 + data.readUInt8(3)) / 100.0).toFixed(1);
        		var humidity = (((data.readUInt8(8) * 0x10000 + data.readUInt8(7) * 0x100 + data.readUInt8(6))) / Math.pow(2, 10) * 10.0).toFixed(1);
        		console.log('[BLE] ' + peripheral.advertisement['localName'] + ' -> Weather Data : { Temperature : ' + temperature + ' C, Pressure : ' + pressure + ' mbar, Humidity: ' + humidity + ' % }');
            deviceClient.publishDeviceEvent("Enviro", peripheral.address.replace(/:/g, ''),"air","json",'{"d" : { "temperature" : ' + temperature + ', "pressure" : ' + pressure + ', "humidity" : ' + humidity + ' }}');
          });

    		thisPeripheral.weatherDataChar.subscribe(function(err) {
           		if(!err){
           			console.log("[BLE] ", peripheral.advertisement.localName, " Subscribed to weather"); 
           		}
          	});
    	}
    })
}

function turnAccelSensorOn(peripheral){
    var thisPeripheral = connectedDevices[peripheral.address.replace(/:/g, '')];
    // Turn on accelerometer sensor and subsribe to it
    thisPeripheral.accelOnChar.write(onValue, false, function(err) {
    	if (!err) {
        deviceClient.publishGatewayEvent("sensorToggleResponse", 'json', JSON.stringify({message: "Accelerometer of " + peripheral.advertisement.localName + " has connected successfully!"}));
    		thisPeripheral.accelDataChar.on('data', function(data, isNotification) {

            var accelX = ((data.readInt8(1) * 0x100 + data.readInt8(0)) * 0.488).toFixed(0);
        		var accelY = ((data.readInt8(3) * 0x100 + data.readInt8(2)) * 0.488).toFixed(0);
        		var accelZ = ((data.readInt8(5) * 0x100 + data.readInt8(4)) * 0.488).toFixed(0);
            	console.log('[BLE] ' + peripheral.advertisement['localName'] + ' -> Accelerometer Data : { X : ' + accelX + ', Y : ' + accelY + ', Z : ' + accelZ + ' }');
              deviceClient.publishDeviceEvent("Enviro", peripheral.address.replace(/:/g, ''),"accel","json",'{"d" : { "x" : ' + accelX + ', "y" : ' + accelY + ', "z" : ' + accelZ + ' }}');
          });

    		thisPeripheral.accelDataChar.subscribe(function(err) {
           		if(!err){
           			console.log("[BLE] ", peripheral.advertisement.localName, " Subscribed to accelerometer");
           		}
          	});
    	}
    })
}

function turnLightSensorOn(peripheral){
    var thisPeripheral = connectedDevices[peripheral.address.replace(/:/g, '')];
    // Turn on accelerometer sensor and subsribe to it
    thisPeripheral.lightOnChar.write(onValue, false, function(err) {
    	if (!err) {
                deviceClient.publishGatewayEvent("sensorToggleResponse", 'json', JSON.stringify({message: "Light sensor of " + peripheral.advertisement.localName + " has connected successfully!"}));
    		thisPeripheral.lightDataChar.on('data', function(data, isNotification) {
            	var lightLevel = data.readUInt8(1) * 0x100 + data.readUInt8(0);
            	console.log('[BLE] ' + peripheral.advertisement['localName'] + ' -> Light Data : ' + lightLevel + ' mV');
            	deviceClient.publishDeviceEvent("Enviro", peripheral.address.replace(/:/g, ''),"health","json",'{"d" : { "light" : ' + lightLevel + ' }}');
          });

    		thisPeripheral.lightDataChar.subscribe(function(err) {
           		if(!err){
           			console.log("[BLE] ", peripheral.advertisement.localName, " Subscribed to light");
           		}
          	});
    	}
    })
}


function turnBatteryReadOn(peripheral){
      var thisPeripheral = connectedDevices[peripheral.address.replace(/:/g, '')];
      thisPeripheral.batteryDataChar.on('data', function(data, isNotification) {
            var batteryLevel = data.readUInt8(0);
            console.log('[BLE] ' + peripheral.advertisement['localName'] + ' -> Battery Level : ' + batteryLevel + ' %');
            deviceClient.publishDeviceEvent("Enviro", peripheral.address.replace(/:/g, ''),"battery","json",'{"d" : { "batteryLevel" : ' + batteryLevel + ' }}');
        });

      thisPeripheral.batteryDataChar.subscribe(function(err) {
            if(!err){
              console.log("[BLE] ", peripheral.advertisement.localName, " Battery level notification on");
            }
          });
}


function turnSensorOff(peripheral, char) {
    var thisPeripheral = connectedDevices[peripheral.address.replace(/:/g, '')];
    characteristic = thisPeripheral[char];
    char = char.substring(0, char.indexOf("OnChar")-1);
    if(characteristic != null) {
      console.log("Turning off sensor");
      characteristic.write(offValue, false, function(err) {
        console.log("sensor collback. err: "+ err);
        if (!err) {
          deviceClient.publishGatewayEvent("sensorToggleResponse", 'json', JSON.stringify({message: "The " + char + " sensor of " + peripheral.advertisement.localName + " has been turned off successfully!"}));
        }
        else {
          deviceClient.publishGatewayEvent("sensorToggleResponse", 'json', JSON.stringify({message: "Could not turn off the " + char + " sensor of " + peripheral.advertisement.localName + "."}));
        }
      });
      characteristic.unsubscribe(function(err) {
           		if(!err){
           			console.log("[BLE] ", peripheral.advertisement.localName, " Unsubscribed to " + char);
           		}
          	});
    }
}
