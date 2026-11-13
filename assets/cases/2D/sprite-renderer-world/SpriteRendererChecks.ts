import {
    _decorator, Camera, Color, Component, Director, director, Label, Layers, Node,
    RenderTexture, screen, Sorting, SpriteRenderer, Vec2, Vec3,
} from 'cc';

const { ccclass, property } = _decorator;
const sampleWidth = 800;
const sampleHeight = 500;
type RGB = [number, number, number];

function distance (a: RGB, b: RGB): number {
    return Math.max(...a.map((value, i) => Math.abs(value - b[i])));
}

@ccclass('SpriteRendererChecks')
export class SpriteRendererChecks extends Component {
    @property(Label)
    resultLabel!: Label;

    @property(Camera)
    captionCamera!: Camera;

    private probe: Camera | null = null;
    private target: RenderTexture | null = null;
    private passed = 0;
    private failures: string[] = [];
    public verdict: 'pending' | 'passed' | 'failed' = 'pending';

    protected onEnable () {
        this.fit();
        screen.on('window-resize', this.fit, this);
    }

    protected onDisable () {
        screen.off('window-resize', this.fit, this);
    }

    private fit () {
        const { width, height } = screen.windowSize;
        if (!width || !height || !this.captionCamera) return;
        const expand = Math.max(1, 1.6 * height / width);
        this.captionCamera.orthoHeight = 320 * expand;
        this.getComponent(Camera)!.fov = Math.atan(Math.tan(35 * Math.PI / 360) * expand) * 360 / Math.PI;
    }

    protected async start () {
        const camera = this.getComponent(Camera)!;
        const probeNode = new Node('Pixel checks');
        // Match the world camera, but exclude the captions from the sampled image.
        this.node.addChild(probeNode);
        const probe = probeNode.addComponent(Camera);
        const target = new RenderTexture();
        this.probe = probe;
        this.target = target;
        try {
            target.reset({ width: sampleWidth, height: sampleHeight });
            probe.targetTexture = target;
            probe.projection = Camera.ProjectionType.PERSPECTIVE;
            probe.fov = 35;
            probe.visibility = Layers.Enum.DEFAULT;
            probe.clearColor = camera.clearColor;
            probe.clearFlags = Camera.ClearFlag.SOLID_COLOR;

            switch (this.node.scene!.name) {
            case 'sprite-renderer-world': await this.world(); break;
            case 'sprite-renderer-draw-modes': await this.modes(); break;
            case 'sprite-renderer-resources': await this.resources(); break;
            default: throw new Error('Unknown SpriteRenderer test scene');
            }
        } catch (error) {
            if (this.isValid) this.failures.push(String(error));
        } finally {
            if (probe.isValid) {
                probe.enabled = false;
                probe.targetTexture = null;
            }
            if (probeNode.isValid) probeNode.destroy();
            target.destroy();
            this.target = null;
            this.probe = null;
        }
        if (!this.isValid || !this.resultLabel.isValid) return;
        if (this.failures.length) {
            this.verdict = 'failed';
            this.resultLabel.color = new Color(255, 145, 120);
            this.resultLabel.string = '未通过  ·  ' + this.failures.join(' / ');
            console.error(this.node.scene!.name, this.resultLabel.string);
        } else {
            this.verdict = 'passed';
            this.resultLabel.string = '自动验收通过  ·  ' + this.passed + ' 项';
        }
    }

    private check (name: string, value: boolean) {
        if (value) ++this.passed;
        else this.failures.push(name);
    }

    private object (name: string): Node {
        const node = this.node.scene!.getChildByName(name);
        if (!node) throw new Error('Missing test node: ' + name);
        return node;
    }

    private sprite (name: string): SpriteRenderer {
        return this.object(name).getComponent(SpriteRenderer)!;
    }

    private async capture (): Promise<Uint8Array> {
        // Changes issued after a draw reach the queue on the next frame.
        await new Promise<void>(resolve => director.once(Director.EVENT_AFTER_DRAW, resolve));
        await new Promise<void>(resolve => director.once(Director.EVENT_AFTER_DRAW, resolve));
        if (!this.isValid) throw new Error('Scene closed');
        const pixels = this.target!.readPixels();
        if (!pixels) throw new Error('GPU readback unavailable');
        return pixels;
    }

