
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
var weatherDataChar = null;
var weatherOnChar = null;
var weatherPeriodChar = null;

var accelDataCharUuid = 'aa81';
var accelOnCharUuid = 'aa82';
var accelPeriodCharUuid = 'aa83';
var accelDataChar = null;
var accelOnChar = null;
var accelPeriodChar = null;

var lightDataCharUuid = 'aa21';
var lightOnCharUuid = 'aa22';
var lightPeriodCharUuid = 'aa23';
var lightDataChar = null;
var lightOnChar= null;
var lightPeriodChar = null;

var batteryDataCharUuid = '2a19';
var batteryDataChar = null;



// Write 0x01 value to turn sensors on
var onValue = new Buffer(1);
onValue.writeUInt8(0x01, 0);

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
  deviceClient.subscribeToGatewayCommand("BeagleBone", "506583dd5c62", 'test');
  deviceClient.on('command', function(type, id, commandName, commandFormat, payload, topic) {
    console.log(type, id, commandName, commandFormat, payload, topic);
  });

  // Once we are connected to the mqtt broker, we can scan for bluetooth devices
	console.log('[BLE] Scanning for Enviro...');
  noble.startScanning([], false);
});



noble.on('discover', function(peripheral) {
  
//  console.log('[BLE] found peripheral:\n' + peripheral + '\n\n\n\n\n');
  // Check if peripheral contains 'Enviro' in its name
  if(false && (peripheral.address == 'b0:b4:48:e4:bf:03' || peripheral.address == '11:22:33:44:55:66' || peripheral.address == 'b0:b4:48:e4:9c:80') && (peripheral.advertisement['localName'] != null && peripheral.advertisement['localName'].indexOf('Enviro') > -1)) {
  	console.log('[BLE] Connecting to peripheral:', peripheral.advertisement['localName'], " with address : ", peripheral.address, ' ...');
  	// we found a enviro, stop scanning
  	//noble.stopScanning();

	  // Once the peripheral has been discovered, then connect to it.
    connectToEnviro(peripheral);
	  
  }
})


