
/**
* !!! Important device information !!!
* -------------------------------------
* Organization ID : 4rxa4d
* Device Type : Enviro
* Device ID : b0b448e49c80
* Authentication Method : token
* Authentication Token : u!lTBzeWYJ1Bd!fC)Q

    "org" : "4rxa4d",
    "id" : "506583dd5c62",
    "domain": "internetofthings.ibmcloud.com",
    "type" : "BeagleBone",
    "auth-method" : "token",
    "auth-token" : "rGpBk2iF?tMG*PSznn"

* ID d'organisation 4rxa4d
* Type de terminal BeagleBone
* ID de terminal 506583dd346a
* Méthode d'authentification token
* Jeton d'authentification @M6ZAOvLtr_pQ_j@x-
*/


var noble = require('noble');
var Client = require('ibmiotf');

var weatherServiceUuid = 'aa40';
var accelServiceUuid = 'aa80';
var lightServiceUuid = 'aa20';
var CO2ServiceUuid = 'aa10';
var batteryServiceUuid = '180f';
var serviceUuids = [weatherServiceUuid, accelServiceUuid, lightServiceUuid, CO2ServiceUuid ,batteryServiceUuid];

var weatherDataCharUuid = 'aa41';
var weatherOnCharUuid = 'aa42';
var weatherPeriodCharUuid = 'aa44';


var accelDataCharUuid = 'aa81';
var accelOnCharUuid = 'aa82';
var accelPeriodCharUuid = 'aa83';


var lightDataCharUuid = 'aa21';
var lightOnCharUuid = 'aa22';
var lightPeriodCharUuid = 'aa23';

var CO2DataCharUuid = 'aa11';
var CO2OnCharUuid = 'aa12'
var CO2PeriodCharUuid = 'aa14';


var batteryDataCharUuid = '2a19';


//varibles used for commands
var currentDiscoveredDevices = [];
var connectedDevices = {};
var manualDisconnection = {};
var naturalDisconnection = {};



// Write 0x01 value to turn sensors on
var onValue = new Buffer(1);
onValue.writeUInt8(0x01, 0);
var offValue = new Buffer(1);
offValue.writeUInt8(0x00, 0);