    private sample (image: Uint8Array, node: Node, x = 0, y = 0): RGB {
        const world = Vec3.transformMat4(new Vec3(), new Vec3(x, y, 0), node.worldMatrix);
        const pixel = this.probe!.worldToScreen(world);
        const px = Math.floor(pixel.x);
        const py = Math.floor(pixel.y);
        if (px < 0 || px >= sampleWidth || py < 0 || py >= sampleHeight) throw new Error('Sample outside target');
        const i = (py * sampleWidth + px) * 4;
        return [image[i], image[i + 1], image[i + 2]];
    }

    private async world () {
        const glider = this.sprite('Depth glider');
        const sphere = this.object('Depth sphere');
        const transparent = this.sprite('Blue last glider');
        const sorting = transparent.getComponent(Sorting)!;
        const z = glider.node.position.z;
        const order = sorting.sortingOrder;
        try {
            const both = await this.capture();
            sphere.active = false;
            const spriteOnly = await this.capture();
            sphere.active = true;
            glider.enabled = false;
            const sphereOnly = await this.capture();
            glider.enabled = true;
            // Both points are inside the glider. At the center the sphere is closer;
            // toward the wing, the curved surface recedes behind the sprite.
            const center = (img: Uint8Array) => this.sample(img, glider.node);
            const wing = (img: Uint8Array) => this.sample(img, glider.node, .54);
            this.check('球体遮挡中心', distance(center(both), center(sphereOnly)) < 8 && distance(center(both), center(spriteOnly)) > 30);
            this.check('精灵遮挡球面边缘', distance(wing(both), wing(spriteOnly)) < 8 && distance(wing(both), wing(sphereOnly)) > 30);
            glider.node.setPosition(glider.node.position.x, glider.node.position.y, 1.65);
            const forward = await this.capture();
            // Perspective changes the projected sample when the node moves.
            // Take the glider-only reference at the same transformed position.
            sphere.active = false;
            const forwardOnly = await this.capture();
            sphere.active = true;
            this.check('前移后解除遮挡', distance(center(forward), center(forwardOnly)) < 8
                && distance(center(forward), this.sample(sphereOnly, sphere)) > 30);
            const overlap = (img: Uint8Array) => this.sample(img, transparent.node);
            const blueLast = overlap(both);
            sorting.sortingOrder = 1;
            const spriteLast = overlap(await this.capture());
            const reference = this.sample(both, this.object('Sprite last glider'));
            this.check('透明对象排序', spriteLast[0] > blueLast[0] + 25 && blueLast[2] > spriteLast[2] + 15);
            this.check('透明混合参照', distance(spriteLast, reference) < 18 && spriteLast[2] > 20);
        } finally {
            if (sphere.isValid) sphere.active = true;
            if (glider.isValid) {
                glider.enabled = true;
                glider.node.setPosition(glider.node.position.x, glider.node.position.y, z);
            }
            if (sorting.isValid) sorting.sortingOrder = order;
        }
    }