function connectToEnviro(peripheral) {
  peripheral.connect(function(err) {
      //**Start scanning for more Enviros
      noble.startScanning();

      console.log("[BLE] Connected");

      peripheral.once('disconnect', function() {
        // handle the disconnection event of the peripheral
        console.log('[BLE] Peripheral:', peripheral.advertisement['localName'], " disconnected");
        console.log('      Attempting to reconnect ...');
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
                weatherOnChar = characteristic;
              }
              else if (accelOnCharUuid == characteristic.uuid) {
                accelOnChar = characteristic;
              }
              else if (lightOnCharUuid == characteristic.uuid) {
                lightOnChar = characteristic;
              }
              else if (weatherDataCharUuid == characteristic.uuid) {
                weatherDataChar = characteristic;
              }
              else if (accelDataCharUuid == characteristic.uuid) {
                accelDataChar = characteristic;
              }
              else if (lightDataCharUuid == characteristic.uuid) {
                lightDataChar = characteristic;
              } 
              else if (weatherPeriodCharUuid == characteristic.uuid) {
                weatherPeriodChar = characteristic;
              }
              else if (accelPeriodCharUuid == characteristic.uuid) {
                accelPeriodChar = characteristic;
              }
              else if (lightPeriodCharUuid == characteristic.uuid) {
                lightPeriodChar = characteristic;
              }
              else if (batteryDataCharUuid == characteristic.uuid) {
                batteryDataChar = characteristic;
              }
            })
     
           // Check to see if we found all of our characteristics.
            //
            if (weatherOnChar &&
                accelOnChar &&
                lightOnChar && 
                weatherDataChar &&
                accelDataChar &&
                lightDataChar &&
                weatherPeriodChar &&
                accelPeriodChar &&
                lightPeriodChar &&
                batteryDataChar) {
              turnWeatherSensorOn(peripheral);
              turnAccelSensorOn(peripheral);
              turnLightSensorOn(peripheral);
              turnBatteryReadOn(peripheral);
              setPeriod(accelPeriodChar, 30);
              setPeriod(weatherPeriodChar, 30);
              setPeriod(lightPeriodChar, 30);
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

function setPeriod(char, period){
	var periodBuf = new Buffer(1);
    periodBuf.writeUInt8(period, 0);
    char.write(periodBuf, false, function(err) {

    });
}


function turnWeatherSensorOn(peripheral){

    // Turn on weather sensor and subsribe to it
    weatherOnChar.write(onValue, false, function(err) {
    	if (!err) {
    		weatherDataChar.on('data', function(data, isNotification) {
            	
            var temperature = ((data.readUInt8(2) * 0x10000 + data.readUInt8(1) * 0x100 + data.readUInt8(0)) / 100.0).toFixed(1);
        		var pressure = ((data.readUInt8(5) * 0x10000 + data.readUInt8(4) * 0x100 + data.readUInt8(3)) / 100.0).toFixed(1);
        		var humidity = (((data.readUInt8(8) * 0x10000 + data.readUInt8(7) * 0x100 + data.readUInt8(6))) / Math.pow(2, 10) * 10.0).toFixed(1);
        		console.log('[BLE] ' + peripheral.advertisement['localName'] + ' -> Weather Data : { Temperature : ' + temperature + ' C, Pressure : ' + pressure + ' mbar, Humidity: ' + humidity + ' % }');
            deviceClient.publishDeviceEvent("Enviro", peripheral.address.replace(/:/g, ''),"air","json",'{"d" : { "temperature" : ' + temperature + ', "pressure" : ' + pressure + ', "humidity" : ' + humidity + ' }}');
          });

    		weatherDataChar.subscribe(function(err) {
           		if(!err){
           			console.log("[BLE] ", peripheral.advertisement.localName, " Subscribed to weather"); 
           		}
          	});
    	}
    })
}

function turnAccelSensorOn(peripheral){

    // Turn on accelerometer sensor and subsribe to it
    accelOnChar.write(onValue, false, function(err) {
    	if (!err) {
    		accelDataChar.on('data', function(data, isNotification) {

            var accelX = ((data.readInt8(1) * 0x100 + data.readInt8(0)) * 0.488).toFixed(0);
        		var accelY = ((data.readInt8(3) * 0x100 + data.readInt8(2)) * 0.488).toFixed(0);
        		var accelZ = ((data.readInt8(5) * 0x100 + data.readInt8(4)) * 0.488).toFixed(0);
            	console.log('[BLE] ' + peripheral.advertisement['localName'] + ' -> Accelerometer Data : { X : ' + accelX + ', Y : ' + accelY + ', Z : ' + accelZ + ' }');
              deviceClient.publishDeviceEvent("Enviro", peripheral.address.replace(/:/g, ''),"accel","json",'{"d" : { "x" : ' + accelX + ', "y" : ' + accelY + ', "z" : ' + accelZ + ' }}');
          });

    		accelDataChar.subscribe(function(err) {
           		if(!err){
           			console.log("[BLE] ", peripheral.advertisement.localName, " Subscribed to accelerometer");
           		}
          	});
    	}
    })
}

function turnLightSensorOn(peripheral){

    // Turn on accelerometer sensor and subsribe to it
    lightOnChar.write(onValue, false, function(err) {
    	if (!err) {
    		lightDataChar.on('data', function(data, isNotification) {
            	var lightLevel = data.readUInt8(1) * 0x100 + data.readUInt8(0);
            	console.log('[BLE] ' + peripheral.advertisement['localName'] + ' -> Light Data : ' + lightLevel + ' mV');
            	deviceClient.publishDeviceEvent("Enviro", peripheral.address.replace(/:/g, ''),"health","json",'{"d" : { "light" : ' + lightLevel + ' }}');
          });

    		lightDataChar.subscribe(function(err) {
           		if(!err){
           			console.log("[BLE] ", peripheral.advertisement.localName, " Subscribed to light");
           		}
          	});
    	}
    })
}


function turnBatteryReadOn(peripheral){

      batteryDataChar.on('data', function(data, isNotification) {
            var batteryLevel = data.readUInt8(0);
            console.log('[BLE] ' + peripheral.advertisement['localName'] + ' -> Battery Level : ' + batteryLevel + ' %');
            deviceClient.publishDeviceEvent("Enviro", peripheral.address.replace(/:/g, ''),"battery","json",'{"d" : { "batteryLevel" : ' + batteryLevel + ' }}');
        });

      batteryDataChar.subscribe(function(err) {
            if(!err){
              console.log("[BLE] ", peripheral.advertisement.localName, " Battery level notification on");
            }
          });
    
    
}
