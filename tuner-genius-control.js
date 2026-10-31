module.exports = (RED) => {
    class TunerGeniusControl {
        constructor(config) {
            RED.nodes.createNode(this, config);
            this.server = RED.nodes.getNode(config.server);

            if (this.server == null) {
                this.status({ fill: "red", shape: "ring", text: "disconnected" });
                return;
            }

            const emitter = this.server.updatesEventEmitter;
            const onConnected = () => {
                this.status({ fill: "green", shape: "dot", text: this.server.info.name || "connected" });
            };
            const onClosed = () => {
                this.status({ fill: "red", shape: "ring", text: "disconnected" });
            };
            emitter.on("connected", onConnected);
            emitter.on("closed", onClosed);

            this.on("close", () => {
                emitter.removeListener("connected", onConnected);
                emitter.removeListener("closed", onClosed);
            });

            this.on("input", async (msg, send, done) => {
                const action = String(msg.topic || config.action || "").toLowerCase();
                const on = msg.payload === true || msg.payload === 1 || msg.payload === "1" ||
                    String(msg.payload).toLowerCase() === "on";
                try {
                    switch (action) {
                        case "operate":
                            await this.server.setOperate(on);
                            break;
                        case "bypass":
                            await this.server.setBypass(on);
                            break;
                        case "activate": {
                            const ant = parseInt(msg.payload, 10);
                            if (![1, 2, 3].includes(ant)) {
                                throw new Error("payload must be antenna 1, 2 or 3");
                            }
                            await this.server.activateAntenna(ant);
                            break;
                        }
                        case "autotune":
                            await this.server.autotune();
                            break;
                        default:
                            throw new Error("topic must be one of: operate, bypass, activate, autotune");
                    }
                    if (done) done();
                } catch (err) {
                    this.status({ fill: "red", shape: "ring", text: err.message });
                    if (done) done(err); else this.error(err, msg);
                }
            });

            this.server.connect();
        }
    }
    RED.nodes.registerType("tuner-genius-control", TunerGeniusControl);
};