setTimeout(function() {
var mqttConfig = {
    "org" : "4rxa4d",
    "id" : "506583dd346a",
    "domain": "internetofthings.ibmcloud.com",
    "type" : "BeagleBone",
    "auth-method" : "token",
    "auth-token" : "@M6ZAOvLtr_pQ_j@x-"
};

var deviceClient = new Client.IotfGateway(mqttConfig);

// Called when noble is ready
noble.on('stateChange', function(state) {
  if (state === 'poweredOn') {
    console.log('[Noble] Powered on.');
  	console.log('[MQTT] Connecting...');
    deviceClient.connect();
  }
  else {
    console.log("Stop scanning");
    noble.stopScanning();
  }
})

if(noble.state == 'poweredOn') {
  console.log('[Noble] Already powered on.');
  console.log('[MQTT] Connecting...');
  deviceClient.connect();
}

deviceClient.on('connect', function () {
  //publishing event using the default quality of service
	console.log('[MQTT] Connected');
  deviceClient.subscribeToGatewayCommand("scan");
  deviceClient.subscribeToGatewayCommand("connectTo");
  deviceClient.subscribeToGatewayCommand("disconnectTo")
  deviceClient.subscribeToGatewayCommand("sensorToggle");
  deviceClient.subscribeToGatewayCommand("sensorPeriod");
  deviceClient.subscribeToGatewayCommand("getter");
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
        var alreadyConnected = false;
        for(i in connectedDevices) {
          if(connectedDevices[i] != null && i == payload.data.deviceId && connectedDevices[i].peripheral.advertisement.localName == payload.data.localName) {
            alreadyConnected = true;
          }
        }
        if (alreadyConnected) {
          console.log("Device " + payload.data.localName + " is already connected.");
          deviceClient.publishGatewayEvent("connectionResponse", 'json', JSON.stringify({message: "The device " + payload.data.localName + " you are trying to connect to is already connected."}));
          break;
        }
        for(i in currentDiscoveredDevices) {
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
      case 'disconnectTo':
        var connected = false;
        for(i in connectedDevices) {
          if (i == payload.data.deviceId) {
            connected = true;
          }
        }
        if (connected) {
          targetDevice = connectedDevices[payload.data.deviceId];
          manualDisconnection[payload.data.deviceId] = true;
          setTimeout(function() {
            manualDisconnection[payload.data.deviceId] = null;
          }, 5000);
          if (targetDevice) {
            targetDevice.peripheral.disconnect(function(error) {
              if(!error) {
                clearTimeout(targetDevice.rssi);
                connectedDevices[payload.data.deviceId] = null;
                deviceClient.publishGatewayEvent("disconnectionResponse", 'json', JSON.stringify({message: "The device " + payload.data.localName + " disconnected successfully."}));
                console.log(payload.data.localName + "disconnected.");
              }
              else {
                deviceClient.publishGatewayEvent("disconnectionResponse", 'json', JSON.stringify({message: "The device " + payload.data.localName + " failed to disconnect."}));
                console.log(payload.data.localName + "failed to disconnect.")
              }
            });
          }
          else {
            deviceClient.publishGatewayEvent("disconnectionResponse", 'json', JSON.stringify({message: "The device " + payload.data.localName + " is already disconnected"}));
          }
        }
        else {
          deviceClient.publishGatewayEvent("disconnectionResponse", 'json', JSON.stringify({message: "Something went wrong trying to disconnect the device " + payload.data.localName + ". Try again."}));
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
            case 'weatherOnChar':
              if (targetDevice.weatherDataChar && targetDevice.weatherOnChar) {
                  turnSensorOff(peripheral, payload.data.sensor);
              }
              else {
                deviceClient.publishGatewayEvent("sensorToggleResponse", 'json', JSON.stringify({message: "The device " + payload.data.localName + " does not have a weather sensor, you therefore cannot toggle it."}));
              }
              break;
            case 'accelOnChar':
              if (targetDevice.accelDataChar && targetDevice.accelOnChar) {
                  turnSensorOff(peripheral, payload.data.sensor);
              }
              else {
                deviceClient.publishGatewayEvent("sensorToggleResponse", 'json', JSON.stringify({message: "The device " + payload.data.localName + " does not have an accelerometer, you therefore cannot toggle it."}));
              }
              break;
            case 'lightOnChar':
              if (targetDevice.lightDataChar && targetDevice.lightOnChar) {
                turnSensorOff(peripheral, payload.data.sensor);
              }
              else {
                deviceClient.publishGatewayEvent("sensorToggleResponse", 'json', JSON.stringify({message: "The device " + payload.data.localName + " does not have a light sensor, you therefore cannot toggle it."}));
              }
              break;
            case 'CO2OnChar':
              if (targetDevice.CO2DataChar && targetDevice.CO2OnChar) {
                turnSensorOff(peripheral, payload.data.sensor);
              }
              else {
                deviceClient.publishGatewayEvent("sensorToggleResponse", 'json', JSON.stringify({message: "The device " + payload.data.localName + " does not have a CO2 sensor, you therefore cannot toggle it."}));
              }
              break;
            default:
              break;
          }
        }
        else if (payload.data.value == "on") {
          switch(payload.data.sensor) {
            case 'weatherOnChar':
              turnWeatherSensorOn(peripheral, false);
              break;
            case 'accelOnChar':
              turnAccelSensorOn(peripheral, false);
              break;
            case 'lightOnChar':
              turnLightSensorOn(peripheral, false);
              break;
            case 'CO2OnChar':
              turnCO2SensorOn(peripheral, false);
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
        var period = payload.data.value;
        period = parseFloat(period)*10;//this multiplication by 10 is due to the fact that enviros have a connection period of 100ms
        var targetSensor = targetDevice[payload.data.sensor];
        if (targetSensor) {
          setPeriod(targetSensor, period, peripheral, payload.data.sensor.substring(0, payload.data.sensor.indexOf("PeriodChar")));
        }
        break;
      case 'getter':
        switch(payload.data.type) {
          case 'connectedDevices':
            var out = [];
            for(i in connectedDevices) {
              if(connectedDevices[i] != null) {
                var tempObj = {};
                tempObj.localName = connectedDevices[i].peripheral.advertisement.localName;
                tempObj.deviceId = i;
                out.push(tempObj);
              }
            }
            deviceClient.publishGatewayEvent("getterResponse", 'json', JSON.stringify({type: 'connectedDevices', d: out}));
            break;
          case 'deviceInfo':
            var targetDevice = connectedDevices[payload.data.deviceId];
            if(targetDevice == undefined || targetDevice == null) {
              deviceClient.publishGatewayEvent("getterResponse", 'json', JSON.stringify({type: 'deviceInfo', d: {localName: payload.data.localName, deviceId: payload.data.deviceId, status: "disconnected"}}));
            }
            else {
              var out = {localName: payload.data.localName, deviceId: payload.data.deviceId, status: "connected", };
              for(i in targetDevice) {
                if(i != "peripheral" && i != "rssi" && i.indexOf("DataChar") < 0 && i.indexOf("OnChar") < 0 && i.indexOf("PeriodChar") < 0) {
                  out[i] = targetDevice[i];
                }
              }
              deviceClient.publishGatewayEvent("getterResponse", 'json', JSON.stringify({type: 'deviceInfo', d: out}));
            }
        }
    }
  });

});



noble.on('discover', function(peripheral) {
  if(naturalDisconnection[peripheral.address.replace(/:/g, '')]) {//if the device recently disconnected and is discovered, we reconnect to it
    connectToEnviro(peripheral);
  }
  // Check if peripheral contains 'Enviro' in its name
  else if( peripheral.advertisement['localName'] != null && (peripheral.advertisement['localName'].indexOf('Enviro') > -1 || peripheral.advertisement['localName'].indexOf('ArtESun') > -1)) {
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
        if (!manualDisconnection[peripheral.address.replace(/:/g, '')]) {
          var thisPeripheral = connectedDevices[peripheral.address.replace(/:/g, '')];
          if(thisPeripheral) {
            clearTimeout(thisPeripheral.rssi);
          }
          connectedDevices[peripheral.address.replace(/:/g, '')] = null;
          naturalDisconnection[peripheral.address.replace(/:/g, '')] = true;
          setTimeout(function() {
            naturalDisconnection[peripheral.address.replace(/:/g, '')] = null;
          }, 12000);
          console.log('[BLE] Peripheral:', peripheral.advertisement['localName'], " disconnected");
          console.log('      Attempting to reconnect ...');
          deviceClient.publishGatewayEvent("connectionResponse", 'json', JSON.stringify({message: "Device " + peripheral.advertisement.localName + " disconnected, atempting to reconect."}));
          noble.startScanning();
        }
          
      });
      console.log("[BLE] Looking for characteristics ...");

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
              else if (CO2OnCharUuid == characteristic.uuid) {
                thisPeripheral.CO2OnChar = characteristic;
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
              else if (CO2DataCharUuid == characteristic.uuid) {
                thisPeripheral.CO2DataChar = characteristic;
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
              else if (CO2PeriodCharUuid == characteristic.uuid) {
                thisPeripheral.CO2PeriodChar = characteristic;
              }
              else if (batteryDataCharUuid == characteristic.uuid) {
                thisPeripheral.batteryDataChar = characteristic;
              }
            })
     
           // Connects to the characteristics it found
            if (thisPeripheral.weatherOnChar && thisPeripheral.weatherDataChar && thisPeripheral.weatherPeriodChar) {
              turnWeatherSensorOn(peripheral, true);
              setPeriod(thisPeripheral.weatherPeriodChar, 30, peripheral, "weather");
            }
            else {
              console.log("[BLE] ", peripheral.advertisement.localName, " Weather service not found");
            }
            if (thisPeripheral.accelOnChar && thisPeripheral.accelDataChar && thisPeripheral.accelPeriodChar) {
              turnAccelSensorOn(peripheral, true);
              setPeriod(thisPeripheral.accelPeriodChar, 30, peripheral, "accel");
            }
            else {
              console.log("[BLE] ", peripheral.advertisement.localName, " Accelerometer service not found");
            }
            if (thisPeripheral.lightOnChar && thisPeripheral.lightDataChar && thisPeripheral.lightPeriodChar) {
              turnLightSensorOn(peripheral, true);
              setPeriod(thisPeripheral.lightPeriodChar, 30, peripheral, "light");
            }
            else {
              console.log("[BLE] ", peripheral.advertisement.localName, " Light service not found");
            }
            if(thisPeripheral.CO2OnChar && thisPeripheral.CO2DataChar && thisPeripheral.CO2PeriodChar) {
              turnCO2SensorOn(peripheral, true);
              setPeriod(thisPeripheral.CO2PeriodChar, 30, peripheral, "CO2");
            }
            else {
              console.log("[BLE] ", peripheral.advertisement.localName, " CO2 service not found");
            }
            if (thisPeripheral.batteryDataChar) {
              turnBatteryReadOn(peripheral, true);
            }
            else {
              console.log("[BLE] ", peripheral.advertisement.localName, " Battery service not found");
            }

            //sending Rssi information periodically every 3 seconds;
            var rssiUpdates = setInterval(function() {
              if (peripheral.state == "disconnected") {
                clearInterval(rssiUpdates);
              }
              else {
                peripheral.updateRssi(function(err, rssi) {
                  console.log('[BLE] ' + peripheral.advertisement['localName'] + ' -> Location Data : ' + rssi + ' dbm');
                  deviceClient.publishDeviceEvent("Enviro", peripheral.address.replace(/:/g, ''),"location","json",'{"localName" : "' + peripheral.advertisement.localName + '", "d" : { "rssi" : ' + rssi + ' }}');
                });
              }
            }, 3000);
            thisPeripheral.rssi = rssiUpdates;
        });
    })
}

