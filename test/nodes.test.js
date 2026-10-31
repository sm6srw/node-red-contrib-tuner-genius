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
});
