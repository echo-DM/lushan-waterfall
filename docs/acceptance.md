# 《望庐山瀑布》验收记录

日期：2026-10-13。最终完整生产验收完成于 19:43（Asia/Shanghai）；原始时间见 [qa-results.json](qa-results.json)。

## 运行与覆盖

- 技术栈：React 19.3、Three.js 0.180、TypeScript 5.9.3、Vite 7.3.7。
- `pnpm check`：通过严格 TypeScript 检查。
- `pnpm build`：通过类型检查和生产构建。
- 实际打开生产服务 `http://127.0.0.1:4173/`，等待成功首帧和加载提示消失后执行验收。
- `pnpm qa http://127.0.0.1:4173`：31 项检查全部通过。
- 另实际打开开发页面 `http://127.0.0.1:4185/`，确认 React StrictMode 重复挂载后仍只有一个画布、场景成功绘制，页面错误与控制台错误为空；此项独立于生产验收的 31 项。
- 浏览器：agent-browser 独立 Chromium 会话；桌面 1440 × 900、1280 × 800；手机使用 iPhone 15 模拟配置，将画幅设为 390 × 844。
- 单指与双指输入由该会话的 CDP 发送，属于模拟触控。真实手机、Safari 和 Firefox 尚未验证。

## 镜头与操作

| 范围 | 实际结果 |
| --- | --- |
| 首帧、加载与场景复用 | 全景先进入；首帧成功后提示消失。逐句切换、尺寸变化和恢复后始终只有一个画布。 |
| 四句镜头 | 桌面和模拟手机分别逐句点击并截图；导航选中项与场景 ID 一致。峰顶紫烟、整条悬瀑、落水深潭与仰望瀑顶均可辨认，预设镜头未被前景树木遮挡。 |
| 快速连续选择 | 最后选择的诗句成为最终目标；飞行从当前位置开始。 |
| 拖动中断 | 鼠标按下结束正在进行的飞行，随后能自由环顾。 |
| 拖动中选句 | 拖动时按数字快捷键，松开后抵达新诗句对应视角。 |
| 仰望切回远景 | 从第四句切回第一句时未检出起点突跳，转场正常结束；向上观察不会被极角限制夹回俯视。 |
| 重选与全景 | 拖动后再次选中当前诗句可恢复预设镜头；返回全景清除诗句选中状态。 |
| 缩放 | 指定画布坐标的真实浏览器滚轮事件改变相机距离；模拟双指缩放也改变距离。 |
| 手机触控 | 模拟单指拖动改变观察方向，双指缩放改变距离；四句入口均可滚动到达并点击。 |
| 响应式布局 | 两个桌面尺寸和手机画幅均无横向溢出；手机诗句按钮高度超过 44px。 |
| 键盘 | Tab/Enter、上下方向键、End、数字选句及全景快捷键通过检查，方向键选择同步更新焦点。 |
| 暂停 | 动画时间保持不变，暂停期间仍能选句和移动镜头；恢复后动画时间继续增加。 |
| 减少动态 | 手动开关和系统偏好均静止景物、直接切换镜头，暂停按钮同步显示静止状态。 |
| 图形连接中断 | 使用 `WEBGL_lose_context` 实际中断连接；完整诗文保留，恢复按钮重新初始化后可继续导航。 |
| 图形初始化不可用 | 恢复时临时令新 WebGL 上下文创建失败，实际触发初始化失败界面；四句和题名仍可阅读。还原图形能力后再次进入成功。 |
| 最终错误检查 | 正常页面的 JavaScript 错误和控制台错误均为空。图形失败注入产生的预期 Three.js 错误单独保存在验收 JSON 中，恢复前清除该预期日志后复查正常运行。 |

首轮检查发现数字快捷键会反复重启镜头；已稳定键盘监听并忽略按键重复。截图检查后调整了第一、三句构图、紫烟色彩、崖壁层次和小字对比度。最终完整验收使用这些修改后的生产文件。

安装的浏览器 CLI 未将滚轮送到画布，也未自动滚动到手机画幅外的按钮。脚本为滚轮明确指定画布坐标，选句前滚动到可见位置；这些情况已与页面实际行为区分。

## 可读性

桌面和模拟手机各运行一次 axe-core WCAG A/AA 检查，均未检出违规。详见 [accessibility-results.json](accessibility-results.json)。画布上的文字与渐变叠层对比度有自动检查未决项，已结合截图观察；这不等于完整无障碍认证。

## 截图

| 视角 | 桌面 | 模拟手机 |
| --- | --- | --- |
| 山水全景 | [1440 × 900](screenshots/overview-desktop.png)、[1280 × 800](screenshots/overview-desktop-1280.png) | [全页](screenshots/overview-mobile.png) |
| 日照香炉生紫烟， | [峰顶紫烟](screenshots/purple-mist-desktop.png) | [峰顶紫烟](screenshots/purple-mist-mobile.png) |
| 遥看瀑布挂前川。 | [山谷远眺](screenshots/hanging-waterfall-desktop.png) | [山谷远眺](screenshots/hanging-waterfall-mobile.png) |
| 飞流直下三千尺， | [瀑流深潭](screenshots/plunging-water-desktop.png) | [瀑流深潭](screenshots/plunging-water-mobile.png) |
| 疑是银河落九天。 | [崖下仰望](screenshots/silver-river-desktop.png) | [崖下仰望](screenshots/silver-river-mobile.png) |
| 图形错误提示 | — | [连接中断](screenshots/graphics-recovery-mobile.png)、[初始化不可用](screenshots/webgl-unavailable-mobile.png) |

## 原文与视觉解释

使用李白《望庐山瀑布二首》其二。原文依据[香港教育局参考版本](https://cd.edb.gov.hk/chi/resource/ncs/download/js_list/JS_wanglushanbaobu.pdf)，以简体字呈现，保留四句原有顺序与标点。

“三千尺”表现高度与气势；“银河”使用银白水流和日光微光承接比喻。松树、深潭、前景溪流和观景石属于连接场景的视觉补充。所有景物在同一坐标系中连续存在，镜头不会切换到另一套世界；地形属于诗意创作。

## 复查

```sh
pnpm install
pnpm check
pnpm build
pnpm preview --port 4173 --strictPort
```

另一个终端运行：

```sh
pnpm qa http://127.0.0.1:4173
```

脚本覆盖上述交互并更新截图和验收 JSON。多指输入和图形失败需支持 CDP 与 WebGL 的 Chromium。截图的视觉判断仍需人工复查。