function setPeriod(char, period, peripheral, charName){
	  var periodBuf = new Buffer(2);
    periodBuf.writeUInt16LE(period, 0);
    if(char) {
      char.write(periodBuf, false, function(err) {
        if(err) {
          deviceClient.publishGatewayEvent("sensorPeriodResponse", 'json', JSON.stringify({message: "Period of " + charName + " sensor on " + peripheral.advertisement.localName + " failed to be set to " + period/10 + " seconds."}));
          throw err;
        }
        else {
          var thisPeripheral = connectedDevices[peripheral.address.replace(/:/g, '')];
          thisPeripheral[charName+"period"] = period/10;
          deviceClient.publishGatewayEvent("sensorPeriodResponse", 'json', JSON.stringify({message: "Period of " + charName + " sensor on " + peripheral.advertisement.localName + " was successfully set to " + period/10 + " seconds."}));
        }
      });
    }
}


function turnWeatherSensorOn(peripheral, first){ // the first variable determined if it is the first time that this is called to prevent to have double data sent when the sensor is tured off then back on.
    var thisPeripheral = connectedDevices[peripheral.address.replace(/:/g, '')];
    // Turn on weather sensor and subsribe to it
    if(thisPeripheral.weatherOnChar) {
      thisPeripheral.weatherOnChar.write(onValue, false, function(err) {
        if (!err) {
          thisPeripheral.weatherSensorOn = true;
          deviceClient.publishGatewayEvent("sensorToggleResponse", 'json', JSON.stringify({message: "Weather sensor of " + peripheral.advertisement.localName + " has connected successfully!"}));
          if(first) {
            thisPeripheral.weatherDataChar.on('data', function(data, isNotification) {
                
              var temperature = ((data.readUInt8(2) * 0x10000 + data.readUInt8(1) * 0x100 + data.readUInt8(0)) / 100.0).toFixed(1);
              var pressure = ((data.readUInt8(5) * 0x10000 + data.readUInt8(4) * 0x100 + data.readUInt8(3)) / 100.0).toFixed(1);
              var humidity = (((data.readUInt8(8) * 0x10000 + data.readUInt8(7) * 0x100 + data.readUInt8(6))) / Math.pow(2, 10) * 10.0).toFixed(1);
              if (temperature != 0 || pressure != 0 || humidity != 0) {
                console.log('[BLE] ' + peripheral.advertisement['localName'] + ' -> Weather Data : { Temperature : ' + temperature + ' C, Pressure : ' + pressure + ' mbar, Humidity: ' + humidity + ' % }');
                deviceClient.publishDeviceEvent("Enviro", peripheral.address.replace(/:/g, ''),"air","json",'{"d" : { "temperature" : ' + temperature + ', "pressure" : ' + pressure + ', "humidity" : ' + humidity + ' }}');
              }
            });
          }

          thisPeripheral.weatherDataChar.subscribe(function(err) {
                if(!err){
                  console.log("[BLE] ", peripheral.advertisement.localName, " Subscribed to weather"); 
                }
              });
        }
      })
    }
}

