var noble = require('noble');
var Client = require('ibmiotf');

var weatherServiceUuid = 'aa40';
var accelServiceUuid = 'aa80';
var lightServiceUuid = 'aa20';
var serviceUuids = [weatherServiceUuid, accelServiceUuid, lightServiceUuid];

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

// Write 0x01 value to turn sensors on
var onValue = new Buffer(1);
onValue.writeUInt8(0x01, 0);

var mqttConfig = {
    "org" : "quickstart",
    "id" : "506583dd5c62",
    "domain": "quickstart.messaging.internetofthings.ibmcloud.com",
    "type" : "iotsample-ti-bbst"
    // "auth-method" : "token",
    // "auth-token" : "authToken"
};

var deviceClient = new Client.IotfDevice(mqttConfig);

// Called when noble is ready
noble.on('stateChange', function(state) {
  if (state === 'poweredOn') {
  	console.log('[MQTT] Connecting...');
  	deviceClient.connect();
  }
  else {
    noble.stopScanning();
  }
})

deviceClient.on('connect', function () {
 
	console.log('[MQTT] Connected');

	console.log('[BLE] Scanning for Enviro...');
    noble.startScanning([], true);
	//publishing event using the default quality of service
});


noble.on('discover', function(peripheral) {
  
//  console.log('[BLE] found peripheral:\n' + peripheral + '\n\n\n\n\n');
  // Check if peripheral contains 'Enviro' in its name
  if(peripheral.address == 'b0:b4:48:e4:9c:80' || (peripheral.advertisement['localName'] != null && peripheral.advertisement['localName'].indexOf('Enviro') > -1)) {
  	console.log('[BLE] connecting to peripheral:', peripheral.advertisement['localName'], ' ...');
  	// we found a enviro, stop scanning
  	//noble.stopScanning();

	  	// Once the peripheral has been discovered, then connect to it.
	  peripheral.connect(function(err) {
	    //
	    // Once the peripheral has been connected, then discover the
	    // services and characteristics of interest.

	    	peripheral.discoverSomeServicesAndCharacteristics(serviceUuids, [], function(error, services, characteristics){

	    		characteristics.forEach(function(characteristic) {
	            console.log('[BLE] found characteristic:', characteristic.uuid);
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
	              lightPeriodChar) {
	          	turnWeatherSensorOn();
	          	turnAccelSensorOn();
	          	turnLightSensorOn();
	          	//setPeriod(accelPeriodChar, 20);
	            
	          }
	          else {
	            console.log('[BLE] missing characteristics');
	          }
	    	});
  	})
  }
})

function setPeriod(char, period){
	var periodBuf = new Buffer(1);
    periodBuf.writeUInt8(period, 0);
    char.write(periodBuf, false, function(err) {
    });
}


function turnWeatherSensorOn(){

    // Turn on weather sensor and subsribe to it
    weatherOnChar.write(onValue, false, function(err) {
    	if (!err) {
    		weatherDataChar.on('data', function(data, isNotification) {
            	
            	var temperature = ((data.readUInt8(2) * 0x10000 + data.readUInt8(1) * 0x100 + data.readUInt8(0)) / 100.0).toFixed(1);
        		var pressure = ((data.readUInt8(5) * 0x10000 + data.readUInt8(4) * 0x100 + data.readUInt8(3)) / 100.0).toFixed(1);
        		var humidity = (((data.readUInt8(8) * 0x10000 + data.readUInt8(7) * 0x100 + data.readUInt8(6))) / Math.pow(2, 10) * 10.0).toFixed(1);
        		console.log('[BLE] Weather Data : { Temperature : ' + temperature + ' C, Pressure : ' + pressure + ' mbar, Humidity: ' + humidity + ' % }');
            	deviceClient.publish("status","json",'{"d" : { "temperature" : ' + temperature + ', "pressure" : ' + pressure + ', "humidity" : ' + humidity + ' }}');
          });

    		weatherDataChar.subscribe(function(err) {
           		if(!err){
           			console.log("[BLE] Subscribed to weather");
           		}
          	});
    	}
    })
}

function turnAccelSensorOn(){

    // Turn on accelerometer sensor and subsribe to it
    accelOnChar.write(onValue, false, function(err) {
    	if (!err) {
    		accelDataChar.on('data', function(data, isNotification) {

            	var accelX = ((data.readUInt8(1) * 0x100 + data.readUInt8(0)) * 0.488).toFixed(0);
        		var accelY = ((data.readUInt8(3) * 0x100 + data.readUInt8(2)) * 0.488).toFixed(0);
        		var accelZ = ((data.readUInt8(5) * 0x100 + data.readUInt8(4)) * 0.488).toFixed(0);
            	console.log('[BLE] Accelerometer Data : { X : ' + accelX + ', Y : ' + accelY + ', Z : ' + accelZ + ' }');
            	deviceClient.publish("status","json",'{"d" : { "accelX" : ' + accelX + ', "accelY" : ' + accelY + ', "accelZ" : ' + accelZ + ' }}');
          });

    		accelDataChar.subscribe(function(err) {
           		if(!err){
           			console.log("[BLE] Subscribed to accelerometer");
           		}
          	});
    	}
    })
}

function turnLightSensorOn(){

    // Turn on accelerometer sensor and subsribe to it
    lightOnChar.write(onValue, false, function(err) {
    	if (!err) {
    		lightDataChar.on('data', function(data, isNotification) {
            	var lightLevel = data.readUInt8(1) * 0x100 + data.readUInt8(0);
            	console.log('[BLE] Light Data : ' + lightLevel + ' mV');
            	deviceClient.publish("status","json",'{"d" : { "light" : ' + lightLevel + ' }}');
          });

    		lightDataChar.subscribe(function(err) {
           		if(!err){
           			console.log("[BLE] Subscribed to light");
           		}
          	});
    	}
    })
}



