const mqtt = require("mqtt");
const express = require("express");
const dotenv = require("dotenv")
const DEVICE_ID = "esp32_wokwi";

const app = express();
dotenv.config()
app.get("/", (req, res) => {
    res.send("MQTT Service OK 🚀");
});

// ================= MQTT ===================
const options = {
    username: process.env.USER_NAME,
    password: process.env.USER_PASS,
    rejectUnauthorized: false
};

const broker = process.env.BROKER_URL;

// ================= TOPIC ==================
const TOPIC = {
    data:   `devices/${DEVICE_ID}/data`,
    cmd:    `devices/${DEVICE_ID}/command`,
    status: `devices/${DEVICE_ID}/status`
};

// ================= STATE ===================
const sensor = {
    deviceId: DEVICE_ID,
    temp: 30,
    humidity: 55,
    soil: 70,
    pump: false,
    mode: "AUTO"
};

// internal state
let mode = "AUTO";
let pump = false;
let autoTarget = false;

// ================= MQTT ====================
const client = mqtt.connect(broker, options);

client.on("connect", () => {
    console.log("✅ MQTT CONNECTED");

    client.subscribe(TOPIC.cmd);

    setInterval(() => {
        randomSensor();
        sendData();
    }, 5000); // gửi mỗi 5s
});

// ================= SENSOR ==================
function randomSensor() {
    sensor.temp = +(30 + Math.random()).toFixed(1);
    sensor.humidity = Math.floor(40 + Math.random() * 20);
    sensor.soil = Math.floor(50 + Math.random() * 30);
}

// ================= PUMP CONTROL ============
function calcPump() {
    switch(mode) {
        case "MANUAL_ON":  return true;
        case "MANUAL_OFF": return false;
        default:           return autoTarget;
    }
}

function controlPump() {
    const target = calcPump();

    if (target !== pump) {
        pump = target;
        sensor.pump = pump;

        client.publish(TOPIC.status,
            JSON.stringify({ pump, mode }),
            { qos: 1 }
        );

        console.log("🔧 Pump changed →", pump);
    }
}

// ================= SEND DATA ===============
function sendData() {
    sensor.mode = mode;

    client.publish(TOPIC.data,
        JSON.stringify(sensor),
        { qos: 1 }
    );

    console.log("📤 SEND DATA", sensor);
}

// ================= RECEIVE CMD ============
client.on("message", (topic, msg) => {
    const raw = msg.toString();

    try {
        const json = JSON.parse(raw);

        if (json.cmd === "mode") {
            mode = json.value;
            controlPump();
        }

        if (json.cmd === "pump") {
            autoTarget = json.value;
            controlPump();
        }

    } catch (err) {
        console.log("❌ JSON ERROR:", err.message);
        console.log("📩 BAD MESSAGE:", raw);  
    }
});


// ================= ERROR ==================
client.on("error", err => {
    console.log("MQTT ERROR:", err.message);
});
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("Express server running on port", PORT);
});