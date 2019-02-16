# 🌍 DC-Collab for VSCode

## 🔮 How open Collab manager?

## 🖥 Hosting workspace

### Automatic

> Automatic installation is only available for local or ssh installation.

1. Open collab manager
2. Press `[🛠 Configure workspace]` button
3. Just follow instructions
4. DONE!

### Manual

1. Download or clone [dc-collab-server](https://github.com/DimaCrafter/dc-collab-server) repository to your server.
2. Install Node.JS 8.0+ ([for Linux from NodeSource repo](https://github.com/nodesource/distributions/blob/master/README.md),
   [for other platfroms from Node.JS site](https://nodejs.org/en/download/)).
3. Install dependencies: `npm i` or `yarn`.
4. Register service: `node ./dc-collab-server/setup.js register-service`.
5. Start service: `systemctl start dc-collab-server` or `service dc-collab-server start`.
6. DONE!

---

## 📜 Change log

* v0.1.5
  * Refactoring
  * Now using GitHub for identification ([dc-collab-auth](https://github.com/DimaCrafter/dc-collab-auth) on Heroku)
  * Added workspace hosting instructions
  * Fixes
  * Redesign
* v0.1.4
  * Now using TCP sockets
* v0.1.3
  * Small fixes
* v0.1.2 (required patch of v0.1.1)
  * Collab Manager moved to webview
  * Added cursor color picker
* v0.1.0
  * Now this isn't breaks vscode!
  * Added emoji before extension name
* v0.0.10
  * Added many cool things
* v0.0.9 and lower
  * History was successfully losted