function turnAccelSensorOn(peripheral, first){
    var thisPeripheral = connectedDevices[peripheral.address.replace(/:/g, '')];
    // Turn on accelerometer sensor and subsribe to it
    if (thisPeripheral.accelOnChar) {
      thisPeripheral.accelOnChar.write(onValue, false, function(err) {
        if (!err) {
          thisPeripheral.accelSensorOn = true;
          deviceClient.publishGatewayEvent("sensorToggleResponse", 'json', JSON.stringify({message: "Accelerometer of " + peripheral.advertisement.localName + " has connected successfully!"}));
          if(first) {
            thisPeripheral.accelDataChar.on('data', function(data, isNotification) {

              var accelX = ((data.readInt8(1) * 0x100 + data.readInt8(0)) * 0.488).toFixed(0);
              var accelY = ((data.readInt8(3) * 0x100 + data.readInt8(2)) * 0.488).toFixed(0);
              var accelZ = ((data.readInt8(5) * 0x100 + data.readInt8(4)) * 0.488).toFixed(0);
              if (accelX != 0 || accelY != 0 || accelZ != 0) {
                console.log('[BLE] ' + peripheral.advertisement['localName'] + ' -> Accelerometer Data : { X : ' + accelX + ', Y : ' + accelY + ', Z : ' + accelZ + ' }');
                deviceClient.publishDeviceEvent("Enviro", peripheral.address.replace(/:/g, ''),"accel","json",'{"d" : { "x" : ' + accelX + ', "y" : ' + accelY + ', "z" : ' + accelZ + ' }}');
              }
            });
          }

          thisPeripheral.accelDataChar.subscribe(function(err) {
                if(!err){
                  console.log("[BLE] ", peripheral.advertisement.localName, " Subscribed to accelerometer");
                }
              });
        }
      })
    }
}

