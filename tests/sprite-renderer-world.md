# SpriteRenderer 自动验收

使用包含 [cocos/cocos4#396](https://github.com/cocos/cocos4/pull/396) 的引擎。三个场景位于 `assets/cases/2D/sprite-renderer-world/`。单独预览任一场景，组件会在首批渲染帧内自动执行检查，恢复展示状态，并用 Label 显示通过数或失败项。场景中所有测试对象均可在 Creator 检查器中查看。

| 场景 | 观察内容 | 自动判定 |
| --- | --- | --- |
| `sprite-renderer-world.scene` | 透视相机俯视带光照的内置球体和圆柱台。飞行标记横穿球体，球面中央遮住机身，靠近轮廓处机身露出。中、右两组用蓝色透明球对比绘制顺序。 | 5 项。采样组合画面及球体、精灵各自单独绘制的画面，对比中心与边缘；前移精灵解除遮挡；切换 Sorting Order，比对同组像素和另一组的混合颜色。 |
| `sprite-renderer-draw-modes.scene` | 同一张箭头纹理展示 Simple、Sliced、Tiled Continuous 与 Tiled Adaptive。 | 7 项。检查自然尺寸、九宫格、末块裁剪与完整铺块的像素差异、Adaptive 阈值、窄尺寸边框压缩、零尺寸隐藏与正尺寸恢复。 |
| `sprite-renderer-resources.scene` | 对照独立着色与翻转、100/200 PPU 及支点、普通与旋转打包帧、显式尺寸面板。 | 7 项。检查 PPU 和 Pivot 对包围盒的影响、图集取样、X/Y 翻转、共享材质实例隔离、换帧保留尺寸、解绑和重新绑定后的画面。 |

**批量运行。** 三个场景已登记在 `assets/auto-test-config.json`。使用项目已有的 automation-framework 启动测试，并将三个场景纳入测试构建。入口为 `assets/auto-test-case/dynamic/2D/sprite-renderer.test.ts`。框架逐场读取相同的验收结果，遇到失败或等待超时会报告对应场景，无需在检查器中调参数。单场预览也可独立执行，无需启动测试服务。

世界对象均由透视相机绘制。单独的 UI 相机只绘制引擎 Label。像素检查临时创建同位置的透视相机和 800 × 500 的离屏目标，在绘制结束后读回世界对象的颜色。完成后释放该目标。透明对照检查对象级排序。记录的图形验收环境为 Web Legacy Forward 和 Web Custom。