    private async modes () {
        const simple = this.sprite('Simple');
        const sliced = this.sprite('Sliced');
        const continuous = this.sprite('Continuous');
        const adaptive = this.sprite('Adaptive');
        const size = sliced.size.clone();
        const threshold = adaptive.adaptiveModeThreshold;
        const indexCount = (r: SpriteRenderer) => r.model?.subModels[0]?.inputAssembler?.indexCount ?? 0;
        try {
            const baseline = await this.capture();
            this.check('Simple 自然尺寸', indexCount(simple) === 6 && Math.abs(simple.size.x - .96) < .001);
            this.check('九宫格', indexCount(sliced) === 54 && indexCount(continuous) > 54);
            let differences = 0;
            for (let x = -1.35; x < 1.4; x += .06) {
                for (let y = -.38; y < .4; y += .07) {
                    if (distance(this.sample(baseline, continuous.node, x, y), this.sample(baseline, adaptive.node, x, y)) > 25) ++differences;
                }
            }
            this.check('裁剪与完整铺块', differences > 20);
            const previous = indexCount(adaptive);
            adaptive.adaptiveModeThreshold = 1;
            await this.capture();
            this.check('Adaptive 阈值', indexCount(adaptive) > 0 && indexCount(adaptive) < previous);
            sliced.size = new Vec2(.12, size.y);
            await this.capture();
            this.check('窄尺寸压缩边框', indexCount(sliced) === 36);
            sliced.size = new Vec2(0, size.y);
            await this.capture();
            this.check('零尺寸隐藏', !sliced.model?.enabled);
            sliced.size = size;
            const restored = await this.capture();
            this.check('恢复尺寸', indexCount(sliced) === 54 && distance(this.sample(restored, sliced.node), this.sample(baseline, sliced.node)) < 8);
        } finally {
            if (sliced.isValid) sliced.size = size;
            if (adaptive.isValid) adaptive.adaptiveModeThreshold = threshold;
        }
    }

    private async resources () {
        const original = this.sprite('Original');
        const mirror = this.sprite('Flip X');
        const tinted = this.sprite('Flip Y tint');
        const centered = this.sprite('Center');
        const corner = this.sprite('Corner');
        const upright = this.object('Upright');
        const packed = this.object('Packed');
        const panel = this.sprite('Swap');
        const source = panel.spriteFrame;
        const tint = tinted.color.clone();
        try {
            const baseline = await this.capture();
            const a = centered.model!.modelBounds!;
            const b = corner.model!.modelBounds!;
            this.check('PPU 与支点', Math.abs(a.halfExtents.x - .48) < .001 && Math.abs(a.center.x) < .001
                && Math.abs(b.halfExtents.x - .24) < .001 && Math.abs(b.center.x - .24) < .001 && Math.abs(b.center.y - .16) < .001);
            let matches = 0;
            let visible = 0;
            let samples = 0;
            for (let i = -4; i <= 4; ++i) {
                for (let j = -5; j <= 5; ++j) {
                    const u = this.sample(baseline, upright, i * .045, j * .045);
                    const p = this.sample(baseline, packed, i * .045, j * .045);
                    if (distance(u, p) < 18) ++matches;
                    if (u[0] > 100) ++visible;
                    ++samples;
                }
            }
            this.check('旋转图集帧', visible > 15 && matches / samples > .88);
            // The salmon corner marker is off-center in both axes.
            const marker = this.sample(baseline, original.node, -.32, .17);
            this.check('水平翻转', distance(marker, this.sample(baseline, mirror.node, .32, .17)) < 15
                && distance(marker, this.sample(baseline, mirror.node, -.32, .17)) > 30);
            tinted.color = Color.WHITE;
            const white = await this.capture();
            this.check('垂直翻转', distance(marker, this.sample(white, tinted.node, -.32, -.17)) < 15
                && distance(marker, this.sample(white, tinted.node, -.32, .17)) > 30);
            this.check('实例着色隔离', original.sharedMaterial === tinted.sharedMaterial
                && distance(this.sample(white, tinted.node), this.sample(baseline, tinted.node)) > 20
                && distance(this.sample(white, original.node), this.sample(baseline, original.node)) < 8);
            const size = panel.size;
            panel.spriteFrame = corner.spriteFrame;
            await this.capture();
            this.check('换帧保持尺寸', panel.size.equals(size) && panel.model!.modelBounds!.center.x > 1);
            panel.spriteFrame = null;
            await this.capture();
            const cleared = !panel.model?.enabled;
            panel.spriteFrame = source;
            const restored = await this.capture();
            this.check('解绑再恢复', cleared && !!panel.model?.enabled
                && distance(this.sample(restored, panel.node), this.sample(baseline, panel.node)) < 8);
        } finally {
            if (tinted.isValid) tinted.color = tint;
            if (panel.isValid) panel.spriteFrame = source;
        }
    }
}
