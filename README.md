# node-red-contrib-tuner-genius

Node-RED nodes for monitoring and operating a 4O3A Tuner Genius XL over its TCP API (port 9010).
Framing: `C<seq>|<command>` request, `R<seq>|<hex>|<message>` reply, `S<n>|status key=value ...` pushed status.

## Nodes

- **tuner-genius-server** (config): host, port (default 9010), auto connect.
- **tuner-genius-status**: emits `msg.payload` (object of `status` key/values such as `fwd`, `peak`, `swr`, `operate`, `bypass`, `bandA`, `antA`) on every change; any input reads and emits the current status.
- **tuner-genius-control**: `msg.topic` selects the action:
  - `operate` / `bypass`: payload true/1/"on" enables, anything else disables
  - `activate`: payload antenna 1-3
  - `autotune`

## Commands used

`status`, `operate set=<0|1>`, `bypass set=<0|1>`, `activate ant=<1-3>`, `autotune`.

Not yet supported: UDP discovery and `auth` (authentication is only required when connecting from outside the local network).

## Install

    npm install node-red-contrib-tuner-genius
