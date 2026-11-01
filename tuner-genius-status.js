module.exports = (RED) => {
    class TunerGeniusStatus {
        constructor(config) {
            RED.nodes.createNode(this, config);
            this.server = RED.nodes.getNode(config.server);

            if (this.server == null) {
                this.status({ fill: "red", shape: "ring", text: "disconnected" });
                return;
            }

            // "*" (or unset, for nodes created before the property option) emits the whole status object.
            const property = config.property && config.property !== "*" ? config.property : null;
            const onlyChange = config.onlyChange !== false && config.onlyChange !== "false";
            const deadband = Math.max(parseFloat(config.deadband) || 0, 0);
            let last;

            const changed = (value) => {
                if (last === undefined) return true;
                if (deadband > 0 && typeof value === "number" && typeof last === "number") {
                    return Math.abs(value - last) >= deadband;
                }
                return value !== last;
            };

            const emit = (status, force) => {
                if (property === null) {
                    const snapshot = JSON.stringify(status);
                    if (force || !onlyChange || snapshot !== last) {
                        last = snapshot;
                        this.send({ topic: "status", payload: status });
                    }
                    return;
                }
                if (!(property in status)) return;
                const value = status[property];
                if (force || !onlyChange || changed(value)) {
                    const previous = last;
                    last = value;
                    this.send({ topic: property, payload: value, previous });
                }
            };

            const emitter = this.server.updatesEventEmitter;

            const onConnected = () => {
                this.status({ fill: "green", shape: "dot", text: this.server.info.name || "connected" });
            };
            const onClosed = () => {
                last = undefined;
                this.status({ fill: "red", shape: "ring", text: "disconnected" });
            };
            const onStatus = (status) => emit(status, false);

            emitter.on("connected", onConnected);
            emitter.on("closed", onClosed);
            emitter.on("status", onStatus);

            // Any input emits the last known value regardless of the change filter, then refreshes from the device.
            this.on("input", (msg, send, done) => {
                if (Object.keys(this.server.status).length > 0) {
                    emit({ ...this.server.status }, true);
                }
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
