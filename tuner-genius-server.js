const Net = require("net");
const EventEmitter = require("events");
const { GeniusV4Protocol, parseInfo, parseTuner } = require("./GeniusV4Protocol");

class UpdatesEventEmitter extends EventEmitter {}

module.exports = (RED) => {
    class TunerGeniusServerNode {
        constructor(n) {
            RED.nodes.createNode(this, n);
            this.host = n.host;
            this.port = n.port;
            this.autoConnect = n.autoConnect || false;

            this.status = {};
            this.info = {};
            this.timer = null;
            this._v4 = null;
            this._dataHandler = null;

            this.updatesEventEmitter = new UpdatesEventEmitter();
            this.updatesEventEmitter.setMaxListeners(0);

            this.client = new Net.Socket();
            this.connected = false;

            this.client.on("close", () => {
                this.log("TCP connection disconnected with the server.");
                clearTimeout(this.timer);
                this.connected = false;
                this._detach();

                if (this.updatesEventEmitter.listenerCount("closed") == 0) {
                    this.log("Stop retrying. No nodes are refering this connection anymore.");
                    return;
                }

                if (this.autoConnect) {
                    this.log("Will try to reconnect in 5 seconds");
                    this.timer = setTimeout(() => this.connect(), 5000);
                    this.updatesEventEmitter.emit("closed");
                }
            });

            this.client.on("connect", async () => {
                this.log("TCP connection established with the server.");
                this.connected = true;
                try {
                    await this._connectV4();
                } catch (err) {
                    this.warn("Connection setup failed: " + err.message);
                }
            });

            this.client.on("error", (err) => {
                this.warn(err);
            });

            this.on("close", (done) => {
                clearTimeout(this.timer);
                this.autoConnect = false;
                this.connected = false;
                this._detach();
                this.client.end();
                done();
            });
        }

        _detach() {
            if (this._dataHandler) {
                this.client.removeListener("data", this._dataHandler);
                this._dataHandler = null;
            }
            this._v4 = null;
        }

        _applyTuner(tuner) {
            const { tunerNum, ...rest } = tuner;
            this.status = { ...this.status, ...rest };
        }

        async _connectV4() {
            const v4 = new GeniusV4Protocol(this.client);
            this._v4 = v4;
            this._dataHandler = (chunk) => v4.handleData(chunk);
            this.client.on("data", this._dataHandler);

            this.info = parseInfo(await v4.sendCommand("info get", 3000));
            this._applyTuner(parseTuner(await v4.sendCommand("tuner get 1", 3000)));

            v4.onStatus((msg) => {
                if (msg.startsWith("tuner ")) {
                    this._applyTuner(parseTuner(msg));
                    this.updatesEventEmitter.emit("status", { ...this.status });
                }
            });

            try {
                await v4.sendCommand("sub tuner all", 1000);
            } catch (err) {
                if (err.code !== "ETIMEDOUT") throw err;
            }

            if (this._v4 !== v4 || !this.connected) return;

            this.updatesEventEmitter.emit("connected");
            this.updatesEventEmitter.emit("status", { ...this.status });
        }

        // Send a command to the tuner. Resolves with the reply message.
        command(cmd) {
            if (!this._v4) {
                return Promise.reject(new Error("not connected"));
            }
            return this._v4.sendCommand(cmd, 5000);
        }

        setOperate(on) {
            return this.command(`tuner set 1 operate=${on ? 1 : 0}`);
        }

        setBypass(on) {
            return this.command(`tuner set 1 bypass=${on ? 1 : 0}`);
        }

        tune() {
            return this.command("tuner tune 1");
        }

        connect() {
            if (this.autoConnect && !this.connected && !this.client.connecting) {
                this.client.connect(this.port, this.host);
            }
        }

        resendStatus() {
            if (this.connected && this.info.name !== undefined) {
                this.updatesEventEmitter.emit("status", { ...this.status });
            }
        }
    }

    RED.nodes.registerType("tuner-genius-server", TunerGeniusServerNode);
};
