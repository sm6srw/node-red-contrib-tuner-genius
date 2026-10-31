module.exports = (RED) => {
    class TunerGeniusStatus {
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
            const onStatus = (status) => {
                this.send({ topic: "status", payload: status });
            };

            emitter.on("connected", onConnected);
            emitter.on("closed", onClosed);
            emitter.on("status", onStatus);

            this.on("input", (msg, send, done) => {
                this.server.resendStatus();
                if (done) done();
            });

            this.on("close", () => {
                emitter.removeListener("connected", onConnected);
                emitter.removeListener("closed", onClosed);
                emitter.removeListener("status", onStatus);
            });

            this.server.connect();
        }
    }
    RED.nodes.registerType("tuner-genius-status", TunerGeniusStatus);
};
