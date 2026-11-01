const Net = require("net");
const EventEmitter = require("events");
const { GeniusTGProtocol, parseKeyValues, parseStatus, parseBanner } = require("./GeniusTGProtocol");

class UpdatesEventEmitter extends EventEmitter {}

module.exports = (RED) => {
    class TunerGeniusServerNode {
        constructor(n) {
            RED.nodes.createNode(this, n);
            this.host = n.host;
            this.port = n.port;
            this.autoConnect = n.autoConnect || false;
            this.pollInterval = Math.max(parseInt(n.pollInterval, 10) || 0, 0);
            this.poller = null;
            this.threeWay = false;

            this.status = {};
            this.info = {};
            this.timer = null;
            this._protocol = null;
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
                this._stopPolling();

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
                    await this._setup();
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
                this._stopPolling();
                this.client.end();
                done();
            });
        }

        _detach() {
            if (this._dataHandler) {
                this.client.removeListener("data", this._dataHandler);
                this._dataHandler = null;
            }
            this._protocol = null;
        }

        _stopPolling() {
            clearInterval(this.poller);
            this.poller = null;
        }

        _startPolling() {
            this._stopPolling();
            if (!this.pollInterval) return;
            let busy = false;
            this.poller = setInterval(async () => {
                if (busy || !this._protocol) return;
                busy = true;
                try {
                    await this.resendStatus();
                } finally {
                    busy = false;
                }
            }, this.pollInterval);
        }

        _applyInfo(reply) {
            const info = parseKeyValues(reply);
            this.threeWay = info["3way"] === 1;
            this.info = {
                ...this.info,
                ...info,
                name: String(info.nickname || info.name || this.info.name || "").replace(/_/g, " "),
            };
        }

        async _setup() {
            const protocol = new GeniusTGProtocol(this.client);
            this._protocol = protocol;
            this._dataHandler = (chunk) => protocol.handleData(chunk);

            // The device sends "V<version>[ AUTH]" immediately after connecting.
            protocol.onBanner((line) => {
                this.info = { ...this.info, ...parseBanner(line) };
                if (this.info.authRequired) {
                    this.warn("Tuner Genius requires authentication, which is not supported yet.");
                }
            });
            // Unsolicited status: "S7|status fwd=... swr=..." (no subscription needed).
            protocol.onStatus((msg) => {
                this.trace("rx " + msg);
                if (msg.startsWith("status")) {
                    this.status = { ...this.status, ...parseStatus(msg) };
                    this.updatesEventEmitter.emit("status", { ...this.status });
                }
            });
            this.client.on("data", this._dataHandler);

            // "info" tells the SO2R and 3WAY variants apart (3way=1 on the latter).
            this._applyInfo(await protocol.sendCommand("info", 3000));
            this.status = { ...this.status, ...parseStatus(await protocol.sendStatusCommand(3000)) };

            if (this._protocol !== protocol || !this.connected) return;

            this._startPolling();

            this.updatesEventEmitter.emit("connected");
            this.updatesEventEmitter.emit("status", { ...this.status });
        }

        // Send a command to the tuner. Resolves with the reply message.
        command(cmd) {
            if (!this._protocol) {
                return Promise.reject(new Error("not connected"));
            }
            return this._protocol.sendCommand(cmd, 5000);
        }

        setOperate(on) {
            return this.command(`operate set=${on ? 1 : 0}`);
        }

        setBypass(on) {
            return this.command(`bypass set=${on ? 1 : 0}`);
        }

        // 3WAY units select an antenna (1-3), SO2R units select a channel (1-2).
        activate(n) {
            const max = this.threeWay ? 3 : 2;
            if (!Number.isInteger(n) || n < 1 || n > max) {
                return Promise.reject(new Error(`activate expects 1-${max}`));
            }
            return this.command(`activate ${this.threeWay ? "ant" : "ch"}=${n}`);
        }

        autotune() {
            return this.command("autotune");
        }

        connect() {
            if (this.autoConnect && !this.connected && !this.client.connecting) {
                this.client.connect(this.port, this.host);
            }
        }

        // Ask the device for the current status and emit it.
        async resendStatus() {
            if (!this._protocol) return;
            try {
                if (!this._protocol) return;
                this.status = { ...this.status, ...parseStatus(await this._protocol.sendStatusCommand(5000)) };
            } catch (err) {
                this.warn("Failed to read status: " + err.message);
                return;
            }
            this.updatesEventEmitter.emit("status", { ...this.status });
        }

        // Re-read the device info.
        async refreshInfo() {
            if (!this._protocol) return;
            try {
                this._applyInfo(await this._protocol.sendCommand("info", 5000));
            } catch (err) {
                this.warn("Failed to read info: " + err.message);
            }
        }
    }

    RED.nodes.registerType("tuner-genius-server", TunerGeniusServerNode);
};
