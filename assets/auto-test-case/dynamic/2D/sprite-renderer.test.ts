import { director } from 'cc';
// @ts-ignore The automation extension provides this virtual module.
import { runScene, testCase, testClass, waitForNextFrame } from 'db://automation-framework/runtime/test-framework.mjs';
import { SpriteRendererChecks } from '../../../cases/2D/sprite-renderer-world/SpriteRendererChecks';

async function expectSceneToPass () {
    const scene = director.getScene()!;
    const checks = scene.getComponentInChildren(SpriteRendererChecks);
    if (!checks) throw new Error(scene.name + ': missing SpriteRendererChecks');
    for (let frame = 0; frame < 120 && checks.verdict === 'pending'; ++frame) {
        await waitForNextFrame();
    }
    if (checks.verdict !== 'passed') {
        throw new Error(scene.name + ': ' + checks.resultLabel.string);
    }
}

@runScene('sprite-renderer-world')
@testClass('SpriteRendererWorldSpace')
export class SpriteRendererWorldSpace {
    @testCase
    async depthAndBlending () { await expectSceneToPass(); }
}

@runScene('sprite-renderer-draw-modes')
@testClass('SpriteRendererDrawModes')
export class SpriteRendererDrawModes {
    @testCase
    async drawModes () { await expectSceneToPass(); }
}

@runScene('sprite-renderer-resources')
@testClass('SpriteRendererResources')
export class SpriteRendererResources {
    @testCase
    async framesAndInstances () { await expectSceneToPass(); }
}
