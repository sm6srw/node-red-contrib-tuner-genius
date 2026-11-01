const helper = require("node-red-node-test-helper");
const server = require("../tuner-genius-server.js");
const status = require("../tuner-genius-status.js");
const control = require("../tuner-genius-control.js");

helper.init(require.resolve("node-red"));

describe("nodes", () => {
    beforeEach(() => helper.startServer());
    afterEach(async () => { await helper.unload(); await helper.stopServer(); });

    test("load", async () => {
        const flow = [
            { id: "s", type: "tuner-genius-server", host: "127.0.0.1", port: 1, autoConnect: false },
            { id: "st", type: "tuner-genius-status", server: "s" },
            { id: "c", type: "tuner-genius-control", server: "s" },
        ];
        await helper.load([server, status, control], flow);
        expect(helper.getNode("st")).toBeDefined();
        expect(helper.getNode("c")).toBeDefined();
    });

    describe("control node", () => {
        const load = async (cfg) => {
            await helper.load([server, control], [
                { id: "s", type: "tuner-genius-server", host: "127.0.0.1", port: 1, autoConnect: false },
                { id: "c", type: "tuner-genius-control", server: "s", ...cfg },
            ]);
            const srv = helper.getNode("s");
            const calls = [];
            srv.command = (cmd) => { calls.push(cmd); return Promise.resolve(""); };
            return { calls, node: helper.getNode("c") };
        };
        const tick = () => new Promise((r) => setTimeout(r, 20));

        test("a fixed action wins over msg.topic", async () => {
            const { calls, node } = await load({ action: "operate" });
            node.receive({ topic: "swr", payload: 1 });
            await tick();
            expect(calls).toEqual(["operate set=1"]);
        });

        test("msg.topic is used when no action is fixed", async () => {
            const { calls, node } = await load({ action: "" });
            node.receive({ topic: "bypass", payload: "off" });
            await tick();
            expect(calls).toEqual(["bypass set=0"]);
        });
    });

    describe("status node", () => {
        const tick = () => new Promise((r) => setTimeout(r, 20));
        const load = async (cfg) => {
            await helper.load([server, status], [
                { id: "s", type: "tuner-genius-server", host: "127.0.0.1", port: 1, autoConnect: false },
                { id: "st", type: "tuner-genius-status", server: "s", wires: [["h"]], ...cfg },
                { id: "h", type: "helper" },
            ]);
            const out = [];
            helper.getNode("h").on("input", (m) => out.push(m));
            return { out, srv: helper.getNode("s"), node: helper.getNode("st") };
        };

        test("single property only emits changes", async () => {
            const { out, srv } = await load({ property: "swr" });
            const emit = (s) => srv.updatesEventEmitter.emit("status", s);
            emit({ swr: 1.5, fwd: 10 });
            emit({ swr: 1.5, fwd: 11 });
            emit({ swr: 2, fwd: 11 });
            emit({ fwd: 12 });
            await tick();
            expect(out.map((m) => [m.topic, m.payload, m.previous])).toEqual([
                ["swr", 1.5, undefined],
                ["swr", 2, 1.5],
            ]);
        });

        test("emits every update when onlyChange is off", async () => {
            const { out, srv } = await load({ property: "swr", onlyChange: false });
            srv.updatesEventEmitter.emit("status", { swr: 1 });
            srv.updatesEventEmitter.emit("status", { swr: 1 });
            await tick();
            expect(out).toHaveLength(2);
        });

        test("deadband ignores small numeric changes", async () => {
            const { out, srv } = await load({ property: "fwd", deadband: 1 });
            for (const fwd of [10, 10.4, 10.9, 11, 9.5]) srv.updatesEventEmitter.emit("status", { fwd });
            await tick();
            expect(out.map((m) => m.payload)).toEqual([10, 11, 9.5]);
        });

        test("all mode emits the object when anything changes", async () => {
            const { out, srv } = await load({ property: "*" });
            srv.updatesEventEmitter.emit("status", { fwd: 1 });
            srv.updatesEventEmitter.emit("status", { fwd: 1 });
            srv.updatesEventEmitter.emit("status", { fwd: 2 });
            await tick();
            expect(out.map((m) => m.payload)).toEqual([{ fwd: 1 }, { fwd: 2 }]);
            await tick();
            expect(out[0].topic).toBe("status");
        });

        test("unset property behaves like all", async () => {
            const { out, srv } = await load({});
            srv.updatesEventEmitter.emit("status", { fwd: 1 });
            await tick();
            expect(out[0].payload).toEqual({ fwd: 1 });
        });

        test("input re-emits the cached value and reconnect resets the filter", async () => {
            const { out, srv, node } = await load({ property: "state" });
            srv.status = { state: 1 };
            srv.updatesEventEmitter.emit("status", { state: 1 });
            node.receive({ payload: "" });
            await tick();
            expect(out.map((m) => m.payload)).toEqual([1, 1]);
            srv.updatesEventEmitter.emit("closed");
            srv.updatesEventEmitter.emit("status", { state: 1 });
            await tick();
            expect(out).toHaveLength(3);
        });
    });
});