function turnLightSensorOn(peripheral, first){
    var thisPeripheral = connectedDevices[peripheral.address.replace(/:/g, '')];
    // Turn on light sensor and subsribe to it
    if (thisPeripheral.lightOnChar) {
      thisPeripheral.lightOnChar.write(onValue, false, function(err) {
        if (!err) {
          thisPeripheral.lightSensorOn = true;
          deviceClient.publishGatewayEvent("sensorToggleResponse", 'json', JSON.stringify({message: "Light sensor of " + peripheral.advertisement.localName + " has connected successfully!"}));
          if(first) {
            thisPeripheral.lightDataChar.on('data', function(data, isNotification) {
                var lightLevel = data.readUInt8(1) * 0x100 + data.readUInt8(0);
                if (lightLevel != 0) { //maybe need to take this if statement depending if it is possible to get 0 normally
                  console.log('[BLE] ' + peripheral.advertisement['localName'] + ' -> Light Data : ' + lightLevel + ' mV');
                  deviceClient.publishDeviceEvent("Enviro", peripheral.address.replace(/:/g, ''),"health","json",'{"d" : { "light" : ' + lightLevel + ' }}');
                }
            });
          }

          thisPeripheral.lightDataChar.subscribe(function(err) {
                if(!err){
                  console.log("[BLE] ", peripheral.advertisement.localName, " Subscribed to light");
                }
              });
        }
      })
    }
}

