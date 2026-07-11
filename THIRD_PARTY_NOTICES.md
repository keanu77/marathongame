# 第三方軟體聲明

本專案本身依根目錄的 [MIT License](./LICENSE) 授權。第三方套件仍分別受其原始授權條款約束；本專案的授權不會取代或變更第三方授權。

以下列出目前正式瀏覽器程式的直接執行期相依套件，以及經本機安裝內容核對的傳遞相依套件。測試、建置與部署工具不會成為瀏覽器正式 bundle 的執行期程式碼，其版本可查閱 `pnpm-lock.yaml`，授權則以各套件隨附的授權檔為準。重新發佈本專案或修改相依版本時，仍應重新進行完整授權稽核。

## Phaser 3.90.0

- 專案：Phaser
- 網站：<https://phaser.io/>
- 原始碼：<https://github.com/phaserjs/phaser>
- 授權：MIT
- 本機核對來源：`node_modules/.pnpm/phaser@3.90.0/node_modules/phaser/LICENSE.md`

```text
The MIT License (MIT)

Copyright (c) 2024 Richard Davey, Phaser Studio Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

## EventEmitter3 5.0.4

EventEmitter3 是目前 Phaser 的傳遞相依套件。

- 專案：EventEmitter3
- 原始碼：<https://github.com/primus/eventemitter3>
- 授權：MIT
- 本機核對來源：`node_modules/.pnpm/eventemitter3@5.0.4/node_modules/eventemitter3/LICENSE`

```text
The MIT License (MIT)

Copyright (c) 2014 Arnout Kazemier

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
