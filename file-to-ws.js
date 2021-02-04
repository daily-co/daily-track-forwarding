const gstreamer = require("gstreamer-superficial");
const fs = require("fs");
const WebSocket = require("ws");

const fileName = process.argv[2];
if (!fileName) {
  console.log("usage: node file-to-ws.js <audio file filename>");
  process.exit(1);
}
console.log("using file ->", fileName);

connect();

//
//
//

async function connect() {
  const ws = new WebSocket("ws://localhost:7272");
  let pipeline = null;
  ws.on("open", async () => {
    await sendHello(ws);
    pipeline = startPipeline(ws);
  });
  ws.on("error", (err) => console.error(err));
  ws.on("close", () => {
    console.log("socket closed");
  });
}

async function sendHello(ws) {
  return new Promise(async (resolve, reject) => {
    ws.once("message", (data) => {
      console.log("ws message ->", data);
      let msg = JSON.parse(data);
      if (msg.tag !== "ready") {
        reject(new Error('expected "ready" response'));
        return;
      }
      resolve();
    });
    ws.send(
      JSON.stringify({
        tag: "hello",
        domain_name: "fake-domain",
        room_name: "file-to-ws",
        user_session_id: Date.now(),
      })
    );
  });
}

async function startPipeline(ws) {
  const pipeline = new gstreamer.Pipeline(
    `filesrc location=${fileName} ! decodebin ! audioconvert ! audio/x-raw,channels=1 ! wavenc ! appsink name=sink`
  );

  const appsink = pipeline.findChild("sink");

  pipeline.pollBus((msg) => {
    // console.log(msg);
    if (msg.type === "eos") {
      console.log("end of stream");
      pipeline.stop();
      ws.close();
      process.exit(0);
    }
  });

  function onData(buf, caps) {
    if (buf) {
      console.log("OUTPUT BUFFER -> ", buf);
      ws.send(buf);
    }
    appsink.pull(onData);
  }

  appsink.pull(onData);
  pipeline.play();

  return pipeline;
}