function turnCO2SensorOn(peripheral, first){
    var thisPeripheral = connectedDevices[peripheral.address.replace(/:/g, '')];
    // Turn on CO2 sensor and subsribe to it
    if (thisPeripheral.CO2OnChar) {
      thisPeripheral.CO2OnChar.write(onValue, false, function(err) {
        if (!err) {
          thisPeripheral.CO2SensorOn = true;
          deviceClient.publishGatewayEvent("sensorToggleResponse", 'json', JSON.stringify({message: "CO2 sensor of " + peripheral.advertisement.localName + " has connected successfully!"}));
          if(first) {
            thisPeripheral.CO2DataChar.on('data', function(data, isNotification) {//4 0-4 1-2 3-msb x 256 3-lsb
                var CO2Level = data.readUInt8(2) * 0x100 + data.readUInt8(3);
                if (data.readUInt8(0) == 4 && data.readUInt8(1) == 2) { // this check is to make sure that the value sent by the enviro is correct.
                  if (CO2Level != 0) {
                    console.log('[BLE] ' + peripheral.advertisement['localName'] + ' -> CO2 Data : ' + CO2Level + ' ppm');
                    deviceClient.publishDeviceEvent("Enviro", peripheral.address.replace(/:/g, ''),"CO2","json",'{"d" : { "CO2" : ' + CO2Level + ' }}');
                  }
                }
                else {
                  console.log('[BLE] ' + peripheral.advertisement['localName'] + ' -> Light Data : error');
                }
                
            });
          }

          thisPeripheral.CO2DataChar.subscribe(function(err) {
                if(!err){
                  console.log("[BLE] ", peripheral.advertisement.localName, " Subscribed to CO2");
                }
              });
        }
      })
    }
}

function turnBatteryReadOn(peripheral){
      var thisPeripheral = connectedDevices[peripheral.address.replace(/:/g, '')];
      if (!thisPeripheral.batteryDataChar) {
        peripheral.disconnect();
      }
      else {
        thisPeripheral.batteryDataChar.on('data', function(data, isNotification) {
              var batteryLevel = data.readUInt8(0);
              var batteryLife = calculateBatteryLife(batteryLevel, thisPeripheral);
              batteryLife = Math.round(batteryLife * 100)/100; // rounds to two decimal places
              console.log('[BLE] ' + peripheral.advertisement['localName'] + ' -> Battery Data : { Battery level : ' + batteryLevel + ' % , battery life : ' + batteryLife + 'h }');
              deviceClient.publishDeviceEvent("Enviro", peripheral.address.replace(/:/g, ''),"battery","json",'{"d" : { "batteryLevel" : ' + batteryLevel + ', "batteryLife" : ' + batteryLife + ' }}');
          });

        thisPeripheral.batteryDataChar.subscribe(function(err) {
              if(!err){
                console.log("[BLE] ", peripheral.advertisement.localName, " Battery level notification on");
              }
        });
      }
}

function calculateBatteryLife(batt, thisPeripheral) {
  var connectionInterval = 100; //hardcoded
  var batteryPeriod = 15; //hardcoded
  var sleep = 1.8; // hardcoded

  var totalAverageCurrentConsumption = 0;
  if(thisPeripheral.weatherSensorOn == true) {
    var averageCurrentDraw = (3198 * 2.93 + sleep * (thisPeripheral.weatherperiod * 1000 - 2.93))/(thisPeripheral.weatherperiod * 1000 * 1000);
    /*if(connectionInterval < 1500) {
      averageCurrentDraw += (4299 * 2.9 + sleep * (connectionInterval - 2.9))/(connectionInterval * 1000);
    }
    else {
      averageCurrentDraw += (4006 * 3.31 + sleep * (connectionInterval - 3.31))/(connectionInterval * 1000);
    }*/
    var weatherSensorAverageCurrent = averageCurrentDraw * 1000;
    totalAverageCurrentConsumption += weatherSensorAverageCurrent;
  }

  if(thisPeripheral.lightSensorOn == true) {
    var averageCurrentDraw = (1624 * 6.81 + sleep * (thisPeripheral.lightperiod * 1000 - 6.81))/(thisPeripheral.lightperiod * 1000 * 1000);
    /*if(connectionInterval < 1500) {
      averageCurrentDraw += (3764 * 2.69 + sleep * (connectionInterval - 2.69))/(connectionInterval * 1000);
    }
    else {
      averageCurrentDraw += (3600 * 2.44 + sleep * (connectionInterval - 2.44))/(connectionInterval * 1000);
    }*/
    var lightSensorAverageCurrent = averageCurrentDraw * 1000;
    totalAverageCurrentConsumption += lightSensorAverageCurrent;
  }

  if(thisPeripheral.accelSensorOn == true) {
    if (thisPeripheral.accelperiod < 0.1) {
      var bmaPeriod = 50;
    }
    else if (thisPeripheral.accelperiod >= 0.1 && thisPeripheral.accelperiod < 500) {
      var bmaPeriod = 100;
    }
    else if (thisPeripheral.accelperiod >= 500 && thisPeripheral.accelperiod < 1000) {
      var bmaPeriod = 500;
    }
    else {
      var bmaPeriod = 1000;
    }
    var averageCurrentDraw = (3065 * 1.18 + sleep * (bmaPeriod - 1.18))/(bmaPeriod)/1000;
    var accelSensorAverageCurrent = averageCurrentDraw * 1000;
    totalAverageCurrentConsumption += accelSensorAverageCurrent;
  }

  var averageCurrentDraw = (1450 * 2.5 + sleep * (batteryPeriod * 1000 - 2.5))/(batteryPeriod * 1000 * 1000);
  var batteryAverageCurrent = averageCurrentDraw * 1000;
  totalAverageCurrentConsumption += batteryAverageCurrent;

  if(connectionInterval < 1500) {
    var averageCurrentDraw = (3666 * 2.46 + sleep * (connectionInterval - 2.46))/(connectionInterval * 1000);
  }
  else {
    var averageCurrentDraw = (2760 * 4.31 + sleep * (connectionInterval - 4.31))/(connectionInterval * 1000);
  }
  var connectionAverageCurrent = averageCurrentDraw * 1000;
  totalAverageCurrentConsumption += connectionAverageCurrent;


  var batteryNominalCapacity = 11; //hardcoded
  var supplyVoltage = 2 + batt / 100;
  var difference = 3 - supplyVoltage;
  var batterylevel = 1 + (supplyVoltage - 3);
  var batteryCapacity = batteryNominalCapacity * (1 - Math.pow(difference, 2*batterylevel));
  var batteryLife = batteryCapacity/(totalAverageCurrentConsumption/1000);
  return batteryLife;
}


function turnSensorOff(peripheral, char) {
    var thisPeripheral = connectedDevices[peripheral.address.replace(/:/g, '')];
    characteristic = thisPeripheral[char];
    var dataCharacteristic = thisPeripheral[char.replace("On", "Data")];
    char = char.substring(0, char.indexOf("OnChar"));
    if(characteristic != null) {
      characteristic.write(offValue, false, function(err) {
        if (!err) {
          thisPeripheral[char+"SensorOn"] = false;
          deviceClient.publishGatewayEvent("sensorToggleResponse", 'json', JSON.stringify({message: "The " + char + " sensor of " + peripheral.advertisement.localName + " has been turned off successfully!"}));
        }
        else {
          deviceClient.publishGatewayEvent("sensorToggleResponse", 'json', JSON.stringify({message: "Could not turn off the " + char + " sensor of " + peripheral.advertisement.localName + "."}));
        }
      });
      dataCharacteristic.unsubscribe(function(err) {
           		if(!err){
           			console.log("[BLE] ", peripheral.advertisement.localName, " Unsubscribed to " + char);
           		}
          	});
    }
}

}, 700);